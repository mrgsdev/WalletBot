import { useMemo, useState } from 'react';
import type { AccountDto, RatesDto } from '@budget/shared';
import { currencySymbol } from '@budget/shared';
import { AccountIcon } from './AccountIcon';
import { Sheet } from './Sheet';
import { formatMoney, formatNumber } from '../lib/format';
import { tg } from '../lib/telegram';

export interface CurrencyGroup {
  currency: string;
  /** Сумма в своей валюте. */
  amount: number;
  /** Та же сумма, приведённая к валюте отчётов. */
  inBase: number;
  /** Сколько единиц валюты в одной единице базовой. */
  rate: number;
  accounts: AccountDto[];
}

/** Группирует счета по валютам и пересчитывает каждую группу в валюту отчётов. */
export function groupByCurrency(
  accounts: AccountDto[],
  base: string,
  rates: RatesDto | undefined,
): CurrencyGroup[] {
  const map = new Map<string, CurrencyGroup>();

  for (const account of accounts) {
    const rate = account.currency === base ? 1 : rates?.rates[account.currency] ?? 1;
    const group = map.get(account.currency) ?? {
      currency: account.currency,
      amount: 0,
      inBase: 0,
      rate,
      accounts: [],
    };
    group.amount += account.balance;
    group.inBase += rate ? account.balance / rate : account.balance;
    group.accounts.push(account);
    map.set(account.currency, group);
  }

  // Базовая валюта первой, остальные — по убыванию вклада.
  return [...map.values()].sort((a, b) => {
    if (a.currency === base) return -1;
    if (b.currency === base) return 1;
    return b.inBase - a.inBase;
  });
}

/**
 * Разбивка баланса по валютам.
 *
 * Общий баланс сводит всё к валюте отчётов, и по нему не видно, сколько
 * денег лежит в каждой валюте на самом деле. Показываем разбивку, только
 * если валюта не одна — иначе это лишний шум.
 */
export function CurrencyBreakdown({
  accounts,
  base,
  rates,
}: {
  accounts: AccountDto[];
  base: string;
  rates: RatesDto | undefined;
}) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => groupByCurrency(accounts, base, rates), [accounts, base, rates]);
  const others = groups.filter((g) => g.currency !== base);

  if (others.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          tg.haptic.light();
          setOpen(true);
        }}
        className="scroll-x -mx-1 mt-2 flex items-center gap-1.5 px-1"
      >
        <span className="shrink-0 text-[12px] text-muted">в том числе</span>
        {others.map((group) => (
          <span
            key={group.currency}
            className="tabular shrink-0 rounded-full bg-elevated/70 px-2.5 py-1 text-[12px] font-medium"
          >
            {formatMoney(group.amount, group.currency)}
          </span>
        ))}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Баланс по валютам" tall>
        <div className="space-y-2.5 pt-1">
          {groups.map((group) => (
            <div key={group.currency} className="rounded-2xl bg-elevated/50 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-semibold">
                  {currencySymbol(group.currency)} {group.currency}
                </span>
                <span className="tabular text-[17px] font-bold">
                  {formatMoney(group.amount, group.currency)}
                </span>
              </div>

              {group.currency !== base && (
                <div className="mt-1 flex items-baseline justify-between gap-3 text-[13px] text-muted">
                  {/* «1 € = 99 ₽» читается привычнее, чем «1 ₽ = 0,01 €». */}
                  <span>
                    1 {currencySymbol(group.currency)} ={' '}
                    {formatNumber(group.rate ? 1 / group.rate : 0, true)}{' '}
                    {currencySymbol(base)}
                  </span>
                  <span className="tabular">≈ {formatMoney(group.inBase, base)}</span>
                </div>
              )}

              <div className="mt-2.5 space-y-1 border-t border-line/50 pt-2.5">
                {group.accounts.map((account) => (
                  <div key={account.id} className="flex items-center gap-2 text-[13px]">
                    <AccountIcon
                      icon={account.icon}
                      color={account.color}
                      className="h-5 w-5"
                      emojiClassName="text-[12px]"
                    />
                    <span className="min-w-0 flex-1 truncate text-muted">{account.name}</span>
                    <span className="tabular shrink-0">
                      {formatMoney(account.balance, account.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <p className="px-1 text-[12px] leading-snug text-muted">
            Общий баланс на главном экране приведён к валюте отчётов по текущему курсу.
            Валюта меняется в «Ещё» → «Валюта отчётов».
          </p>
        </div>
      </Sheet>
    </>
  );
}
