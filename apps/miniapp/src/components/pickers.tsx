import { useMemo, useState } from 'react';
import type { AccountDto, CategoryDto } from '@budget/shared';
import { CURRENCIES } from '@budget/shared';
import { Sheet } from './Sheet';
import { ListRow } from './ui';
import { formatMoney } from '../lib/format';
import { tg } from '../lib/telegram';

export function AccountPickerSheet({
  open,
  onClose,
  accounts,
  selectedId,
  onSelect,
  title = 'Счёт',
  excludeId,
}: {
  open: boolean;
  onClose: () => void;
  accounts: AccountDto[];
  selectedId: number | null;
  onSelect: (account: AccountDto) => void;
  title?: string;
  excludeId?: number | null;
}) {
  const list = accounts.filter((a) => a.id !== excludeId);

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="divide-y divide-line/60">
        {list.map((account) => (
          <ListRow
            key={account.id}
            icon={account.icon}
            iconColor={account.color}
            title={account.name}
            subtitle={account.isShared ? 'Общий счёт семьи' : account.currency}
            right={
              <div className="flex items-center gap-2">
                <span className="tabular text-[15px] font-medium">
                  {formatMoney(account.balance, account.currency)}
                </span>
                {account.id === selectedId && <span className="text-accent">✓</span>}
              </div>
            }
            onClick={() => {
              onSelect(account);
              onClose();
            }}
          />
        ))}
        {list.length === 0 && (
          <div className="py-8 text-center text-[14px] text-muted">Нет доступных счетов</div>
        )}
      </div>
    </Sheet>
  );
}

export function CurrencyPickerSheet({
  open,
  onClose,
  selected,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  selected: string;
  onSelect: (code: string) => void;
}) {
  const [search, setSearch] = useState('');

  const list = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return CURRENCIES;
    return CURRENCIES.filter(
      (c) => c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query),
    );
  }, [search]);

  return (
    <Sheet open={open} onClose={onClose} title="Валюта операции">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск валюты"
        className="mb-2 w-full rounded-2xl bg-elevated px-4 py-3 text-[15px] outline-none placeholder:text-muted"
      />
      <div className="divide-y divide-line/60">
        {list.map((currency) => (
          <ListRow
            key={currency.code}
            icon={currency.flag}
            title={`${currency.code} ${currency.symbol}`}
            subtitle={currency.name}
            right={currency.code === selected ? <span className="text-accent">✓</span> : null}
            onClick={() => {
              onSelect(currency.code);
              onClose();
            }}
          />
        ))}
      </div>
    </Sheet>
  );
}

/**
 * Сетка категорий с иконками — открывается тапом по категории
 * в нижней части экрана ввода операции.
 */
export function CategoryPickerSheet({
  open,
  onClose,
  categories,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryDto[];
  selectedId: number | null;
  onSelect: (category: CategoryDto) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, CategoryDto[]>();
    for (const category of categories) {
      const key = category.group ?? 'Прочее';
      map.set(key, [...(map.get(key) ?? []), category]);
    }
    return [...map.entries()];
  }, [categories]);

  return (
    <Sheet open={open} onClose={onClose} title="Категория" tall>
      <div className="space-y-5 pt-1">
        {grouped.map(([group, items]) => (
          <div key={group}>
            <div className="mb-2 px-1 text-[13px] font-medium uppercase tracking-wide text-muted">
              {group}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {items.map((category) => {
                const active = category.id === selectedId;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      tg.haptic.select();
                      onSelect(category);
                      onClose();
                    }}
                    className="pressable flex flex-col items-center gap-1.5 rounded-2xl p-2"
                  >
                    <span
                      className="flex h-14 w-14 items-center justify-center rounded-full text-[24px] transition-all"
                      style={{
                        backgroundColor: active ? category.color : `${category.color}26`,
                        boxShadow: active ? `0 0 0 3px ${category.color}55` : undefined,
                      }}
                    >
                      {category.icon}
                    </span>
                    <span className="line-clamp-2 text-center text-[11px] leading-tight text-muted">
                      {category.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="py-10 text-center text-[14px] text-muted">Категории не найдены</div>
        )}
      </div>
    </Sheet>
  );
}
