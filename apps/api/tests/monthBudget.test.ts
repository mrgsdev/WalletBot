import { describe, expect, it } from 'vitest';
import { computeMonthBudget, localNow } from '../src/services/monthBudget.js';

const base = { currency: 'RUB' };

describe('computeMonthBudget', () => {
  it('делит лимит на дни месяца, когда ещё ничего не потрачено', () => {
    // 1 сентября, 30 дней в месяце, лимит 30 000 → 1000 в день.
    const r = computeMonthBudget({
      ...base,
      limit: 30_000,
      spent: 0,
      localDate: new Date('2026-09-01T10:00:00Z'),
    });
    expect(r.daysInMonth).toBe(30);
    expect(r.daysLeft).toBe(30);
    expect(r.perDay).toBe(1000);
    expect(r.perDayPlanned).toBe(1000);
    expect(r.remaining).toBe(30_000);
  });

  it('различает дни для расчёта и дни до конца месяца', () => {
    // 10 сентября: впереди ещё 20 дней, но тратить можно и сегодня — итого 21.
    const r = computeMonthBudget({
      ...base,
      limit: 30_000,
      spent: 0,
      localDate: new Date('2026-09-10T10:00:00Z'),
    });
    expect(r.dayOfMonth).toBe(10);
    expect(r.daysRemaining).toBe(20);
    expect(r.daysLeft).toBe(21);
  });

  it('в последний день месяца впереди ноль дней', () => {
    const r = computeMonthBudget({
      ...base,
      limit: 30_000,
      spent: 0,
      localDate: new Date('2026-09-30T10:00:00Z'),
    });
    expect(r.daysRemaining).toBe(0);
    expect(r.daysLeft).toBe(1);
  });

  it('пересчитывает дневную норму от остатка', () => {
    // 10 сентября, потрачено 12 000 из 30 000 → 18 000 на 21 оставшийся день.
    const r = computeMonthBudget({
      ...base,
      limit: 30_000,
      spent: 12_000,
      localDate: new Date('2026-09-10T10:00:00Z'),
    });
    expect(r.daysLeft).toBe(21);
    expect(r.remaining).toBe(18_000);
    expect(r.perDay).toBe(857.14);
  });

  it('считает сегодняшний день оставшимся', () => {
    // В последний день месяца ещё можно потратить весь остаток.
    const r = computeMonthBudget({
      ...base,
      limit: 30_000,
      spent: 29_000,
      localDate: new Date('2026-09-30T10:00:00Z'),
    });
    expect(r.daysLeft).toBe(1);
    expect(r.perDay).toBe(1000);
  });

  it('при перерасходе дневная норма равна нулю, а не отрицательна', () => {
    const r = computeMonthBudget({
      ...base,
      limit: 30_000,
      spent: 45_000,
      localDate: new Date('2026-09-15T10:00:00Z'),
    });
    expect(r.isOverspent).toBe(true);
    expect(r.remaining).toBe(-15_000);
    expect(r.perDay).toBe(0);
    expect(r.usedShare).toBe(150);
  });

  it('без лимита возвращает нули, но считает потраченное', () => {
    const r = computeMonthBudget({
      ...base,
      limit: null,
      spent: 5000,
      localDate: new Date('2026-09-10T10:00:00Z'),
    });
    expect(r.limit).toBeNull();
    expect(r.spent).toBe(5000);
    expect(r.perDay).toBe(0);
    expect(r.usedShare).toBe(0);
    expect(r.isOverspent).toBe(false);
  });

  it('считает средний расход и прогноз на месяц', () => {
    // За 10 дней потрачено 10 000 → 1000 в день → 30 000 к концу месяца.
    const r = computeMonthBudget({
      ...base,
      limit: 30_000,
      spent: 10_000,
      localDate: new Date('2026-09-10T10:00:00Z'),
    });
    expect(r.averagePerDay).toBe(1000);
    expect(r.projected).toBe(30_000);
  });

  it('учитывает разную длину месяцев', () => {
    const feb = computeMonthBudget({
      ...base, limit: 28_000, spent: 0,
      localDate: new Date('2026-02-01T10:00:00Z'),
    });
    expect(feb.daysInMonth).toBe(28);
    expect(feb.perDayPlanned).toBe(1000);

    const leap = computeMonthBudget({
      ...base, limit: 29_000, spent: 0,
      localDate: new Date('2024-02-01T10:00:00Z'),
    });
    expect(leap.daysInMonth).toBe(29);
  });

  it('не уводит потраченное в минус', () => {
    const r = computeMonthBudget({
      ...base, limit: 1000, spent: -50,
      localDate: new Date('2026-09-10T10:00:00Z'),
    });
    expect(r.spent).toBe(0);
  });
});

describe('лимит в другой валюте', () => {
  it('пересчитанный лимит даёт пропорциональную дневную норму', () => {
    // 30 000 ₽ при курсе 90 ₽/$ — это ~333,33 $, делённые на 30 дней.
    const rub = computeMonthBudget({
      currency: 'RUB', limit: 30_000, spent: 0,
      localDate: new Date('2026-09-01T10:00:00Z'),
    });
    const usd = computeMonthBudget({
      currency: 'USD', limit: 333.33, spent: 0,
      localDate: new Date('2026-09-01T10:00:00Z'),
    });
    expect(rub.perDay).toBe(1000);
    expect(usd.perDay).toBe(11.11);
    expect(usd.currency).toBe('USD');
  });
});

describe('localNow', () => {
  it('сдвигает время на часовой пояс пользователя', () => {
    const local = localNow(new Date('2026-09-10T22:00:00Z'), 180);
    expect(local.getUTCDate()).toBe(11);
    expect(local.getUTCHours()).toBe(1);
  });
});
