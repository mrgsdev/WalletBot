import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';
import { getUsdRates } from './currency.js';
import { makeConverter, round2 } from './aggregate.js';
import { MONTHS_FULL } from '../lib/dates.js';
import { categoryWhere, visibleAccountIds } from './scope.js';
import type { AuthUser } from '../middleware/auth.js';
import type { Scope } from './scope.js';

export interface ExportRange {
  year: number;
  fromMonth: number;
  toMonth: number;
}

const TYPE_NAMES: Record<string, string> = {
  income: 'Доход',
  expense: 'Расход',
  transfer: 'Перевод',
};

/**
 * Собирает книгу Excel за диапазон месяцев.
 * Лист «План-Факт» — категории по строкам, месяцы по колонкам.
 * Лист «Операции» — плоский список транзакций.
 */
export async function buildWorkbook(user: AuthUser, scope: Scope, range: ExportRange) {
  const { year, fromMonth, toMonth } = range;

  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  const base = settings?.baseCurrency ?? 'RUB';
  const toBase = makeConverter(await getUsdRates(), base);

  const accountIds = await visibleAccountIds(user, scope);
  const from = new Date(Date.UTC(year, fromMonth - 1, 1));
  const to = new Date(Date.UTC(year, toMonth, 0, 23, 59, 59, 999));

  const [budget, categories, plans, transactions] = await Promise.all([
    prisma.budget.findUnique({ where: { id: scope.budgetId }, select: { name: true } }),
    prisma.category.findMany({
      where: categoryWhere(user, scope),
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    prisma.budgetPlan.findMany({
      where: { budgetId: scope.budgetId, year, month: { gte: fromMonth, lte: toMonth } },
    }),
    prisma.transaction.findMany({
      where: { accountId: { in: accountIds }, date: { gte: from, lte: to } },
      include: {
        account: { select: { name: true, currency: true } },
        toAccount: { select: { name: true } },
        category: { select: { name: true, group: true } },
        user: { select: { name: true } },
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const months: number[] = [];
  for (let m = fromMonth; m <= toMonth; m++) months.push(m);

  const planMap = new Map(plans.map((p) => [`${p.categoryId}:${p.month}`, p.plannedAmount]));

  const factMap = new Map<string, number>();
  for (const t of transactions) {
    if (!t.categoryId || t.type === 'transfer') continue;
    const key = `${t.categoryId}:${t.date.getUTCMonth() + 1}`;
    factMap.set(key, (factMap.get(key) ?? 0) + toBase(t.convertedAmount, t.account.currency));
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Бюджет';
  workbook.created = new Date();

  // ---------- Лист «План-Факт» ----------
  const sheet = workbook.addWorksheet('План-Факт', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 2 }],
  });

  const header1: string[] = ['Группа', 'Категория'];
  const header2: string[] = ['', ''];
  for (const m of months) {
    header1.push(MONTHS_FULL[m - 1], '', '');
    header2.push('План', 'Факт', 'Разница');
  }
  header1.push('Итого план', 'Итого факт');
  header2.push('', '');

  sheet.addRow(header1);
  sheet.addRow(header2);

  months.forEach((_, i) => {
    const start = 3 + i * 3;
    sheet.mergeCells(1, start, 1, start + 2);
  });
  sheet.mergeCells(1, 1, 2, 1);
  sheet.mergeCells(1, 2, 2, 2);

  const lastCol = 2 + months.length * 3;
  sheet.mergeCells(1, lastCol + 1, 2, lastCol + 1);
  sheet.mergeCells(1, lastCol + 2, 2, lastCol + 2);

  for (const rowIndex of [1, 2]) {
    const row = sheet.getRow(rowIndex);
    row.font = { bold: true };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  const addSection = (title: string, list: typeof categories) => {
    if (list.length === 0) return;
    const sectionRow = sheet.addRow([title]);
    sectionRow.font = { bold: true };
    sectionRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };

    for (const c of list) {
      const cells: (string | number)[] = [c.group ?? '', c.name];
      let totalPlan = 0;
      let totalFact = 0;
      for (const m of months) {
        const plan = round2(planMap.get(`${c.id}:${m}`) ?? 0);
        const fact = round2(factMap.get(`${c.id}:${m}`) ?? 0);
        totalPlan += plan;
        totalFact += fact;
        cells.push(plan, fact, round2(plan - fact));
      }
      cells.push(round2(totalPlan), round2(totalFact));
      sheet.addRow(cells);
    }
  };

  addSection('ДОХОДЫ', categories.filter((c) => c.type === 'income'));
  sheet.addRow([]);
  addSection('РАСХОДЫ', categories.filter((c) => c.type === 'expense'));

  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 28;
  for (let i = 3; i <= lastCol + 2; i++) {
    sheet.getColumn(i).width = 13;
    sheet.getColumn(i).numFmt = '#,##0.00';
  }

  // ---------- Лист «Операции» ----------
  const txSheet = workbook.addWorksheet('Операции');
  txSheet.addRow([
    'Дата', 'Тип', 'Счёт', 'Счёт-получатель', 'Группа', 'Категория',
    'Сумма', 'Валюта', `Сумма (${base})`, 'Кто', 'Комментарий',
  ]).font = { bold: true };

  for (const t of transactions) {
    txSheet.addRow([
      t.date.toISOString().slice(0, 10),
      TYPE_NAMES[t.type] ?? t.type,
      t.account.name,
      t.toAccount?.name ?? '',
      t.category?.group ?? '',
      t.category?.name ?? '',
      t.amount,
      t.currency,
      round2(toBase(t.convertedAmount, t.account.currency)),
      t.user.name,
      t.comment ?? '',
    ]);
  }

  txSheet.columns.forEach((col, i) => {
    col.width = [12, 10, 16, 16, 20, 22, 12, 8, 14, 18, 30][i] ?? 14;
  });
  txSheet.getColumn(7).numFmt = '#,##0.00';
  txSheet.getColumn(9).numFmt = '#,##0.00';

  const safeName = (budget?.name ?? 'бюджет').replace(/[^\wа-яА-ЯёЁ-]+/g, '_').slice(0, 30);
  const filename = `${safeName}-${year}-${String(fromMonth).padStart(2, '0')}-${String(toMonth).padStart(2, '0')}.xlsx`;

  return {
    workbook,
    filename,
    budgetName: budget?.name ?? 'Бюджет',
    transactionCount: transactions.length,
  };
}
