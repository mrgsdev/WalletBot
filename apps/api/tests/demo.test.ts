import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { clearDemo, demoStatus, seedDemo } from '../src/services/demo.js';
import { createTransaction } from '../src/services/transactions.js';
import { DEFAULT_CATEGORIES } from '../src/lib/defaultCategories.js';
import type { AuthUser } from '../src/middleware/auth.js';
import type { Scope } from '../src/services/scope.js';

const TODAY = new Date().toISOString().slice(0, 10);

let user: AuthUser;
let scope: Scope;
let cardId: number;

/** Курсы фиксируем в базе, чтобы тесты не ходили во внешний API. */
async function seedRates() {
  for (const [quote, rate] of Object.entries({ USD: 1, EUR: 0.9, RUB: 90 })) {
    await prisma.exchangeRate.upsert({
      where: { base_quote_date: { base: 'USD', quote, date: TODAY } },
      create: { base: 'USD', quote, rate, date: TODAY },
      update: { rate },
    });
  }
}

beforeAll(seedRates);

beforeEach(async () => {
  await prisma.user.deleteMany();

  user = (await prisma.user.create({
    data: { telegramId: 'demo-1', name: 'Новичок', settings: { create: {} } },
  })) as AuthUser;

  const budget = await prisma.budget.create({
    data: {
      name: 'Личный бюджет',
      kind: 'personal',
      createdById: user.id,
      members: { create: { userId: user.id } },
      categories: {
        create: DEFAULT_CATEGORIES.map((c, i) => ({
          name: c.name, type: c.type, group: c.group, icon: c.icon, color: c.color, sortOrder: i,
        })),
      },
      accounts: {
        create: [
          { ownerUserId: user.id, name: 'Карта', currency: 'RUB', sortOrder: 0 },
          { ownerUserId: user.id, name: 'Наличные', currency: 'RUB', sortOrder: 1 },
        ],
      },
    },
    include: { accounts: true },
  });

  scope = { budgetId: budget.id, kind: 'personal', isOwner: true };
  cardId = budget.accounts[0].id;
});

describe('seedDemo', () => {
  it('наполняет пустой бюджет историей', async () => {
    const status = await seedDemo(user, scope);
    expect(status.hasDemo).toBe(true);
    expect(status.count).toBeGreaterThan(40);

    const total = await prisma.transaction.count({ where: { budgetId: scope.budgetId } });
    expect(total).toBe(status.count);
  });

  it('помечает все созданные операции как демо', async () => {
    await seedDemo(user, scope);
    const notDemo = await prisma.transaction.count({
      where: { budgetId: scope.budgetId, isDemo: false },
    });
    expect(notDemo).toBe(0);
  });

  it('создаёт и доходы, и расходы — иначе диаграммы пустые', async () => {
    await seedDemo(user, scope);
    const income = await prisma.transaction.count({ where: { budgetId: scope.budgetId, type: 'income' } });
    const expense = await prisma.transaction.count({ where: { budgetId: scope.budgetId, type: 'expense' } });
    expect(income).toBeGreaterThan(0);
    expect(expense).toBeGreaterThan(10);
  });

  it('охватывает три месяца — для графика тренда', async () => {
    await seedDemo(user, scope);
    const rows = await prisma.transaction.findMany({
      where: { budgetId: scope.budgetId },
      select: { date: true },
    });
    const months = new Set(rows.map((r) => `${r.date.getUTCFullYear()}-${r.date.getUTCMonth()}`));
    expect(months.size).toBe(3);
  });

  it('ставит лимит на месяц и помечает его как демонстрационный', async () => {
    await seedDemo(user, scope);
    const budget = await prisma.budget.findUnique({ where: { id: scope.budgetId } });
    expect(budget?.monthlyLimit).toBeGreaterThan(0);
    expect(budget?.demoLimit).toBe(true);
  });

  it('не трогает лимит, заданный пользователем', async () => {
    await prisma.budget.update({
      where: { id: scope.budgetId },
      data: { monthlyLimit: 55_000 },
    });
    await seedDemo(user, scope);
    const budget = await prisma.budget.findUnique({ where: { id: scope.budgetId } });
    expect(budget?.monthlyLimit).toBe(55_000);
    expect(budget?.demoLimit).toBe(false);
  });

  it('повторный вызов не удваивает данные', async () => {
    const first = await seedDemo(user, scope);
    const second = await seedDemo(user, scope);
    expect(second.count).toBe(first.count);

    const total = await prisma.transaction.count({ where: { budgetId: scope.budgetId } });
    expect(total).toBe(first.count);
  });
});

describe('clearDemo', () => {
  it('удаляет демо-операции', async () => {
    await seedDemo(user, scope);
    const { removed } = await clearDemo(user, scope);
    expect(removed).toBeGreaterThan(40);

    const left = await prisma.transaction.count({ where: { budgetId: scope.budgetId } });
    expect(left).toBe(0);
  });

  it('сохраняет операции, добавленные пользователем', async () => {
    await seedDemo(user, scope);

    const category = await prisma.category.findFirst({
      where: { budgetId: scope.budgetId, type: 'expense' },
    });
    const mine = await createTransaction(user, scope, {
      type: 'expense',
      accountId: cardId,
      categoryId: category!.id,
      amount: 1234,
      currency: 'RUB',
      date: new Date().toISOString(),
      comment: 'Моя настоящая трата',
    });

    await clearDemo(user, scope);

    const left = await prisma.transaction.findMany({ where: { budgetId: scope.budgetId } });
    expect(left).toHaveLength(1);
    expect(left[0].id).toBe(mine.id);
    expect(left[0].comment).toBe('Моя настоящая трата');
  });

  it('пересчитывает баланс по оставшимся операциям', async () => {
    await seedDemo(user, scope);

    const category = await prisma.category.findFirst({
      where: { budgetId: scope.budgetId, type: 'expense' },
    });
    await createTransaction(user, scope, {
      type: 'expense',
      accountId: cardId,
      categoryId: category!.id,
      amount: 1000,
      currency: 'RUB',
      date: new Date().toISOString(),
    });

    await clearDemo(user, scope);

    const card = await prisma.account.findUnique({ where: { id: cardId } });
    // Осталась одна трата на 1000 при нулевом стартовом остатке.
    expect(card?.balance).toBe(-1000);
  });

  it('возвращает лимит в исходное состояние', async () => {
    await seedDemo(user, scope);
    await clearDemo(user, scope);

    const budget = await prisma.budget.findUnique({ where: { id: scope.budgetId } });
    expect(budget?.monthlyLimit).toBeNull();
    expect(budget?.demoLimit).toBe(false);
  });

  it('не сбрасывает лимит, заданный пользователем', async () => {
    await prisma.budget.update({ where: { id: scope.budgetId }, data: { monthlyLimit: 70_000 } });
    await seedDemo(user, scope);
    await clearDemo(user, scope);

    const budget = await prisma.budget.findUnique({ where: { id: scope.budgetId } });
    expect(budget?.monthlyLimit).toBe(70_000);
  });

  it('на пустом бюджете отрабатывает без ошибок', async () => {
    const { removed } = await clearDemo(user, scope);
    expect(removed).toBe(0);
  });
});

describe('demoStatus', () => {
  it('до и после наполнения отвечает корректно', async () => {
    expect(await demoStatus(scope)).toMatchObject({ hasDemo: false, count: 0 });
    await seedDemo(user, scope);
    expect((await demoStatus(scope)).hasDemo).toBe(true);
    await clearDemo(user, scope);
    expect(await demoStatus(scope)).toMatchObject({ hasDemo: false, count: 0 });
  });
});
