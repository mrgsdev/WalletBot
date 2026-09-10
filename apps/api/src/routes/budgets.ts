import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/asyncHandler.js';
import { budgetDto } from '../lib/serialize.js';
import {
  createBudget,
  deleteBudget,
  joinByCode,
  leaveBudget,
  listBudgets,
  loadBudget,
  removeMember,
  rotateInvite,
} from '../services/budgets.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { round2 } from '../services/currency.js';

export const budgetsRouter = Router();

budgetsRouter.get(
  '/',
  ah(async (req, res) => {
    const budgets = await listBudgets(req.user.id);
    res.json(budgets.map((b) => budgetDto(b, req.user.id)));
  }),
);

const createSchema = z.object({
  name: z.string().min(1).max(60),
  kind: z.enum(['personal', 'family']),
  icon: z.string().max(8).optional(),
  currency: z.string().length(3).optional(),
});

budgetsRouter.post(
  '/',
  ah(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Укажите название и тип бюджета');

    const budget = await createBudget(req.user.id, parsed.data);
    res.status(201).json(budgetDto(budget, req.user.id));
  }),
);

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  icon: z.string().max(8).optional(),
  monthlyLimit: z.number().min(0).nullable().optional(),
  limitCurrency: z.string().length(3).optional(),
});

/** Переименование бюджета и установка лимита на месяц. */
budgetsRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const membership = await prisma.budgetMember.findUnique({
      where: { budgetId_userId: { budgetId: id, userId: req.user.id } },
    });
    if (!membership) throw notFound('Бюджет не найден');

    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Проверьте название и лимит');

    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
    if (parsed.data.icon !== undefined) data.icon = parsed.data.icon;
    if (parsed.data.monthlyLimit !== undefined) {
      data.monthlyLimit = parsed.data.monthlyLimit === null ? null : round2(parsed.data.monthlyLimit);
    }
    if (parsed.data.limitCurrency !== undefined) {
      data.limitCurrency = parsed.data.limitCurrency.toUpperCase();
    }

    await prisma.budget.update({ where: { id }, data });
    res.json(budgetDto(await loadBudget(id), req.user.id));
  }),
);

/** Полное удаление бюджета: счета, операции и приглашение исчезают. */
budgetsRouter.delete(
  '/:id',
  ah(async (req, res) => {
    await deleteBudget(req.user.id, Number(req.params.id));
    res.json({ ok: true });
  }),
);

budgetsRouter.post(
  '/join',
  ah(async (req, res) => {
    const code = String(req.body?.code ?? '').trim();
    const budget = await joinByCode(req.user.id, code);
    res.json(budgetDto(budget, req.user.id));
  }),
);

budgetsRouter.post(
  '/:id/leave',
  ah(async (req, res) => {
    await leaveBudget(req.user.id, Number(req.params.id));
    res.json({ ok: true });
  }),
);

/** Исключение участника — только создателем. */
budgetsRouter.delete(
  '/:id/members/:userId',
  ah(async (req, res) => {
    await removeMember(req.user.id, Number(req.params.id), Number(req.params.userId));
    res.json({ ok: true });
  }),
);

budgetsRouter.post(
  '/:id/rotate-invite',
  ah(async (req, res) => {
    const budget = await rotateInvite(req.user.id, Number(req.params.id));
    res.json(budgetDto(budget, req.user.id));
  }),
);

/** Превращает личный бюджет в семейный, чтобы можно было пригласить близких. */
budgetsRouter.post(
  '/:id/share',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const budget = await prisma.budget.findUnique({ where: { id } });
    if (!budget) throw notFound('Бюджет не найден');
    if (budget.createdById !== req.user.id) throw forbidden('Только создатель может открыть доступ');
    if (budget.kind === 'family') return res.json(budgetDto(await loadBudget(id), req.user.id));

    const { generateInviteCode } = await import('../lib/telegram.js');
    await prisma.budget.update({
      where: { id },
      data: { kind: 'family', inviteCode: generateInviteCode() },
    });
    res.json(budgetDto(await loadBudget(id), req.user.id));
  }),
);
