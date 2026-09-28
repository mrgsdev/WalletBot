import { describe, expect, it } from 'vitest';
import { isKnownCurrency } from '@budget/shared';
import { TIME_PATTERN } from '../src/lib/dates.js';

describe('isKnownCurrency', () => {
  it('принимает валюты из списка приложения', () => {
    for (const code of ['RUB', 'USD', 'EUR', 'THB', 'AMD']) {
      expect(isKnownCurrency(code)).toBe(true);
    }
  });

  it('не принимает выдуманные коды', () => {
    for (const code of ['XYZ', 'ABC', 'РУБ']) {
      expect(isKnownCurrency(code)).toBe(false);
    }
  });

  it('не зависит от регистра', () => {
    expect(isKnownCurrency('rub')).toBe(true);
  });
});

describe('TIME_PATTERN', () => {
  it('принимает реальное время суток', () => {
    for (const time of ['00:00', '09:30', '23:59', '10:00']) {
      expect(TIME_PATTERN.test(time)).toBe(true);
    }
  });

  it('не принимает несуществующее время', () => {
    for (const time of ['99:99', '24:00', '12:60', '7:00', '070:0']) {
      expect(TIME_PATTERN.test(time)).toBe(false);
    }
  });
});
