export * from './calc.js';
export * from './text.js';

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

export interface BudgetDto {
  id: number;
  name: string;
  kind: BudgetKind;
  icon: string;

  inviteCode: string | null;
  inviteLink: string | null;

  monthlyLimit: number | null;
  limitCurrency: string;
  createdById: number;

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

  dailyAlways: boolean;
  tzOffsetMinutes: number;
  seenTips: string[];
}

export interface SessionDto {
  user: UserDto;
  budgets: BudgetDto[];
  settings: UserSettingsDto;

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

export interface MonthBudgetDto {
  currency: string;

  limit: number | null;
  spent: number;
  remaining: number;

  perDay: number;

  perDayPlanned: number;
  daysInMonth: number;

  daysLeft: number;

  daysRemaining: number;
  dayOfMonth: number;

  usedShare: number;

  averagePerDay: number;

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

  amount: number;
  currency: string;

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

  previousAmount: number;

  changePercent: number | null;
}

export interface CategoryStatsDto {
  currency: string;
  total: number;
  from: string;
  to: string;
  items: CategoryStatItem[];

  previousTotal: number;
  previousChangePercent: number | null;

  previousLabel: string;
}

export interface GroupStatItem {
  group: string;
  color: string;
  amount: number;
  share: number;
}

export interface TrendPoint {
  label: string;
  month: string;
  value: number;
}

export interface SummaryStatsDto {
  currency: string;
  income: number;
  expense: number;
  savings: number;

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

export function isKnownCurrency(code: string): boolean {
  return Object.hasOwn(CURRENCY_BY_CODE, code.toUpperCase());
}

export const CHART_PALETTE = [
  '#6EC1FF', '#FF9F6E', '#7ED97E', '#B57BFF', '#5B5BD6',
  '#E6E86E', '#7EE8C6', '#FF6E8A', '#FFC94D', '#8E8E93',
];
