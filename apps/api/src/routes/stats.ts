import { Router } from 'express';
import { ah } from '../lib/asyncHandler.js';
import { categoryStats, summaryStats } from '../services/stats.js';
import { parseDate, type Period } from '../lib/dates.js';
import { prisma } from '../lib/prisma.js';
import { monthBudgetFor } from '../services/monthBudget.js';

export const statsRouter = Router();

const PERIODS: Period[] = ['week', 'month', 'quarter', 'year'];

async function baseCurrencyFor(userId: number, override?: unknown): Promise<string> {
  if (typeof override === 'string' && override.length === 3) return override.toUpperCase();
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  return settings?.baseCurrency ?? 'RUB';
}

/** Данные для кольцевой диаграммы по категориям. */
statsRouter.get(
  '/categories',
  ah(async (req, res) => {
    const type = req.query.type === 'income' ? 'income' : 'expense';
    const period = PERIODS.includes(req.query.period as Period)
      ? (req.query.period as Period)
      : 'month';
    const anchor = parseDate(req.query.anchor);
    const accountId = req.query.accountId ? Number(req.query.accountId) : null;
    const baseCurrency = await baseCurrencyFor(req.user.id, req.query.currency);

    res.json(
      await categoryStats(req.user, req.scope, { type, period, anchor, accountId, baseCurrency }),
    );
  }),
);

/** Сводная статистика: доход/расход/накопления, группы расходов, тренд. */
statsRouter.get(
  '/summary',
  ah(async (req, res) => {
    const mode = req.query.mode === 'year' ? 'year' : 'month';
    const anchor = parseDate(req.query.anchor);
    const accountId = req.query.accountId ? Number(req.query.accountId) : null;
    const baseCurrency = await baseCurrencyFor(req.user.id, req.query.currency);
    const trendMonths = Math.min(Math.max(Number(req.query.trendMonths ?? 8) || 8, 3), 24);

    res.json(
      await summaryStats(req.user, req.scope, { mode, anchor, accountId, baseCurrency, trendMonths }),
    );
  }),
);

/** Бюджет на месяц: сколько осталось и сколько можно тратить в день. */
statsRouter.get(
  '/month-budget',
  ah(async (req, res) => {
    res.json(await monthBudgetFor(req.user, req.scope));
  }),
);
