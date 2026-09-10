import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, History, LineChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DonutChart } from '../charts/DonutChart';
import { Segmented } from '../components/Segmented';
import { TourTarget } from '../components/Tour';
import { ChangeBadge } from '../components/ChangeBadge';
import { BudgetSwitcher } from '../components/BudgetSwitcher';
import { Sheet } from '../components/Sheet';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { useAccounts, useCategoryStats } from '../lib/queries';
import { formatCompact, formatMoney } from '../lib/format';
import { buildPeriodTabs, type PeriodKind } from '../lib/periods';
import { useAppStore } from '../store/app';
import { useStatsAccount } from '../hooks/useStatsAccount';
import { tg } from '../lib/telegram';

/**
 * Экран статистики с кольцевой диаграммой по категориям (референс №2).
 */
export function StatsScreen() {
  const navigate = useNavigate();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [period, setPeriod] = useState<PeriodKind>('month');
  const [typeSheet, setTypeSheet] = useState(false);
  const [accountSheet, setAccountSheet] = useState(false);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);

  const accountId = useStatsAccount();
  const setAccountId = useAppStore((s) => s.setStatsAccountId);
  const { data: accounts = [] } = useAccounts();

  const tabs = useMemo(() => buildPeriodTabs(period), [period]);
  const [tabKey, setTabKey] = useState(() => tabs[tabs.length - 1]?.key);
  const activeTab = tabs.find((t) => t.key === tabKey) ?? tabs[tabs.length - 1];

  // При смене типа периода выбираем последнюю вкладку.
  useEffect(() => {
    setTabKey(tabs[tabs.length - 1]?.key);
  }, [tabs]);

  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const active = stripRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [tabKey, tabs]);

  const { data, isLoading, isError, error, refetch } = useCategoryStats({
    type,
    period,
    anchor: (activeTab?.anchor ?? new Date()).toISOString(),
    accountId,
  });

  const accountName =
    accountId === null ? 'Все счета' : accounts.find((a) => a.id === accountId)?.name ?? 'Все счета';

  const items = data?.items ?? [];
  const segments = items.map((item) => ({
    id: item.categoryId ?? 'none',
    value: item.amount,
    color: item.color,
  }));

  const highlighted = items.find((i) => (i.categoryId ?? 'none') === activeCategory) ?? null;

  return (
    <div className="pb-36">
      <header className="sticky top-0 z-20 bg-ink/90 px-4 pb-3 pt-[calc(10px+var(--safe-top))] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <BudgetSwitcher />
          <button
            type="button"
            onClick={() => {
              tg.haptic.light();
              setAccountSheet(true);
            }}
            className="pressable flex items-center gap-1 rounded-full bg-card px-3.5 py-2 text-[14px]"
          >
            <span className="max-w-[110px] truncate">{accountName}</span>
            <ChevronDown size={15} className="text-muted" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <TourTarget id="stats-type">
          <button
            type="button"
            onClick={() => {
              tg.haptic.light();
              setTypeSheet(true);
            }}
            className="pressable flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-[14px] font-medium"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: type === 'expense' ? '#FF6E8A' : '#9BE870' }}
            />
            {type === 'expense' ? 'Расходы' : 'Доходы'}
            <ChevronDown size={15} className="text-muted" />
          </button>
          </TourTarget>

          <TourTarget id="stats-period">
            <Segmented
              size="sm"
              value={period}
              onChange={(value) => setPeriod(value)}
              options={[
                { value: 'week', label: 'Неделя' },
                { value: 'month', label: 'Месяц' },
                { value: 'quarter', label: 'Квартал' },
              ]}
            />
          </TourTarget>
        </div>
      </header>

      {/* Лента периодов */}
      <div ref={stripRef} className="scroll-x flex gap-4 px-5 py-3">
        {tabs.map((tab) => {
          const active = tab.key === activeTab?.key;
          return (
            <button
              key={tab.key}
              data-active={active}
              type="button"
              onClick={() => {
                tg.haptic.select();
                setTabKey(tab.key);
              }}
              className={`shrink-0 whitespace-nowrap text-[17px] transition-colors ${
                active ? 'font-semibold text-content' : 'text-muted/70'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
        {/* Хвостовой отступ, чтобы последний период тоже мог встать по центру. */}
        <span className="w-[45vw] shrink-0" aria-hidden />
      </div>

      {isError ? (
        <ErrorState message={(error as Error)?.message ?? ''} onRetry={() => refetch()} />
      ) : isLoading ? (
        <StatsSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon="📊"
          title="Пока нет данных"
          hint={`За выбранный период ${type === 'expense' ? 'расходов' : 'доходов'} не было. Добавьте операцию — и график оживёт.`}
        />
      ) : (
        <>
          <TourTarget id="stats-donut" className="flex justify-center py-2">
            <DonutChart
              segments={segments}
              size={248}
              thickness={28}
              gap={12}
              activeId={activeCategory}
              onSegmentClick={(id) => {
                tg.haptic.select();
                setActiveCategory((prev) => (prev === id ? null : (id as number)));
              }}
            >
              <motion.div
                key={highlighted?.categoryId ?? 'total'}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-8"
              >
                {highlighted ? (
                  <>
                    <div className="text-[28px]">{highlighted.icon}</div>
                    <div className="tabular text-[26px] font-bold leading-tight">
                      {formatCompact(highlighted.amount, data!.currency)}
                    </div>
                    <div className="line-clamp-2 text-[12px] text-muted">{highlighted.name}</div>
                    <div className="mt-0.5">
                      <ChangeBadge percent={highlighted.changePercent} type={type} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="tabular text-[38px] font-bold leading-none">
                      {formatCompact(data!.total, data!.currency)}
                    </div>
                    <div className="mt-1 text-[12px] text-muted">
                      {type === 'expense' ? 'Расходы' : 'Доходы'} за период
                    </div>
                    {data!.previousChangePercent !== null && (
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <ChangeBadge percent={data!.previousChangePercent} type={type} size="md" />
                        <span className="text-[11px] text-muted">{data!.previousLabel}</span>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </DonutChart>
          </TourTarget>

          {/* Список категорий в две колонки */}
          <TourTarget id="stats-list" className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 pt-3">
            {items.map((item) => {
              const id = item.categoryId ?? 'none';
              const dimmed = activeCategory !== null && activeCategory !== id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    tg.haptic.select();
                    setActiveCategory((prev) => (prev === id ? null : (id as number)));
                  }}
                  className={`flex items-center gap-2 py-1.5 text-left transition-opacity ${
                    dimmed ? 'opacity-40' : ''
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{item.name}</span>
                  <span className="shrink-0 text-right">
                    <span className="tabular block text-[13.5px] font-medium">
                      {formatMoney(item.amount, data!.currency)}
                    </span>
                    <ChangeBadge percent={item.changePercent} type={type} />
                  </span>
                </button>
              );
            })}
          </TourTarget>

          <div className="flex justify-center gap-2 px-5 pt-6">
            <button
              type="button"
              onClick={() => {
                tg.haptic.light();
                navigate('/history');
              }}
              className="pressable flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-[15px] font-medium"
            >
              <History size={16} />
              История
            </button>
            <button
              type="button"
              onClick={() => {
                tg.haptic.light();
                navigate('/summary');
              }}
              className="pressable flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-[15px] font-medium"
            >
              <LineChart size={16} />
              Сводка
            </button>
          </div>
        </>
      )}

      <Sheet open={typeSheet} onClose={() => setTypeSheet(false)} title="Что показываем">
        {(['expense', 'income'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              tg.haptic.select();
              setType(value);
              setActiveCategory(null);
              setTypeSheet(false);
            }}
            className="flex w-full items-center gap-3 border-b border-line/60 py-3.5 text-left last:border-0"
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: value === 'expense' ? '#FF6E8A' : '#9BE870' }}
            />
            <span className="flex-1 text-[15px] font-medium">
              {value === 'expense' ? 'Расходы' : 'Доходы'}
            </span>
            {type === value && <span className="text-accent">✓</span>}
          </button>
        ))}
      </Sheet>

      <Sheet open={accountSheet} onClose={() => setAccountSheet(false)} title="Счёт">
        <button
          type="button"
          onClick={() => {
            setAccountId(null);
            setAccountSheet(false);
          }}
          className="flex w-full items-center justify-between border-b border-line/60 py-3.5 text-[15px] font-medium"
        >
          Все счета
          {accountId === null && <span className="text-accent">✓</span>}
        </button>
        {accounts.map((account) => (
          <button
            key={account.id}
            type="button"
            onClick={() => {
              setAccountId(account.id);
              setAccountSheet(false);
            }}
            className="flex w-full items-center gap-3 border-b border-line/60 py-3.5 text-left last:border-0"
          >
            <span className="text-[18px]">{account.icon}</span>
            <span className="flex-1 text-[15px] font-medium">{account.name}</span>
            <span className="tabular text-[14px] text-muted">
              {formatMoney(account.balance, account.currency)}
            </span>
            {accountId === account.id && <span className="text-accent">✓</span>}
          </button>
        ))}
      </Sheet>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6 px-5 py-6">
      <Skeleton className="h-[248px] w-[248px] rounded-full" />
      <div className="grid w-full grid-cols-2 gap-x-4 gap-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </div>
  );
}
