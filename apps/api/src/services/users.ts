import { prisma } from '../lib/prisma.js';
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
