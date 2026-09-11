import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DonutChart } from '../charts/DonutChart';
import coinSmile from '../assets/coin-smile.png';
import { PeriodRow, PeriodSheet } from '../components/PeriodSheet';
import { Segmented } from '../components/Segmented';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { useSummaryStats } from '../lib/queries';
import { useStatsAccount } from '../hooks/useStatsAccount';
import { pastel } from '../lib/palette';
import { daysElapsed, periodStructure, STRUCTURE_COLORS } from '../lib/structure';
import { formatMoney, formatNumber, MONTHS_NOM } from '../lib/format';
import { tg } from '../lib/telegram';

/** Подробный разбор одного месяца: куда разошёлся доход. */
export function StructureScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const now = new Date();

  /* Режим наследуем от сводки, чтобы разбор открывался за тот же период. */
  const initialMode = (location.state as { mode?: 'month' | 'year' } | null)?.mode ?? 'month';
  const [mode, setMode] = useState<'month' | 'year'>(initialMode);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [pickerOpen, setPickerOpen] = useState(false);

  const accountId = useStatsAccount();

  /*
   * Середина месяца: так выбранный период не уедет из-за часового пояса.
   * Для года берём декабрь — тренд строится назад от якоря, и только с
   * декабря он укладывается ровно в январь-декабрь выбранного года.
   */
  const anchor = useMemo(
    () => new Date(Date.UTC(year, mode === 'year' ? 11 : month - 1, 15)).toISOString(),
    [year, month, mode],
  );
  const { data, isLoading, isError, error, refetch } = useSummaryStats({ mode, anchor, accountId });

  const structure = periodStructure(data?.income ?? 0, data?.expense ?? 0);
  const days = daysElapsed(mode, year, month, now);
  const perDay = days > 0 ? structure.expense / days : 0;

  /* Накопления по месяцам: доход минус расход в каждой точке тренда. */
  const savingsTrend = useMemo(() => {
    if (!data) return [];
    const expenseByMonth = new Map(data.expenseTrend.map((p) => [p.month, p.value]));
    return data.incomeTrend.map((point) => ({
      month: point.month,
      label: point.label,
      value: point.value - (expenseByMonth.get(point.month) ?? 0),
    }));
  }, [data]);

  const peak = Math.max(1, ...savingsTrend.map((p) => Math.abs(p.value)));
  const empty = !!data && data.income === 0 && data.expense === 0;

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
        <h1 className="flex-1 text-center text-[17px] font-semibold">Структура периода</h1>
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
          <ErrorState message={(error as Error)?.message ?? ''} onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <div className="space-y-4">
            <Skeleton className="h-72 w-full rounded-3xl" />
            <Skeleton className="h-24 w-full rounded-3xl" />
          </div>
        ) : empty ? (
          <EmptyState
            iconBare
            icon={<img src={coinSmile} alt="" className="h-20 w-20 object-contain" />}
            title="Нет операций"
            hint={`За ${mode === 'year' ? 'этот год' : 'этот месяц'} ещё ничего не записано. Выберите другой период.`}
          />
        ) : (
          <>
            {/* ---------- Кольцо и суммы ---------- */}
            <section className="rounded-3xl bg-card p-4">
              <div className="flex justify-center pb-1 pt-2">
                <DonutChart
                  size={196}
                  thickness={24}
                  gap={10}
                  segments={[
                    { id: 'expense', value: structure.expense, color: STRUCTURE_COLORS.expense },
                    { id: 'savings', value: Math.max(structure.savings, 0), color: STRUCTURE_COLORS.savings },
                  ]}
                >
                  <div className="tabular text-[30px] font-bold leading-none">
                    {structure.overspent ? '0%' : `${formatNumber(structure.savingsShare)}%`}
                  </div>
                  <div className="mt-1 text-[12px] text-muted">
                    {structure.overspent ? 'ушло всё' : 'осталось'}
                  </div>
                </DonutChart>
              </div>

              <div className="mt-3 space-y-2.5">
                <AmountRow
                  label="Доход"
                  amount={data.income}
                  currency={data.currency}
                  share="100%"
                  strong
                />
                <AmountRow
                  color={pastel(STRUCTURE_COLORS.expense)}
                  label="Расход"
                  amount={data.expense}
                  currency={data.currency}
                  share={`${formatNumber(structure.expenseShare)}%`}
                />
                <AmountRow
                  color={pastel(STRUCTURE_COLORS.savings)}
                  label={structure.overspent ? 'Перерасход' : 'Накопления'}
                  amount={Math.abs(structure.savings)}
                  currency={data.currency}
                  share={structure.overspent ? '' : `${formatNumber(structure.savingsShare)}%`}
                />
              </div>

              {structure.overspent && (
                <div className="mt-3 rounded-2xl bg-negative/15 p-3 text-center text-[13px] leading-snug text-negative">
                  Расход больше дохода на {formatMoney(Math.abs(structure.savings), data.currency)}.
                  Разницу закрыли деньгами с прошлых периодов.
                </div>
              )}
            </section>

            {/* ---------- Метрики ---------- */}
            <div className="grid grid-cols-2 gap-3">
              <Metric
                title="Норма сбережений"
                value={structure.overspent ? '0%' : `${formatNumber(structure.savingsShare)}%`}
                hint="доля дохода, которая осталась"
              />
              <Metric
                title="Расход в день"
                value={formatMoney(perDay, data.currency)}
                hint={`в среднем за ${days} ${pluralDays(days)}`}
              />
            </div>

            {/* ---------- Накопления по месяцам ---------- */}
            {savingsTrend.length > 0 && (
              <section className="rounded-3xl bg-card p-4">
                <div className="mb-3 text-[16px] font-semibold">Накопления по месяцам</div>
                <div className="space-y-2">
                  {savingsTrend.map((point, index) => (
                    <div key={point.month} className="flex items-center gap-2.5">
                      <span className="w-8 shrink-0 text-[12px] text-muted">{point.label}</span>
                      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-elevated/60">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: pastel(
                              point.value < 0 ? STRUCTURE_COLORS.expense : STRUCTURE_COLORS.savings,
                            ),
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(Math.abs(point.value) / peak) * 100}%` }}
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

            {/* ---------- Расходы по группам ---------- */}
            {data.expenseGroups.length > 0 && (
              <section className="rounded-3xl bg-card p-4">
                <div className="mb-3 text-[16px] font-semibold">Куда ушли расходы</div>
                <div className="space-y-3">
                  {data.expenseGroups.map((group, index) => (
                    <div key={group.group}>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: pastel(group.color, index) }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[14px]">{group.group}</span>
                        <span className="tabular shrink-0 text-[13px] text-muted">
                          {formatMoney(group.amount, data.currency)}
                        </span>
                        <span className="tabular w-12 shrink-0 text-right text-[13px] font-semibold">
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
            )}
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

function AmountRow({
  color,
  label,
  amount,
  currency,
  share,
  strong = false,
}: {
  color?: string;
  label: string;
  amount: number;
  currency: string;
  share: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {color ? (
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        <span className="w-2.5 shrink-0" />
      )}
      <span className={`flex-1 text-[14px] ${strong ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`tabular text-[14px] ${strong ? 'font-semibold' : 'text-muted'}`}>
        {formatMoney(amount, currency)}
      </span>
      <span className="tabular w-14 shrink-0 text-right text-[14px] font-semibold">{share}</span>
    </div>
  );
}

function Metric({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl bg-card p-4">
      <div className="text-[13px] text-muted">{title}</div>
      <div className="tabular mt-1 text-[22px] font-bold leading-tight">{value}</div>
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
