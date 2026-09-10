import { describe, expect, it } from 'vitest';
import {
  lastMonths, monthKey, parseDate, previousLabel, previousRange, rangeFor,
} from '../src/lib/dates.js';

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('rangeFor', () => {
  it('месяц: с 1-го по последнее число', () => {
    const { from, to } = rangeFor('month', new Date('2025-02-14T10:00:00Z'));
    expect(iso(from)).toBe('2025-02-01');
    expect(iso(to)).toBe('2025-02-28');
  });

  it('учитывает високосный февраль', () => {
    const { to } = rangeFor('month', new Date('2024-02-14T10:00:00Z'));
    expect(iso(to)).toBe('2024-02-29');
  });

  it('неделя начинается с понедельника', () => {
    // 2025-09-10 — среда
    const { from, to } = rangeFor('week', new Date('2025-09-10T10:00:00Z'));
    expect(iso(from)).toBe('2025-09-08');
    expect(iso(to)).toBe('2025-09-14');
  });

  it('неделя для воскресенья не перескакивает вперёд', () => {
    // 2025-09-14 — воскресенье
    const { from, to } = rangeFor('week', new Date('2025-09-14T10:00:00Z'));
    expect(iso(from)).toBe('2025-09-08');
    expect(iso(to)).toBe('2025-09-14');
  });

  it('квартал охватывает три месяца', () => {
    const { from, to } = rangeFor('quarter', new Date('2025-08-20T10:00:00Z'));
    expect(iso(from)).toBe('2025-07-01');
    expect(iso(to)).toBe('2025-09-30');
  });

  it('год охватывает 12 месяцев', () => {
    const { from, to } = rangeFor('year', new Date('2025-05-05T10:00:00Z'));
    expect(iso(from)).toBe('2025-01-01');
    expect(iso(to)).toBe('2025-12-31');
  });

  it('верхняя граница включает конец дня', () => {
    const { to } = rangeFor('month', new Date('2025-03-10T00:00:00Z'));
    expect(to.getUTCHours()).toBe(23);
    expect(to.getUTCMinutes()).toBe(59);
  });
});

describe('lastMonths', () => {
  it('возвращает N месяцев, заканчивая текущим', () => {
    const months = lastMonths(new Date('2025-03-15T00:00:00Z'), 4);
    expect(months.map((m) => m.key)).toEqual(['2024-12', '2025-01', '2025-02', '2025-03']);
  });

  it('корректно переходит через границу года', () => {
    const months = lastMonths(new Date('2025-01-05T00:00:00Z'), 3);
    expect(months.map((m) => m.label)).toEqual(['Ноя', 'Дек', 'Янв']);
  });
});

describe('monthKey', () => {
  it('дополняет номер месяца нулём', () => {
    expect(monthKey(new Date('2025-04-01T00:00:00Z'))).toBe('2025-04');
  });
});

describe('parseDate', () => {
  it('возвращает fallback для мусора', () => {
    const fallback = new Date('2020-01-01T00:00:00Z');
    expect(parseDate('не дата', fallback)).toBe(fallback);
    expect(parseDate(undefined, fallback)).toBe(fallback);
  });

  it('разбирает ISO-строку', () => {
    expect(iso(parseDate('2025-06-07T08:00:00Z'))).toBe('2025-06-07');
  });
});

describe('previousRange', () => {
  it('месяц: предыдущий календарный месяц целиком', () => {
    const { from, to } = previousRange('month', new Date('2026-09-15T10:00:00Z'));
    expect(iso(from)).toBe('2026-08-01');
    expect(iso(to)).toBe('2026-08-31');
  });

  it('месяц: с 31-го числа не соскальзывает через месяц', () => {
    // Наивное «minus 1 month» от 31 марта дало бы 3 марта.
    const { from, to } = previousRange('month', new Date('2026-03-31T10:00:00Z'));
    expect(iso(from)).toBe('2026-02-01');
    expect(iso(to)).toBe('2026-02-28');
  });

  it('месяц: январь сравнивается с декабрём прошлого года', () => {
    const { from, to } = previousRange('month', new Date('2026-01-10T10:00:00Z'));
    expect(iso(from)).toBe('2025-12-01');
    expect(iso(to)).toBe('2025-12-31');
  });

  it('неделя: ровно предыдущая неделя с понедельника', () => {
    // 2026-09-10 — четверг, текущая неделя 07–13 сентября.
    const { from, to } = previousRange('week', new Date('2026-09-10T10:00:00Z'));
    expect(iso(from)).toBe('2026-08-31');
    expect(iso(to)).toBe('2026-09-06');
  });

  it('квартал: предыдущий квартал целиком', () => {
    const { from, to } = previousRange('quarter', new Date('2026-08-20T10:00:00Z'));
    expect(iso(from)).toBe('2026-04-01');
    expect(iso(to)).toBe('2026-06-30');
  });

  it('квартал: первый квартал сравнивается с четвёртым прошлого года', () => {
    const { from, to } = previousRange('quarter', new Date('2026-02-10T10:00:00Z'));
    expect(iso(from)).toBe('2025-10-01');
    expect(iso(to)).toBe('2025-12-31');
  });

  it('предыдущий период не пересекается с текущим', () => {
    for (const period of ['week', 'month', 'quarter'] as const) {
      const now = rangeFor(period, new Date('2026-09-10T10:00:00Z'));
      const prev = previousRange(period, new Date('2026-09-10T10:00:00Z'));
      expect(prev.to.getTime()).toBeLessThan(now.from.getTime());
    }
  });
});

describe('previousLabel', () => {
  it('месяц подписывается в дательном падеже', () => {
    expect(previousLabel('month', new Date('2026-09-10T00:00:00Z'))).toBe('к августу');
    expect(previousLabel('month', new Date('2026-01-05T00:00:00Z'))).toBe('к декабрю');
  });

  it('остальные периоды подписаны словами', () => {
    expect(previousLabel('week', new Date('2026-09-10T00:00:00Z'))).toBe('к прошлой неделе');
    expect(previousLabel('quarter', new Date('2026-09-10T00:00:00Z'))).toBe('к прошлому кварталу');
  });
});
