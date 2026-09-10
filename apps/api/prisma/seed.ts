/**
 * Сид для локальной разработки: пользователь из DEV_USER_ID,
 * личный бюджет со счетами и историей операций за 8 месяцев,
 * чтобы экраны статистики не были пустыми.
 */
import { env } from '../src/lib/env.js';
import { prisma } from '../src/lib/prisma.js';
import { ensureUser } from '../src/services/users.js';
import { createTransaction } from '../src/services/transactions.js';
import type { AuthUser } from '../src/middleware/auth.js';
import type { Scope } from '../src/services/scope.js';

/** Детерминированный ГПСЧ — повторный сид даёт те же цифры. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const rnd = makeRandom(42);
const pick = <T>(list: T[]): T => list[Math.floor(rnd() * list.length)];
const amountBetween = (min: number, max: number) =>
  Math.round((min + rnd() * (max - min)) / 10) * 10;

async function main() {
  const user = (await ensureUser({
    id: Number(env.devUserId),
    first_name: env.devUserName,
    username: 'dev_user',
  })) as AuthUser;

  const membership = await prisma.budgetMember.findFirst({
    where: { userId: user.id },
    include: { budget: true },
    orderBy: { budget: { createdAt: 'asc' } },
  });
  if (!membership) throw new Error('У пользователя нет бюджета');

  const budget = membership.budget;
  const scope: Scope = { budgetId: budget.id, kind: budget.kind, isOwner: true };

  console.log(`[seed] пользователь #${user.id}, бюджет «${budget.name}» #${budget.id}`);

  const existing = await prisma.transaction.count({ where: { budgetId: budget.id } });
  if (existing > 0) {
    console.log(`[seed] уже есть ${existing} операций — пропускаю`);
    return;
  }

  // Лимит на месяц, чтобы карточка бюджета была наглядной.
  await prisma.budget.update({
    where: { id: budget.id },
    data: { monthlyLimit: 120_000, limitCurrency: 'RUB' },
  });

  let accounts = await prisma.account.findMany({
    where: { budgetId: budget.id },
    orderBy: { sortOrder: 'asc' },
  });

  if (accounts.length < 3) {
    await prisma.account.create({
      data: {
        budgetId: budget.id,
        ownerUserId: user.id,
        name: 'Revolut',
        icon: '🏦',
        color: '#B57BFF',
        currency: 'EUR',
        initialBalance: 3437.23,
        balance: 3437.23,
        sortOrder: 2,
      },
    });
    accounts = await prisma.account.findMany({
      where: { budgetId: budget.id },
      orderBy: { sortOrder: 'asc' },
    });
  }

  const categories = await prisma.category.findMany({ where: { budgetId: budget.id } });
  const incomeCats = categories.filter((c) => c.type === 'income');
  const expenseCats = categories.filter((c) => c.type === 'expense');

  const main = accounts[0];
  const cash = accounts[1] ?? accounts[0];

  const now = new Date();
  let created = 0;

  for (let back = 7; back >= 0; back--) {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const year = monthDate.getUTCFullYear();
    const month = monthDate.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const maxDay = back === 0 ? now.getUTCDate() : daysInMonth;

    if (maxDay >= 5) {
      await createTransaction(user, scope, {
        type: 'income',
        accountId: main.id,
        categoryId: incomeCats.find((c) => c.name === 'Зарплата')!.id,
        amount: amountBetween(180_000, 240_000),
        currency: main.currency,
        date: new Date(Date.UTC(year, month, 5)).toISOString(),
        comment: 'Зарплата за месяц',
      });
      created++;
    }

    if (cash.id !== main.id && maxDay >= 6) {
      await createTransaction(user, scope, {
        type: 'transfer',
        accountId: main.id,
        toAccountId: cash.id,
        amount: amountBetween(30_000, 60_000),
        currency: main.currency,
        date: new Date(Date.UTC(year, month, 6)).toISOString(),
        comment: 'Снятие наличных',
      });
      created++;
    }

    for (const name of ['Квартплата', 'Коммуналка', 'Интернет и связь', 'Подписки']) {
      const category = expenseCats.find((c) => c.name === name);
      if (!category || maxDay < 10) continue;
      await createTransaction(user, scope, {
        type: 'expense',
        accountId: main.id,
        categoryId: category.id,
        amount: amountBetween(700, 28_000),
        currency: main.currency,
        date: new Date(Date.UTC(year, month, 10)).toISOString(),
        comment: name,
        isRecurring: true,
      });
      created++;
    }

    const everyday = expenseCats.filter((c) =>
      ['Продукты', 'Кафе и рестораны', 'Готовая еда/доставка', 'Такси/транспорт', 'Бензин',
       'Хозтовары', 'Личные вещи', 'Здоровье', 'Хобби', 'Покупки детям', 'Разное',
       'Путешествия и отдых', 'Уход за собой'].includes(c.name),
    );

    const count = 18 + Math.floor(rnd() * 14);
    for (let i = 0; i < count; i++) {
      const day = 1 + Math.floor(rnd() * maxDay);
      const category = pick(everyday);
      const useCash = rnd() > 0.75;
      await createTransaction(user, scope, {
        type: 'expense',
        accountId: useCash ? cash.id : main.id,
        categoryId: category.id,
        amount: amountBetween(200, category.name === 'Путешествия и отдых' ? 45_000 : 6000),
        currency: useCash ? cash.currency : main.currency,
        date: new Date(Date.UTC(year, month, day, 12)).toISOString(),
      });
      created++;
    }
  }

  for (const name of ['Продукты', 'Кафе и рестораны', 'Квартплата', 'Такси/транспорт', 'Хобби']) {
    const category = expenseCats.find((c) => c.name === name);
    if (!category) continue;
    await prisma.budgetPlan.create({
      data: {
        budgetId: budget.id,
        categoryId: category.id,
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
        plannedAmount: amountBetween(10_000, 60_000),
      },
    });
  }

  console.log(`[seed] создано операций: ${created}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
