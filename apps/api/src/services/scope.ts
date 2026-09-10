import { prisma } from '../lib/prisma.js';
import { forbidden, notFound } from '../lib/errors.js';
import type { AuthUser } from '../middleware/auth.js';

/** Текущий бюджет запроса и роль пользователя в нём. */
export interface Scope {
  budgetId: number;
  kind: 'personal' | 'family';
  /** Создатель бюджета: только он может удалять бюджет и исключать участников. */
  isOwner: boolean;
}

/**
 * Видимость счетов.
 * В семейном бюджете общие счета видны всем участникам, личные — только владельцу.
 * В личном бюджете участник один, поэтому видно всё.
 */
export function accountWhere(user: AuthUser, scope: Scope) {
  if (scope.kind === 'personal') return { budgetId: scope.budgetId };
  return {
    budgetId: scope.budgetId,
    OR: [{ isShared: true }, { ownerUserId: user.id }],
  };
}

/** Идентификаторы счетов, доступных пользователю в текущем бюджете. */
export async function visibleAccountIds(user: AuthUser, scope: Scope): Promise<number[]> {
  const accounts = await prisma.account.findMany({
    where: accountWhere(user, scope),
    select: { id: true },
  });
  return accounts.map((a) => a.id);
}

/** Категории принадлежат бюджету целиком. */
export function categoryWhere(_user: AuthUser, scope: Scope) {
  return { budgetId: scope.budgetId };
}

/** Проверяет членство и возвращает scope. */
export async function resolveScope(userId: number, budgetId: number): Promise<Scope> {
  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
    select: { id: true, kind: true, createdById: true },
  });
  if (!budget) throw notFound('Бюджет не найден');

  const membership = await prisma.budgetMember.findUnique({
    where: { budgetId_userId: { budgetId, userId } },
  });
  if (!membership) throw forbidden('У вас нет доступа к этому бюджету');

  return {
    budgetId: budget.id,
    kind: budget.kind,
    isOwner: budget.createdById === userId,
  };
}

/** Бюджет по умолчанию — первый личный, иначе любой доступный. */
export async function defaultBudgetId(userId: number): Promise<number | null> {
  const memberships = await prisma.budgetMember.findMany({
    where: { userId },
    include: { budget: { select: { id: true, kind: true, createdAt: true } } },
    orderBy: { budget: { createdAt: 'asc' } },
  });
  if (memberships.length === 0) return null;
  const personal = memberships.find((m) => m.budget.kind === 'personal');
  return (personal ?? memberships[0]).budget.id;
}
