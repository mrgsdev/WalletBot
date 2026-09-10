import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Route, Routes, useLocation } from 'react-router-dom';
import type { TransactionDto } from '@budget/shared';
import { BottomNav } from './components/BottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TourProvider } from './components/Tour';
import { AddTransactionScreen } from './screens/AddTransactionScreen';
import { BudgetsScreen } from './screens/BudgetsScreen';
import { CategoriesScreen } from './screens/CategoriesScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MoreScreen } from './screens/MoreScreen';
import { PlansScreen } from './screens/PlansScreen';
import { RemindersScreen } from './screens/RemindersScreen';
import { StatsScreen } from './screens/StatsScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { WalletScreen } from './screens/WalletScreen';
import { useSession } from './lib/queries';
import { useAppStore } from './store/app';
import { useTheme } from './hooks/useTheme';
import { tg } from './lib/telegram';

const TAB_ROUTES = ['/', '/stats', '/wallet', '/more'];

export default function App() {
  const location = useLocation();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TransactionDto | null>(null);

  const { data: session, isError, error, refetch } = useSession();

  const budgetId = useAppStore((s) => s.budgetId);
  const setBudgetId = useAppStore((s) => s.setBudgetId);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  useTheme(theme);

  // Тема с сервера — источник истины, локальная копия нужна лишь до загрузки сессии.
  useEffect(() => {
    const serverTheme = session?.settings.theme;
    if (serverTheme && serverTheme !== theme) setTheme(serverTheme);
  }, [session?.settings.theme, theme, setTheme]);

  // Выбираем бюджет: сохранённый, если он ещё существует, иначе — по умолчанию.
  useEffect(() => {
    if (!session) return;
    const exists = session.budgets.some((b) => b.id === budgetId);
    if (!exists) {
      const fallback = session.defaultBudgetId || session.budgets[0]?.id;
      if (fallback) setBudgetId(fallback);
    }
  }, [session, budgetId, setBudgetId]);

  const openAdd = useCallback(() => {
    setEditing(null);
    setAdding(true);
  }, []);

  const openEdit = useCallback((transaction: TransactionDto) => {
    setEditing(transaction);
    setAdding(true);
  }, []);

  const closeAdd = useCallback(() => {
    setAdding(false);
    setEditing(null);
  }, []);

  // Быстрый ввод можно открыть сразу при запуске: из напоминания бота или по /#add.
  useEffect(() => {
    const wanted =
      tg.startParam === 'add' ||
      window.location.hash === '#add' ||
      new URLSearchParams(window.location.search).get('action') === 'add';
    if (wanted) setAdding(true);
  }, []);

  const showNav = TAB_ROUTES.includes(location.pathname);

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-[40px]">📡</div>
        <div className="text-[17px] font-semibold">Не удалось подключиться</div>
        <div className="text-[14px] text-muted">
          {(error as Error)?.message ?? 'Проверьте соединение и попробуйте снова.'}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="pressable mt-2 rounded-full bg-content px-6 py-2.5 text-[15px] font-semibold text-ink"
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <TourProvider>
      <div className="mx-auto min-h-full max-w-md">
        {/*
          Раньше здесь был AnimatePresence mode="wait": новый экран ждал, пока
          доиграет уход предыдущего. При быстром переключении вкладок анимация
          прерывалась, и не появлялся ни старый экран, ни новый — интерфейс
          оставался пустым. Теперь анимируем только появление: смена ключа
          пересоздаёт узел, и застревать нечему.
        */}
        <ErrorBoundary key={location.pathname}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Routes location={location}>
              <Route path="/" element={<HomeScreen onAdd={openAdd} onEdit={openEdit} />} />
              <Route path="/stats" element={<StatsScreen />} />
              <Route path="/summary" element={<SummaryScreen />} />
              <Route path="/history" element={<HistoryScreen onEdit={openEdit} />} />
              <Route path="/wallet" element={<WalletScreen onTransfer={openAdd} />} />
              <Route path="/categories" element={<CategoriesScreen />} />
              <Route path="/plans" element={<PlansScreen />} />
              <Route path="/reminders" element={<RemindersScreen />} />
              <Route path="/budgets" element={<BudgetsScreen />} />
              <Route path="/more" element={<MoreScreen />} />
              <Route path="*" element={<HomeScreen onAdd={openAdd} onEdit={openEdit} />} />
            </Routes>
          </motion.div>
        </ErrorBoundary>

        {showNav && <BottomNav onAdd={openAdd} />}

        <AddTransactionScreen open={adding} onClose={closeAdd} editing={editing} />
      </div>
    </TourProvider>
  );
}
