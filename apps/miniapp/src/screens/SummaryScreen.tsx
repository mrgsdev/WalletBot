import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DonutChart } from '../charts/DonutChart';
import { PieChart } from '../charts/PieChart';
import { TrendLine } from '../charts/TrendLine';
import { Segmented } from '../components/Segmented';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { useAccounts, useRates, useSession, useSummaryStats } from '../lib/queries';
import { totalBalance } from '../lib/balance';
import { formatCompact, formatMoney, formatNumber } from '../lib/format';
import { useAppStore } from '../store/app';
import { useStatsAccount } from '../hooks/useStatsAccount';
import { tg } from '../lib/telegram';

/**
 * Сводная статистика (референс №3): карусель счетов, разбивка расходов
 * по крупным группам, соотношение доход/расход/накопления и тренд дохода.
 */
export function SummaryScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [trendType, setTrendType] = useState<'income' | 'expense'>('income');

  const accountId = useStatsAccount();
  const setAccountId = useAppStore((s) => s.setStatsAccountId);
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();

  const { data: session } = useSession();
  const baseCurrency = session?.settings.baseCurrency ?? 'RUB';
  const { data: rates } = useRates(baseCurrency);
  const allBalance = totalBalance(accounts, baseCurrency, rates);

  const anchor = useMemo(() => new Date().toISOString(), []);
  const { data, isLoading, isError, error, refetch } = useSummaryStats({ mode, anchor, accountId });

  const trend = trendType === 'income' ? data?.incomeTrend ?? [] : data?.expenseTrend ?? [];
  const trendTotal = trend.reduce((sum, point) => sum + point.value, 0);
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const shownPoint = activePoint ?? trend.length - 1;

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
        <h1 className="flex-1 text-center text-[17px] font-semibold">Сводка</h1>
        <div className="w-10" />
      </header>

      {/* ---------- Карусель счетов ---------- */}
      <div className="scroll-x flex snap-x snap-mandatory gap-3 px-4 pb-2 pt-1">
        {accountsLoading ? (
          <Skeleton className="h-[132px] w-[280px] shrink-0 rounded-3xl" />
        ) : (
          <>
            <AccountCard
              active={accountId === null}
              onClick={() => {
                tg.haptic.select();
                setAccountId(null);
              }}
              title="Все счета"
              subtitle={`${accounts.length} шт.`}
              amount={allBalance}
              currency={baseCurrency}
              color="#5B5BD6"
              icon="🗂"
              muted
            />
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                active={accountId === account.id}
                onClick={() => {
                  tg.haptic.select();
                  setAccountId(account.id);
                }}
                title={account.name}
                subtitle={account.isShared ? 'Общий счёт' : 'Личный счёт'}
                amount={account.balance}
                currency={account.currency}
                color={account.color}
                icon={account.icon}
              />
            ))}
          </>
        )}
      </div>

      {isError ? (
        <ErrorState message={(error as Error)?.message ?? ''} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="space-y-4 px-4 pt-4">
          <Skeleton className="h-56 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
      ) : (
        <div className="space-y-4 px-4 pt-3">
          {/* ---------- Расходы ---------- */}
          <section className="rounded-3xl bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF6E8A]" />
                <span className="text-[16px] font-semibold">Расходы</span>
              </div>
              <Segmented
                size="sm"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'month', label: 'Месяц' },
                  { value: 'year', label: 'Год' },
                ]}
              />
            </div>

            {data.expense === 0 && data.income === 0 ? (
              <EmptyState
                icon="🪙"
                title="Нет операций"
                hint="За выбранный период ещё ничего не записано."
              />
            ) : (
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <DonutChart
                    segments={data.expenseGroups.slice(0, 6).map((g) => ({
                      id: g.group,
                      value: g.amount,
                      color: g.color,
                    }))}
                    size={132}
                    thickness={16}
                    gap={7}
                  >
                    <div className="tabular text-[19px] font-bold leading-none">
                      {formatCompact(data.expense, data.currency)}
                    </div>
                  </DonutChart>
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  {data.expenseGroups.slice(0, 5).map((group) => (
                    <div key={group.group} className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{group.group}</span>
                      <span className="tabular shrink-0 text-[13px] font-semibold">
                        {formatNumber(group.share)}%
                      </span>
                    </div>
                  ))}
                  {data.expenseGroups.length > 5 && (
                    <div className="text-[12px] text-muted">
                      и ещё {data.expenseGroups.length - 5}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ---------- Доход / Расход / Накопления ---------- */}
          <section className="rounded-3xl bg-card p-4">
            <div className="mb-3 text-[16px] font-semibold">Структура периода</div>
            <div className="flex items-center gap-4">
              <PieChart
                size={116}
                slices={[
                  { id: 'income', value: data.income, color: '#D8F24A' },
                  { id: 'expense', value: data.expense, color: '#FF6E6E' },
                  { id: 'savings', value: data.savings, color: '#FFA640' },
                ]}
              />
              <div className="flex-1 space-y-2">
                <LegendRow color="#D8F24A" label="Доход" share={data.incomeShare} amount={data.income} currency={data.currency} />
                <LegendRow color="#FF6E6E" label="Расход" share={data.expenseShare} amount={data.expense} currency={data.currency} />
                <LegendRow color="#FFA640" label="Накопления" share={data.savingsShare} amount={data.savings} currency={data.currency} />
              </div>
            </div>
          </section>

          {/* ---------- Тренд ---------- */}
          <section className="rounded-3xl bg-card p-4 pb-2">
            <div className="mb-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  tg.haptic.select();
                  setTrendType((prev) => (prev === 'income' ? 'expense' : 'income'));
                  setActivePoint(null);
                }}
                className="pressable flex items-center gap-2 text-[16px] font-semibold"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: trendType === 'income' ? '#D8F24A' : '#FF6E6E' }}
                />
                {trendType === 'income' ? 'Доход' : 'Расход'}
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[13px] text-muted">{trend[shownPoint]?.label}</span>
                <motion.span
                  key={`${trendType}-${shownPoint}`}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="tabular rounded-full px-3 py-1 text-[14px] font-semibold text-black"
                  style={{ backgroundColor: trendType === 'income' ? '#D8F24A' : '#FF9B9B' }}
                >
                  {formatMoney(trend[shownPoint]?.value ?? 0, data.currency)}
                </motion.span>
              </div>
            </div>

            <div className="mb-1 text-[13px] text-muted">
              Всего за {trend.length} мес.: {formatMoney(trendTotal, data.currency)}
            </div>

            <TrendLine
              data={trend}
              color={trendType === 'income' ? '#D8F24A' : '#FF6E6E'}
              height={104}
              activeIndex={shownPoint}
              onSelect={(index) => {
                tg.haptic.select();
                setActivePoint(index);
              }}
            />

            <div className="mt-1 flex justify-between px-1 pb-2">
              {trend.map((point, index) => (
                <span
                  key={point.month}
                  className={`text-[11px] ${index === shownPoint ? 'font-semibold text-content' : 'text-muted/70'}`}
                >
                  {point.label}
                </span>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function LegendRow({
  color,
  label,
  share,
  amount,
  currency,
}: {
  color: string;
  label: string;
  share: number;
  amount: number;
  currency: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="flex-1 text-[13px]">{label}</span>
      <span className="tabular text-[13px] text-muted">{formatMoney(amount, currency)}</span>
      <span className="tabular w-11 text-right text-[13px] font-semibold">{formatNumber(share)}%</span>
    </div>
  );
}

function AccountCard({
  title,
  subtitle,
  amount,
  currency,
  color,
  icon,
  active,
  onClick,
  muted = false,
}: {
  title: string;
  subtitle: string;
  amount: number;
  currency: string;
  color: string;
  icon: string;
  active: boolean;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pressable relative w-[248px] shrink-0 snap-center overflow-hidden rounded-3xl p-4 text-left transition-all ${
        active ? 'ring-2 ring-content' : 'ring-1 ring-line/60'
      }`}
      style={{
        background: `linear-gradient(140deg, ${color}${muted ? '22' : '38'} 0%, rgb(var(--c-card)) 70%)`,
      }}
    >
      <div className="flex items-start justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-[18px]"
          style={{ backgroundColor: `${color}40` }}
        >
          {icon}
        </span>
        <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide">
          {currency}
        </span>
      </div>

      <div className="mt-5">
        <div className="tabular text-[24px] font-bold leading-tight">
          {formatMoney(amount, currency, true)}
        </div>
        <div className="mt-0.5 truncate text-[14px] font-medium">{title}</div>
        <div className="truncate text-[12px] text-muted">{subtitle}</div>
      </div>
    </button>
  );
}
