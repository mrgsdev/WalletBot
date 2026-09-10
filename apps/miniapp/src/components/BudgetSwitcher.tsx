import { useState } from 'react';
import { Check, ChevronDown, Plus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../lib/queries';
import { useAppStore } from '../store/app';
import { Sheet } from './Sheet';
import { tg } from '../lib/telegram';

/** Переключатель бюджета в шапке главного экрана и статистики. */
export function BudgetSwitcher() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data: session } = useSession();
  const budgetId = useAppStore((s) => s.budgetId);
  const setBudgetId = useAppStore((s) => s.setBudgetId);

  const budgets = session?.budgets ?? [];
  const current = budgets.find((b) => b.id === budgetId);

  const choose = (id: number) => {
    tg.haptic.select();
    setBudgetId(id);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          tg.haptic.light();
          setOpen(true);
        }}
        className="pressable flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2"
      >
        <span className="text-[15px]">{current?.icon ?? '👛'}</span>
        <span className="max-w-[150px] truncate text-[15px] font-semibold">
          {current?.name ?? 'Бюджет'}
        </span>
        <ChevronDown size={16} className="text-muted" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Бюджеты">
        <div className="divide-y divide-line/60">
          {budgets.map((budget) => (
            <button
              key={budget.id}
              type="button"
              onClick={() => choose(budget.id)}
              className="flex w-full items-center gap-3 py-3 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elevated text-[18px]">
                {budget.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{budget.name}</span>
                <span className="flex items-center gap-1 text-[13px] text-muted">
                  {budget.kind === 'family' ? (
                    <>
                      <Users size={12} />
                      {budget.members.length} {plural(budget.members.length)}
                    </>
                  ) : (
                    'Личный'
                  )}
                </span>
              </span>
              {budget.id === budgetId && <Check size={18} className="text-accent" />}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setOpen(false);
            navigate('/budgets');
          }}
          className="pressable mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-elevated px-4 py-3 text-[15px] font-medium"
        >
          <Plus size={18} />
          Создать или настроить
        </button>
      </Sheet>
    </>
  );
}

function plural(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'участник';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'участника';
  return 'участников';
}
