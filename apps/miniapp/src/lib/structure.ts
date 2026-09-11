/**
 * Структура периода: как доход разошёлся на расходы и накопления.
 *
 * Доли считаем от дохода, а не от «оборота». Оборот в API это
 * доход + расход + накопления, то есть ровно два дохода, поэтому доля
 * дохода в нём всегда выходила 50% — цифра, которая ничего не говорит.
 */
export interface PeriodStructure {
  income: number;
  expense: number;
  /** Доход минус расход. Отрицательное значение это перерасход. */
  savings: number;
  overspent: boolean;
  /** Доли от дохода, в процентах. */
  expenseShare: number;
  savingsShare: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function periodStructure(income: number, expense: number): PeriodStructure {
  const savings = round2(income - expense);
  // Без дохода считать долю не от чего: берём за единицу расход.
  const base = income > 0 ? income : expense;
  return {
    income,
    expense,
    savings,
    overspent: savings < 0,
    expenseShare: base > 0 ? (expense / base) * 100 : 0,
    savingsShare: base > 0 ? (Math.max(savings, 0) / base) * 100 : 0,
  };
}

export const STRUCTURE_COLORS = {
  income: '#D8F24A',
  expense: '#FF6E6E',
  savings: '#FFA640',
} as const;

/** Сколько дней периода уже прошло: для среднего расхода в день. */
export function daysElapsed(
  mode: 'month' | 'year',
  year: number,
  month: number,
  now = new Date(),
): number {
  if (mode === 'year') {
    const inYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
    if (now.getFullYear() !== year) return inYear;
    const start = Date.UTC(year, 0, 1);
    const today = Date.UTC(year, now.getMonth(), now.getDate());
    return Math.min(Math.floor((today - start) / 86_400_000) + 1, inYear);
  }

  const inMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const isCurrent = now.getFullYear() === year && now.getMonth() + 1 === month;
  return isCurrent ? Math.min(now.getDate(), inMonth) : inMonth;
}
