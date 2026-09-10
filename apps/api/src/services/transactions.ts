import type { Transaction } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { convert, getRate, round2 } from './currency.js';
import { badRequest, notFound } from '../lib/errors.js';
import type { AuthUser } from '../middleware/auth.js';
import type { Scope } from './scope.js';
import { visibleAccountIds } from './scope.js';

export interface TransactionInput {
  type: 'income' | 'expense' | 'transfer';
  accountId: number;
  toAccountId?: number | null;
  categoryId?: number | null;
  amount: number;
  currency: string;
  date: string;
  comment?: string | null;
  receiptPhotoUrl?: string | null;
  isRecurring?: boolean;
  /** Операция из демо-набора — удаляется вместе с ним. */
  isDemo?: boolean;
}

/** Знак, с которым операция влияет на баланс счёта-источника. */
function signFor(type: string): number {
  if (type === 'income') return 1;
  return -1; // expense и transfer уменьшают баланс источника
}

/**
 * Применяет операцию к балансам счетов.
 * factor = 1 — начислить, factor = -1 — откатить.
 */
async function applyToBalances(tx: any, transaction: Transaction, factor: 1 | -1) {
  const delta = round2(signFor(transaction.type) * transaction.convertedAmount * factor);
  await tx.account.update({
    where: { id: transaction.accountId },
    data: { balance: { increment: delta } },
  });

  if (transaction.type === 'transfer' && transaction.toAccountId) {
    const incoming = round2((transaction.toConvertedAmount ?? transaction.convertedAmount) * factor);
    await tx.account.update({
      where: { id: transaction.toAccountId },
      data: { balance: { increment: incoming } },
    });
  }
}

async function loadAccount(accountId: number, user: AuthUser, scope: Scope) {
  const allowed = await visibleAccountIds(user, scope);
  if (!allowed.includes(accountId)) throw notFound('Счёт не найден в текущем бюджете');
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw notFound('Счёт не найден');
  return account;
}

function validate(input: TransactionInput) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw badRequest('Сумма должна быть больше нуля');
  }
  if (input.type === 'transfer') {
    if (!input.toAccountId) throw badRequest('Для перевода нужен счёт-получатель');
    if (input.toAccountId === input.accountId) throw badRequest('Счета перевода должны отличаться');
  }
  if (input.type !== 'transfer' && !input.categoryId) {
    throw badRequest('Выберите категорию');
  }
}

export async function createTransaction(user: AuthUser, scope: Scope, input: TransactionInput) {
  validate(input);
  const account = await loadAccount(input.accountId, user, scope);

  const { amount: convertedAmount, rate } = await convert(input.amount, input.currency, account.currency);

  let toConvertedAmount: number | null = null;
  if (input.type === 'transfer' && input.toAccountId) {
    const toAccount = await loadAccount(input.toAccountId, user, scope);
    const converted = await convert(input.amount, input.currency, toAccount.currency);
    toConvertedAmount = converted.amount;
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        type: input.type,
        accountId: input.accountId,
        toAccountId: input.type === 'transfer' ? input.toAccountId! : null,
        categoryId: input.type === 'transfer' ? null : input.categoryId!,
        userId: user.id,
        budgetId: scope.budgetId,
        amount: round2(input.amount),
        currency: input.currency,
        convertedAmount,
        toConvertedAmount,
        rate,
        date: new Date(input.date),
        comment: input.comment ?? null,
        receiptPhotoUrl: input.receiptPhotoUrl ?? null,
        isRecurring: input.isRecurring ?? false,
        isDemo: input.isDemo ?? false,
      },
    });
    await applyToBalances(tx, created, 1);
    return created;
  });
}

export async function updateTransaction(
  user: AuthUser,
  scope: Scope,
  id: number,
  input: TransactionInput,
) {
  validate(input);
  const allowed = await visibleAccountIds(user, scope);
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || !allowed.includes(existing.accountId)) throw notFound('Операция не найдена');

  const account = await loadAccount(input.accountId, user, scope);
  const { amount: convertedAmount, rate } = await convert(input.amount, input.currency, account.currency);

  let toConvertedAmount: number | null = null;
  if (input.type === 'transfer' && input.toAccountId) {
    const toAccount = await loadAccount(input.toAccountId, user, scope);
    toConvertedAmount = (await convert(input.amount, input.currency, toAccount.currency)).amount;
  }

  return prisma.$transaction(async (tx) => {
    await applyToBalances(tx, existing, -1);
    const updated = await tx.transaction.update({
      where: { id },
      data: {
        type: input.type,
        accountId: input.accountId,
        toAccountId: input.type === 'transfer' ? input.toAccountId! : null,
        categoryId: input.type === 'transfer' ? null : input.categoryId!,
        budgetId: scope.budgetId,
        amount: round2(input.amount),
        currency: input.currency,
        convertedAmount,
        toConvertedAmount,
        rate,
        date: new Date(input.date),
        comment: input.comment ?? null,
        receiptPhotoUrl: input.receiptPhotoUrl ?? null,
        isRecurring: input.isRecurring ?? false,
      },
    });
    await applyToBalances(tx, updated, 1);
    return updated;
  });
}

export async function deleteTransaction(user: AuthUser, scope: Scope, id: number) {
  const allowed = await visibleAccountIds(user, scope);
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || !allowed.includes(existing.accountId)) throw notFound('Операция не найдена');

  await prisma.$transaction(async (tx) => {
    await applyToBalances(tx, existing, -1);
    await tx.transaction.delete({ where: { id } });
  });
}

/** Пересчёт баланса счёта с нуля — используется после массовых правок. */
export async function recalcAccountBalance(accountId: number): Promise<number> {
  const outgoing = await prisma.transaction.findMany({
    where: { accountId },
    select: { type: true, convertedAmount: true },
  });
  const incoming = await prisma.transaction.findMany({
    where: { toAccountId: accountId, type: 'transfer' },
    select: { toConvertedAmount: true, convertedAmount: true },
  });

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  let balance = account?.initialBalance ?? 0;
  for (const t of outgoing) balance += signFor(t.type) * t.convertedAmount;
  for (const t of incoming) balance += t.toConvertedAmount ?? t.convertedAmount;

  balance = round2(balance);
  await prisma.account.update({ where: { id: accountId }, data: { balance } });
  return balance;
}

export { getRate };
