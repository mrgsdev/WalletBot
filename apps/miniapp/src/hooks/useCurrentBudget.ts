import { useSession } from '../lib/queries';
import { useAppStore } from '../store/app';

/** Текущий бюджет целиком — удобно, когда нужен его тип или название. */
export function useCurrentBudget() {
  const budgetId = useAppStore((s) => s.budgetId);
  const { data: session } = useSession();
  return session?.budgets.find((b) => b.id === budgetId) ?? null;
}

/** Семейный ли текущий бюджет: от этого зависит показ авторов и общих счетов. */
export function useIsFamilyBudget(): boolean {
  return useCurrentBudget()?.kind === 'family';
}
