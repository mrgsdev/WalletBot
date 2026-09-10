import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutGrid, PieChart, Plus, Settings2, Wallet } from 'lucide-react';
import { tg } from '../lib/telegram';
import { TourTarget } from './Tour';

const ITEMS = [
  { to: '/', label: 'Главная', Icon: LayoutGrid },
  { to: '/stats', label: 'Статистика', Icon: PieChart },
  { to: '/wallet', label: 'Кошелёк', Icon: Wallet },
  { to: '/more', label: 'Ещё', Icon: Settings2 },
];

/** Нижняя таб-навигация с кнопкой добавления операции по центру. */
export function BottomNav({ onAdd }: { onAdd: () => void }) {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/50 bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 pb-[var(--safe-bottom)] pt-2">
        {ITEMS.slice(0, 2).map((item) => (
          <NavItem key={item.to} {...item} active={location.pathname === item.to} />
        ))}

        <TourTarget id="add-button" className="-mt-6">
          <button
            type="button"
            onClick={() => {
              tg.haptic.medium();
              onAdd();
            }}
            className="pressable flex h-14 w-14 items-center justify-center rounded-full bg-accent text-black shadow-lg shadow-accent/25"
            aria-label="Добавить операцию"
          >
            <Plus size={26} strokeWidth={2.5} />
          </button>
        </TourTarget>

        {ITEMS.slice(2).map((item) => (
          <NavItem key={item.to} {...item} active={location.pathname === item.to} />
        ))}
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
      className="relative flex w-16 flex-col items-center gap-1 py-1"
    >
      <Icon size={22} className={active ? 'text-content' : 'text-muted'} strokeWidth={active ? 2.3 : 1.8} />
      <span className={`text-[10px] ${active ? 'text-content' : 'text-muted'}`}>{label}</span>
      {active && (
        <motion.span
          layoutId="nav-dot"
          className="absolute -top-0.5 h-1 w-1 rounded-full bg-accent"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </NavLink>
  );
}
