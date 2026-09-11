import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import type { TransactionType } from '@budget/shared';
import { tg } from '../lib/telegram';

/**
 * Тёмная полоса быстрых действий между шапкой и листом операций.
 *
 * Три способа завести операцию. Полоса тёмная в обеих темах — она же
 * зрительно разделяет два белых полотна.
 */
export function ActionBar({ onAdd }: { onAdd: (type: TransactionType) => void }) {
  return (
    <div className="flex items-center justify-center gap-2 px-3.5 py-3">
      <Action
        icon={<ArrowUpRight size={17} strokeWidth={2.4} />}
        label="Расход"
        onClick={() => onAdd('expense')}
      />
      <Action
        icon={<ArrowDownLeft size={17} strokeWidth={2.4} />}
        label="Доход"
        onClick={() => onAdd('income')}
      />
      <Action
        icon={<ArrowLeftRight size={17} strokeWidth={2.4} />}
        label="Перевод"
        onClick={() => onAdd('transfer')}
      />
    </div>
  );
}

function Action({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        tg.haptic.medium();
        onClick();
      }}
      className="pressable flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/10 px-2 text-bar-content"
    >
      {icon}
      <span className="truncate text-[14px] font-medium">{label}</span>
    </button>
  );
}
