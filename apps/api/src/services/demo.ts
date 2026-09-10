import { prisma } from '../lib/prisma.js';
import { createTransaction, recalcAccountBalance } from './transactions.js';
import type { AuthUser } from '../middleware/auth.js';
import type { Scope } from './scope.js';
import { visibleAccountIds } from './scope.js';

/**
 * Демо-данные для обучения.
 *
 * У нового пользователя все экраны пустые, и обзорный тур показывать нечего:
 * ни диаграмм, ни истории, ни бюджета на месяц. Поэтому перед обучением
 * наполняем бюджет правдоподобной историей, а после — предлагаем удалить.
 */

/** Детерминированный ГПСЧ: демо у всех выглядит одинаково предсказуемо. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const DEMO_LIMIT = 120_000;

/** Сколько демо-операций уже есть в бюджете. */
export async function demoCount(scope: Scope): Promise<number> {
  return prisma.transaction.count({ where: { budgetId: scope.budgetId, isDemo: true } });
}

export interface DemoStatus {
  hasDemo: boolean;
  count: number;
}

export async function demoStatus(scope: Scope): Promise<DemoStatus> {
  const count = await demoCount(scope);
  return { hasDemo: count > 0, count };
}

/**
 * Наполняет бюджет историей за три месяца.
 * Повторный вызов ничего не делает — демо создаётся один раз.
 */
export async function seedDemo(user: AuthUser, scope: Scope): Promise<DemoStatus> {
  const existing = await demoCount(scope);
  if (existing > 0) return { hasDemo: true, count: existing };

  const accounts = await prisma.account.findMany({
    where: { budgetId: scope.budgetId, isArchived: false },
    orderBy: { sortOrder: 'asc' },
  });
  if (accounts.length === 0) return { hasDemo: false, count: 0 };

  const categories = await prisma.category.findMany({
    where: { budgetId: scope.budgetId, isArchived: false },
  });
  const income = categories.filter((c) => c.type === 'income');
  const expense = categories.filter((c) => c.type === 'expense');
  if (income.length === 0 || expense.length === 0) return { hasDemo: false, count: 0 };

  const rnd = makeRandom(2026);
  const pick = <T>(list: T[]): T => list[Math.floor(rnd() * list.length)];
  const between = (min: number, max: number) => Math.round((min + rnd() * (max - min)) / 10) * 10;

  const main = accounts[0];
  const cash = accounts[1] ?? accounts[0];
  const currency = main.currency;

  const byName = (name: string, list: typeof categories) =>
    list.find((c) => c.name === name) ?? pick(list);

  const now = new Date();
  let created = 0;

  // Три месяца: этого хватает и на кольцевую диаграмму, и на график тренда.
  for (let back = 2; back >= 0; back--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const maxDay = back === 0 ? now.getUTCDate() : daysInMonth;

    const at = (day: number, hour = 12) =>
      new Date(Date.UTC(year, month, Math.min(day, maxDay), hour)).toISOString();

    if (maxDay >= 5) {
      await createTransaction(user, scope, {
        type: 'income',
        accountId: main.id,
        categoryId: byName('Зарплата', income).id,
        amount: between(180_000, 220_000),
        currency,
        date: at(5),
        comment: 'Зарплата',
        isDemo: true,
      });
      created++;
    }

    if (cash.id !== main.id && maxDay >= 6) {
      await createTransaction(user, scope, {
        type: 'transfer',
        accountId: main.id,
        toAccountId: cash.id,
        amount: between(20_000, 40_000),
        currency,
        date: at(6),
        comment: 'Снятие наличных',
        isDemo: true,
      });
      created++;
    }

    for (const name of ['Квартплата', 'Коммуналка', 'Интернет и связь', 'Подписки']) {
      if (maxDay < 10) break;
      await createTransaction(user, scope, {
        type: 'expense',
        accountId: main.id,
        categoryId: byName(name, expense).id,
        amount: between(700, 25_000),
        currency,
        date: at(10),
        comment: name,
        isRecurring: true,
        isDemo: true,
      });
      created++;
    }

    const everyday = [
      'Продукты', 'Кафе и рестораны', 'Готовая еда/доставка', 'Такси/транспорт',
      'Бензин', 'Хозтовары', 'Личные вещи', 'Здоровье', 'Хобби', 'Уход за собой',
    ]
      .map((name) => expense.find((c) => c.name === name))
      .filter((c): c is (typeof expense)[number] => Boolean(c));

    const count = 14 + Math.floor(rnd() * 8);
    for (let i = 0; i < count; i++) {
      const useCash = rnd() > 0.75;
      await createTransaction(user, scope, {
        type: 'expense',
        accountId: useCash ? cash.id : main.id,
        categoryId: pick(everyday.length ? everyday : expense).id,
        amount: between(200, 5000),
        currency: useCash ? cash.currency : currency,
        date: at(1 + Math.floor(rnd() * maxDay), 9 + Math.floor(rnd() * 10)),
        isDemo: true,
      });
      created++;
    }
  }

  // Лимит на месяц, чтобы карточка бюджета была наглядной.
  const budget = await prisma.budget.findUnique({ where: { id: scope.budgetId } });
  if (budget && budget.monthlyLimit === null) {
    await prisma.budget.update({
      where: { id: scope.budgetId },
      data: { monthlyLimit: DEMO_LIMIT, limitCurrency: currency, demoLimit: true },
    });
  }

  return { hasDemo: true, count: created };
}

/**
 * Удаляет демо-операции и возвращает балансы счетов к реальным значениям.
 * Операции, добавленные пользователем вручную, не трогаются.
 */
export async function clearDemo(user: AuthUser, scope: Scope): Promise<{ removed: number }> {
  const removed = await prisma.transaction.deleteMany({
    where: { budgetId: scope.budgetId, isDemo: true },
  });

  // Балансы пересчитываем по оставшейся истории.
  const accountIds = await visibleAccountIds(user, scope);
  for (const id of accountIds) await recalcAccountBalance(id);

  // Лимит возвращаем, только если его поставило демо.
  const budget = await prisma.budget.findUnique({ where: { id: scope.budgetId } });
  if (budget?.demoLimit) {
    await prisma.budget.update({
      where: { id: scope.budgetId },
      data: { monthlyLimit: null, demoLimit: false },
    });
  }

  return { removed: removed.count };
}
