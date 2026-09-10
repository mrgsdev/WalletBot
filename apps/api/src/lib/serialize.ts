import type { AccountDto, BudgetDto, CategoryDto, TransactionDto } from '@budget/shared';
import { env } from './env.js';
import { inviteLink } from '../services/budgets.js';

export function accountDto(a: any): AccountDto {
  return {
    id: a.id,
    name: a.name,
    icon: a.icon,
    color: a.color,
    currency: a.currency,
    balance: a.balance,
    isShared: a.isShared,
    budgetId: a.budgetId,
    ownerUserId: a.ownerUserId,
    ownerName: a.owner?.name ?? '',
    isArchived: a.isArchived,
  };
}

export function categoryDto(c: any): CategoryDto {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    icon: c.icon,
    color: c.color,
    group: c.group ?? null,
    isArchived: c.isArchived,
    // Пользовательские категории нумеруются от 1000 — так их видно в интерфейсе.
    isCustom: c.sortOrder >= 1000,
  };
}

export function transactionDto(t: any): TransactionDto {
  return {
    id: t.id,
    type: t.type,
    accountId: t.accountId,
    accountName: t.account?.name ?? '',
    accountIcon: t.account?.icon ?? '💳',
    accountCurrency: t.account?.currency ?? 'RUB',
    toAccountId: t.toAccountId ?? null,
    toAccountName: t.toAccount?.name ?? null,
    categoryId: t.categoryId ?? null,
    categoryName: t.category?.name ?? null,
    categoryIcon: t.category?.icon ?? null,
    categoryColor: t.category?.color ?? null,
    userId: t.userId,
    userName: t.user?.name ?? '',
    userAvatarUrl: t.user?.avatarUrl ?? null,
    amount: t.amount,
    currency: t.currency,
    convertedAmount: t.convertedAmount,
    rate: t.rate,
    date: t.date.toISOString(),
    comment: t.comment ?? null,
    receiptPhotoUrl: t.receiptPhotoUrl ?? null,
    isRecurring: t.isRecurring,
    createdAt: t.createdAt.toISOString(),
  };
}

/** `viewerId` нужен, чтобы отдать флаг isOwner для текущего пользователя. */
export function budgetDto(b: any, viewerId: number): BudgetDto {
  return {
    id: b.id,
    name: b.name,
    kind: b.kind,
    icon: b.icon,
    inviteCode: b.inviteCode ?? null,
    inviteLink:
      b.inviteCode && env.botUsername ? inviteLink(env.botUsername, b.inviteCode) : null,
    monthlyLimit: b.monthlyLimit ?? null,
    limitCurrency: b.limitCurrency,
    createdById: b.createdById,
    isOwner: b.createdById === viewerId,
    members: (b.members ?? []).map((m: any) => ({
      userId: m.userId,
      name: m.user?.name ?? '',
      username: m.user?.username ?? null,
      avatarUrl: m.user?.avatarUrl ?? null,
      joinedAt: m.joinedAt.toISOString(),
      isOwner: m.userId === b.createdById,
    })),
    accountCount: b._count?.accounts ?? 0,
    transactionCount: b._count?.transactions ?? 0,
  };
}
