import { Router } from 'express';
import { z } from 'zod';
import { MAX_AMOUNT } from '@budget/shared';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/asyncHandler.js';
import { transactionDto } from '../lib/serialize.js';
import { visibleAccountIds } from '../services/scope.js';
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from '../services/transactions.js';
import { badRequest, notFound } from '../lib/errors.js';
import { parseDate } from '../lib/dates.js';

export const transactionsRouter = Router();

const txInclude = {
  account: { select: { name: true, icon: true, currency: true } },
  toAccount: { select: { name: true } },
  category: { select: { name: true, icon: true, color: true } },
  user: { select: { name: true, avatarUrl: true } },
} as const;

transactionsRouter.get(
  '/',
  ah(async (req, res) => {
    const accountIds = await visibleAccountIds(req.user, req.scope);
    const q = req.query;

    const limit = Math.min(Number(q.limit ?? 50) || 50, 200);
    const cursor = q.cursor ? Number(q.cursor) : null;

    const filterAccount = q.accountId ? Number(q.accountId) : null;
    const filterCategories =
      typeof q.categoryId === 'string' && q.categoryId
        ? q.categoryId.split(',').map(Number).filter(Number.isFinite)
        : null;

    const where: any = {
      accountId: filterAccount ? { in: accountIds.filter((id) => id === filterAccount) } : { in: accountIds },
    };
    if (filterCategories?.length) where.categoryId = { in: filterCategories };
    if (q.type === 'income' || q.type === 'expense' || q.type === 'transfer') where.type = q.type;
    if (q.from || q.to) {
      where.date = {};
      if (q.from) where.date.gte = parseDate(q.from);
      if (q.to) where.date.lte = parseDate(q.to);
    }
    if (typeof q.search === 'string' && q.search.trim()) {
      where.comment = { contains: q.search.trim() };
    }

    const rows = await prisma.transaction.findMany({
      where,
      include: txInclude,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      items: items.map(transactionDto),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  }),
);

const inputSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  accountId: z.number().int().positive(),
  toAccountId: z.number().int().positive().nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  amount: z.number().positive().max(MAX_AMOUNT),
  currency: z.string().length(3),
  date: z.string(),
  comment: z.string().max(500).nullable().optional(),
  receiptPhotoUrl: z.string().max(500).nullable().optional(),
  isRecurring: z.boolean().optional(),
});

transactionsRouter.post(
  '/',
  ah(async (req, res) => {
    const parsed = inputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? 'Некорректные данные операции');
    }
    const created = await createTransaction(req.user, req.scope, {
      ...parsed.data,
      currency: parsed.data.currency.toUpperCase(),
    });
    const full = await prisma.transaction.findUnique({ where: { id: created.id }, include: txInclude });
    res.status(201).json(transactionDto(full));
  }),
);

transactionsRouter.get(
  '/:id',
  ah(async (req, res) => {
    const accountIds = await visibleAccountIds(req.user, req.scope);
    const row = await prisma.transaction.findFirst({
      where: { id: Number(req.params.id), accountId: { in: accountIds } },
      include: txInclude,
    });
    if (!row) throw notFound('Операция не найдена');
    res.json(transactionDto(row));
  }),
);

transactionsRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const parsed = inputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? 'Некорректные данные операции');
    }
    const updated = await updateTransaction(req.user, req.scope, Number(req.params.id), {
      ...parsed.data,
      currency: parsed.data.currency.toUpperCase(),
    });
    const full = await prisma.transaction.findUnique({ where: { id: updated.id }, include: txInclude });
    res.json(transactionDto(full));
  }),
);

transactionsRouter.delete(
  '/:id',
  ah(async (req, res) => {
    await deleteTransaction(req.user, req.scope, Number(req.params.id));
    res.json({ ok: true });
  }),
);
