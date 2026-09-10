import { describe, expect, it } from 'vitest';
import { isTimeToNotify, localDayStart, localTimeString } from '../src/services/reminders.js';

const MSK = 180; // UTC+3

describe('localTimeString', () => {
  it('переводит UTC в локальное время пользователя', () => {
    expect(localTimeString(new Date('2026-09-10T18:05:00Z'), MSK)).toBe('21:05');
  });

  it('корректно перескакивает через полночь', () => {
    expect(localTimeString(new Date('2026-09-10T22:30:00Z'), MSK)).toBe('01:30');
  });

  it('работает с отрицательным смещением', () => {
    expect(localTimeString(new Date('2026-09-10T12:00:00Z'), -300)).toBe('07:00');
  });
});

describe('isTimeToNotify', () => {
  it('срабатывает точно в назначенное время', () => {
    expect(isTimeToNotify(new Date('2026-09-10T18:00:00Z'), MSK, '21:00')).toBe(true);
  });

  it('срабатывает внутри окна допуска', () => {
    expect(isTimeToNotify(new Date('2026-09-10T18:04:00Z'), MSK, '21:00')).toBe(true);
  });

  it('не срабатывает раньше времени', () => {
    expect(isTimeToNotify(new Date('2026-09-10T17:59:00Z'), MSK, '21:00')).toBe(false);
  });

  it('не срабатывает после окна', () => {
    expect(isTimeToNotify(new Date('2026-09-10T18:06:00Z'), MSK, '21:00')).toBe(false);
  });

  it('учитывает часовой пояс пользователя', () => {
    // 18:00 UTC — это 21:00 в Москве, но 13:00 в Нью-Йорке.
    expect(isTimeToNotify(new Date('2026-09-10T18:00:00Z'), -300, '21:00')).toBe(false);
    expect(isTimeToNotify(new Date('2026-09-11T02:00:00Z'), -300, '21:00')).toBe(true);
  });

  it('игнорирует некорректное время', () => {
    expect(isTimeToNotify(new Date(), MSK, 'не время')).toBe(false);
  });
});

describe('localDayStart', () => {
  it('возвращает полночь по местному времени в UTC', () => {
    // 10 сентября 01:30 МСК = 9 сентября 22:30 UTC, начало суток — 9-го в 21:00 UTC.
    const start = localDayStart(new Date('2026-09-09T22:30:00Z'), MSK);
    expect(start.toISOString()).toBe('2026-09-09T21:00:00.000Z');
  });

  it('для полудня даёт ту же локальную дату', () => {
    const start = localDayStart(new Date('2026-09-10T12:00:00Z'), MSK);
    expect(start.toISOString()).toBe('2026-09-09T21:00:00.000Z');
  });
});

describe('окно срабатывания и дубли', () => {
  it('окно шире минуты — иначе напоминание пропадёт при задержке опроса', () => {
    // Бот опрашивает раз в минуту; если он опоздал на пару минут,
    // напоминание всё равно должно уйти.
    const target = '21:00';
    const hits = [0, 1, 2, 3, 4].map((m) =>
      isTimeToNotify(new Date(`2026-09-10T18:0${m}:00Z`), MSK, target),
    );
    expect(hits.every(Boolean)).toBe(true);
  });

  it('за пределами окна не срабатывает', () => {
    expect(isTimeToNotify(new Date('2026-09-10T18:05:00Z'), MSK, '21:00')).toBe(false);
    expect(isTimeToNotify(new Date('2026-09-10T17:59:00Z'), MSK, '21:00')).toBe(false);
  });
});
