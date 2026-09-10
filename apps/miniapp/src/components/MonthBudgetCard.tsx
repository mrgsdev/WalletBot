import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Pencil, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import type { BudgetDto, MonthBudgetDto } from '@budget/shared';
import { Sheet } from './Sheet';
import { Skeleton } from './ui';
import { formatMoney, MONTHS_NOM } from '../lib/format';
import { useBudgetMutations } from '../lib/queries';
import { tg } from '../lib/telegram';

/**
 * Бюджет на месяц. В свёрнутом виде — остаток и дневная норма,
 * по тапу открывается разбор: сколько можно тратить, сколько уже ушло
 * и куда всё идёт при текущем темпе.
 */
export function MonthBudgetCard({
  data,
  budget,
  isLoading,
}: {
  data?: MonthBudgetDto;
  budget?: BudgetDto;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (isLoading || !data) return <Skeleton className="h-[104px] w-full rounded-3xl" />;

  // Лимит не задан — предлагаем задать.
  if (data.limit === null) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            tg.haptic.light();
            setOpen(true);
          }}
          className="pressable flex w-full items-center gap-3 rounded-3xl bg-card p-4 text-left"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Wallet size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Бюджет на месяц</span>
            <span className="block text-[13px] text-muted">
              Задайте лимит — покажу, сколько можно тратить в день
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-muted" />
        </button>
        <LimitSheet open={open} onClose={() => setOpen(false)} data={data} budget={budget} />
      </>
    );
  }

  const share = Math.min(data.usedShare, 100);
  const barColor = data.isOverspent ? '#FF6E6E' : share > 80 ? '#FFC94D' : '#7ED97E';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          tg.haptic.light();
          setOpen(true);
        }}
        className="pressable w-full rounded-3xl bg-card p-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] text-muted">Бюджет на месяц</div>
            <div className="tabular mt-0.5 text-[26px] font-bold leading-tight">
              {formatMoney(data.perDay, data.currency)}
              <span className="ml-1 text-[14px] font-medium text-muted">в день</span>
            </div>
          </div>
          <ChevronRight size={18} className="mt-1 shrink-0 text-muted" />
        </div>

        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-elevated">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: barColor }}
            initial={{ width: 0 }}
            animate={{ width: `${share}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[13px]">
          <span className={data.isOverspent ? 'text-negative' : 'text-muted'}>
            {data.isOverspent
              ? `Перерасход ${formatMoney(Math.abs(data.remaining), data.currency)}`
              : `Осталось ${formatMoney(data.remaining, data.currency)}`}
          </span>
          <span className="text-muted">
            {data.daysRemaining === 0
              ? 'последний день'
              : `ещё ${data.daysRemaining} ${pluralDays(data.daysRemaining)}`}
          </span>
        </div>
      </button>

      <LimitSheet open={open} onClose={() => setOpen(false)} data={data} budget={budget} />
    </>
  );
}

function LimitSheet({
  open,
  onClose,
  data,
  budget,
}: {
  open: boolean;
  onClose: () => void;
  data: MonthBudgetDto;
  budget?: BudgetDto;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(data.limit ?? ''));
  const { update } = useBudgetMutations();

  const monthName = MONTHS_NOM[new Date().getMonth()];

  const save = () => {
    if (!budget) return;
    const parsed = Number(value.replace(',', '.').replace(/\s/g, ''));
    if (!Number.isFinite(parsed) || parsed < 0) {
      tg.haptic.error();
      return;
    }
    tg.haptic.success();
    update.mutate(
      { id: budget.id, monthlyLimit: parsed || null, limitCurrency: data.currency },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Бюджет на ${monthName.toLowerCase()}`}>
      {data.limit === null || editing ? (
        <div className="pt-1">
          <label className="block text-[13px] text-muted">Сколько планируете тратить в месяц</label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl bg-elevated px-4 py-3">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              placeholder="30000"
              autoFocus
              className="tabular min-w-0 flex-1 bg-transparent text-[20px] font-semibold outline-none"
            />
            <span className="text-[15px] text-muted">{data.currency}</span>
          </div>

          <p className="mt-3 text-[13px] leading-snug text-muted">
            Сумма делится на дни месяца. Каждая трата уменьшает остаток, и дневная норма
            пересчитывается на оставшиеся дни.
          </p>

          <div className="mt-4 flex gap-2">
            {data.limit !== null && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="pressable flex-1 rounded-2xl bg-elevated px-4 py-3 text-[15px] font-medium"
              >
                Отмена
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={update.isPending}
              className="pressable flex-1 rounded-2xl bg-content px-4 py-3 text-[15px] font-semibold text-ink disabled:opacity-50"
            >
              {update.isPending ? 'Сохраняю…' : 'Сохранить'}
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-1">
          {/* Главная цифра — сколько можно потратить сегодня и в каждый следующий день. */}
          <div className="rounded-3xl bg-elevated/50 p-4 text-center">
            <div className="text-[13px] text-muted">Можно тратить в день</div>
            <div className="tabular mt-1 text-[36px] font-bold leading-tight">
              {formatMoney(data.perDay, data.currency)}
            </div>
            <div className="mt-1 text-[13px] text-muted">
              {formatMoney(data.remaining, data.currency)} на сегодня
              {data.daysRemaining > 0 &&
                ` и ещё ${data.daysRemaining} ${pluralDays(data.daysRemaining)}`}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Stat label="Лимит на месяц" value={formatMoney(data.limit, data.currency)} />
            <Stat label="Потрачено" value={formatMoney(data.spent, data.currency)} />
            <Stat
              label="В среднем в день"
              value={formatMoney(data.averagePerDay, data.currency)}
              hint={`из ${formatMoney(data.perDayPlanned, data.currency)} по плану`}
              tone={data.averagePerDay > data.perDayPlanned ? 'bad' : 'good'}
            />
            <Stat
              label="Выйдет к концу месяца"
              value={formatMoney(data.projected, data.currency)}
              hint={
                data.projected > data.limit
                  ? `перерасход ${formatMoney(data.projected - data.limit, data.currency)}`
                  : `экономия ${formatMoney(data.limit - data.projected, data.currency)}`
              }
              tone={data.projected > data.limit ? 'bad' : 'good'}
            />
          </div>

          <div className="mt-3 rounded-2xl bg-elevated/40 p-3.5 text-[13px] leading-snug text-muted">
            {data.isOverspent ? (
              <>
                Лимит на {monthName.toLowerCase()} уже превышен на{' '}
                <b className="text-negative">
                  {formatMoney(Math.abs(data.remaining), data.currency)}
                </b>
                . Можно поднять лимит или притормозить до конца месяца.
              </>
            ) : data.averagePerDay > data.perDayPlanned ? (
              <>
                Тратите быстрее плана: {formatMoney(data.averagePerDay, data.currency)} в день
                вместо {formatMoney(data.perDayPlanned, data.currency)}. Если темп сохранится,
                лимит закончится раньше срока.
              </>
            ) : (
              <>
                Идёте в рамках плана. Сегодня {data.dayOfMonth}-е из {data.daysInMonth},
                впереди ещё {data.daysRemaining} {pluralDays(data.daysRemaining)}.
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setValue(String(data.limit));
              setEditing(true);
            }}
            className="pressable mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-elevated px-4 py-3 text-[15px] font-medium"
          >
            <Pencil size={16} />
            Изменить лимит
          </button>
        </div>
      )}
    </Sheet>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className="rounded-2xl bg-elevated/50 p-3">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="tabular mt-1 text-[17px] font-semibold">{value}</div>
      {hint && (
        <div
          className={`mt-0.5 flex items-center gap-1 text-[11px] ${
            tone === 'bad' ? 'text-negative' : tone === 'good' ? 'text-positive' : 'text-muted'
          }`}
        >
          {tone === 'bad' ? <TrendingUp size={11} /> : tone === 'good' ? <TrendingDown size={11} /> : null}
          {hint}
        </div>
      )}
    </div>
  );
}

function pluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}
