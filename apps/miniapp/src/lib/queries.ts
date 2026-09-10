import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  AccountDto,
  BudgetDto,
  BudgetPlanDto,
  CategoryDto,
  CategoryStatsDto,
  MonthBudgetDto,
  RatesDto,
  SessionDto,
  SummaryStatsDto,
  ThemeMode,
  TransactionDto,
  UserSettingsDto,
} from '@budget/shared';
import { apiFetch } from './api';
import { useAppStore } from '../store/app';

/**
 * Ключ текущего бюджета для запросов.
 *
 * Возвращает 0, пока бюджет не подтверждён сессией: сохранённый id может
 * указывать на удалённый бюджет, и запросы с ним отвечали бы 404,
 * пока приложение не переключится на существующий.
 */
function useBudgetKey() {
  const budgetId = useAppStore((s) => s.budgetId);
  const { data: session } = useQuery<SessionDto>({
    queryKey: ['session'],
    queryFn: () => apiFetch<SessionDto>('/session', { skipScope: true }),
    staleTime: 5 * 60_000,
  });

  if (!budgetId) return 0;
  if (!session) return 0;
  return session.budgets.some((b) => b.id === budgetId) ? budgetId : 0;
}

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => apiFetch<SessionDto>('/session', { skipScope: true }),
    staleTime: 5 * 60_000,
  });
}

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: () => apiFetch<BudgetDto[]>('/budgets', { skipScope: true }),
    staleTime: 60_000,
  });
}

export function useAccounts() {
  const budgetId = useBudgetKey();
  return useQuery({
    queryKey: ['accounts', budgetId],
    queryFn: () => apiFetch<AccountDto[]>('/accounts'),
    enabled: budgetId > 0,
    staleTime: 30_000,
  });
}

export function useCategories(type?: 'income' | 'expense') {
  const budgetId = useBudgetKey();
  return useQuery({
    queryKey: ['categories', budgetId, type ?? 'all'],
    queryFn: () => apiFetch<CategoryDto[]>('/categories', { query: { type } }),
    enabled: budgetId > 0,
    staleTime: 5 * 60_000,
  });
}

/**
 * Валюта отчётов. Входит в ключи запросов, которые сервер считает в ней:
 * без этого после смены валюты react-query отдавал бы кэш со старыми суммами,
 * пока данные не устареют сами.
 */
function useBaseCurrency(): string {
  const { data: session } = useQuery<SessionDto>({
    queryKey: ['session'],
    queryFn: () => apiFetch<SessionDto>('/session', { skipScope: true }),
    staleTime: 5 * 60_000,
  });
  return session?.settings.baseCurrency ?? 'RUB';
}

/** Бюджет на месяц: остаток и дневная норма. */
export function useMonthBudget() {
  const budgetId = useBudgetKey();
  const currency = useBaseCurrency();
  return useQuery({
    queryKey: ['month-budget', budgetId, currency],
    queryFn: () => apiFetch<MonthBudgetDto>('/stats/month-budget'),
    enabled: budgetId > 0,
    staleTime: 30_000,
  });
}

export interface TransactionFilters {
  accountId?: number | null;
  categoryId?: number[] | null;
  type?: 'income' | 'expense' | 'transfer' | null;
  from?: string | null;
  to?: string | null;
  search?: string | null;
}

export function useTransactions(filters: TransactionFilters = {}, limit = 40) {
  const budgetId = useBudgetKey();
  return useInfiniteQuery({
    queryKey: ['transactions', budgetId, filters, limit],
    initialPageParam: null as number | null,
    enabled: budgetId > 0,
    queryFn: ({ pageParam }) =>
      apiFetch<{ items: TransactionDto[]; nextCursor: number | null }>('/transactions', {
        query: {
          limit,
          cursor: pageParam,
          accountId: filters.accountId ?? undefined,
          categoryId: filters.categoryId?.length ? filters.categoryId.join(',') : undefined,
          type: filters.type ?? undefined,
          from: filters.from ?? undefined,
          to: filters.to ?? undefined,
          search: filters.search ?? undefined,
        },
      }),
    getNextPageParam: (last) => last.nextCursor,
  });
}

export interface CategoryStatsParams {
  type: 'income' | 'expense';
  period: 'week' | 'month' | 'quarter';
  anchor: string;
  accountId: number | null;
}

export function useCategoryStats(params: CategoryStatsParams) {
  const budgetId = useBudgetKey();
  const currency = useBaseCurrency();
  return useQuery({
    queryKey: ['stats', 'categories', budgetId, currency, params],
    enabled: budgetId > 0,
    queryFn: () =>
      apiFetch<CategoryStatsDto>('/stats/categories', {
        query: {
          type: params.type,
          period: params.period,
          anchor: params.anchor,
          accountId: params.accountId ?? undefined,
        },
      }),
    staleTime: 30_000,
  });
}

export function useSummaryStats(params: { mode: 'month' | 'year'; anchor: string; accountId: number | null }) {
  const budgetId = useBudgetKey();
  const currency = useBaseCurrency();
  return useQuery({
    queryKey: ['stats', 'summary', budgetId, currency, params],
    enabled: budgetId > 0,
    queryFn: () =>
      apiFetch<SummaryStatsDto>('/stats/summary', {
        query: {
          mode: params.mode,
          anchor: params.anchor,
          accountId: params.accountId ?? undefined,
          trendMonths: params.mode === 'year' ? 12 : 8,
        },
      }),
    staleTime: 30_000,
  });
}

export function useRates(base: string) {
  return useQuery({
    queryKey: ['rates', base],
    queryFn: () => apiFetch<RatesDto>('/rates', { query: { base }, skipScope: true }),
    staleTime: 60 * 60_000,
  });
}

export function usePlans(year: number, month: number) {
  const budgetId = useBudgetKey();
  const currency = useBaseCurrency();
  return useQuery({
    queryKey: ['plans', budgetId, currency, year, month],
    enabled: budgetId > 0,
    queryFn: () =>
      apiFetch<{ currency: string; year: number; month: number; items: BudgetPlanDto[] }>('/plans', {
        query: { year, month },
      }),
  });
}

/** Сбрасывает всё, что зависит от операций. */
export function useInvalidateBudget() {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: ['accounts'] });
    client.invalidateQueries({ queryKey: ['transactions'] });
    client.invalidateQueries({ queryKey: ['stats'] });
    client.invalidateQueries({ queryKey: ['plans'] });
    client.invalidateQueries({ queryKey: ['month-budget'] });
  };
}

export interface TransactionPayload {
  type: 'income' | 'expense' | 'transfer';
  accountId: number;
  toAccountId?: number | null;
  categoryId?: number | null;
  amount: number;
  currency: string;
  date: string;
  comment?: string | null;
}

export function useSaveTransaction() {
  const invalidate = useInvalidateBudget();
  return useMutation({
    mutationFn: ({ id, ...payload }: TransactionPayload & { id?: number }) =>
      id
        ? apiFetch<TransactionDto>(`/transactions/${id}`, { method: 'PATCH', body: payload })
        : apiFetch<TransactionDto>('/transactions', { method: 'POST', body: payload }),
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateBudget();
  return useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: true }>(`/transactions/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useSaveAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<AccountDto> & { id?: number; initialBalance?: number }) =>
      id
        ? apiFetch<AccountDto>(`/accounts/${id}`, { method: 'PATCH', body: payload })
        : apiFetch<AccountDto>('/accounts', { method: 'POST', body: payload }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['accounts'] });
      client.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useDeleteAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['accounts'] });
      client.invalidateQueries({ queryKey: ['transactions'] });
      client.invalidateQueries({ queryKey: ['month-budget'] });
    },
  });
}

export function useSaveCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<CategoryDto> & { id?: number }) =>
      id
        ? apiFetch<CategoryDto>(`/categories/${id}`, { method: 'PATCH', body: payload })
        : apiFetch<CategoryDto>('/categories', { method: 'POST', body: payload }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['categories'] });
      client.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useSavePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { categoryId: number; year: number; month: number; plannedAmount: number }) =>
      apiFetch('/plans', { method: 'PUT', body: payload }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['plans'] }),
  });
}

/** Мутации бюджетов: создание, удаление, приглашения, участники. */
export function useBudgetMutations() {
  const client = useQueryClient();
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['budgets'] });
    client.invalidateQueries({ queryKey: ['session'] });
  };

  return {
    create: useMutation({
      mutationFn: (input: { name: string; kind: 'personal' | 'family'; icon?: string; currency?: string }) =>
        apiFetch<BudgetDto>('/budgets', { method: 'POST', body: input, skipScope: true }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: number; name?: string; icon?: string; monthlyLimit?: number | null; limitCurrency?: string }) =>
        apiFetch<BudgetDto>(`/budgets/${id}`, { method: 'PATCH', body, skipScope: true }),
      onSuccess: () => {
        refresh();
        client.invalidateQueries({ queryKey: ['month-budget'] });
      },
    }),
    remove: useMutation({
      mutationFn: (id: number) => apiFetch(`/budgets/${id}`, { method: 'DELETE', skipScope: true }),
      onSuccess: refresh,
    }),
    join: useMutation({
      mutationFn: (code: string) =>
        apiFetch<BudgetDto>('/budgets/join', { method: 'POST', body: { code }, skipScope: true }),
      onSuccess: refresh,
    }),
    leave: useMutation({
      mutationFn: (id: number) =>
        apiFetch(`/budgets/${id}/leave`, { method: 'POST', skipScope: true }),
      onSuccess: refresh,
    }),
    removeMember: useMutation({
      mutationFn: ({ budgetId, userId }: { budgetId: number; userId: number }) =>
        apiFetch(`/budgets/${budgetId}/members/${userId}`, { method: 'DELETE', skipScope: true }),
      onSuccess: refresh,
    }),
    rotateInvite: useMutation({
      mutationFn: (id: number) =>
        apiFetch<BudgetDto>(`/budgets/${id}/rotate-invite`, { method: 'POST', skipScope: true }),
      onSuccess: refresh,
    }),
    share: useMutation({
      mutationFn: (id: number) =>
        apiFetch<BudgetDto>(`/budgets/${id}/share`, { method: 'POST', skipScope: true }),
      onSuccess: refresh,
    }),
  };
}

export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Omit<UserSettingsDto, 'seenTips'>> & { theme?: ThemeMode }) =>
      apiFetch<UserSettingsDto>('/session/settings', { method: 'PATCH', body: patch, skipScope: true }),
    onSuccess: (_data, patch) => {
      client.invalidateQueries({ queryKey: ['session'] });
      // Валюта отчётов и часовой пояс меняют то, что считает сервер,
      // поэтому пересчитанные им данные нужно перезапросить, а не брать из кэша.
      if (patch.baseCurrency !== undefined || patch.tzOffsetMinutes !== undefined) {
        client.invalidateQueries({ queryKey: ['stats'] });
        client.invalidateQueries({ queryKey: ['month-budget'] });
        client.invalidateQueries({ queryKey: ['plans'] });
        client.invalidateQueries({ queryKey: ['rates'] });
      }
    },
  });
}

/** Отметка просмотренной подсказки. */
export function useMarkTipSeen() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (tip: string) =>
      apiFetch(`/session/tips/${encodeURIComponent(tip)}/seen`, { method: 'POST', skipScope: true }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['session'] }),
  });
}

export function useResetTips() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/session/tips/reset', { method: 'POST', skipScope: true }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['session'] }),
  });
}

export interface RecurringDto {
  id: number;
  title: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense';
  dayOfMonth: number;
  notifyTime: string;
  isActive: boolean;
  accountId: number;
  categoryId: number | null;
  account: { name: string; icon: string; currency: string };
  category: { name: string; icon: string; color: string } | null;
}

export interface RecurringInput {
  title: string;
  accountId: number;
  categoryId?: number | null;
  amount: number;
  currency: string;
  dayOfMonth: number;
  notifyTime: string;
}

/** Напоминания о регулярных платежах. */
export function useRecurring() {
  const budgetId = useBudgetKey();
  return useQuery({
    queryKey: ['recurring', budgetId],
    queryFn: () => apiFetch<RecurringDto[]>('/recurring'),
    enabled: budgetId > 0,
  });
}

export function useRecurringMutations() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ['recurring'] });

  return {
    create: useMutation({
      mutationFn: (input: RecurringInput) =>
        apiFetch<RecurringDto>('/recurring', { method: 'POST', body: input }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...patch }: Partial<RecurringInput> & { id: number; isActive?: boolean }) =>
        apiFetch<RecurringDto>(`/recurring/${id}`, { method: 'PATCH', body: patch }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: number) => apiFetch(`/recurring/${id}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
  };
}

export interface DemoStatus {
  hasDemo: boolean;
  count: number;
}

/** Демо-данные для обучения: наполнение и удаление. */
export function useDemo() {
  const client = useQueryClient();
  const invalidate = useInvalidateBudget();

  return {
    seed: useMutation({
      mutationFn: () => apiFetch<DemoStatus>('/demo/seed', { method: 'POST' }),
      onSuccess: invalidate,
    }),
    clear: useMutation({
      mutationFn: () => apiFetch<{ removed: number }>('/demo', { method: 'DELETE' }),
      onSuccess: () => {
        invalidate();
        client.invalidateQueries({ queryKey: ['demo'] });
      },
    }),
  };
}

export function useDemoStatus() {
  const budgetId = useBudgetKey();
  return useQuery({
    queryKey: ['demo', budgetId],
    queryFn: () => apiFetch<DemoStatus>('/demo'),
    enabled: budgetId > 0,
  });
}

/** Отправляет выгрузку файлом в чат с ботом. */
export function useSendExport() {
  return useMutation({
    mutationFn: (range: { year: number; fromMonth: number; toMonth: number }) =>
      apiFetch<{ ok: true; filename: string; transactionCount: number }>('/export/send', {
        method: 'POST',
        body: range,
      }),
  });
}
