import { useSession } from '../lib/queries';
import { useAppStore } from '../store/app';

export function useCurrentBudget() {
  const budgetId = useAppStore((s) => s.budgetId);
  const { data: session } = useSession();
  return session?.budgets.find((b) => b.id === budgetId) ?? null;
}

export function useIsFamilyBudget(): boolean {
  return useCurrentBudget()?.kind === 'family';
}
