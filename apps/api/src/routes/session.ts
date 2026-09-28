import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/asyncHandler.js';
import { budgetDto } from '../lib/serialize.js';
import { joinByCode, listBudgets } from '../services/budgets.js';
import { defaultBudgetId } from '../services/scope.js';
import { badRequest } from '../lib/errors.js';
import { isKnownCurrency } from '@budget/shared';
import { TIME_PATTERN } from '../lib/dates.js';

export const sessionRouter = Router();

sessionRouter.get(
  '/',
  ah(async (req, res) => {
    if (req.startParam?.startsWith('join_')) {
      await joinByCode(req.user.id, req.startParam.slice('join_'.length)).catch(() => null);
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id },
      update: {},
    });

    const budgets = await listBudgets(req.user.id);

    res.json({
      user: {
        id: req.user.id,
        telegramId: req.user.telegramId,
        name: req.user.name,
        username: req.user.username,
        avatarUrl: req.user.avatarUrl,
      },
      budgets: budgets.map((b) => budgetDto(b, req.user.id)),
      defaultBudgetId: (await defaultBudgetId(req.user.id)) ?? budgets[0]?.id ?? 0,
      settings: {
        baseCurrency: settings.baseCurrency,
        theme: settings.theme,
        dailyReminder: settings.dailyReminder,
        dailyReminderTime: settings.dailyReminderTime,
        dailyAlways: settings.dailyAlways,
        tzOffsetMinutes: settings.tzOffsetMinutes,
        seenTips: settings.seenTips,
      },
    });
  }),
);

const settingsSchema = z.object({
  baseCurrency: z.string().length(3).refine(isKnownCurrency, 'Неизвестная валюта').optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  dailyReminder: z.boolean().optional(),
  dailyAlways: z.boolean().optional(),

  dailyReminderTime: z.string().regex(TIME_PATTERN, 'Некорректное время').optional(),
  tzOffsetMinutes: z.number().int().min(-840).max(840).optional(),
});

sessionRouter.patch(
  '/settings',
  ah(async (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Проверьте настройки');

    const data = { ...parsed.data };
    if (data.baseCurrency) data.baseCurrency = data.baseCurrency.toUpperCase();

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, ...data },
      update: data,
    });

    res.json({
      baseCurrency: settings.baseCurrency,
      theme: settings.theme,
      dailyReminder: settings.dailyReminder,
      dailyReminderTime: settings.dailyReminderTime,
      dailyAlways: settings.dailyAlways,
      tzOffsetMinutes: settings.tzOffsetMinutes,
      seenTips: settings.seenTips,
    });
  }),
);

sessionRouter.post(
  '/tips/:tip/seen',
  ah(async (req, res) => {
    const tip = String(req.params.tip).slice(0, 40);
    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, seenTips: [tip] },
      update: {},
    });

    if (!settings.seenTips.includes(tip)) {
      await prisma.userSettings.update({
        where: { userId: req.user.id },
        data: { seenTips: { push: tip } },
      });
    }
    res.json({ ok: true });
  }),
);

sessionRouter.post(
  '/tips/reset',
  ah(async (req, res) => {
    await prisma.userSettings.update({
      where: { userId: req.user.id },
      data: { seenTips: [] },
    });
    res.json({ ok: true });
  }),
);
