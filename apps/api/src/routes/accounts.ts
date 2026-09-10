import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/asyncHandler.js';
import { accountDto } from '../lib/serialize.js';
import { accountWhere } from '../services/scope.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { recalcAccountBalance } from '../services/transactions.js';
import { round2 } from '../services/currency.js';

export const accountsRouter = Router();

accountsRouter.get(
  '/',
  ah(async (req, res) => {
    const includeArchived = req.query.includeArchived === 'true';
    const accounts = await prisma.account.findMany({
      where: {
        ...accountWhere(req.user, req.scope),
        ...(includeArchived ? {} : { isArchived: false }),
      },
      include: { owner: { select: { name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    res.json(accounts.map(accountDto));
  }),
);

const upsertSchema = z.object({
  name: z.string().min(1).max(40),
  icon: z.string().max(8).optional(),
  color: z.string().max(16).optional(),
  currency: z.string().length(3),
  initialBalance: z.number().optional(),
  isShared: z.boolean().optional(),
});

accountsRouter.post(
  '/',
  ah(async (req, res) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Проверьте название, валюту и баланс счёта');
    const data = parsed.data;

    const isFamily = req.scope.kind === 'family';
    const initial = round2(data.initialBalance ?? 0);

    const count = await prisma.account.count({ where: accountWhere(req.user, req.scope) });

    const account = await prisma.account.create({
      data: {
        ownerUserId: req.user.id,
        budgetId: req.scope.budgetId,
        name: data.name,
        icon: data.icon ?? '💳',
        color: data.color ?? '#6EC1FF',
        currency: data.currency.toUpperCase(),
        initialBalance: initial,
        balance: initial,
        // В личном бюджете участник один, поэтому счёт всегда общий.
        isShared: isFamily ? (data.isShared ?? true) : true,
        sortOrder: count,
      },
      include: { owner: { select: { name: true } } },
    });

    res.status(201).json(accountDto(account));
  }),
);

accountsRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const account = await prisma.account.findFirst({
      where: { id, ...accountWhere(req.user, req.scope) },
    });
    if (!account) throw notFound('Счёт не найден');
    if (account.ownerUserId !== req.user.id && !account.isShared) {
      throw forbidden('Редактировать может только владелец счёта');
    }

    const body = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (typeof body.icon === 'string') data.icon = body.icon;
    if (typeof body.color === 'string') data.color = body.color;
    if (typeof body.currency === 'string' && body.currency.length === 3) {
      data.currency = body.currency.toUpperCase();
    }
    if (typeof body.isShared === 'boolean' && req.scope.kind === 'family') data.isShared = body.isShared;
    if (typeof body.isArchived === 'boolean') data.isArchived = body.isArchived;
    if (Number.isFinite(body.initialBalance)) data.initialBalance = round2(body.initialBalance);

    const updated = await prisma.account.update({
      where: { id },
      data,
      include: { owner: { select: { name: true } } },
    });

    // Смена валюты или стартового остатка требует пересчёта баланса.
    if (data.currency !== undefined || data.initialBalance !== undefined) {
      await recalcAccountBalance(id);
    }

    const fresh = await prisma.account.findUnique({
      where: { id },
      include: { owner: { select: { name: true } } },
    });
    res.json(accountDto(fresh ?? updated));
  }),
);

accountsRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const account = await prisma.account.findFirst({
      where: { id, ...accountWhere(req.user, req.scope) },
    });
    if (!account) throw notFound('Счёт не найден');
    if (account.ownerUserId !== req.user.id) throw forbidden('Удалить счёт может только владелец');

    const txCount = await prisma.transaction.count({
      where: { OR: [{ accountId: id }, { toAccountId: id }] },
    });

    // Счёт с историей не удаляем, а архивируем — иначе потеряем операции.
    if (txCount > 0) {
      await prisma.account.update({ where: { id }, data: { isArchived: true } });
      return res.json({ ok: true, archived: true });
    }

    await prisma.account.delete({ where: { id } });
    res.json({ ok: true, archived: false });
  }),
);

/** Ручной пересчёт баланса по истории операций. */
accountsRouter.post(
  '/:id/recalc',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const account = await prisma.account.findFirst({
      where: { id, ...accountWhere(req.user, req.scope) },
    });
    if (!account) throw notFound('Счёт не найден');
    const balance = await recalcAccountBalance(id);
    res.json({ id, balance });
  }),
);
