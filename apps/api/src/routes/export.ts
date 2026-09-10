import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/asyncHandler.js';
import { buildWorkbook, type ExportRange } from '../services/excel.js';
import { sendDocument } from '../services/telegram-send.js';
import { visibleAccountIds } from '../services/scope.js';
import { MONTHS_FULL, parseDate } from '../lib/dates.js';
import { badRequest } from '../lib/errors.js';

export const exportRouter = Router();

function rangeFromQuery(query: Record<string, unknown>): ExportRange {
  const now = new Date();
  const year = Number(query.year ?? now.getUTCFullYear());
  const fromMonth = Math.min(Math.max(Number(query.fromMonth ?? 1), 1), 12);
  const toMonth = Math.min(Math.max(Number(query.toMonth ?? 12), fromMonth), 12);
  if (!Number.isFinite(year)) throw badRequest('Некорректный год');
  return { year, fromMonth, toMonth };
}

/** Скачивание файла напрямую. */
exportRouter.get(
  '/xlsx',
  ah(async (req, res) => {
    const range = rangeFromQuery(req.query as Record<string, unknown>);
    const { workbook, filename } = await buildWorkbook(req.user, req.scope, range);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    await workbook.xlsx.write(res);
    res.end();
  }),
);

/**
 * Отправка выгрузки прямо в чат с ботом.
 * В Telegram скачивание файла из Mini App работает ненадёжно,
 * поэтому файл приходит сообщением от бота.
 */
exportRouter.post(
  '/send',
  ah(async (req, res) => {
    const range = rangeFromQuery(req.body ?? {});
    const { workbook, filename, budgetName, transactionCount } = await buildWorkbook(
      req.user,
      req.scope,
      range,
    );

    if (transactionCount === 0) {
      throw badRequest('За выбранный период нет операций');
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const period =
      range.fromMonth === range.toMonth
        ? `${MONTHS_FULL[range.fromMonth - 1]} ${range.year}`
        : `${MONTHS_FULL[range.fromMonth - 1]} — ${MONTHS_FULL[range.toMonth - 1]} ${range.year}`;

    await sendDocument(
      req.user.telegramId,
      buffer,
      filename,
      `📊 <b>${budgetName}</b>\n${period}\nОпераций: ${transactionCount}`,
    );

    res.json({ ok: true, filename, transactionCount });
  }),
);

/** Быстрая выгрузка операций за произвольный период в CSV. */
exportRouter.get(
  '/csv',
  ah(async (req, res) => {
    const accountIds = await visibleAccountIds(req.user, req.scope);
    const from = parseDate(req.query.from, new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)));
    const to = parseDate(req.query.to, new Date());

    const rows = await prisma.transaction.findMany({
      where: { accountId: { in: accountIds }, date: { gte: from, lte: to } },
      include: {
        account: { select: { name: true } },
        category: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    });

    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Дата', 'Тип', 'Счёт', 'Категория', 'Сумма', 'Валюта', 'Кто', 'Комментарий'].join(';'),
      ...rows.map((t) =>
        [
          t.date.toISOString().slice(0, 10),
          t.type,
          t.account.name,
          t.category?.name ?? '',
          String(t.amount).replace('.', ','),
          t.currency,
          t.user.name,
          t.comment ?? '',
        ]
          .map(esc)
          .join(';'),
      ),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    res.send('﻿' + lines.join('\n'));
  }),
);
