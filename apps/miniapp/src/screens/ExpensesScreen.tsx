import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DonutChart } from '../charts/DonutChart';
import coinSmile from '../assets/coin-smile.png';
import { CategoryIcon } from '../components/CategoryIcon';
import { ChangeBadge } from '../components/ChangeBadge';
import { PeriodRow, PeriodSheet } from '../components/PeriodSheet';
import { Segmented } from '../components/Segmented';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { useCategoryStats, useSummaryStats } from '../lib/queries';
import { useStatsAccount } from '../hooks/useStatsAccount';
import { pastel } from '../lib/palette';
import { daysElapsed } from '../lib/structure';
import { formatCompact, formatMoney, formatNumber, MONTHS_NOM } from '../lib/format';
import { tg } from '../lib/telegram';

export function ExpensesScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const now = new Date();

  const initialMode = (location.state as { mode?: 'month' | 'year' } | null)?.mode ?? 'month';
  const [mode, setMode] = useState<'month' | 'year'>(initialMode);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [pickerOpen, setPickerOpen] = useState(false);

  const accountId = useStatsAccount();

  const anchor = useMemo(
    () => new Date(Date.UTC(year, mode === 'year' ? 11 : month - 1, 15)).toISOString(),
    [year, month, mode],
  );

  const summary = useSummaryStats({ mode, anchor, accountId });
  const categories = useCategoryStats({ type: 'expense', period: mode, anchor, accountId });

  const data = summary.data;
  const isLoading = summary.isLoading || categories.isLoading;
  const isError = summary.isError || categories.isError;
  const error = (summary.error ?? categories.error) as Error | null;

  const days = daysElapsed(mode, year, month, now);
  const total = data?.expense ?? 0;
  const perDay = days > 0 ? total / days : 0;

  const previous = categories.data?.previousTotal ?? 0;
  const delta = total - previous;

  const trend = data?.expenseTrend ?? [];
  const peak = Math.max(1, ...trend.map((point) => point.value));
  const items = categories.data?.items ?? [];

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
        <h1 className="flex-1 text-center text-[17px] font-semibold">Расходы</h1>
        <div className="w-10" />
      </header>

      <div className="space-y-4 px-4 pt-1">
        <div className="flex justify-center">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'month', label: 'Месяц' },
              { value: 'year', label: 'Год' },
            ]}
          />
        </div>

        <PeriodRow
          label={mode === 'year' ? 'Год' : 'Месяц'}
          value={mode === 'year' ? String(year) : `${MONTHS_NOM[month - 1]} ${year}`}
          right={<ChevronRight size={17} className="text-muted" />}
          onClick={() => {
            tg.haptic.light();
            setPickerOpen(true);
          }}
        />

        {isError ? (
          <ErrorState
            message={error?.message ?? ''}
            onRetry={() => {
              void summary.refetch();
              void categories.refetch();
            }}
          />
        ) : isLoading || !data ? (
          <div className="space-y-4">
            <Skeleton className="h-72 w-full rounded-3xl" />
            <Skeleton className="h-24 w-full rounded-3xl" />
          </div>
        ) : total === 0 ? (
          <EmptyState
            iconBare
            icon={<img src={coinSmile} alt="" className="h-20 w-20 object-contain" />}
            title="Расходов нет"
            hint={`За ${mode === 'year' ? 'этот год' : 'этот месяц'} трат не записано. Выберите другой период.`}
          />
        ) : (
          <>
            <section className="rounded-3xl bg-card p-4">
              <div className="flex justify-center pb-1 pt-2">
                <DonutChart
                  size={196}
                  thickness={24}
                  gap={10}
                  segments={data.expenseGroups.map((group) => ({
                    id: group.group,
                    value: group.amount,
                    color: group.color,
                  }))}
                >
                  <div className="tabular text-[26px] font-bold leading-none">
                    {formatCompact(total, data.currency)}
                  </div>
                  <div className="mt-1 text-[12px] text-muted">всего</div>
                </DonutChart>
              </div>

              <div className="mt-3 space-y-3">
                {data.expenseGroups.map((group, index) => (
                  <div key={group.group}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: pastel(group.color, index) }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[14px]">{group.group}</span>
                      <span className="tabular shrink-0 text-[13px] text-muted">
                        {formatMoney(group.amount, data.currency)}
                      </span>
                      <span className="tabular w-12 shrink-0 text-right text-[14px] font-semibold">
                        {formatNumber(group.share)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-elevated/60">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: pastel(group.color, index) }}
                        initial={{ width: 0 }}
                        animate={{ width: `${group.share}%` }}
                        transition={{ delay: index * 0.03, duration: 0.35 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <Metric
                title="Расход в день"
                value={formatMoney(perDay, data.currency)}
                hint={`в среднем за ${days} ${pluralDays(days)}`}
              />
              <Metric
                title={mode === 'year' ? 'К прошлому году' : 'К прошлому месяцу'}
                value={previous > 0 ? `${delta > 0 ? '+' : ''}${formatMoney(delta, data.currency)}` : 'нет данных'}
                hint={
                  previous > 0
                    ? `было ${formatMoney(previous, data.currency)}`
                    : 'тогда трат не было'
                }
                tone={previous > 0 ? (delta > 0 ? 'bad' : 'good') : 'plain'}
              />
            </div>

            {trend.length > 0 && (
              <section className="rounded-3xl bg-card p-4">
                <div className="mb-3 text-[16px] font-semibold">Расходы по месяцам</div>
                <div className="space-y-2">
                  {trend.map((point, index) => (
                    <div key={point.month} className="flex items-center gap-2.5">
                      <span className="w-8 shrink-0 text-[12px] text-muted">{point.label}</span>
                      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-elevated/60">
                        <motion.div
                          className="h-full rounded-full bg-[#FFB4B4]"
                          initial={{ width: 0 }}
                          animate={{ width: `${(point.value / peak) * 100}%` }}
                          transition={{ delay: index * 0.03, duration: 0.35 }}
                        />
                      </div>
                      <span className="tabular w-24 shrink-0 text-right text-[12px] font-medium">
                        {formatMoney(point.value, data.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {items.length > 0 && (
              <section className="rounded-3xl bg-card p-4">
                <div className="mb-1 text-[16px] font-semibold">По категориям</div>
                <div className="divide-y divide-line/50">
                  {items.map((item) => (
                    <div key={item.categoryId ?? 'none'} className="flex items-center gap-3 py-2.5">
                      <CategoryIcon icon={item.icon} color={item.color} className="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px]">{item.name}</div>
                        <div className="text-[12px] text-muted">
                          {formatNumber(item.share)}% · {item.transactionCount}{' '}
                          {pluralOperations(item.transactionCount)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="tabular text-[14px] font-semibold">
                          {formatMoney(item.amount, data.currency)}
                        </div>
                        <ChangeBadge percent={item.changePercent} type="expense" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <button
              type="button"
              onClick={() => {
                tg.haptic.light();
                navigate('/history');
              }}
              className="pressable flex w-full items-center justify-center gap-2 rounded-2xl border border-line px-5 py-3 text-[15px] font-medium"
            >
              <History size={16} />
              Смотреть операции
            </button>
          </>
        )}
      </div>

      <PeriodSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        withMonth={mode === 'month'}
        month={month}
        year={year}
        onMonth={setMonth}
        onYear={setYear}
      />
    </div>
  );
}

function Metric({
  title,
  value,
  hint,
  tone = 'plain',
}: {
  title: string;
  value: string;
  hint: string;

  tone?: 'plain' | 'good' | 'bad';
}) {
  const color = tone === 'good' ? 'text-positive' : tone === 'bad' ? 'text-negative' : '';
  return (
    <div className="rounded-3xl bg-card p-4">
      <div className="truncate text-[13px] text-muted">{title}</div>
      <div className={`tabular mt-1 text-[22px] font-bold leading-tight ${color}`}>{value}</div>
      <div className="mt-0.5 text-[12px] leading-snug text-muted">{hint}</div>
    </div>
  );
}

function pluralDays(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}

function pluralOperations(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'операций';
  if (mod10 === 1) return 'операция';
  if (mod10 >= 2 && mod10 <= 4) return 'операции';
  return 'операций';
}
