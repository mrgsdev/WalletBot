import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  createTransaction,
  deleteTransaction,
  recalcAccountBalance,
  updateTransaction,
} from '../src/services/transactions.js';
import type { AuthUser } from '../src/middleware/auth.js';
import type { Scope } from '../src/services/scope.js';

let SCOPE: Scope;
const TODAY = new Date().toISOString().slice(0, 10);

let user: AuthUser;
let rubAccount: number;
let eurAccount: number;
let categoryId: number;
let incomeCategoryId: number;

/** Фиксируем курсы в БД, чтобы тесты не ходили во внешний API. */
async function seedRates() {
  const rates: Record<string, number> = { USD: 1, EUR: 0.9, RUB: 90 };
  for (const [quote, rate] of Object.entries(rates)) {
    await prisma.exchangeRate.upsert({
      where: { base_quote_date: { base: 'USD', quote, date: TODAY } },
      create: { base: 'USD', quote, rate, date: TODAY },
      update: { rate },
    });
  }
}

beforeAll(async () => {
  await seedRates();
});

beforeEach(async () => {
  // Каскады снимут всё остальное.
  await prisma.user.deleteMany();

  const created = await prisma.user.create({
    data: { telegramId: 'test-1', name: 'Тестовый пользователь' },
  });
  user = created as AuthUser;

  const budget = await prisma.budget.create({
    data: {
      name: 'Тестовый бюджет',
      kind: 'personal',
      createdById: user.id,
      members: { create: { userId: user.id } },
    },
  });
  SCOPE = { budgetId: budget.id, kind: 'personal', isOwner: true };

  const rub = await prisma.account.create({
    data: { budgetId: budget.id, ownerUserId: user.id, name: 'Карта', currency: 'RUB', initialBalance: 10_000, balance: 10_000 },
  });
  const eur = await prisma.account.create({
    data: { budgetId: budget.id, ownerUserId: user.id, name: 'Revolut', currency: 'EUR', initialBalance: 100, balance: 100 },
  });
  rubAccount = rub.id;
  eurAccount = eur.id;

  const cat = await prisma.category.create({
    data: { budgetId: budget.id, name: 'Продукты', type: 'expense', group: 'Питание' },
  });
  const inc = await prisma.category.create({
    data: { budgetId: budget.id, name: 'Зарплата', type: 'income', group: 'Доходы' },
  });
  categoryId = cat.id;
  incomeCategoryId = inc.id;
});

async function balanceOf(id: number) {
  return (await prisma.account.findUnique({ where: { id } }))!.balance;
}

describe('расход', () => {
  it('уменьшает баланс счёта', async () => {
    await createTransaction(user, SCOPE, {
      type: 'expense',
      accountId: rubAccount,
      categoryId,
      amount: 1500,
      currency: 'RUB',
      date: new Date().toISOString(),
    });
    expect(await balanceOf(rubAccount)).toBe(8500);
  });

  it('конвертирует валюту операции в валюту счёта', async () => {
    // 10 EUR при курсах USD→EUR 0.9 и USD→RUB 90 равны 1000 RUB.
    const tx = await createTransaction(user, SCOPE, {
      type: 'expense',
      accountId: rubAccount,
      categoryId,
      amount: 10,
      currency: 'EUR',
      date: new Date().toISOString(),
    });
    expect(tx.convertedAmount).toBe(1000);
    expect(tx.amount).toBe(10);
    expect(await balanceOf(rubAccount)).toBe(9000);
  });

  it('отклоняет нулевую и отрицательную сумму', async () => {
    await expect(
      createTransaction(user, SCOPE, {
        type: 'expense',
        accountId: rubAccount,
        categoryId,
        amount: 0,
        currency: 'RUB',
        date: new Date().toISOString(),
      }),
    ).rejects.toThrow(/больше нуля/);
  });

  it('требует категорию', async () => {
    await expect(
      createTransaction(user, SCOPE, {
        type: 'expense',
        accountId: rubAccount,
        amount: 100,
        currency: 'RUB',
        date: new Date().toISOString(),
      }),
    ).rejects.toThrow(/категорию/);
  });
});

describe('доход', () => {
  it('увеличивает баланс счёта', async () => {
    await createTransaction(user, SCOPE, {
      type: 'income',
      accountId: rubAccount,
      categoryId: incomeCategoryId,
      amount: 50_000,
      currency: 'RUB',
      date: new Date().toISOString(),
    });
    expect(await balanceOf(rubAccount)).toBe(60_000);
  });
});

describe('перевод между счетами', () => {
  it('списывает с источника и зачисляет получателю в его валюте', async () => {
    await createTransaction(user, SCOPE, {
      type: 'transfer',
      accountId: rubAccount,
      toAccountId: eurAccount,
      amount: 9000,
      currency: 'RUB',
      date: new Date().toISOString(),
    });

    expect(await balanceOf(rubAccount)).toBe(1000);
    // 9000 RUB = 100 USD = 90 EUR
    expect(await balanceOf(eurAccount)).toBe(190);
  });

  it('не даёт переводить на тот же счёт', async () => {
    await expect(
      createTransaction(user, SCOPE, {
        type: 'transfer',
        accountId: rubAccount,
        toAccountId: rubAccount,
        amount: 100,
        currency: 'RUB',
        date: new Date().toISOString(),
      }),
    ).rejects.toThrow(/должны отличаться/);
  });

  it('требует счёт-получатель', async () => {
    await expect(
      createTransaction(user, SCOPE, {
        type: 'transfer',
        accountId: rubAccount,
        amount: 100,
        currency: 'RUB',
        date: new Date().toISOString(),
      }),
    ).rejects.toThrow(/счёт-получатель/);
  });
});

describe('редактирование и удаление', () => {
  it('при изменении суммы баланс пересчитывается от исходного', async () => {
    const tx = await createTransaction(user, SCOPE, {
      type: 'expense',
      accountId: rubAccount,
      categoryId,
      amount: 1000,
      currency: 'RUB',
      date: new Date().toISOString(),
    });
    expect(await balanceOf(rubAccount)).toBe(9000);

    await updateTransaction(user, SCOPE, tx.id, {
      type: 'expense',
      accountId: rubAccount,
      categoryId,
      amount: 2500,
      currency: 'RUB',
      date: new Date().toISOString(),
    });
    expect(await balanceOf(rubAccount)).toBe(7500);
  });

  it('смена типа с расхода на доход разворачивает знак', async () => {
    const tx = await createTransaction(user, SCOPE, {
      type: 'expense',
      accountId: rubAccount,
      categoryId,
      amount: 1000,
      currency: 'RUB',
      date: new Date().toISOString(),
    });

    await updateTransaction(user, SCOPE, tx.id, {
      type: 'income',
      accountId: rubAccount,
      categoryId: incomeCategoryId,
      amount: 1000,
      currency: 'RUB',
      date: new Date().toISOString(),
    });
    expect(await balanceOf(rubAccount)).toBe(11_000);
  });

  it('перенос операции на другой счёт двигает оба баланса', async () => {
    const tx = await createTransaction(user, SCOPE, {
      type: 'expense',
      accountId: rubAccount,
      categoryId,
      amount: 900,
      currency: 'RUB',
      date: new Date().toISOString(),
    });

    await updateTransaction(user, SCOPE, tx.id, {
      type: 'expense',
      accountId: eurAccount,
      categoryId,
      amount: 900,
      currency: 'RUB',
      date: new Date().toISOString(),
    });

    expect(await balanceOf(rubAccount)).toBe(10_000);
    expect(await balanceOf(eurAccount)).toBe(91); // 900 RUB = 9 EUR
  });

  it('удаление возвращает баланс к исходному', async () => {
    const tx = await createTransaction(user, SCOPE, {
      type: 'expense',
      accountId: rubAccount,
      categoryId,
      amount: 3333,
      currency: 'RUB',
      date: new Date().toISOString(),
    });
    await deleteTransaction(user, SCOPE, tx.id);
    expect(await balanceOf(rubAccount)).toBe(10_000);
  });

  it('удаление перевода откатывает оба счёта', async () => {
    const tx = await createTransaction(user, SCOPE, {
      type: 'transfer',
      accountId: rubAccount,
      toAccountId: eurAccount,
      amount: 900,
      currency: 'RUB',
      date: new Date().toISOString(),
    });
    await deleteTransaction(user, SCOPE, tx.id);
    expect(await balanceOf(rubAccount)).toBe(10_000);
    expect(await balanceOf(eurAccount)).toBe(100);
  });
});

describe('recalcAccountBalance', () => {
  it('восстанавливает баланс по истории операций', async () => {
    await createTransaction(user, SCOPE, {
      type: 'expense', accountId: rubAccount, categoryId,
      amount: 1000, currency: 'RUB', date: new Date().toISOString(),
    });
    await createTransaction(user, SCOPE, {
      type: 'income', accountId: rubAccount, categoryId: incomeCategoryId,
      amount: 5000, currency: 'RUB', date: new Date().toISOString(),
    });

    // Портим баланс «руками» и просим пересчитать.
    await prisma.account.update({ where: { id: rubAccount }, data: { balance: 42 } });
    const balance = await recalcAccountBalance(rubAccount);

    expect(balance).toBe(14_000);
  });

  it('учитывает входящие переводы', async () => {
    await createTransaction(user, SCOPE, {
      type: 'transfer', accountId: rubAccount, toAccountId: eurAccount,
      amount: 1800, currency: 'RUB', date: new Date().toISOString(),
    });
    await prisma.account.update({ where: { id: eurAccount }, data: { balance: 0 } });
    expect(await recalcAccountBalance(eurAccount)).toBe(118); // 100 + 18
  });
});

describe('изоляция бюджетов', () => {
  it('нельзя записать операцию на чужой счёт', async () => {
    const other = await prisma.user.create({
      data: { telegramId: 'test-2', name: 'Другой' },
    });
    const otherBudget = await prisma.budget.create({
      data: {
        name: 'Чужой бюджет',
        kind: 'personal',
        createdById: other.id,
        members: { create: { userId: other.id } },
      },
    });
    const foreign = await prisma.account.create({
      data: { budgetId: otherBudget.id, ownerUserId: other.id, name: 'Чужая карта', currency: 'RUB' },
    });

    await expect(
      createTransaction(user, SCOPE, {
        type: 'expense', accountId: foreign.id, categoryId,
        amount: 100, currency: 'RUB', date: new Date().toISOString(),
      }),
    ).rejects.toThrow(/Счёт не найден/);
  });
});
