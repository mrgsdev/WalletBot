/**
 * Чистые функции агрегации статистики.
 * Вынесены из stats.ts, чтобы бизнес-логику можно было покрыть тестами без БД.
 */
import type { CategoryStatItem, GroupStatItem, TrendPoint } from '@budget/shared';
import { GROUP_COLORS } from '../lib/defaultCategories.js';
import { EXPENSE_GROUP_ORDER } from '../lib/defaultCategories.js';

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Строка операции в виде, достаточном для агрегации. */
export interface AggRow {
  type: 'income' | 'expense';
  date: Date;
  /** Сумма в валюте счёта. */
  amount: number;
  accountCurrency: string;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  categoryGroup: string | null;
}

export type ToBase = (amount: number, fromCurrency: string) => number;

/**
 * Строит конвертер в базовую валюту по карте курсов относительно USD.
 * Неизвестная валюта возвращается как есть — лучше показать сумму, чем ноль.
 */
export function makeConverter(usdRates: Record<string, number>, base: string): ToBase {
  const baseRate = usdRates[base] ?? 1;
  return (amount, from) => {
    if (from === base) return amount;
    const fromRate = usdRates[from];
    if (!fromRate) return amount;
    return (amount / fromRate) * baseRate;
  };
}

export interface CategoryAggregation {
  total: number;
  items: CategoryStatItem[];
}

/** Ключ бакета: операции без категории собираем вместе. */
function bucketKey(categoryId: number | null): string {
  return categoryId === null ? 'none' : String(categoryId);
}

/** Суммы по категориям в валюте отчёта, без долей и сравнения. */
function sumByCategory(rows: AggRow[], toBase: ToBase): Map<string, number> {
  const sums = new Map<string, number>();
  for (const row of rows) {
    const key = bucketKey(row.categoryId);
    sums.set(key, (sums.get(key) ?? 0) + toBase(row.amount, row.accountCurrency));
  }
  return sums;
}

/**
 * Изменение к предыдущему периоду в процентах.
 * Если раньше трат не было, процент не определён: рост от нуля бесконечен,
 * и показывать «+100%» было бы враньём.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return round2(((current - previous) / previous) * 100);
}

/**
 * Суммы по категориям с долями и сравнением с предыдущим периодом.
 * `previousRows` — операции того же типа за предыдущий период.
 */
export function aggregateByCategory(
  rows: AggRow[],
  toBase: ToBase,
  previousRows: AggRow[] = [],
): CategoryAggregation {
  const buckets = new Map<string, CategoryStatItem>();
  const previousSums = sumByCategory(previousRows, toBase);

  for (const row of rows) {
    const key = bucketKey(row.categoryId);
    const bucket = buckets.get(key) ?? {
      categoryId: row.categoryId,
      name: row.categoryName ?? 'Без категории',
      icon: row.categoryIcon ?? '❓',
      color: row.categoryColor ?? '#8E8E93',
      amount: 0,
      share: 0,
      transactionCount: 0,
      previousAmount: 0,
      changePercent: null,
    };
    bucket.amount += toBase(row.amount, row.accountCurrency);
    bucket.transactionCount += 1;
    buckets.set(key, bucket);
  }

  const items = [...buckets.values()]
    .map((item) => ({ ...item, amount: round2(item.amount) }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const total = round2(items.reduce((sum, item) => sum + item.amount, 0));

  return {
    total,
    items: items.map((item) => {
      const previousAmount = round2(previousSums.get(bucketKey(item.categoryId)) ?? 0);
      return {
        ...item,
        share: total > 0 ? round2((item.amount / total) * 100) : 0,
        previousAmount,
        changePercent: percentChange(item.amount, previousAmount),
      };
    }),
  };
}

/** Суммы по крупным группам расходов. */
export function aggregateByGroup(rows: AggRow[], toBase: ToBase): GroupStatItem[] {
  const groups = new Map<string, number>();
  let total = 0;

  for (const row of rows) {
    if (row.type !== 'expense') continue;
    const value = toBase(row.amount, row.accountCurrency);
    const group = row.categoryGroup ?? 'Прочее';
    groups.set(group, (groups.get(group) ?? 0) + value);
    total += value;
  }

  return [...groups.entries()]
    .map(([group, amount]) => ({
      group,
      color: GROUP_COLORS[group] ?? '#8E8E93',
      amount: round2(amount),
      share: total > 0 ? round2((amount / total) * 100) : 0,
    }))
    .sort((a, b) => {
      const diff = b.amount - a.amount;
      if (diff !== 0) return diff;
      return EXPENSE_GROUP_ORDER.indexOf(a.group) - EXPENSE_GROUP_ORDER.indexOf(b.group);
    });
}

export interface Totals {
  income: number;
  expense: number;
  savings: number;
  incomeShare: number;
  expenseShare: number;
  savingsShare: number;
}

/**
 * Доход, расход и накопления за период.
 * Накопления — положительная разница дохода и расхода; доли считаются
 * от суммы всех трёх величин, как на референсной круговой диаграмме.
 */
export function computeTotals(rows: AggRow[], toBase: ToBase): Totals {
  let income = 0;
  let expense = 0;

  for (const row of rows) {
    const value = toBase(row.amount, row.accountCurrency);
    if (row.type === 'income') income += value;
    else expense += value;
  }

  income = round2(income);
  expense = round2(expense);
  const savings = round2(Math.max(income - expense, 0));
  const turnover = income + expense + savings;

  return {
    income,
    expense,
    savings,
    incomeShare: turnover > 0 ? round2((income / turnover) * 100) : 0,
    expenseShare: turnover > 0 ? round2((expense / turnover) * 100) : 0,
    savingsShare: turnover > 0 ? round2((savings / turnover) * 100) : 0,
  };
}

export interface MonthSlot {
  year: number;
  month: number;
  label: string;
  key: string;
}

/** Помесячный тренд по типу операции — точки для линейного графика. */
export function buildTrend(rows: AggRow[], months: MonthSlot[], type: 'income' | 'expense', toBase: ToBase): TrendPoint[] {
  const byMonth = new Map<string, number>();

  for (const row of rows) {
    if (row.type !== type) continue;
    const key = `${row.date.getUTCFullYear()}-${String(row.date.getUTCMonth() + 1).padStart(2, '0')}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + toBase(row.amount, row.accountCurrency));
  }

  return months.map((m) => ({
    label: m.label,
    month: m.key,
    value: round2(byMonth.get(m.key) ?? 0),
  }));
}

/** Отбирает строки, попадающие в диапазон дат включительно. */
export function inRange(rows: AggRow[], from: Date, to: Date): AggRow[] {
  return rows.filter((row) => row.date >= from && row.date <= to);
}
