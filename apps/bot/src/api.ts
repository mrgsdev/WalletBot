import { env } from './env.js';

/** Клиент служебного API: бот ходит с внутренним ключом, без initData. */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${env.apiUrl}/api/internal${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': env.internalApiKey,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const json = (await response.json()) as { message?: string };
      message = json.message ?? message;
    } catch {
      /* тело не JSON */
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export interface BudgetInfo {
  kind: 'personal' | 'family';
  id: number;
  name: string;
  membersCount: number;
  inviteCode: string;
  inviteLink: string | null;
}

export const api = {
  ensureUser: (payload: {
    telegramId: number;
    firstName?: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
  }) => request<{ id: number; name: string }>('/users/ensure', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  joinBudget: (telegramId: number, code: string) =>
    request<{ budgetId: number; name: string }>('/budgets/join', {
      method: 'POST',
      body: JSON.stringify({ telegramId, code }),
    }),

  createBudget: (telegramId: number, name: string, kind: 'personal' | 'family' = 'family') =>
    request<{ budgetId: number; name: string; kind: string; inviteCode: string | null; inviteLink: string | null }>(
      '/budgets/create',
      { method: 'POST', body: JSON.stringify({ telegramId, name }) },
    ),

  listBudgets: (telegramId: number) =>
    request<BudgetInfo[]>(`/budgets/list?telegramId=${telegramId}`),

  /** API сам решает, кому и когда пора напомнить — по времени и часовому поясу. */
  dueRecurring: () =>
    request<
      {
        id: number;
        telegramId: string;
        title: string;
        amount: number;
        currency: string;
        accountName: string;
        categoryName: string | null;
        categoryIcon: string | null;
      }[]
    >('/reminders/recurring'),

  markRecurringSent: (id: number) =>
    request<{ ok: true }>(`/reminders/recurring/${id}/sent`, { method: 'POST' }),

  /** API сам сверяет часовые пояса и выбранное пользователем время. */
  dailyReminders: () =>
    request<{ userId: number; telegramId: string; name: string }[]>('/reminders/daily'),

  markDailySent: (userId: number) =>
    request<{ ok: true }>(`/reminders/daily/${userId}/sent`, { method: 'POST' }),
};
