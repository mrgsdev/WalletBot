import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode } from '@budget/shared';
import { setApiBudgetId } from '../lib/api';

interface AppState {
  budgetId: number | null;

  statsAccountId: number | null;

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

        set({ budgetId, statsAccountId: null });
      },
      setStatsAccountId: (statsAccountId) => set({ statsAccountId }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'budget-app-state',
      version: 2,

      migrate: () => ({ budgetId: null, statsAccountId: null, theme: 'system' as ThemeMode }),
      onRehydrateStorage: () => (state) => {
        if (state?.budgetId) setApiBudgetId(state.budgetId);
      },
    },
  ),
);
