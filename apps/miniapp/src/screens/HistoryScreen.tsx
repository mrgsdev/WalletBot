import { useMemo, useState } from 'react';
import { ChevronLeft, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { TransactionDto } from '@budget/shared';
import { CategoryIcon } from '../components/CategoryIcon';
import { AccountIcon } from '../components/AccountIcon';
import { TransactionRow } from '../components/TransactionRow';
import { Sheet } from '../components/Sheet';
import { Segmented } from '../components/Segmented';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { useAccounts, useCategories, useTransactions, type TransactionFilters } from '../lib/queries';
import { dayKey, formatDateFull, formatMoney } from '../lib/format';
import { tg } from '../lib/telegram';
import { useIsFamilyBudget } from '../hooks/useCurrentBudget';

/** История операций с фильтрами по типу, счёту, категории и периоду. */
export function HistoryScreen({ onEdit }: { onEdit: (transaction: TransactionDto) => void }) {
  const navigate = useNavigate();
  const isFamily = useIsFamilyBudget();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [type, setType] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();

  const filters: TransactionFilters = {
    type: type === 'all' ? null : type,
    accountId,
    categoryId: categoryIds.length ? categoryIds : null,
    from: from ? new Date(from).toISOString() : null,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : null,
    search: search.trim() || null,
  };

  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTransactions(filters);

  const items = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  const groups = useMemo(() => {
    const map = new Map<string, TransactionDto[]>();
    for (const item of items) {
      const key = dayKey(item.date);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [items]);

  const activeFilters =
    (type !== 'all' ? 1 : 0) +
    (accountId !== null ? 1 : 0) +
    (categoryIds.length ? 1 : 0) +
    (from || to ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const reset = () => {
    setType('all');
    setAccountId(null);
    setCategoryIds([]);
    setFrom('');
    setTo('');
    setSearch('');
  };

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-ink/90 px-4 pb-3 pt-[calc(10px+var(--safe-top))] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => {
            tg.haptic.light();
            navigate(-1);
          }}
          className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-card"
          aria-label="Назад"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold">История</h1>
        <button
          type="button"
          onClick={() => {
            tg.haptic.light();
            setFiltersOpen(true);
          }}
          className="pressable relative flex h-10 w-10 items-center justify-center rounded-full bg-card"
          aria-label="Фильтры"
        >
          <SlidersHorizontal size={18} />
          {activeFilters > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-black">
              {activeFilters}
            </span>
          )}
        </button>
      </header>

      {isError ? (
        <ErrorState message={(error as Error)?.message ?? ''} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-3 px-5 py-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="🧾"
          title={activeFilters ? 'Ничего не найдено' : 'История пуста'}
          hint={
            activeFilters
              ? 'Попробуйте изменить фильтры.'
              : 'Здесь появятся все операции — по мере того как вы их добавляете.'
          }
          action={
            activeFilters ? (
              <button
                type="button"
                onClick={reset}
                className="pressable mt-1 rounded-full bg-elevated px-5 py-2.5 text-[14px] font-medium"
              >
                Сбросить фильтры
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4 px-4">
          {groups.map(([key, list]) => {
            const dayTotal = list.reduce((sum, item) => {
              if (item.type === 'transfer') return sum;
              return sum + (item.type === 'income' ? item.convertedAmount : -item.convertedAmount);
            }, 0);

            return (
              <section key={key}>
                <div className="flex items-baseline justify-between px-2 pb-1">
                  <h2 className="text-[14px] font-medium text-muted">{formatDateFull(list[0].date)}</h2>
                  <span className={`tabular text-[13px] ${dayTotal >= 0 ? 'text-positive' : 'text-muted'}`}>
                    {dayTotal >= 0 ? '+' : '−'}
                    {formatMoney(Math.abs(dayTotal), list[0].accountCurrency)}
                  </span>
                </div>
                <div className="divide-y divide-line/50 rounded-3xl bg-card px-4">
                  {list.map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      showAuthor={isFamily}
                      onClick={() => onEdit(transaction)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="pressable mx-auto block rounded-full bg-elevated px-6 py-2.5 text-[14px] font-medium disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}
            </button>
          )}
        </div>
      )}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Фильтры" tall>
        <div className="space-y-5 pt-1">
          <div>
            <div className="mb-2 text-[13px] text-muted">Тип операции</div>
            <Segmented
              value={type}
              onChange={setType}
              size="sm"
              options={[
                { value: 'all', label: 'Все' },
                { value: 'expense', label: 'Расход' },
                { value: 'income', label: 'Доход' },
                { value: 'transfer', label: 'Перевод' },
              ]}
            />
          </div>

          <div>
            <div className="mb-2 text-[13px] text-muted">Поиск по комментарию</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Например: такси"
              className="w-full rounded-2xl bg-elevated px-4 py-3 text-[15px] outline-none placeholder:text-muted"
            />
          </div>

          <div>
            <div className="mb-2 text-[13px] text-muted">Период</div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="flex-1 rounded-2xl bg-elevated px-4 py-3 text-[15px] outline-none"
              />
              <span className="text-muted">—</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="flex-1 rounded-2xl bg-elevated px-4 py-3 text-[15px] outline-none"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-[13px] text-muted">Счёт</div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={accountId === null} onClick={() => setAccountId(null)}>
                Все счета
              </FilterChip>
              {accounts.map((account) => (
                <FilterChip
                  key={account.id}
                  active={accountId === account.id}
                  onClick={() => setAccountId(accountId === account.id ? null : account.id)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <AccountIcon
                      icon={account.icon}
                      color={account.color}
                      className="h-5 w-5"
                      emojiClassName="text-[12px]"
                    />
                    {account.name}
                  </span>
                </FilterChip>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[13px] text-muted">Категории</div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <FilterChip
                  key={category.id}
                  active={categoryIds.includes(category.id)}
                  onClick={() =>
                    setCategoryIds((prev) =>
                      prev.includes(category.id)
                        ? prev.filter((id) => id !== category.id)
                        : [...prev, category.id],
                    )
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    <CategoryIcon
                      icon={category.icon}
                      color={category.color}
                      className="h-5 w-5"
                      emojiClassName="text-[12px]"
                    />
                    {category.name}
                  </span>
                </FilterChip>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={reset}
              className="pressable flex-1 rounded-2xl bg-elevated px-5 py-3 text-[15px] font-medium"
            >
              Сбросить
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="pressable flex-1 rounded-2xl bg-content px-5 py-3 text-[15px] font-semibold text-ink"
            >
              Показать
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        tg.haptic.select();
        onClick();
      }}
      className={`pressable rounded-full px-3.5 py-2 text-[13px] font-medium ${
        active ? 'bg-content text-ink' : 'bg-elevated text-content'
      }`}
    >
      {children}
    </button>
  );
}
