import { describe, expect, it } from 'vitest';
import { escapeHtml, formatMoney, formatNumber, truncate } from '@budget/shared';

describe('escapeHtml', () => {
  it('экранирует символы, на которых Telegram отказывается разбирать HTML', () => {
    expect(escapeHtml('Бюджет <2026>')).toBe('Бюджет &lt;2026&gt;');
    expect(escapeHtml('Мама & Папа')).toBe('Мама &amp; Папа');
  });

  it('не превращает пользовательский текст в разметку', () => {
    expect(escapeHtml('<script>alert(1)</script>')).not.toContain('<script>');
  });
});

describe('formatMoney', () => {
  it('ставит разделители разрядов и символ валюты', () => {
    const text = formatMoney(900000000, 'RUB');
    // Intl разделяет разряды неразрывным пробелом (U+00A0), а не обычным:
    // сравнивать с литералом из редактора нельзя, они не равны.
    expect(text.replace(/\s/g, ' ')).toBe('₽900 000 000');
    expect(text).toMatch(/\u00a0/);
  });

  it('огромные суммы не уходят в экспоненциальную запись', () => {
    // String(1e21) === '1e+21' — такое попадало в текст напоминания.
    expect(formatNumber(1e21)).not.toContain('e+');
  });

  it('не отдаёт NaN и Infinity пользователю', () => {
    expect(formatNumber(NaN)).toBe('0');
    expect(formatNumber(Infinity)).toBe('0');
  });
});

describe('truncate', () => {
  it('обрезает длинное и добавляет многоточие', () => {
    expect(truncate('А'.repeat(50), 10)).toHaveLength(10);
  });

  it('короткое оставляет как есть', () => {
    expect(truncate('Семья', 40)).toBe('Семья');
  });
});
