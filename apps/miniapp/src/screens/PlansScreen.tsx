import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CategoryIcon } from '../components/CategoryIcon';
import { Segmented } from '../components/Segmented';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { usePlans, useSavePlan } from '../lib/queries';
import { formatMoney, MONTHS_NOM } from '../lib/format';
import { tg } from '../lib/telegram';

/** План на месяц по категориям и сравнение с фактом. */
export function PlansScreen() {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [type, setType] = useState<'expense' | 'income'>('expense');

  const { data, isLoading, isError, refetch } = usePlans(year, month);
  const savePlan = useSavePlan();
  const [draft, setDraft] = useState<Record<number, string>>({});

  const items = useMemo(
    () => (data?.items ?? []).filter((item) => item.categoryType === type),
    [data, type],
  );

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, item) => ({
          plan: acc.plan + item.plannedAmount,
          fact: acc.fact + item.factAmount,
        }),
        { plan: 0, fact: 0 },
      ),
    [items],
  );

  const shift = (delta: number) => {
    tg.haptic.select();
    const date = new Date(year, month - 1 + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
    setDraft({});
  };

  const commit = (categoryId: number, value: string) => {
    const parsed = Number(value.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    savePlan.mutate({ categoryId, year, month, plannedAmount: parsed });
    tg.haptic.light();
  };

  const currency = data?.currency ?? 'RUB';

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-ink/90 px-4 pb-3 pt-[calc(10px+var(--safe-top))] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-card"
          aria-label="Назад"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold">План на месяц</h1>
        <div className="w-10" />
      </header>

      <div className="flex items-center justify-between px-4 pb-3">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-card"
          aria-label="Предыдущий месяц"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-[16px] font-semibold">
          {MONTHS_NOM[month - 1]} {year}
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-card"
          aria-label="Следующий месяц"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex justify-center pb-3">
        <Segmented
          size="sm"
          value={type}
          onChange={setType}
          options={[
            { value: 'expense', label: 'Расходы' },
            { value: 'income', label: 'Доходы' },
          ]}
        />
      </div>

      {isError ? (
        <ErrorState message="План не загрузился" onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-3 px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="🗒" title="Нет категорий" hint="Сначала создайте категории этого типа." />
      ) : (
        <div className="px-4">
          <div className="mb-3 flex items-center justify-between rounded-2xl bg-card px-4 py-3">
            <div>
              <div className="text-[12px] text-muted">План</div>
              <div className="tabular text-[17px] font-semibold">{formatMoney(totals.plan, currency)}</div>
            </div>
            <div className="text-right">
              <div className="text-[12px] text-muted">Факт</div>
              <div
                className={`tabular text-[17px] font-semibold ${
                  type === 'expense' && totals.fact > totals.plan && totals.plan > 0
                    ? 'text-negative'
                    : ''
                }`}
              >
                {formatMoney(totals.fact, currency)}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {items.map((item) => {
              const progress =
                item.plannedAmount > 0 ? Math.min((item.factAmount / item.plannedAmount) * 100, 100) : 0;
              const over = item.plannedAmount > 0 && item.factAmount > item.plannedAmount;

              return (
                <div key={item.categoryId} className="rounded-2xl bg-card p-3">
                  <div className="flex items-center gap-3">
                    <CategoryIcon
                      icon={item.categoryIcon}
                      color={item.categoryColor}
                      className="h-9 w-9"
                      emojiClassName="text-[16px]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-medium">{item.categoryName}</div>
                      <div className="tabular text-[12px] text-muted">
                        факт {formatMoney(item.factAmount, currency)}
                      </div>
                    </div>
                    <input
                      inputMode="decimal"
                      value={draft[item.categoryId] ?? (item.plannedAmount || '')}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, [item.categoryId]: e.target.value }))
                      }
                      onBlur={(e) => commit(item.categoryId, e.target.value)}
                      placeholder="План"
                      className="tabular w-24 shrink-0 rounded-xl bg-elevated px-3 py-2 text-right text-[15px] outline-none placeholder:text-muted"
                    />
                  </div>

                  {item.plannedAmount > 0 && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: over ? '#FF6E6E' : item.categoryColor,
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
