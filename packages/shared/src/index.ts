export * from './calc.js';
export * from './text.js';

/**
 * Общие типы и константы для Mini App, API и бота.
 * Пакет type-only: сюда не кладём код, зависящий от окружения.
 */

export type TransactionType = 'income' | 'expense' | 'transfer';
export type CategoryType = 'income' | 'expense';
export type StatsPeriod = 'week' | 'month' | 'quarter' | 'year';

export type BudgetKind = 'personal' | 'family';
export type ThemeMode = 'system' | 'light' | 'dark';

export interface UserDto {
  id: number;
  telegramId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

export interface BudgetMemberDto {
  userId: number;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  isOwner: boolean;
}

/** Бюджет — личный или семейный. Всё остальное принадлежит ему. */
export interface BudgetDto {
  id: number;
  name: string;
  kind: BudgetKind;
  icon: string;
  /** Только у семейных бюджетов. */
  inviteCode: string | null;
  inviteLink: string | null;
  /** Лимит трат на месяц; null — не задан. */
  monthlyLimit: number | null;
  limitCurrency: string;
  createdById: number;
  /** Может ли текущий пользователь удалять бюджет и исключать участников. */
  isOwner: boolean;
  members: BudgetMemberDto[];
  accountCount: number;
  transactionCount: number;
}

export interface UserSettingsDto {
  baseCurrency: string;
  theme: ThemeMode;
  dailyReminder: boolean;
  dailyReminderTime: string;
  /** Напоминать даже в дни, когда операции уже записаны. */
  dailyAlways: boolean;
  tzOffsetMinutes: number;
  seenTips: string[];
}

export interface SessionDto {
  user: UserDto;
  budgets: BudgetDto[];
  settings: UserSettingsDto;
  /** Бюджет, который открывается по умолчанию. */
  defaultBudgetId: number;
}

export interface AccountDto {
  id: number;
  name: string;
  icon: string;
  color: string;
  currency: string;
  balance: number;
  isShared: boolean;
  budgetId: number;
  ownerUserId: number;
  ownerName: string;
  isArchived: boolean;
}

export interface CategoryDto {
  id: number;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  group: string | null;
  isArchived: boolean;
  isCustom: boolean;
}

/** Бюджет на месяц: сколько осталось и сколько можно тратить в день. */
export interface MonthBudgetDto {
  currency: string;
  /** Заданный лимит на месяц; null — не задан. */
  limit: number | null;
  spent: number;
  remaining: number;
  /** Сколько можно тратить в день до конца месяца. */
  perDay: number;
  /** Дневная норма, если бы тратили ровно по плану с 1-го числа. */
  perDayPlanned: number;
  daysInMonth: number;
  /** Дней, на которые делится остаток: сегодня и все следующие. */
  daysLeft: number;
  /** Дней до конца месяца, не считая сегодняшний. */
  daysRemaining: number;
  dayOfMonth: number;
  /** Доля потраченного, 0–100 (может быть больше при перерасходе). */
  usedShare: number;
  /** Средний расход в день с начала месяца. */
  averagePerDay: number;
  /** Прогноз расхода к концу месяца по текущему темпу. */
  projected: number;
  isOverspent: boolean;
}

export interface TransactionDto {
  id: number;
  type: TransactionType;
  accountId: number;
  accountName: string;
  accountIcon: string;
  accountCurrency: string;
  toAccountId: number | null;
  toAccountName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  userId: number;
  userName: string;
  userAvatarUrl: string | null;
  /** Сумма в валюте операции. */
  amount: number;
  currency: string;
  /** Сумма, пересчитанная в валюту счёта — именно она меняет баланс. */
  convertedAmount: number;
  rate: number;
  date: string;
  comment: string | null;
  receiptPhotoUrl: string | null;
  isRecurring: boolean;
  createdAt: string;
}

export interface CategoryStatItem {
  categoryId: number | null;
  name: string;
  icon: string;
  color: string;
  amount: number;
  share: number;
  transactionCount: number;
  /** Сумма за предыдущий период того же типа. */
  previousAmount: number;
  /**
   * Изменение к предыдущему периоду в процентах.
   * null, если тогда трат не было — процент от нуля не считается.
   */
  changePercent: number | null;
}

export interface CategoryStatsDto {
  /** Валюта, в которой посчитаны все суммы. */
  currency: string;
  total: number;
  from: string;
  to: string;
  items: CategoryStatItem[];
  /** Итог за предыдущий период — для сравнения. */
  previousTotal: number;
  previousChangePercent: number | null;
  /** Готовая подпись вида «к августу». */
  previousLabel: string;
}

export interface GroupStatItem {
  group: string;
  color: string;
  amount: number;
  share: number;
}

export interface TrendPoint {
  /** Метка периода, например «Апр» или «2025-04». */
  label: string;
  month: string;
  value: number;
}

export interface SummaryStatsDto {
  currency: string;
  income: number;
  expense: number;
  savings: number;
  /** Доли дохода / расхода / накоплений в общем «обороте», в процентах. */
  incomeShare: number;
  expenseShare: number;
  savingsShare: number;
  expenseGroups: GroupStatItem[];
  incomeTrend: TrendPoint[];
  expenseTrend: TrendPoint[];
}

export interface BudgetPlanDto {
  id: number | null;
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  categoryType: CategoryType;
  year: number;
  month: number;
  plannedAmount: number;
  factAmount: number;
}

export interface RatesDto {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface CurrencyMeta {
  code: string;
  symbol: string;
  flag: string;
  name: string;
}

/** Валюты, доступные для выбора в интерфейсе ввода операции. */
export const CURRENCIES: CurrencyMeta[] = [
  { code: 'RUB', symbol: '₽', flag: '🇷🇺', name: 'Российский рубль' },
  { code: 'USD', symbol: '$', flag: '🇺🇸', name: 'Доллар США' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺', name: 'Евро' },
  { code: 'GEL', symbol: '₾', flag: '🇬🇪', name: 'Грузинский лари' },
  { code: 'KZT', symbol: '₸', flag: '🇰🇿', name: 'Тенге' },
  { code: 'TRY', symbol: '₺', flag: '🇹🇷', name: 'Турецкая лира' },
  { code: 'AMD', symbol: '֏', flag: '🇦🇲', name: 'Армянский драм' },
  { code: 'RSD', symbol: 'дин', flag: '🇷🇸', name: 'Сербский динар' },
  { code: 'GBP', symbol: '£', flag: '🇬🇧', name: 'Фунт стерлингов' },
  { code: 'AED', symbol: 'د.إ', flag: '🇦🇪', name: 'Дирхам ОАЭ' },
  { code: 'THB', symbol: '฿', flag: '🇹🇭', name: 'Тайский бат' },
  { code: 'CNY', symbol: '¥', flag: '🇨🇳', name: 'Юань' },
];

export const CURRENCY_BY_CODE: Record<string, CurrencyMeta> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c]),
);

export function currencySymbol(code: string): string {
  return CURRENCY_BY_CODE[code]?.symbol ?? code;
}

/** Палитра для диаграмм — совпадает с цветами категорий из сидов. */
export const CHART_PALETTE = [
  '#6EC1FF', '#FF9F6E', '#7ED97E', '#B57BFF', '#5B5BD6',
  '#E6E86E', '#7EE8C6', '#FF6E8A', '#FFC94D', '#8E8E93',
];
