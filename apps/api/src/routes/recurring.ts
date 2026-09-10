import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/asyncHandler.js';
import { accountWhere, categoryWhere } from '../services/scope.js';
import { badRequest, notFound } from '../lib/errors.js';

export const recurringRouter = Router();

recurringRouter.get(
  '/',
  ah(async (req, res) => {
    const items = await prisma.recurringPayment.findMany({
      where: { budgetId: req.scope.budgetId },
      include: {
        account: { select: { name: true, icon: true, currency: true } },
        category: { select: { name: true, icon: true, color: true } },
      },
      orderBy: [{ dayOfMonth: 'asc' }, { id: 'asc' }],
    });
    res.json(items);
  }),
);

const schema = z.object({
  title: z.string().min(1).max(60),
  accountId: z.number().int().positive(),
  categoryId: z.number().int().positive().nullable().optional(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  type: z.enum(['income', 'expense']).optional(),
  dayOfMonth: z.number().int().min(1).max(28),
  notifyTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

recurringRouter.post(
  '/',
  ah(async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Проверьте поля напоминания');
    const data = parsed.data;

    const account = await prisma.account.findFirst({
      where: { id: data.accountId, ...accountWhere(req.user, req.scope) },
    });
    if (!account) throw notFound('Счёт не найден');

    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, ...categoryWhere(req.user, req.scope) },
      });
      if (!category) throw notFound('Категория не найдена');
    }

    const created = await prisma.recurringPayment.create({
      data: {
        ownerUserId: req.user.id,
        budgetId: req.scope.budgetId,
        accountId: data.accountId,
        categoryId: data.categoryId ?? null,
        title: data.title,
        amount: data.amount,
        currency: data.currency.toUpperCase(),
        type: data.type ?? 'expense',
        dayOfMonth: data.dayOfMonth,
        notifyTime: data.notifyTime ?? '10:00',
      },
    });
    res.status(201).json(created);
  }),
);

recurringRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const item = await prisma.recurringPayment.findFirst({
      where: { id, ownerUserId: req.user.id },
    });
    if (!item) throw notFound('Напоминание не найдено');

    const body = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
    if (Number.isFinite(body.amount) && body.amount > 0) data.amount = body.amount;
    if (Number.isInteger(body.dayOfMonth) && body.dayOfMonth >= 1 && body.dayOfMonth <= 28) {
      data.dayOfMonth = body.dayOfMonth;
    }
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
    if (typeof body.notifyTime === 'string' && /^\d{2}:\d{2}$/.test(body.notifyTime)) {
      data.notifyTime = body.notifyTime;
    }
    if (typeof body.currency === 'string' && body.currency.length === 3) {
      data.currency = body.currency.toUpperCase();
    }
    if (Number.isInteger(body.accountId)) data.accountId = body.accountId;
    if (body.categoryId === null || Number.isInteger(body.categoryId)) {
      data.categoryId = body.categoryId;
    }

    res.json(await prisma.recurringPayment.update({ where: { id }, data }));
  }),
);

recurringRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const item = await prisma.recurringPayment.findFirst({
      where: { id, ownerUserId: req.user.id },
    });
    if (!item) throw notFound('Напоминание не найдено');
    await prisma.recurringPayment.delete({ where: { id } });
    res.json({ ok: true });
  }),
);
