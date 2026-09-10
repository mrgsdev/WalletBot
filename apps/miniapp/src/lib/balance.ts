import type { AccountDto, RatesDto } from '@budget/shared';

/**
 * Суммарный баланс счетов в базовой валюте.
 * `rates.rates[code]` — сколько единиц `code` в одной единице базы,
 * поэтому баланс делим на курс.
 */
export function totalBalance(
  accounts: AccountDto[],
  base: string,
  rates: RatesDto | undefined,
): number {
  let total = 0;
  for (const account of accounts) {
    if (account.currency === base) {
      total += account.balance;
      continue;
    }
    const rate = rates?.rates[account.currency];
    total += rate ? account.balance / rate : account.balance;
  }
  return Math.round((total + Number.EPSILON) * 100) / 100;
}
