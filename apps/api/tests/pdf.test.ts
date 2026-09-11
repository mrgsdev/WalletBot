import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { buildReportPdf, pdfText } from '../src/services/pdf.js';
import { createTransaction } from '../src/services/transactions.js';
import { DEFAULT_CATEGORIES } from '../src/lib/defaultCategories.js';
import type { AuthUser } from '../src/middleware/auth.js';
import type { Scope } from '../src/services/scope.js';

const TODAY = new Date().toISOString().slice(0, 10);

let user: AuthUser;
let scope: Scope;
let cardId: number;
let cashId: number;

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
    data: { telegramId: 'pdf-1', name: 'Отчётник', settings: { create: {} } },
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
  cashId = budget.accounts[1].id;
});

/** Месяц с операциями — чтобы отчёт не оказался пустым. */
async function seedMonth() {
  const expense = await prisma.category.findFirst({
    where: { budgetId: scope.budgetId, type: 'expense' },
  });
  const income = await prisma.category.findFirst({
    where: { budgetId: scope.budgetId, type: 'income' },
  });

  await createTransaction(user, scope, {
    type: 'income',
    accountId: cardId,
    categoryId: income!.id,
    amount: 100_000,
    currency: 'RUB',
    date: '2026-03-05T00:00:00.000Z',
  });
  await createTransaction(user, scope, {
    type: 'expense',
    accountId: cardId,
    categoryId: expense!.id,
    amount: 2_500,
    currency: 'RUB',
    date: '2026-03-06T00:00:00.000Z',
  });
  await createTransaction(user, scope, {
    type: 'transfer',
    accountId: cardId,
    toAccountId: cashId,
    amount: 7_000,
    currency: 'RUB',
    date: '2026-03-07T00:00:00.000Z',
  });
}

const RANGE = { year: 2026, fromMonth: 3, toMonth: 3 };

describe('pdfText', () => {
  it('убирает символы, которых нет в шрифте отчёта', () => {
    // Roboto из pdfmake не содержит эмодзи — pdfkit нарисовал бы пустые квадраты.
    expect(pdfText('🍕 Пицца')).toBe('Пицца');
    expect(pdfText('Карта → Наличные')).toBe('Карта Наличные');
  });

  it('подставляет запасной текст, если не осталось ничего', () => {
    expect(pdfText('🚀🔥')).toBe('Без названия');
    expect(pdfText('🚀', 'Без категории')).toBe('Без категории');
  });

  it('сохраняет кириллицу, латиницу и обычную пунктуацию', () => {
    expect(pdfText('Кафе и рестораны')).toBe('Кафе и рестораны');
    expect(pdfText('Netflix — №1 (12,99 €)')).toBe('Netflix — №1 (12,99 €)');
  });

  it('схлопывает переносы строк: в ячейке таблицы им не место', () => {
    expect(pdfText('Карта\nVisa')).toBe('Карта Visa');
    expect(pdfText('  Карта   Visa  ')).toBe('Карта Visa');
  });
});

describe('buildReportPdf', () => {
  it('собирает настоящий PDF с операциями периода', async () => {
    await seedMonth();
    const report = await buildReportPdf(user, scope, RANGE);

    expect(report.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(report.buffer.length).toBeGreaterThan(5_000);
    expect(report.filename).toBe('budget-2026-3.pdf');
    expect(report.budgetName).toBe('Личный бюджет');
    expect(report.transactionCount).toBe(3);
  });

  it('строит отчёт и за пустой период — без операций и категорий', async () => {
    const report = await buildReportPdf(user, scope, { year: 2026, fromMonth: 7, toMonth: 7 });

    expect(report.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(report.transactionCount).toBe(0);
  });

  it('в имени файла отражает диапазон месяцев', async () => {
    const report = await buildReportPdf(user, scope, { year: 2026, fromMonth: 1, toMonth: 3 });
    expect(report.filename).toBe('budget-2026-1-3.pdf');
  });
});
