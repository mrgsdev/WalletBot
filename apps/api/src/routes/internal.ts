import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/asyncHandler.js';
import { env } from '../lib/env.js';
import { badRequest, forbidden } from '../lib/errors.js';
import { createBudget, inviteLink, joinByCode, listBudgets } from '../services/budgets.js';
import { ensureUser, notifyAdminAboutNewUser } from '../services/users.js';
import { dueRecurring, markDailySent, usersToRemind } from '../services/reminders.js';

export const internalRouter = Router();

/** Служебные ручки для бота: приглашения и данные для напоминаний. */
internalRouter.use((req, _res, next) => {
  if (!env.internalApiKey || req.header('x-internal-key') !== env.internalApiKey) {
    return next(forbidden('Неверный внутренний ключ'));
  }
  next();
});

/** Регистрация пользователя при /start в боте. */
internalRouter.post(
  '/users/ensure',
  ah(async (req, res) => {
    const { telegramId, firstName, lastName, username, photoUrl, languageCode } = req.body ?? {};

    /*
     * Кто пришёл впервые, проверяем до регистрации: ensureUser возвращает
     * пользователя одинаково и для нового, и для существующего. Лишний SELECT
     * не жалко — /start для одного человека случается один раз.
     */
    const known = await prisma.user.findUnique({
      where: { telegramId: String(telegramId) },
      select: { id: true },
    });

    const user = await ensureUser({
      id: Number(telegramId),
      first_name: firstName,
      last_name: lastName,
      username,
      photo_url: photoUrl,
      language_code: languageCode,
    });

    // Не ждём отправку: ответ боту не должен зависеть от доступности Telegram.
    if (!known) void notifyAdminAboutNewUser(user);

    res.json({ id: user.id, name: user.name });
  }),
);

/** Присоединение к семейному бюджету по коду из deep link. */
internalRouter.post(
  '/budgets/join',
  ah(async (req, res) => {
    const { telegramId, code } = req.body ?? {};
    const user = await ensureUser({ id: Number(telegramId) });
    const budget = await joinByCode(user.id, String(code));
    res.json({ budgetId: budget!.id, name: budget!.name });
  }),
);

const botBudgetSchema = z.object({
  name: z.string().min(1).max(60),
  kind: z.enum(['personal', 'family']).catch('family'),
});

/** Создание бюджета из чата бота. */
internalRouter.post(
  '/budgets/create',
  ah(async (req, res) => {
    const { telegramId, name, kind } = req.body ?? {};

    /*
     * Те же ограничения, что и в POST /budgets для мини-аппа.
     * Раньше их здесь не было, и через чат бота можно было завести
     * бюджет с названием на тысячи символов — после чего список бюджетов
     * и выгрузка переставали отправляться: сообщение не влезало в лимит
     * Telegram, и чинить это было уже нечем.
     *
     * Переносы строк схлопываем: в карточке имя стоит заголовком,
     * и многострочное название разваливало вёрстку.
     */
    const cleaned = String(name ?? '').replace(/\s+/g, ' ').trim();
    const parsed = botBudgetSchema.safeParse({ name: cleaned, kind });
    if (!parsed.success) {
      throw badRequest('Название нужно от 1 до 60 символов');
    }

    const user = await ensureUser({ id: Number(telegramId) });
    const budget = await createBudget(user.id, {
      name: parsed.data.name,
      kind: parsed.data.kind,
    });
    res.json({
      budgetId: budget!.id,
      name: budget!.name,
      kind: budget!.kind,
      inviteCode: budget!.inviteCode,
      inviteLink:
        budget!.inviteCode && env.botUsername
          ? inviteLink(env.botUsername, budget!.inviteCode)
          : null,
    });
  }),
);

/** Бюджеты пользователя со ссылками-приглашениями. */
internalRouter.get(
  '/budgets/list',
  ah(async (req, res) => {
    const telegramId = String(req.query.telegramId ?? '');
    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) return res.json([]);

    const budgets = await listBudgets(user.id);
    res.json(
      budgets.map((b) => ({
        id: b.id,
        name: b.name,
        kind: b.kind,
        icon: b.icon,
        membersCount: b.members.length,
        isOwner: b.createdById === user.id,
        inviteCode: b.inviteCode,
        inviteLink:
          b.inviteCode && env.botUsername ? inviteLink(env.botUsername, b.inviteCode) : null,
      })),
    );
  }),
);

/** Регулярные платежи, по которым сейчас нужно напомнить. */
internalRouter.get(
  '/reminders/recurring',
  ah(async (_req, res) => {
    res.json(await dueRecurring(new Date()));
  }),
);

internalRouter.post(
  '/reminders/recurring/:id/sent',
  ah(async (req, res) => {
    await prisma.recurringPayment.update({
      where: { id: Number(req.params.id) },
      data: { lastNotifiedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

/** Отметка, что дневное напоминание доставлено. */
internalRouter.post(
  '/reminders/daily/:userId/sent',
  ah(async (req, res) => {
    await markDailySent(Number(req.params.userId));
    res.json({ ok: true });
  }),
);

/** Пользователи, которым пора напомнить внести траты за день. */
internalRouter.get(
  '/reminders/daily',
  ah(async (_req, res) => {
    res.json(await usersToRemind(new Date()));
  }),
);
