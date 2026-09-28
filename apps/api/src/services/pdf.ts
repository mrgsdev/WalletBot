import { createRequire } from 'node:module';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { formatMoneyCode, formatNumber } from '@budget/shared';
import { prisma } from '../lib/prisma.js';
import { getUsdRates } from './currency.js';
import { makeConverter, round2 } from './aggregate.js';
import { MONTHS_FULL, MONTHS_GENITIVE } from '../lib/dates.js';
import { categoryWhere, visibleAccountIds } from './scope.js';
import type { AuthUser } from '../middleware/auth.js';
import type { Scope } from './scope.js';
import type { ExportRange } from './excel.js';

const require = createRequire(import.meta.url);

type FontSet = Record<string, Record<string, Buffer>>;
type PdfDoc = NodeJS.EventEmitter & { end(): void };
type Printer = { createPdfKitDocument(def: TDocumentDefinitions): PdfDoc };

const PdfPrinter = require('pdfmake') as new (fonts: FontSet) => Printer;

const vfsModule = require('pdfmake/build/vfs_fonts.js') as
  | { pdfMake?: { vfs: Record<string, string> }; vfs?: Record<string, string> }
  | Record<string, string>;

const vfs: Record<string, string> =
  (vfsModule as { pdfMake?: { vfs: Record<string, string> } }).pdfMake?.vfs ??
  (vfsModule as { vfs?: Record<string, string> }).vfs ??
  (vfsModule as Record<string, string>);

const font = (name: string) => Buffer.from(vfs[name], 'base64');

const printer = new PdfPrinter({
  Roboto: {
    normal: font('Roboto-Regular.ttf'),
    bold: font('Roboto-Medium.ttf'),
    italics: font('Roboto-Italic.ttf'),
    bolditalics: font('Roboto-MediumItalic.ttf'),
  },
});

function fontCoverage(buf: Buffer): Set<number> {
  const codes = new Set<number>();
  const tables = buf.readUInt16BE(4);
  let cmap: number | null = null;
  for (let i = 0; i < tables; i++) {
    const head = 12 + i * 16;
    if (buf.toString('latin1', head, head + 4) === 'cmap') cmap = buf.readUInt32BE(head + 8);
  }
  if (cmap === null) return codes;

  let sub: number | null = null;
  let format = 0;
  const subtables = buf.readUInt16BE(cmap + 2);
  for (let i = 0; i < subtables; i++) {
    const head = cmap + 4 + i * 8;
    const platform = buf.readUInt16BE(head);
    const offset = cmap + buf.readUInt32BE(head + 4);
    const kind = buf.readUInt16BE(offset);
    if (kind === 12) {
      sub = offset;
      format = 12;
    } else if (kind === 4 && format !== 12 && (platform === 0 || platform === 3)) {
      sub = sub ?? offset;
      format = 4;
    }
  }
  if (sub === null) return codes;

  if (format === 12) {
    const groups = buf.readUInt32BE(sub + 12);
    for (let i = 0; i < groups; i++) {
      const head = sub + 16 + i * 12;
      const end = buf.readUInt32BE(head + 4);
      for (let code = buf.readUInt32BE(head); code <= end; code++) codes.add(code);
    }
    return codes;
  }

  const segments = buf.readUInt16BE(sub + 6) / 2;
  const ends = sub + 14;
  const starts = ends + segments * 2 + 2;
  for (let i = 0; i < segments; i++) {
    const start = buf.readUInt16BE(starts + i * 2);
    if (start === 0xffff) continue;
    const end = buf.readUInt16BE(ends + i * 2);
    for (let code = start; code <= end; code++) codes.add(code);
  }
  return codes;
}

const COVERAGE = fontCoverage(font('Roboto-Regular.ttf'));

export function pdfText(value: string, fallback = 'Без названия'): string {
  let out = '';
  for (const char of value.replace(/\s/g, ' ')) {
    const code = char.codePointAt(0);
    if (code !== undefined && COVERAGE.has(code)) out += char;
  }
  out = out.replace(/ {2,}/g, ' ').trim();
  return out.length > 0 ? out : fallback;
}

const MAX_ROWS = 1500;

const TYPE_NAMES: Record<string, string> = {
  income: 'Доход',
  expense: 'Расход',
  transfer: 'Перевод',
};

const GREY = '#6b7280';

function periodTitle(range: ExportRange): string {
  const { year, fromMonth, toMonth } = range;
  return fromMonth === toMonth
    ? `${MONTHS_FULL[fromMonth - 1]} ${year}`
    : `с ${MONTHS_GENITIVE[fromMonth - 1]} по ${MONTHS_FULL[toMonth - 1].toLowerCase()} ${year}`;
}

function formatDate(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${date.getUTCFullYear()}`;
}

export async function buildReportPdf(user: AuthUser, scope: Scope, range: ExportRange) {
  const { year, fromMonth, toMonth } = range;

  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  const base = settings?.baseCurrency ?? 'RUB';
  const toBase = makeConverter(await getUsdRates(), base);

  const accountIds = await visibleAccountIds(user, scope);
  const from = new Date(Date.UTC(year, fromMonth - 1, 1));
  const to = new Date(Date.UTC(year, toMonth, 0, 23, 59, 59, 999));

  const [budget, categories, transactions] = await Promise.all([
    prisma.budget.findUnique({ where: { id: scope.budgetId }, select: { name: true } }),
    prisma.category.findMany({
      where: categoryWhere(user, scope),
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    prisma.transaction.findMany({
      where: { accountId: { in: accountIds }, date: { gte: from, lte: to } },
      include: {
        account: { select: { name: true, currency: true } },
        toAccount: { select: { name: true } },
        category: { select: { name: true, group: true } },
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const budgetName = budget?.name ?? 'Бюджет';
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  let income = 0;
  let expense = 0;
  const byCategory = new Map<number, number>();

  for (const t of transactions) {
    if (t.type === 'transfer') continue;
    const value = toBase(t.convertedAmount, t.account.currency);
    if (t.type === 'income') income += value;
    else {
      expense += value;
      if (t.categoryId) byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + value);
    }
  }

  income = round2(income);
  expense = round2(expense);

  const spending = [...byCategory.entries()]
    .map(([id, amount]) => ({
      name: categoryById.get(id)?.name ?? 'Без категории',
      group: categoryById.get(id)?.group ?? 'Прочее',
      amount: round2(amount),
      share: expense > 0 ? (amount / expense) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const spendingTable: Content =
    spending.length === 0
      ? { text: 'За период расходов нет.', color: GREY, margin: [0, 4, 0, 0] }
      : {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto'],
            body: [
              [
                { text: 'Категория', bold: true },
                { text: 'Сумма', bold: true, alignment: 'right' },
                { text: 'Доля', bold: true, alignment: 'right' },
              ],
              ...spending.map((row) => [
                { text: pdfText(row.name), noWrap: false },
                { text: formatMoneyCode(row.amount, base), alignment: 'right' as const },
                { text: `${formatNumber(row.share)} %`, alignment: 'right' as const, color: GREY },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        };

  const shown = transactions.slice(0, MAX_ROWS);
  const rows = shown.map((t) => {
    const title =
      t.type === 'transfer'
        ? `${pdfText(t.account.name)} » ${pdfText(t.toAccount?.name ?? 'счёт удалён')}`
        : pdfText(t.category?.name ?? 'Без категории', 'Без категории');
    const sign = t.type === 'income' ? '' : t.type === 'expense' ? '−' : '';
    return [
      { text: formatDate(t.date), noWrap: true },
      { text: TYPE_NAMES[t.type] ?? t.type, color: GREY },
      { text: title },
      { text: pdfText(t.account.name), color: GREY },
      {
        text: `${sign}${formatMoneyCode(t.amount, t.currency, true).replace('−', '')}`,
        alignment: 'right' as const,
        noWrap: true,
      },
    ];
  });

  const content: Content[] = [
    { text: pdfText(budgetName, 'Бюджет'), fontSize: 18, bold: true },
    { text: periodTitle(range), color: GREY, margin: [0, 2, 0, 12] },

    {
      table: {
        widths: ['*', '*', '*'],
        body: [
          [
            { text: 'Доходы', color: GREY, fontSize: 9 },
            { text: 'Расходы', color: GREY, fontSize: 9 },
            { text: 'Разница', color: GREY, fontSize: 9 },
          ],
          [
            { text: formatMoneyCode(income, base), bold: true },
            { text: formatMoneyCode(expense, base), bold: true },
            { text: formatMoneyCode(round2(income - expense), base), bold: true },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 16],
    },

    { text: 'Расходы по категориям', fontSize: 13, bold: true, margin: [0, 0, 0, 6] },
    spendingTable,

    {
      text: `Операции (${formatNumber(transactions.length)})`,
      fontSize: 13,
      bold: true,
      margin: [0, 18, 0, 6],
      pageBreak: 'before',
    },
    rows.length === 0
      ? { text: 'За период операций нет.', color: GREY }
      : {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', '*', 'auto', 'auto'],
            body: [
              [
                { text: 'Дата', bold: true },
                { text: 'Тип', bold: true },
                { text: 'Категория', bold: true },
                { text: 'Счёт', bold: true },
                { text: 'Сумма', bold: true, alignment: 'right' },
              ],
              ...rows,
            ],
          },
          layout: 'lightHorizontalLines',
        },
  ];

  if (transactions.length > shown.length) {
    content.push({
      text: `Показаны первые ${formatNumber(shown.length)} операций из ${formatNumber(transactions.length)}. Полный список есть в выгрузке Excel.`,
      color: GREY,
      fontSize: 9,
      margin: [0, 8, 0, 0],
    });
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [32, 32, 32, 40],
    content,
    defaultStyle: { font: 'Roboto', fontSize: 9, lineHeight: 1.15 },
    footer: (currentPage: number, pageCount: number) => ({
      text: `${currentPage} из ${pageCount}`,
      alignment: 'center',
      color: GREY,
      fontSize: 8,
      margin: [0, 12, 0, 0],
    }),
  };

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = printer.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });

  const suffix = fromMonth === toMonth ? `${fromMonth}` : `${fromMonth}-${toMonth}`;
  return {
    buffer,
    filename: `budget-${year}-${suffix}.pdf`,
    budgetName,
    transactionCount: transactions.length,
  };
}
