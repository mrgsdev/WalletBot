import type { MonthBudgetDto } from '@budget/shared';
import { prisma } from '../lib/prisma.js';
import { getUsdRates } from './currency.js';
import { makeConverter, round2 } from './aggregate.js';
import type { AuthUser } from '../middleware/auth.js';
import type { Scope } from './scope.js';
import { visibleAccountIds } from './scope.js';

export function localNow(now: Date, tzOffsetMinutes: number): Date {
  return new Date(now.getTime() + tzOffsetMinutes * 60_000);
}

export interface MonthBudgetInput {
  limit: number | null;

  spent: number;
  currency: string;

  localDate: Date;
}

export function computeMonthBudget(input: MonthBudgetInput): MonthBudgetDto {
  const year = input.localDate.getUTCFullYear();
  const month = input.localDate.getUTCMonth();

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const dayOfMonth = input.localDate.getUTCDate();

  const daysLeft = Math.max(daysInMonth - dayOfMonth + 1, 1);
  const daysRemaining = Math.max(daysInMonth - dayOfMonth, 0);

  const spent = round2(Math.max(input.spent, 0));
  const limit = input.limit === null ? null : round2(Math.max(input.limit, 0));

  const remaining = limit === null ? 0 : round2(limit - spent);
  const perDay = limit === null ? 0 : round2(Math.max(remaining, 0) / daysLeft);
  const perDayPlanned = limit === null ? 0 : round2(limit / daysInMonth);
  const averagePerDay = round2(spent / dayOfMonth);
  const projected = round2(averagePerDay * daysInMonth);

  return {
    currency: input.currency,
    limit,
    spent,
    remaining,
    perDay,
    perDayPlanned,
    daysInMonth,
    daysLeft,
    daysRemaining,
    dayOfMonth,
    usedShare: limit && limit > 0 ? round2((spent / limit) * 100) : 0,
    averagePerDay,
    projected,
    isOverspent: limit !== null && spent > limit,
  };
}

export async function monthBudgetFor(
  user: AuthUser,
  scope: Scope,
  now = new Date(),
): Promise<MonthBudgetDto> {
  const [budget, settings] = await Promise.all([
    prisma.budget.findUnique({
      where: { id: scope.budgetId },
      select: { monthlyLimit: true, limitCurrency: true },
    }),
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
  ]);

  const currency = settings?.baseCurrency ?? 'RUB';
  const tz = settings?.tzOffsetMinutes ?? 180;
  const local = localNow(now, tz);

  const from = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1));
  const to = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );

  const accountIds = await visibleAccountIds(user, scope);

  const rows = await prisma.transaction.findMany({
    where: {
      accountId: { in: accountIds },
      type: 'expense',
      date: { gte: from, lte: to },
    },
    include: { account: { select: { currency: true } } },
  });

  const toBase = makeConverter(await getUsdRates(), currency);
  const spent = rows.reduce((sum, row) => sum + toBase(row.convertedAmount, row.account.currency), 0);

  const rawLimit = budget?.monthlyLimit ?? null;
  const limit =
    rawLimit === null ? null : toBase(rawLimit, budget?.limitCurrency ?? currency);

  return computeMonthBudget({ limit, spent, currency, localDate: local });
}
