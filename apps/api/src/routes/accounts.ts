import { Router } from 'express';
import { z } from 'zod';
import { isKnownCurrency, MAX_AMOUNT } from '@budget/shared';
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

const currencyField = z
  .string()
  .length(3)
  .refine(isKnownCurrency, 'Неизвестная валюта')
  .transform((code) => code.toUpperCase());

const balanceField = z.number().min(-MAX_AMOUNT).max(MAX_AMOUNT);

const createSchema = z.object({
  name: z.string().min(1).max(40),
  icon: z.string().max(8).optional(),
  color: z.string().max(16).optional(),
  currency: currencyField,
  initialBalance: balanceField.optional(),
  isShared: z.boolean().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  icon: z.string().min(1).max(8).optional(),
  color: z.string().min(4).max(16).optional(),
  currency: currencyField.optional(),
  initialBalance: balanceField.optional(),
  isShared: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

accountsRouter.post(
  '/',
  ah(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Проверьте название, валюту и баланс счёта');
    const data = parsed.data;

    const isFamily = req.scope.kind === 'family';
    const initial = round2(data.initialBalance ?? 0);

    const maxOrder = await prisma.account.aggregate({
      where: accountWhere(req.user, req.scope),
      _max: { sortOrder: true },
    });

    const account = await prisma.account.create({
      data: {
        ownerUserId: req.user.id,
        budgetId: req.scope.budgetId,
        name: data.name,
        icon: data.icon ?? '💳',
        color: data.color ?? '#6EC1FF',
        currency: data.currency,
        initialBalance: initial,
        balance: initial,

        isShared: isFamily ? (data.isShared ?? true) : true,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
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

    const parsed = patchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? 'Проверьте поля счёта');
    }
    const body = parsed.data;

    if (body.currency && body.currency !== account.currency) {
      const used = await prisma.transaction.count({
        where: { OR: [{ accountId: id }, { toAccountId: id }] },
      });
      if (used > 0) {
        throw badRequest(
          'У счёта есть операции, поэтому валюту изменить нельзя. Заведите новый счёт в нужной валюте.',
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.icon !== undefined) data.icon = body.icon;
    if (body.color !== undefined) data.color = body.color;
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.isShared !== undefined && req.scope.kind === 'family') data.isShared = body.isShared;
    if (body.isArchived !== undefined) data.isArchived = body.isArchived;
    if (body.initialBalance !== undefined) data.initialBalance = round2(body.initialBalance);

    const updated = await prisma.account.update({
      where: { id },
      data,
      include: { owner: { select: { name: true } } },
    });

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

    if (txCount > 0) {
      await prisma.account.update({ where: { id }, data: { isArchived: true } });
      return res.json({ ok: true, archived: true });
    }

    await prisma.account.delete({ where: { id } });
    res.json({ ok: true, archived: false });
  }),
);

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
