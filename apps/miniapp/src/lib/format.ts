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

  for (let i = 0; i < steps.length; i++) {
    if (abs < steps[i].from) continue;

    let { unit, suffix } = steps[i];
    let short = Math.round((abs / unit) * 10) / 10;

    /*
     * Округление могло выбить значение в старший разряд: 999 999 при
     * делении на тысячу давало «1000,0», то есть «₽1000K» вместо «₽1M».
     * Тогда берём разряд выше — он в списке предыдущий.
     */
    if (short >= 1000 && i > 0) {
      ({ unit, suffix } = steps[i - 1]);
      short = Math.round((abs / unit) * 10) / 10;
    }

    return `${sign}${symbol}${String(short).replace('.', ',')}${suffix}`;
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

/**
 * Дата операции это календарный день, а не момент времени.
 *
 * Пока хранили момент, операция, внесённая ночью, попадала в историю под
 * сегодняшним днём (там дата читалась по местным часам), а в статистику
 * за вчерашний: периоды на сервере режутся по UTC. На стыке месяцев она
 * уезжала в прошлый месяц. Поэтому и храним, и показываем день как
 * полночь UTC, одинаково для любого часового пояса.
 */
export function calendarDay(input: string | Date): Date {
  const date = typeof input === 'string' ? new Date(input) : input;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Сегодняшний день по часам пользователя, выраженный полуночью UTC. */
export function todayCalendarDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** «Сегодня» / «Вчера» / «12 августа». */
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

/** Полная дата для заголовков групп в истории. */
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

/** Ключ группировки истории по дню. */
export function dayKey(input: string | Date): string {
  return toDateInputValue(input);
}
