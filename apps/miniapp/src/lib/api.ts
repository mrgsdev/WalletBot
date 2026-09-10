import { tg } from './telegram';

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';

/** Текущий бюджет. Обновляется из useAppStore. */
let currentBudgetId: number | null = null;

export function setApiBudgetId(id: number | null) {
  currentBudgetId = id;
}

export function getApiBudgetId(): number | null {
  return currentBudgetId;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'error',
  ) {
    super(message);
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Не передавать текущий бюджет (например, для списка бюджетов). */
  skipScope?: boolean;
  query?: Record<string, string | number | boolean | null | undefined>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipScope, query, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    'X-Telegram-Init-Data': tg.initData,
    ...(skipScope || currentBudgetId === null
      ? {}
      : { 'X-Budget-Id': String(currentBudgetId) }),
    ...(headers as Record<string, string> | undefined),
  };

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    finalHeaders['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), { ...rest, headers: finalHeaders, body: payload });
  } catch {
    throw new ApiError(0, 'Нет связи с сервером. Проверьте интернет.', 'network');
  }

  if (!response.ok) {
    let message = 'Что-то пошло не так';
    let code = 'error';
    try {
      const json = await response.json();
      message = json.message ?? message;
      code = json.error ?? code;
    } catch {
      /* тело не JSON */
    }
    throw new ApiError(response.status, message, code);
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return (await response.text()) as T;

  return (await response.json()) as T;
}

/** Ссылка на файл экспорта: initData передаём query-параметром, т.к. это переход по ссылке. */
export function exportUrl(path: string, query: Record<string, string | number>): string {
  const params = new URLSearchParams({
    ...Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)])),
    ...(currentBudgetId === null ? {} : { budgetId: String(currentBudgetId) }),
    initData: tg.initData,
  });
  return `${BASE}${path}?${params.toString()}`;
}
