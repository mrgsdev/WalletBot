import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { TransactionType } from '@budget/shared';
import { tg } from '../lib/telegram';

/**
 * Тёмная полоса быстрых действий между шапкой и листом операций.
 *
 * Ключевой элемент референса: три способа завести операцию и «ещё».
 * Полоса тёмная в обеих темах — она же зрительно разделяет два белых полотна.
 */
export function ActionBar({ onAdd }: { onAdd: (type: TransactionType) => void }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center gap-2 px-3.5 py-3">
      <Action
        icon={<ArrowUpRight size={16} strokeWidth={2.4} />}
        label="Расход"
        onClick={() => onAdd('expense')}
      />
      <Action
        icon={<ArrowDownLeft size={16} strokeWidth={2.4} />}
        label="Доход"
        onClick={() => onAdd('income')}
      />
      <Action
        icon={<ArrowLeftRight size={16} strokeWidth={2.4} />}
        label="Перевод"
        onClick={() => onAdd('transfer')}
      />
      <button
        type="button"
        aria-label="Ещё"
        onClick={() => {
          tg.haptic.light();
          navigate('/more');
        }}
        className="pressable flex h-11 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-bar-content"
      >
        <MoreHorizontal size={18} />
      </button>
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
      className="pressable flex h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-full bg-white/10 px-1.5 text-bar-content"
    >
      {icon}
      <span className="truncate text-[13px] font-medium">{label}</span>
    </button>
  );
}
