export type Period = 'week' | 'month' | 'quarter' | 'year';

export interface Range {
  from: Date;
  to: Date;
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

/**
 * Диапазон периода, содержащего дату `anchor`.
 * Неделя считается с понедельника.
 */
export function rangeFor(period: Period, anchor: Date): Range {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();

  switch (period) {
    case 'week': {
      const day = (anchor.getUTCDay() + 6) % 7; // 0 = понедельник
      const from = startOfDay(new Date(Date.UTC(y, m, anchor.getUTCDate() - day)));
      const to = endOfDay(new Date(Date.UTC(y, m, anchor.getUTCDate() - day + 6)));
      return { from, to };
    }
    case 'month':
      return {
        from: new Date(Date.UTC(y, m, 1)),
        to: endOfDay(new Date(Date.UTC(y, m + 1, 0))),
      };
    case 'quarter': {
      const qStart = Math.floor(m / 3) * 3;
      return {
        from: new Date(Date.UTC(y, qStart, 1)),
        to: endOfDay(new Date(Date.UTC(y, qStart + 3, 0))),
      };
    }
    case 'year':
      return {
        from: new Date(Date.UTC(y, 0, 1)),
        to: endOfDay(new Date(Date.UTC(y, 11, 31))),
      };
  }
}

/**
 * Диапазон предыдущего периода того же типа.
 * Нужен для сравнения «сколько было в прошлом месяце».
 */
export function previousRange(period: Period, anchor: Date): Range {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  const d = anchor.getUTCDate();

  switch (period) {
    case 'week':
      return rangeFor('week', new Date(Date.UTC(y, m, d - 7)));
    case 'month':
      // Берём первое число, чтобы не соскользнуть с 31-го на другой месяц.
      return rangeFor('month', new Date(Date.UTC(y, m - 1, 1)));
    case 'quarter':
      return rangeFor('quarter', new Date(Date.UTC(y, Math.floor(m / 3) * 3 - 3, 1)));
    case 'year':
      return rangeFor('year', new Date(Date.UTC(y - 1, 0, 1)));
  }
}

/** Подпись периода сравнения: «к августу», «к прошлой неделе». */
export function previousLabel(period: Period, anchor: Date): string {
  switch (period) {
    case 'week':
      return 'к прошлой неделе';
    case 'month': {
      const prev = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1));
      return `к ${MONTHS_DATIVE[prev.getUTCMonth()]}`;
    }
    case 'quarter':
      return 'к прошлому кварталу';
    case 'year':
      return 'к прошлому году';
  }
}

/** Названия месяцев в дательном падеже — «к августу». */
const MONTHS_DATIVE = [
  'январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню',
  'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю',
];

export const MONTHS_SHORT = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
];

export const MONTHS_FULL = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/** Последние `count` месяцев, включая месяц даты `anchor`. */
export function lastMonths(anchor: Date, count: number): { year: number; month: number; label: string; key: string }[] {
  const out: { year: number; month: number; label: string; key: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    out.push({
      year,
      month,
      label: MONTHS_SHORT[month],
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
    });
  }
  return out;
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function parseDate(value: unknown, fallback = new Date()): Date {
  if (typeof value !== 'string' || !value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}
