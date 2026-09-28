import { useEffect } from 'react';
import { useAccounts } from '../lib/queries';
import { useAppStore } from '../store/app';

export function useStatsAccount(): number | null {
  const accountId = useAppStore((s) => s.statsAccountId);
  const setAccountId = useAppStore((s) => s.setStatsAccountId);
  const { data: accounts, isSuccess } = useAccounts();

  const exists = accountId !== null && (accounts?.some((a) => a.id === accountId) ?? false);

  useEffect(() => {
    if (isSuccess && accountId !== null && !exists) setAccountId(null);
  }, [isSuccess, accountId, exists, setAccountId]);

  return exists ? accountId : null;
}
