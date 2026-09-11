import { currencySymbol, formatMoney, formatNumber } from '@budget/shared';

/*
 * Формат денег живёт в @budget/shared: его используют и бот в напоминаниях,
 * и сервер в подписи к выгрузке. Пока копия была здесь, одна и та же сумма
 * выглядела в трёх местах по-разному.
 */
export { formatMoney, formatNumber };

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

  /*
   * Разряды доходим до триллионов: раньше всё, что больше миллиона,
   * делилось на 1e6, и 50 трлн превращались в «50000000,1M» — строку
   * длиннее исходной, которая вылезала за центр кольца.
   */
  // Порог и делитель различаются: тысячи сокращаем только с 10 000,
  // иначе «5 000» превратилось бы в «5K» и стало бы длиннее исходного.
  const steps: { from: number; unit: number; suffix: string }[] = [
    { from: 1e12, unit: 1e12, suffix: 'T' },
    { from: 1e9, unit: 1e9, suffix: 'B' },
    { from: 1e6, unit: 1e6, suffix: 'M' },
    { from: 1e4, unit: 1e3, suffix: 'K' },
  ];

  for (const { from, unit, suffix } of steps) {
    if (abs >= from) {
      const short = (abs / unit).toFixed(1).replace(/\.0$/, '').replace('.', ',');
      return `${sign}${symbol}${short}${suffix}`;
    }
  }

  return `${sign}${symbol}${formatNumber(abs)}`;
}

/**
 * Полная запись, пока помещается; дальше — компактная.
 *
 * Для второстепенных строк, где уменьшать шрифт некуда: обрезать деньги
 * нельзя (теряются разряды), а «₽50,0T» читается и влезает.
 */
export function formatMoneyFit(value: number, currency: string, maxChars: number): string {
  const full = formatMoney(value, currency);
  return full.length <= maxChars ? full : formatCompact(value, currency);
}

/**
 * Кегль под длину строки.
 *
 * У крупных сумм ширина не ограничена данными: баланс в 50 трлн длиннее
 * обычного втрое и уезжает за край. Обрезать деньги нельзя — теряются
 * разряды, поэтому уменьшаем шрифт, пока строка не поместится.
 *
 * `fitsUpTo` — сколько знаков помещается в отведённую ширину при базовом кегле.
 */
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
