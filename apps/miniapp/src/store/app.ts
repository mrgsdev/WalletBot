import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode } from '@budget/shared';
import { setApiBudgetId } from '../lib/api';

interface AppState {
  /** Текущий бюджет. null — ещё не выбран, возьмём из сессии. */
  budgetId: number | null;
  /** Выбранный счёт в статистике: null — «Все счета». */
  statsAccountId: number | null;
  /** Тема хранится локально, чтобы применяться до загрузки сессии. */
  theme: ThemeMode;
  setBudgetId: (id: number) => void;
  setStatsAccountId: (id: number | null) => void;
  setTheme: (theme: ThemeMode) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      budgetId: null,
      statsAccountId: null,
      theme: 'system',
      setBudgetId: (budgetId) => {
        setApiBudgetId(budgetId);
        // Счёт из другого бюджета в новом контексте невалиден.
        set({ budgetId, statsAccountId: null });
      },
      setStatsAccountId: (statsAccountId) => set({ statsAccountId }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'budget-app-state',
      version: 2,
      // Прошлая версия хранила scope строкой вида «family:3» — она больше не нужна.
      migrate: () => ({ budgetId: null, statsAccountId: null, theme: 'system' as ThemeMode }),
      onRehydrateStorage: () => (state) => {
        if (state?.budgetId) setApiBudgetId(state.budgetId);
      },
    },
  ),
);
