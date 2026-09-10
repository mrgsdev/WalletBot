import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutGrid, PieChart, Plus, Settings2, Wallet } from 'lucide-react';
import type { TransactionType } from '@budget/shared';
import { tg } from '../lib/telegram';

const ITEMS = [
  { to: '/', label: 'Главная', Icon: LayoutGrid },
  { to: '/stats', label: 'Статистика', Icon: PieChart },
  { to: '/wallet', label: 'Кошелёк', Icon: Wallet },
  { to: '/more', label: 'Ещё', Icon: Settings2 },
];

/**
 * Плавающая тёмная пилюля навигации.
 *
 * Неактивные вкладки — только иконка, активная разворачивается в подпись:
 * так бар остаётся узким, но всегда отвечает, где пользователь находится.
 */
export function BottomNav({ onAdd }: { onAdd: (type?: TransactionType) => void }) {
  const location = useLocation();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[calc(10px+var(--safe-bottom))]">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-bar p-1.5 shadow-bar">
        {ITEMS.map((item) => (
          <NavItem key={item.to} {...item} active={location.pathname === item.to} />
        ))}

        <button
          type="button"
          onClick={() => {
            tg.haptic.medium();
            onAdd('expense');
          }}
          className="pressable ml-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white"
          aria-label="Добавить операцию"
        >
          <Plus size={22} strokeWidth={2.6} />
        </button>
      </div>
    </nav>
  );
}

function NavItem({
  to,
  label,
  Icon,
  active,
}: {
  to: string;
  label: string;
  Icon: typeof LayoutGrid;
  active: boolean;
}) {
  return (
    <NavLink
      to={to}
      onClick={() => tg.haptic.select()}
      aria-label={label}
      className={`flex h-11 items-center gap-1.5 rounded-full px-3 text-bar-content transition-colors ${
        active ? 'bg-white/15' : 'opacity-55'
      }`}
    >
      <Icon size={20} strokeWidth={active ? 2.3 : 1.9} />
      {active && (
        <motion.span
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          className="overflow-hidden whitespace-nowrap text-[13px] font-semibold"
        >
          {label}
        </motion.span>
      )}
    </NavLink>
  );
}
