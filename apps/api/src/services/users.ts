import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { sendMessage } from './telegram-send.js';
import type { TelegramInitUser } from '../lib/telegram.js';
import { displayName } from '../lib/telegram.js';
import { createBudget } from './budgets.js';

/**
 * Находит пользователя по telegram_id либо регистрирует нового
 * вместе с личным бюджетом, категориями и парой счетов.
 */
export async function ensureUser(tgUser: TelegramInitUser) {
  const telegramId = String(tgUser.id);
  const name = displayName(tgUser);

  const existing = await prisma.user.findUnique({ where: { telegramId } });

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (existing.name !== name) patch.name = name;
    if ((existing.username ?? null) !== (tgUser.username ?? null)) patch.username = tgUser.username ?? null;
    if ((existing.avatarUrl ?? null) !== (tgUser.photo_url ?? null)) patch.avatarUrl = tgUser.photo_url ?? null;

    const user = Object.keys(patch).length
      ? await prisma.user.update({ where: { id: existing.id }, data: patch })
      : existing;

    // Страховка: пользователь без единого бюджета остался бы без интерфейса.
    const budgets = await prisma.budgetMember.count({ where: { userId: user.id } });
    if (budgets === 0) {
      await createBudget(user.id, {
        name: 'Личный бюджет',
        kind: 'personal',
        withDefaultAccounts: true,
      });
    }

    return user;
  }

  const user = await prisma.user.create({
    data: {
      telegramId,
      name,
      username: tgUser.username ?? null,
      avatarUrl: tgUser.photo_url ?? null,
      languageCode: tgUser.language_code ?? null,
      settings: { create: {} },
    },
  });

  await createBudget(user.id, {
    name: 'Личный бюджет',
    kind: 'personal',
    withDefaultAccounts: true,
  });

  return user;
}

/** Экранирование для parse_mode=HTML: имя может содержать <, > или &. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Текст уведомления администратору о новом пользователе. */
export function newUserMessage(user: {
  name: string;
  username: string | null;
  telegramId: string;
}): string {
  const lines = [`👤 <b>${escapeHtml(user.name)}</b> начал пользоваться ботом`];
  lines.push(
    user.username
      ? `@${escapeHtml(user.username)} · t.me/${escapeHtml(user.username)}`
      : `Без username · id ${user.telegramId}`,
  );
  return lines.join('\n');
}

/**
 * Сообщает администратору о новом пользователе.
 *
 * Ошибка отправки не должна ломать регистрацию: человек уже нажал /start,
 * и если Telegram недоступен, он всё равно должен попасть в приложение.
 */
export async function notifyAdminAboutNewUser(user: {
  name: string;
  username: string | null;
  telegramId: string;
}): Promise<void> {
  if (!env.adminChatId) return;
  try {
    await sendMessage(env.adminChatId, newUserMessage(user));
  } catch (err) {
    console.error('[api] уведомление о новом пользователе:', (err as Error).message);
  }
}
