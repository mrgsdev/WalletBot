import { currencySymbol, formatMoney, formatNumber } from '@budget/shared';

export { formatMoney, formatNumber };

export function splitMoney(
  value: number,
  currency: string,
  alwaysCents = false,
): { sign: string; symbol: string; int: string; cents: string } {
  const text = formatNumber(Math.abs(value), alwaysCents);
  const comma = text.lastIndexOf(',');
  return {
    sign: value < 0 ? '\u2212' : '',
    symbol: currencySymbol(currency),
    int: comma === -1 ? text : text.slice(0, comma),
    cents: comma === -1 ? '' : text.slice(comma),
  };
}

export function formatCompact(value: number, currency: string): string {
  const abs = Math.abs(value);
  const symbol = currencySymbol(currency);
  const sign = value < 0 ? '−' : '';

  const steps: { from: number; unit: number; suffix: string }[] = [
    { from: 1e12, unit: 1e12, suffix: 'T' },
    { from: 1e9, unit: 1e9, suffix: 'B' },
    { from: 1e6, unit: 1e6, suffix: 'M' },
    { from: 1e4, unit: 1e3, suffix: 'K' },
  ];

  for (let i = 0; i < steps.length; i++) {
    if (abs < steps[i].from) continue;

    let { unit, suffix } = steps[i];
    let short = Math.round((abs / unit) * 10) / 10;

    if (short >= 1000 && i > 0) {
      ({ unit, suffix } = steps[i - 1]);
      short = Math.round((abs / unit) * 10) / 10;
    }

    return `${sign}${symbol}${String(short).replace('.', ',')}${suffix}`;
  }

  return `${sign}${symbol}${formatNumber(abs)}`;
}

export function formatMoneyFit(value: number, currency: string, maxChars: number): string {
  const full = formatMoney(value, currency);
  return full.length <= maxChars ? full : formatCompact(value, currency);
}

export function fontSizeForLength(
  text: string,
  base: number,
  fitsUpTo: number,
  min = 14,
): number {
  if (text.length <= fitsUpTo) return base;
  return Math.max(min, Math.round((base * fitsUpTo) / text.length));
}

const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export const MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export const MONTHS_SHORT = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
];

const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

export function calendarDay(input: string | Date): Date {
  const date = typeof input === 'string' ? new Date(input) : input;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function todayCalendarDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDateLabel(input: string | Date): string {
  const date = calendarDay(input);
  const today = todayCalendarDay();

  if (date.getTime() === today.getTime()) return 'Сегодня';
  if (date.getTime() === today.getTime() - DAY_MS) return 'Вчера';

  const day = date.getUTCDate();
  const month = MONTHS_GEN[date.getUTCMonth()];
  const year = date.getUTCFullYear() === today.getUTCFullYear() ? '' : ` ${date.getUTCFullYear()}`;
  return `${day} ${month}${year}`;
}

export function formatDateFull(input: string | Date): string {
  const label = formatDateLabel(input);
  if (label === 'Сегодня' || label === 'Вчера') return label;
  return `${label}, ${WEEKDAYS[calendarDay(input).getUTCDay()].toLowerCase()}`;
}

export function toDateInputValue(input: string | Date): string {
  const date = calendarDay(input);
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${m}-${d}`;
}

export function dayKey(input: string | Date): string {
  return toDateInputValue(input);
}
