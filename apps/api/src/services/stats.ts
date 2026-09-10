import type { CategoryStatsDto, SummaryStatsDto } from '@budget/shared';
import { prisma } from '../lib/prisma.js';
import { getUsdRates } from './currency.js';
import { lastMonths, type Period, previousLabel, previousRange, rangeFor } from '../lib/dates.js';
import type { AuthUser } from '../middleware/auth.js';
import type { Scope } from './scope.js';
import { visibleAccountIds } from './scope.js';
import {
  type AggRow,
  aggregateByCategory,
  percentChange,
  aggregateByGroup,
  buildTrend,
  computeTotals,
  inRange,
  makeConverter,
  round2,
} from './aggregate.js';

interface StatsQuery {
  type: 'income' | 'expense';
  period: Period;
  anchor: Date;
  /** null — «Все счета». */
  accountId: number | null;
  baseCurrency: string;
}

async function resolveAccountIds(user: AuthUser, scope: Scope, accountId: number | null) {
  const visible = await visibleAccountIds(user, scope);
  if (accountId === null) return visible;
  return visible.filter((id) => id === accountId);
}

/** Загружает операции в виде, пригодном для чистых агрегаторов. */
async function loadRows(
  accountIds: number[],
  from: Date,
  to: Date,
  types: ('income' | 'expense')[],
): Promise<AggRow[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      accountId: { in: accountIds },
      type: { in: types },
      date: { gte: from, lte: to },
    },
    include: {
      category: { select: { name: true, icon: true, color: true, group: true } },
      account: { select: { currency: true } },
    },
  });

  return rows.map((row) => ({
    type: row.type as 'income' | 'expense',
    date: row.date,
    amount: row.convertedAmount,
    accountCurrency: row.account.currency,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    categoryIcon: row.category?.icon ?? null,
    categoryColor: row.category?.color ?? null,
    categoryGroup: row.category?.group ?? null,
  }));
}

/** Разбивка по категориям за период — данные для кольцевой диаграммы. */
export async function categoryStats(
  user: AuthUser,
  scope: Scope,
  query: StatsQuery,
): Promise<CategoryStatsDto> {
  const { from, to } = rangeFor(query.period, query.anchor);
  const previous = previousRange(query.period, query.anchor);
  const accountIds = await resolveAccountIds(user, scope, query.accountId);
  const toBase = makeConverter(await getUsdRates(), query.baseCurrency);

  // Один и тот же тип операций за оба периода: текущий показываем, прошлый — для сравнения.
  const [rows, previousRows] = await Promise.all([
    loadRows(accountIds, from, to, [query.type]),
    loadRows(accountIds, previous.from, previous.to, [query.type]),
  ]);

  const { total, items } = aggregateByCategory(rows, toBase, previousRows);
  const previousTotal = round2(
    previousRows.reduce((sum, row) => sum + toBase(row.amount, row.accountCurrency), 0),
  );

  return {
    currency: query.baseCurrency,
    total,
    from: from.toISOString(),
    to: to.toISOString(),
    items,
    previousTotal,
    previousChangePercent: percentChange(total, previousTotal),
    previousLabel: previousLabel(query.period, query.anchor),
  };
}

interface SummaryQuery {
  mode: 'month' | 'year';
  anchor: Date;
  accountId: number | null;
  baseCurrency: string;
  /** Сколько точек показывать на графике тренда. */
  trendMonths: number;
}

/** Сводная статистика: доход/расход/накопления, группы расходов и тренд. */
export async function summaryStats(
  user: AuthUser,
  scope: Scope,
  query: SummaryQuery,
): Promise<SummaryStatsDto> {
  const { from, to } = rangeFor(query.mode, query.anchor);
  const accountIds = await resolveAccountIds(user, scope, query.accountId);
  const toBase = makeConverter(await getUsdRates(), query.baseCurrency);

  const months = lastMonths(query.anchor, query.trendMonths);
  const trendFrom = new Date(Date.UTC(months[0].year, months[0].month, 1));
  const windowFrom = from < trendFrom ? from : trendFrom;

  // Одна выборка на период отчёта и на окно тренда — они могут не совпадать.
  const rows = await loadRows(accountIds, windowFrom, to, ['income', 'expense']);
  const periodRows = inRange(rows, from, to);

  const totals = computeTotals(periodRows, toBase);

  return {
    currency: query.baseCurrency,
    ...totals,
    expenseGroups: aggregateByGroup(periodRows, toBase),
    incomeTrend: buildTrend(rows, months, 'income', toBase),
    expenseTrend: buildTrend(rows, months, 'expense', toBase),
  };
}
