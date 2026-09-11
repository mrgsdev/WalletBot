import { currencySymbol } from './index.js';

/**
 * Экранирование для Telegram `parse_mode: 'HTML'`.
 *
 * Нужно везде, где в разметку попадает то, что ввёл человек: название
 * бюджета, счёта, категории. Без этого «Бюджет <2026>» Telegram примет
 * за незакрытый тег и откажется отправлять сообщение целиком.
 *
 * Обратное тоже верно: применять эту функцию к тексту БЕЗ parse_mode
 * нельзя — пользователь увидит «Мама &amp; Папа».
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const numberFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const numberFormat2 = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * «1 234,56» — с неразрывными пробелами, как в iOS.
 *
 * Живёт в общем пакете, потому что деньги показывают все трое: мини-апп,
 * бот в напоминаниях и сервер в подписи к выгрузке. Раньше формат был
 * только у мини-аппа, и одна и та же сумма выглядела в трёх местах
 * по-разному: «900 000 000 ₽», «900000000 RUB» и «900000000».
 */
export function formatNumber(value: number, alwaysCents = false): string {
  if (!Number.isFinite(value)) return '0';
  return (alwaysCents ? numberFormat2 : numberFormat).format(value);
}

/** «₽1 234,56»: символ валюты перед числом. */
export function formatMoney(value: number, currency: string, alwaysCents = false): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}${currencySymbol(currency)}${formatNumber(Math.abs(value), alwaysCents)}`;
}

/** Обрезает длинный текст, чтобы он не распирал сообщение. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
