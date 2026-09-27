import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { CURRENCIES } from '@budget/shared';
import { badRequest } from '../lib/errors.js';

const CODES = CURRENCIES.map((c) => c.code);

/** Курсы «на всякий случай»: используются, если внешний API недоступен. */
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
      // Считаем ответ валидным, только если получили большинство валют.
      if (Object.keys(picked).length >= Math.ceil(CODES.length / 2)) return picked;
    } catch {
      // Пробуем следующего провайдера.
    }
  }
  return null;
}

/**
 * Дополняет карту запасными значениями.
 *
 * Провайдер считается валидным, если отдал хотя бы половину валют, но
 * недостающие раньше просто отсутствовали в карте. Тогда getRate молча
 * возвращал единицу, и 100 батов сохранялись в рублёвый счёт как 100 ₽ —
 * уже навсегда, в convertedAmount и в балансе.
 */
function withFallback(rates: RateMap): RateMap {
  const full: RateMap = { ...FALLBACK_USD_RATES, ...rates };
  full.USD = 1;
  return full;
}

/**
 * Возвращает карту курсов относительно USD, кэшируя её в БД на сутки.
 */
/** Как долго держим запасные курсы, прежде чем снова постучаться к провайдеру. */
const FALLBACK_RETRY_MS = 10 * 60_000;

let fallbackUntil = 0;

export async function getUsdRates(): Promise<RateMap> {
  const date = today();
  const cached = memory.get('usd');
  // На запасных курсах кэш живёт до конца окна, потом пробуем провайдера снова.
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
    /*
     * Провайдер недоступен. Запасные курсы в базу НЕ пишем: раньше они
     * оседали там на весь день, и сервер больше не пробовал сходить за
     * настоящими, даже когда провайдер оживал через минуту.
     */
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

/** Курс перевода 1 единицы `from` в `to`. */
export async function getRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const rates = await getUsdRates();
  const fromRate = rates[from];
  const toRate = rates[to];
  // Курса нет даже в запасных: валюта неизвестна приложению.
  if (!fromRate || !toRate) {
    throw badRequest(`Неизвестная валюта: ${!fromRate ? from : to}`);
  }
  return toRate / fromRate;
}

/** Конвертация суммы с округлением до 2 знаков. */
export async function convert(amount: number, from: string, to: string): Promise<{ amount: number; rate: number }> {
  const rate = await getRate(from, to);
  return { amount: round2(amount * rate), rate };
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Курсы относительно произвольной базы — для клиента. */
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
