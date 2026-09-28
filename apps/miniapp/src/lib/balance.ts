import type { AccountDto, RatesDto } from '@budget/shared';

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
