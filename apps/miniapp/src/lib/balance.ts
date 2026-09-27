import type { AccountDto, RatesDto } from '@budget/shared';

/**
 * Суммарный баланс счетов в базовой валюте.
 * `rates.rates[code]` — сколько единиц `code` в одной единице базы,
 * поэтому баланс делим на курс.
 *
 * Возвращает null, если хотя бы для одного счёта курса нет: раньше такой
 * счёт складывался один к одному, и на холодном открытии, пока курсы ещё
 * грузились, на главной успевала мелькнуть неверная сумма.
 */
export function totalBalance(
  accounts: AccountDto[],
  base: string,
  rates: RatesDto | undefined,
): number | null {
  let total = 0;
  for (const account of accounts) {
    if (account.currency === base) {
      total += account.balance;
      continue;
    }
    const rate = rates?.rates[account.currency];
    if (!rate) return null;
    total += account.balance / rate;
  }
  return Math.round((total + Number.EPSILON) * 100) / 100;
}
