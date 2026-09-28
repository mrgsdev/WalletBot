import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

const TODAY = new Date().toISOString().slice(0, 10);

async function freshCurrency() {
  vi.resetModules();
  return import('../src/services/currency.js');
}

function providerReturning(rates: Record<string, number>) {
  return vi.fn(async () => ({ ok: true, json: async () => ({ rates }) }));
}

beforeEach(async () => {
  await prisma.exchangeRate.deleteMany();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getUsdRates', () => {
  it('дополняет неполный ответ провайдера запасными курсами', async () => {
    vi.stubGlobal('fetch', providerReturning({ EUR: 0.9, RUB: 95, GEL: 2.7, KZT: 480, TRY: 35, GBP: 0.8 }));
    const { getUsdRates } = await freshCurrency();

    const rates = await getUsdRates();

    expect(rates.RUB).toBe(95);
    expect(rates.USD).toBe(1);

    expect(rates.THB).toBeGreaterThan(1);
    expect(rates.AMD).toBeGreaterThan(1);
  });

  it('не записывает запасные курсы в базу, когда провайдер недоступен', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('нет сети');
    });
    vi.stubGlobal('fetch', fetchMock);
    const { getUsdRates } = await freshCurrency();

    const rates = await getUsdRates();

    expect(fetchMock).toHaveBeenCalled();
    expect(rates.RUB).toBeGreaterThan(1);

    expect(await prisma.exchangeRate.count({ where: { base: 'USD', date: TODAY } })).toBe(0);
  });

  it('сохраняет настоящие курсы провайдера', async () => {
    vi.stubGlobal('fetch', providerReturning({ EUR: 0.9, RUB: 95, GEL: 2.7, KZT: 480, TRY: 35, GBP: 0.8 }));
    const { getUsdRates } = await freshCurrency();

    await getUsdRates();

    const saved = await prisma.exchangeRate.findMany({ where: { base: 'USD', date: TODAY } });
    expect(saved.find((r) => r.quote === 'RUB')?.rate).toBe(95);
  });
});

describe('getRate', () => {
  it('не подменяет неизвестную валюту курсом один к одному', async () => {
    vi.stubGlobal('fetch', providerReturning({ RUB: 90, EUR: 0.9 }));
    const { getRate } = await freshCurrency();

    await expect(getRate('XYZ', 'RUB')).rejects.toThrow(/Неизвестная валюта/);
  });

  it('считает кросс-курс через доллар', async () => {
    vi.stubGlobal('fetch', providerReturning({ EUR: 0.9, RUB: 90, GEL: 2.7, KZT: 480, TRY: 35, GBP: 0.8 }));
    const { getRate } = await freshCurrency();

    expect(await getRate('EUR', 'RUB')).toBeCloseTo(100, 6);
  });

  it('одинаковые валюты не требуют курса', async () => {
    const { getRate } = await freshCurrency();
    await expect(getRate('RUB', 'RUB')).resolves.toBe(1);
  });
});
