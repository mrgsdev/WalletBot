import { currencySymbol } from './index.js';

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

export function formatNumber(value: number, alwaysCents = false): string {
  if (!Number.isFinite(value)) return '0';
  return (alwaysCents ? numberFormat2 : numberFormat).format(value);
}

export function formatMoney(value: number, currency: string, alwaysCents = false): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}${currencySymbol(currency)}${formatNumber(Math.abs(value), alwaysCents)}`;
}

export function formatMoneyCode(value: number, currency: string, alwaysCents = false): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(value), alwaysCents)} ${currency.toUpperCase()}`;
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
