import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { CURRENCIES } from '@budget/shared';
import { badRequest } from '../lib/errors.js';

const CODES = CURRENCIES.map((c) => c.code);

const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, RUB: 92, GEL: 2.7, KZT: 470,
  TRY: 34, AMD: 390, RSD: 108, GBP: 0.78, AED: 3.67,
  THB: 35, CNY: 7.2,
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type RateMap = Record<string, number>;

const memory = new Map<string, { date: string; rates: RateMap }>();

async function fetchFromProvider(): Promise<RateMap | null> {
  const symbols = CODES.join(',');
  const urls = [
    `${env.exchangeApiBase}/latest?base=USD&symbols=${symbols}`,
    'https://open.er-api.com/v6/latest/USD',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (!res.ok) continue;
      const json: any = await res.json();
      const rates: RateMap | undefined = json?.rates;
      if (!rates || typeof rates !== 'object') continue;
      const picked: RateMap = { USD: 1 };
      for (const code of CODES) {
        const value = Number(rates[code]);
        if (Number.isFinite(value) && value > 0) picked[code] = value;
      }

      if (Object.keys(picked).length >= Math.ceil(CODES.length / 2)) return picked;
    } catch {
    }
  }
  return null;
}

function withFallback(rates: RateMap): RateMap {
  const full: RateMap = { ...FALLBACK_USD_RATES, ...rates };
  full.USD = 1;
  return full;
}

const FALLBACK_RETRY_MS = 10 * 60_000;

let fallbackUntil = 0;

export async function getUsdRates(): Promise<RateMap> {
  const date = today();
  const cached = memory.get('usd');

  const fallbackFresh = fallbackUntil === 0 || Date.now() < fallbackUntil;
  if (cached?.date === date && fallbackFresh) return cached.rates;

  const rows = await prisma.exchangeRate.findMany({ where: { base: 'USD', date } });
  if (rows.length > 0) {
    const rates: RateMap = { USD: 1 };
    for (const row of rows) rates[row.quote] = row.rate;
    const full = withFallback(rates);
    memory.set('usd', { date, rates: full });
    fallbackUntil = 0;
    return full;
  }

  const fetched = await fetchFromProvider();

  if (!fetched) {
    const rates = withFallback({});
    memory.set('usd', { date, rates });
    fallbackUntil = Date.now() + FALLBACK_RETRY_MS;
    return rates;
  }

  await prisma.$transaction(
    Object.entries(fetched).map(([quote, rate]) =>
      prisma.exchangeRate.upsert({
        where: { base_quote_date: { base: 'USD', quote, date } },
        create: { base: 'USD', quote, rate, date },
        update: { rate },
      }),
    ),
  );

  const full = withFallback(fetched);
  memory.set('usd', { date, rates: full });
  fallbackUntil = 0;
  return full;
}

export async function getRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const rates = await getUsdRates();
  const fromRate = rates[from];
  const toRate = rates[to];

  if (!fromRate || !toRate) {
    throw badRequest(`Неизвестная валюта: ${!fromRate ? from : to}`);
  }
  return toRate / fromRate;
}

export async function convert(amount: number, from: string, to: string): Promise<{ amount: number; rate: number }> {
  const rate = await getRate(from, to);
  return { amount: round2(amount * rate), rate };
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function getRatesFor(base: string): Promise<{ base: string; date: string; rates: RateMap }> {
  const usd = await getUsdRates();
  const baseRate = usd[base] ?? 1;
  const rates: RateMap = {};
  for (const [code, rate] of Object.entries(usd)) rates[code] = round6(rate / baseRate);
  return { base, date: today(), rates };
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
