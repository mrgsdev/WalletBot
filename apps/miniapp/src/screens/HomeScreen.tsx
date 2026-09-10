import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { TransactionDto } from '@budget/shared';
import { BudgetSwitcher } from '../components/BudgetSwitcher';
import { MonthBudgetCard } from '../components/MonthBudgetCard';
import { CurrencyBreakdown } from '../components/CurrencyBreakdown';
import { TourTarget } from '../components/Tour';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { TransactionRow } from '../components/TransactionRow';
import { useAccounts, useMonthBudget, useRates, useSession, useSummaryStats, useTransactions } from '../lib/queries';
import { useAppStore } from '../store/app';
import { useIsFamilyBudget } from '../hooks/useCurrentBudget';
import { totalBalance } from '../lib/balance';
import { formatMoney, MONTHS_NOM } from '../lib/format';
import { tg } from '../lib/telegram';

/** Главный экран: общий баланс, счета, итоги месяца и последние операции. */
export function HomeScreen({
  onAdd,
  onEdit,
}: {
  onAdd: () => void;
  onEdit: (transaction: TransactionDto) => void;
}) {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { data: accounts = [], isLoading: accountsLoading, isError: accountsError, refetch } = useAccounts();

  const baseCurrency = session?.settings.baseCurrency ?? 'RUB';
  const { data: rates } = useRates(baseCurrency);
  const total = totalBalance(accounts, baseCurrency, rates);

  const anchor = useMemo(() => new Date().toISOString(), []);
  const { data: summary } = useSummaryStats({ mode: 'month', anchor, accountId: null });
  const { data: history, isLoading: historyLoading } = useTransactions({}, 6);
  const { data: monthBudget, isLoading: monthBudgetLoading } = useMonthBudget();

  const budgetId = useAppStore((s) => s.budgetId);
  const currentBudget = session?.budgets.find((b) => b.id === budgetId);
  const isFamily = useIsFamilyBudget();

  const recent = history?.pages[0]?.items ?? [];
  const monthName = MONTHS_NOM[new Date().getMonth()];

  return (
    <div className="pb-28">
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-[calc(10px+var(--safe-top))]">
        <TourTarget id="budget-switch">
          <BudgetSwitcher />
        </TourTarget>
        <button
          type="button"
          onClick={() => {
            tg.haptic.light();
            navigate('/more');
          }}
          className="pressable h-10 w-10 overflow-hidden rounded-full bg-card"
        >
          {session?.user.avatarUrl ? (
            <img src={session.user.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[15px] font-semibold">
              {session?.user.name?.[0]?.toUpperCase() ?? '·'}
            </span>
          )}
        </button>
      </header>

      {/* Общий баланс */}
      <TourTarget id="total-balance" className="px-5 pb-4 pt-2">
        <div className="text-[13px] text-muted">Общий баланс</div>
        {accountsLoading ? (
          <Skeleton className="mt-2 h-11 w-52" />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="tabular text-[38px] font-bold leading-tight"
          >
            {formatMoney(total, baseCurrency, true)}
          </motion.div>
        )}

        {/* Если счета в разных валютах — показываем, сколько в каждой. */}
        {!accountsLoading && (
          <CurrencyBreakdown accounts={accounts} base={baseCurrency} rates={rates} />
        )}
      </TourTarget>

      {/* Бюджет на месяц */}
      <section className="px-4 pb-4">
        <TourTarget id="month-budget">
          <MonthBudgetCard
            data={monthBudget}
            budget={currentBudget}
            isLoading={monthBudgetLoading}
          />
        </TourTarget>
      </section>

      {/* Счета */}
      {accountsError ? (
        <ErrorState message="Не удалось получить счета" onRetry={() => refetch()} />
      ) : (
        <TourTarget id="accounts-strip" className="scroll-x flex gap-2.5 px-4 pb-4">
          {accountsLoading ? (
            <>
              <Skeleton className="h-[92px] w-[168px] shrink-0 rounded-3xl" />
              <Skeleton className="h-[92px] w-[168px] shrink-0 rounded-3xl" />
            </>
          ) : (
            <>
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => {
                    tg.haptic.light();
                    navigate('/wallet');
                  }}
                  className="pressable w-[168px] shrink-0 rounded-3xl p-3.5 text-left"
                  style={{
                    background: `linear-gradient(150deg, ${account.color}30 0%, rgb(var(--c-card)) 75%)`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[16px]"
                      style={{ backgroundColor: `${account.color}40` }}
                    >
                      {account.icon}
                    </span>
                    {account.isShared && (
                      <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px]">Общий</span>
                    )}
                  </div>
                  <div className="tabular mt-3 text-[18px] font-bold leading-tight">
                    {formatMoney(account.balance, account.currency)}
                  </div>
                  <div className="truncate text-[12px] text-muted">{account.name}</div>
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  tg.haptic.light();
                  navigate('/wallet');
                }}
                className="pressable flex h-auto w-[92px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-3xl border border-dashed border-line text-muted"
              >
                <Plus size={20} />
                <span className="text-[12px]">Счёт</span>
              </button>
            </>
          )}
        </TourTarget>
      )}

      {/* Итоги месяца */}
      <TourTarget id="month-summary" className="px-4">
        <button
          type="button"
          onClick={() => {
            tg.haptic.light();
            navigate('/stats');
          }}
          className="pressable w-full rounded-3xl bg-card p-4 text-left"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[16px] font-semibold">{monthName}</span>
            <ChevronRight size={18} className="text-muted" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MonthTile
              icon={<ArrowDownLeft size={15} />}
              label="Доходы"
              value={summary ? formatMoney(summary.income, summary.currency) : '—'}
              color="#9BE870"
            />
            <MonthTile
              icon={<ArrowUpRight size={15} />}
              label="Расходы"
              value={summary ? formatMoney(summary.expense, summary.currency) : '—'}
              color="#FF6E8A"
            />
          </div>

          {summary && summary.income + summary.expense > 0 && (
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-elevated">
              <motion.div
                className="h-full bg-[#9BE870]"
                initial={{ width: 0 }}
                animate={{ width: `${(summary.income / (summary.income + summary.expense)) * 100}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
              <div className="h-full flex-1 bg-[#FF6E8A]" />
            </div>
          )}
        </button>
      </TourTarget>

      {/* Последние операции */}
      <TourTarget id="recent-transactions" className="px-4 pt-4">
        <div className="mb-1 flex items-center justify-between px-1">
          <h2 className="text-[16px] font-semibold">Последние операции</h2>
          <button
            type="button"
            onClick={() => {
              tg.haptic.light();
              navigate('/history');
            }}
            className="text-[14px] text-muted"
          >
            Все
          </button>
        </div>

        <div className="rounded-3xl bg-card px-4">
          {historyLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon="✨"
              title="Пока пусто"
              hint="Добавьте первую операцию — она появится здесь."
              action={
                <button
                  type="button"
                  onClick={onAdd}
                  className="pressable mt-1 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-black"
                >
                  Добавить операцию
                </button>
              }
            />
          ) : (
            <div className="divide-y divide-line/50">
              {recent.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  showAuthor={isFamily}
                  onClick={() => onEdit(transaction)}
                />
              ))}
            </div>
          )}
        </div>
      </TourTarget>
    </div>
  );
}

function MonthTile({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-elevated/50 p-3">
      <div className="flex items-center gap-1.5 text-[12px] text-muted">
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}30`, color }}
        >
          {icon}
        </span>
        {label}
      </div>
      <div className="tabular mt-1.5 text-[17px] font-semibold">{value}</div>
    </div>
  );
}
