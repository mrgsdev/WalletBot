import { useMemo } from 'react';
import { Sheet } from './Sheet';
import { Wheel, WheelGroup, type WheelOption } from './Wheel';
import { MONTHS_NOM } from '../lib/format';

/** Барабан выбора периода, как нативный пикер даты. */
export function PeriodSheet({
  open,
  onClose,
  withMonth = true,
  month,
  year,
  onMonth,
  onYear,
}: {
  open: boolean;
  onClose: () => void;
  /** Без месяца остаётся одна колонка с годами. */
  withMonth?: boolean;
  month: number;
  year: number;
  onMonth: (month: number) => void;
  onYear: (year: number) => void;
}) {
  const months: WheelOption<number>[] = useMemo(
    () => MONTHS_NOM.map((name, index) => ({ value: index + 1, label: name })),
    [],
  );

  /* Пять прошлых лет и следующий: дальше смотреть нечего. */
  const years: WheelOption<number>[] = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => current - 5 + i).map((value) => ({
      value,
      label: String(value),
    }));
  }, []);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={withMonth ? 'Месяц и год' : 'Год'}
      dragToClose={false}
    >
      <div className="space-y-3 pt-1">
        <WheelGroup>
          {withMonth && (
            <Wheel options={months} value={month} onChange={onMonth} className="flex-[3]" />
          )}
          <Wheel
            options={years}
            value={year}
            onChange={onYear}
            className={withMonth ? 'flex-[2]' : 'flex-1'}
          />
        </WheelGroup>

        <button
          type="button"
          onClick={onClose}
          className="pressable w-full rounded-2xl bg-content px-4 py-3.5 text-[16px] font-semibold text-ink"
        >
          Готово
        </button>
      </div>
    </Sheet>
  );
}

/** Строка «Выбрать месяц → Сентябрь 2026», открывающая барабан. */
export function PeriodRow({
  label,
  value,
  onClick,
  right,
}: {
  label: string;
  value: string;
  onClick: () => void;
  right?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable flex w-full items-center justify-between rounded-2xl bg-elevated px-4 py-3.5 text-left"
    >
      <span className="text-[15px] text-muted">{label}</span>
      <span className="flex items-center gap-1 text-[16px] font-medium">
        {value}
        {right}
      </span>
    </button>
  );
}
