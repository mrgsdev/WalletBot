import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, PieChart, Plus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { TransactionDto, TransactionType } from '@budget/shared';
import { ActionBar } from '../components/ActionBar';
import { BudgetSwitcher } from '../components/BudgetSwitcher';
import { MonthBudgetCard } from '../components/MonthBudgetCard';
import { Money } from '../components/Money';
import { CurrencyBreakdown } from '../components/CurrencyBreakdown';
import { TourTarget } from '../components/Tour';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { TransactionRow } from '../components/TransactionRow';
import { useAccounts, useMonthBudget, useRates, useSession, useSummaryStats, useTransactions } from '../lib/queries';
import { useAppStore } from '../store/app';
import { useIsFamilyBudget } from '../hooks/useCurrentBudget';
import { totalBalance } from '../lib/balance';
import { APP_NAME } from '../lib/appName';
import { formatMoney, MONTHS_NOM } from '../lib/format';
import { tg } from '../lib/telegram';

/** Фильтры над списком операций — пилюли из референса. */
const FILTERS: { value: TransactionType | null; label: string }[] = [
  { value: null, label: 'Все' },
  { value: 'expense', label: 'Расходы' },
  { value: 'income', label: 'Доходы' },
];

/**
 * Главный экран.
 *
 * Композиция редизайна: белое полотно с балансом и счетами, тёмная полоса
 * быстрых действий и лист операций, «выезжающий» из-под неё. Тёмная полоса —
 * не только кнопки: она же зрительно разделяет две белые плоскости.
 */
export function HomeScreen({
  onAdd,
  onEdit,
}: {
  onAdd: (type?: TransactionType) => void;
  onEdit: (transaction: TransactionDto) => void;
}) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<TransactionType | null>(null);

  const { data: session } = useSession();
  const { data: accounts = [], isLoading: accountsLoading, isError: accountsError, refetch } = useAccounts();

  const baseCurrency = session?.settings.baseCurrency ?? 'RUB';
  const { data: rates } = useRates(baseCurrency);
  const total = totalBalance(accounts, baseCurrency, rates);

  const anchor = useMemo(() => new Date().toISOString(), []);
  const { data: summary } = useSummaryStats({ mode: 'month', anchor, accountId: null });
  const { data: history, isLoading: historyLoading } = useTransactions(
    filter ? { type: filter } : {},
    8,
  );
  const { data: monthBudget, isLoading: monthBudgetLoading } = useMonthBudget();

  const budgetId = useAppStore((s) => s.budgetId);
  const currentBudget = session?.budgets.find((b) => b.id === budgetId);
  const isFamily = useIsFamilyBudget();

  const recent = history?.pages[0]?.items ?? [];
  const monthName = MONTHS_NOM[new Date().getMonth()];

  return (
    <div className="min-h-[var(--tg-viewport-height)] bg-bar">
      {/* ── Белое полотно: кто я, сколько у меня и где это лежит ── */}
      <div className="rounded-b-sheet bg-surface pb-5">
        <header className="flex items-center justify-between gap-2 px-5 pb-1 pt-[calc(12px+var(--safe-top))]">
          <span className="text-[17px] font-bold tracking-tight">{APP_NAME}</span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                tg.haptic.light();
                navigate('/stats');
              }}
              aria-label="Статистика"
              className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-content"
            >
              <PieChart size={18} />
            </button>

            <button
              type="button"
              onClick={() => {
                tg.haptic.light();
                navigate('/more');
              }}
              className="pressable h-10 w-10 overflow-hidden rounded-full bg-elevated"
            >
              {session?.user.avatarUrl ? (
                <img src={session.user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[15px] font-semibold">
                  {session?.user.name?.[0]?.toUpperCase() ?? '·'}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Баланс: подпись и пилюля бюджета в одну строку, под ними — сумма */}
        <TourTarget id="total-balance" className="px-5 pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[14px] text-muted">Общий баланс</span>
            <TourTarget id="budget-switch">
              <BudgetSwitcher variant="pill" />
            </TourTarget>
          </div>

          {accountsLoading ? (
            <Skeleton className="mt-2.5 h-11 w-56" />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1.5"
            >
              <Money
                value={total}
                currency={baseCurrency}
                alwaysCents
                className="amount-lead text-[42px]"
              />
            </motion.div>
          )}

          {!accountsLoading && (
            <CurrencyBreakdown accounts={accounts} base={baseCurrency} rates={rates} />
          )}

          {/* Итоги месяца одной строкой — подробности на экране статистики. */}
          <TourTarget id="month-summary">
            <button
              type="button"
              onClick={() => {
                tg.haptic.light();
                navigate('/stats');
              }}
              className="pressable mt-2.5 flex items-center gap-3 text-[13px]"
            >
              <span className="text-muted">{monthName}</span>
              <span className="flex items-center gap-1 text-positive">
                <ArrowDownLeft size={13} />
                <span className="tabular font-medium">
                  {summary ? formatMoney(summary.income, summary.currency) : '—'}
                </span>
              </span>
              <span className="flex items-center gap-1 text-negative">
                <ArrowUpRight size={13} />
                <span className="tabular font-medium">
                  {summary ? formatMoney(summary.expense, summary.currency) : '—'}
                </span>
              </span>
              <ChevronRight size={14} className="text-muted" />
            </button>
          </TourTarget>
        </TourTarget>

        {/* Ряд плиток: бюджет месяца, счета, вход в кошелёк */}
        {accountsError ? (
          <ErrorState message="Не удалось получить счета" onRetry={() => refetch()} />
        ) : (
          <TourTarget id="accounts-strip" className="scroll-x mt-4 flex gap-2.5 px-5">
            <TourTarget id="month-budget">
              <MonthBudgetCard
                data={monthBudget}
                budget={currentBudget}
                isLoading={monthBudgetLoading}
                variant="tile"
              />
            </TourTarget>

            {accountsLoading ? (
              <Skeleton className="h-[104px] w-[156px] shrink-0 rounded-3xl" />
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
                    className="pressable w-[156px] shrink-0 rounded-3xl bg-elevated p-3.5 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="squircle h-8 w-8 shrink-0 text-[15px]"
                        style={{ backgroundColor: `${account.color}26` }}
                      >
                        {account.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                        {account.name}
                      </span>
                      {account.isShared && <Users size={13} className="shrink-0 text-muted" />}
                    </div>

                    <Money
                      value={account.balance}
                      currency={account.currency}
                      className="mt-3.5 block text-[19px] font-bold leading-none"
                    />
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    tg.haptic.light();
                    navigate('/wallet');
                  }}
                  className="pressable flex w-[104px] shrink-0 flex-col items-start justify-between rounded-3xl bg-elevated p-3.5 text-left"
                >
                  <span className="squircle h-8 w-8 bg-line text-muted">
                    <Plus size={16} />
                  </span>
                  <span className="text-[13px] font-medium leading-tight">
                    Все
                    <br />
                    счета
                  </span>
                </button>
              </>
            )}
          </TourTarget>
        )}
      </div>

      {/* ── Тёмная полоса: три способа завести операцию ── */}
      <TourTarget id="add-button">
        <ActionBar onAdd={onAdd} />
      </TourTarget>

      {/* ── Лист операций ── */}
      <TourTarget
        id="recent-transactions"
        className="min-h-[52vh] rounded-t-sheet bg-surface px-5 pb-36 pt-2.5"
      >
        <div className="mx-auto h-1 w-9 rounded-full bg-line" />

        <div className="mt-3.5 flex items-center justify-between">
          <h2 className="text-[17px] font-bold">Операции</h2>
          <button
            type="button"
            onClick={() => {
              tg.haptic.light();
              navigate('/history');
            }}
            className="pressable flex items-center gap-0.5 rounded-full bg-elevated py-1.5 pl-3 pr-2 text-[13px] font-medium"
          >
            Все
            <ChevronRight size={14} className="text-muted" />
          </button>
        </div>

        <div className="scroll-x -mx-1 mt-3 flex gap-2 px-1 pb-1">
          {FILTERS.map((item) => {
            const active = filter === item.value;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  tg.haptic.select();
                  setFilter(item.value);
                }}
                className={`pressable shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
                  active ? 'bg-accent/15 text-accent' : 'bg-elevated text-muted'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {historyLoading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon="✨"
            title={filter ? 'Здесь пока пусто' : 'Пока пусто'}
            hint={
              filter
                ? 'В этом фильтре операций нет — попробуйте другой.'
                : 'Добавьте первую операцию — она появится здесь.'
            }
            action={
              filter ? undefined : (
                <button
                  type="button"
                  onClick={() => onAdd('expense')}
                  className="pressable mt-1 rounded-full bg-content px-5 py-2.5 text-[14px] font-semibold text-surface"
                >
                  Добавить операцию
                </button>
              )
            }
          />
        ) : (
          <div className="mt-1 divide-y divide-line/60">
            {recent.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                showAuthor={isFamily}
                showDate
                onClick={() => onEdit(transaction)}
              />
            ))}
          </div>
        )}
      </TourTarget>
    </div>
  );
}
