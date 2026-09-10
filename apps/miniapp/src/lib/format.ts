import { currencySymbol } from '@budget/shared';

const numberFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const numberFormat2 = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** «1 234,56» — с неразрывными пробелами, как в iOS. */
export function formatNumber(value: number, alwaysCents = false): string {
  return (alwaysCents ? numberFormat2 : numberFormat).format(value);
}

/** «₽1 234,56»: символ валюты идёт перед числом, как на референсах. */
export function formatMoney(value: number, currency: string, alwaysCents = false): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}${currencySymbol(currency)}${formatNumber(Math.abs(value), alwaysCents)}`;
}

/**
 * Разбирает сумму на части для «крупной» вёрстки из редизайна:
 * символ валюты рисуется меньше и выше, копейки — приглушённым цветом.
 */
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

/** Компактная запись для центра диаграммы: «$11,3K». */
export function formatCompact(value: number, currency: string): string {
  const abs = Math.abs(value);
  const symbol = currencySymbol(currency);
  const sign = value < 0 ? '−' : '';

  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 10_000) return `${sign}${symbol}${(abs / 1000).toFixed(1).replace('.', ',')}K`;
  return `${sign}${symbol}${formatNumber(abs)}`;
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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** «Сегодня» / «Вчера» / «12 августа». */
export function formatDateLabel(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) return 'Сегодня';
  if (isSameDay(date, yesterday)) return 'Вчера';

  const day = date.getDate();
  const month = MONTHS_GEN[date.getMonth()];
  const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${day} ${month}${year}`;
}

/** Полная дата для заголовков групп в истории. */
export function formatDateFull(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const label = formatDateLabel(date);
  if (label === 'Сегодня' || label === 'Вчера') return label;
  return `${label}, ${WEEKDAYS[date.getDay()].toLowerCase()}`;
}

export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Ключ группировки истории по дню. */
export function dayKey(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return toDateInputValue(date);
}
