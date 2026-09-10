import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/asyncHandler.js';
import { categoryWhere, visibleAccountIds } from '../services/scope.js';
import { getUsdRates, round2 } from '../services/currency.js';
import { badRequest, notFound } from '../lib/errors.js';
import type { BudgetPlanDto } from '@budget/shared';

export const plansRouter = Router();

async function baseCurrencyFor(userId: number): Promise<string> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  return settings?.baseCurrency ?? 'RUB';
}

/** План и факт по всем категориям выбранного месяца. */
plansRouter.get(
  '/',
  ah(async (req, res) => {
    const now = new Date();
    const year = Number(req.query.year ?? now.getUTCFullYear());
    const month = Number(req.query.month ?? now.getUTCMonth() + 1);
    if (!Number.isFinite(year) || month < 1 || month > 12) throw badRequest('Некорректный период');

    const base = await baseCurrencyFor(req.user.id);
    const usd = await getUsdRates();
    const baseRate = usd[base] ?? 1;
    const toBase = (amount: number, from: string) =>
      from === base ? amount : (amount / (usd[from] ?? 1)) * baseRate;

    const categories = await prisma.category.findMany({
      where: { ...categoryWhere(req.user, req.scope), isArchived: false },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    const plans = await prisma.budgetPlan.findMany({
      where: { budgetId: req.scope.budgetId, year, month },
    });
    const planByCategory = new Map(plans.map((p) => [p.categoryId, p]));

    const accountIds = await visibleAccountIds(req.user, req.scope);
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const rows = await prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        type: { in: ['income', 'expense'] },
        date: { gte: from, lte: to },
      },
      include: { account: { select: { currency: true } } },
    });

    const factByCategory = new Map<number, number>();
    for (const row of rows) {
      if (!row.categoryId) continue;
      const value = toBase(row.convertedAmount, row.account.currency);
      factByCategory.set(row.categoryId, (factByCategory.get(row.categoryId) ?? 0) + value);
    }

    const items: BudgetPlanDto[] = categories.map((c) => ({
      id: planByCategory.get(c.id)?.id ?? null,
      categoryId: c.id,
      categoryName: c.name,
      categoryIcon: c.icon,
      categoryColor: c.color,
      categoryType: c.type as 'income' | 'expense',
      year,
      month,
      plannedAmount: planByCategory.get(c.id)?.plannedAmount ?? 0,
      factAmount: round2(factByCategory.get(c.id) ?? 0),
    }));

    res.json({ currency: base, year, month, items });
  }),
);

const putSchema = z.object({
  categoryId: z.number().int().positive(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  plannedAmount: z.number().min(0),
});

/** Установка плана по категории на месяц. */
plansRouter.put(
  '/',
  ah(async (req, res) => {
    const parsed = putSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Проверьте категорию, период и сумму плана');
    const { categoryId, year, month, plannedAmount } = parsed.data;

    const category = await prisma.category.findFirst({
      where: { id: categoryId, ...categoryWhere(req.user, req.scope) },
    });
    if (!category) throw notFound('Категория не найдена');

    // Уникальный ключ (budgetId, categoryId, year, month) позволяет обойтись upsert.
    const plan = await prisma.budgetPlan.upsert({
      where: {
        budgetId_categoryId_year_month: {
          budgetId: req.scope.budgetId,
          categoryId,
          year,
          month,
        },
      },
      create: {
        budgetId: req.scope.budgetId,
        categoryId,
        year,
        month,
        plannedAmount: round2(plannedAmount),
      },
      update: { plannedAmount: round2(plannedAmount) },
    });

    res.json(plan);
  }),
);
