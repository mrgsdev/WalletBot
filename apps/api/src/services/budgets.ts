import { prisma } from '../lib/prisma.js';
import { generateInviteCode } from '../lib/telegram.js';
import { DEFAULT_CATEGORIES } from '../lib/defaultCategories.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';

type Client = Pick<typeof prisma, 'budget' | 'category' | 'account' | 'budgetMember'>;

/** Наполняет новый бюджет категориями по умолчанию. */
async function seedCategories(budgetId: number, tx: Client) {
  await tx.category.createMany({
    data: DEFAULT_CATEGORIES.map((c, index) => ({
      budgetId,
      name: c.name,
      type: c.type,
      group: c.group,
      icon: c.icon,
      color: c.color,
      sortOrder: index,
    })),
  });
}

export interface CreateBudgetInput {
  name: string;
  kind: 'personal' | 'family';
  icon?: string;
  currency?: string;
  /** Заводить ли пару счетов по умолчанию (нужно только при регистрации). */
  withDefaultAccounts?: boolean;
}

/** Создаёт бюджет, делает автора участником и наполняет категориями. */
export async function createBudget(userId: number, input: CreateBudgetInput) {
  const name = input.name.trim();
  if (!name) throw badRequest('Укажите название бюджета');

  const currency = (input.currency ?? 'RUB').toUpperCase();

  const budget = await prisma.$transaction(async (tx) => {
    const created = await tx.budget.create({
      data: {
        name,
        kind: input.kind,
        icon: input.icon ?? (input.kind === 'family' ? '👨‍👩‍👧' : '👛'),
        // Код приглашения нужен только семейным бюджетам.
        inviteCode: input.kind === 'family' ? generateInviteCode() : null,
        limitCurrency: currency,
        createdById: userId,
        members: { create: { userId } },
      },
    });

    await seedCategories(created.id, tx as unknown as Client);

    if (input.withDefaultAccounts) {
      await tx.account.createMany({
        data: [
          { budgetId: created.id, ownerUserId: userId, name: 'Карта', icon: '💳', color: '#6EC1FF', currency, sortOrder: 0 },
          { budgetId: created.id, ownerUserId: userId, name: 'Наличные', icon: '💵', color: '#7ED97E', currency, sortOrder: 1 },
        ],
      });
    }

    return created;
  });

  return loadBudget(budget.id);
}

export function loadBudget(budgetId: number) {
  return prisma.budget.findUnique({
    where: { id: budgetId },
    include: {
      members: { include: { user: true }, orderBy: { joinedAt: 'asc' } },
      _count: { select: { accounts: true, transactions: true } },
    },
  });
}

/** Все бюджеты пользователя. */
export async function listBudgets(userId: number) {
  const memberships = await prisma.budgetMember.findMany({
    where: { userId },
    include: {
      budget: {
        include: {
          members: { include: { user: true }, orderBy: { joinedAt: 'asc' } },
          _count: { select: { accounts: true, transactions: true } },
        },
      },
    },
    orderBy: { budget: { createdAt: 'asc' } },
  });
  return memberships.map((m) => m.budget);
}

/** Присоединение по коду приглашения. Работает только для семейных бюджетов. */
export async function joinByCode(userId: number, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw badRequest('Пустой код приглашения');

  const budget = await prisma.budget.findUnique({ where: { inviteCode: code } });
  // Бюджет удалён вместе с кодом — ссылка больше не действует.
  if (!budget) throw notFound('Приглашение не найдено или больше не действует');
  if (budget.kind !== 'family') throw badRequest('В личный бюджет нельзя пригласить');

  await prisma.budgetMember.upsert({
    where: { budgetId_userId: { budgetId: budget.id, userId } },
    create: { budgetId: budget.id, userId },
    update: {},
  });

  return loadBudget(budget.id);
}

/** Выход из бюджета. Личные счета участника уходят вместе с ним. */
export async function leaveBudget(userId: number, budgetId: number) {
  const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
  if (!budget) throw notFound('Бюджет не найден');
  if (budget.createdById === userId) {
    throw badRequest('Создатель не может выйти — бюджет нужно удалить');
  }

  const membership = await prisma.budgetMember.findUnique({
    where: { budgetId_userId: { budgetId, userId } },
  });
  if (!membership) throw notFound('Вы не состоите в этом бюджете');

  await prisma.budgetMember.delete({ where: { budgetId_userId: { budgetId, userId } } });
}

/**
 * Исключение участника. Доступно только создателю бюджета.
 * Операции исключённого остаются в истории — иначе у остальных «поедут» балансы.
 */
export async function removeMember(actorId: number, budgetId: number, targetUserId: number) {
  const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
  if (!budget) throw notFound('Бюджет не найден');
  if (budget.createdById !== actorId) throw forbidden('Исключать участников может только создатель');
  if (targetUserId === actorId) throw badRequest('Нельзя исключить самого себя');

  const membership = await prisma.budgetMember.findUnique({
    where: { budgetId_userId: { budgetId, userId: targetUserId } },
  });
  if (!membership) throw notFound('Участник не найден');

  await prisma.budgetMember.delete({
    where: { budgetId_userId: { budgetId, userId: targetUserId } },
  });
}

/**
 * Полное удаление бюджета вместе со счетами, операциями и категориями.
 * Код приглашения исчезает, поэтому старая ссылка перестаёт работать.
 */
export async function deleteBudget(userId: number, budgetId: number) {
  const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
  if (!budget) throw notFound('Бюджет не найден');
  if (budget.createdById !== userId) throw forbidden('Удалить бюджет может только его создатель');

  const remaining = await prisma.budgetMember.count({ where: { userId } });
  if (remaining <= 1) throw badRequest('Нельзя удалить единственный бюджет');

  // Каскады в схеме сносят счета, операции, категории, планы и напоминания.
  await prisma.budget.delete({ where: { id: budgetId } });
}

/** Перевыпуск кода приглашения — старая ссылка перестаёт работать. */
export async function rotateInvite(userId: number, budgetId: number) {
  const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
  if (!budget) throw notFound('Бюджет не найден');
  if (budget.createdById !== userId) throw forbidden('Обновить ссылку может только создатель');
  if (budget.kind !== 'family') throw badRequest('У личного бюджета нет приглашений');

  await prisma.budget.update({
    where: { id: budgetId },
    data: { inviteCode: generateInviteCode() },
  });
  return loadBudget(budgetId);
}

/** Ссылка-приглашение вида https://t.me/bot?start=join_CODE. */
export function inviteLink(botUsername: string, code: string): string {
  return `https://t.me/${botUsername}?start=join_${code}`;
}
