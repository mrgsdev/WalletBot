import { prisma } from '../lib/prisma.js';

/** Локальное время пользователя в формате «ЧЧ:ММ». */
export function localTimeString(now: Date, tzOffsetMinutes: number): string {
  const local = new Date(now.getTime() + tzOffsetMinutes * 60_000);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Начало локальных суток пользователя, выраженное в UTC. */
export function localDayStart(now: Date, tzOffsetMinutes: number): Date {
  const local = new Date(now.getTime() + tzOffsetMinutes * 60_000);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(startLocal - tzOffsetMinutes * 60_000);
}

/** Совпадает ли текущая минута с временем напоминания (с допуском). */
export function isTimeToNotify(
  now: Date,
  tzOffsetMinutes: number,
  target: string,
  toleranceMinutes = 5,
): boolean {
  const [th, tm] = target.split(':').map(Number);
  if (!Number.isFinite(th) || !Number.isFinite(tm)) return false;

  const local = new Date(now.getTime() + tzOffsetMinutes * 60_000);
  const nowMinutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const targetMinutes = th * 60 + tm;

  const diff = nowMinutes - targetMinutes;
  // Окно только вперёд: напоминание не должно срабатывать раньше времени.
  return diff >= 0 && diff < toleranceMinutes;
}

/** Регулярные платежи, по которым пора напомнить владельцу. */
export async function dueRecurring(now: Date) {
  const items = await prisma.recurringPayment.findMany({
    where: { isActive: true },
    include: {
      owner: { select: { telegramId: true, name: true, settings: true } },
      account: { select: { name: true } },
      category: { select: { name: true, icon: true } },
      budget: { select: { id: true, name: true } },
    },
  });

  const due = items.filter((item) => {
    const tz = item.owner.settings?.tzOffsetMinutes ?? 180;
    const local = new Date(now.getTime() + tz * 60_000);

    if (local.getUTCDate() !== item.dayOfMonth) return false;
    if (!isTimeToNotify(now, tz, item.notifyTime)) return false;

    // Не напоминаем дважды в один локальный день.
    if (item.lastNotifiedAt) {
      const sentLocal = new Date(item.lastNotifiedAt.getTime() + tz * 60_000);
      if (
        sentLocal.getUTCFullYear() === local.getUTCFullYear() &&
        sentLocal.getUTCMonth() === local.getUTCMonth() &&
        sentLocal.getUTCDate() === local.getUTCDate()
      ) {
        return false;
      }
    }
    return true;
  });

  return due.map((item) => ({
    id: item.id,
    telegramId: item.owner.telegramId,
    title: item.title,
    amount: item.amount,
    currency: item.currency,
    accountName: item.account.name,
    categoryName: item.category?.name ?? null,
    categoryIcon: item.category?.icon ?? null,
    budgetId: item.budget.id,
    budgetName: item.budget.name,
  }));
}

/** Совпадают ли две даты по локальному календарю пользователя. */
function sameLocalDay(a: Date, b: Date, tzOffsetMinutes: number): boolean {
  const la = new Date(a.getTime() + tzOffsetMinutes * 60_000);
  const lb = new Date(b.getTime() + tzOffsetMinutes * 60_000);
  return (
    la.getUTCFullYear() === lb.getUTCFullYear() &&
    la.getUTCMonth() === lb.getUTCMonth() &&
    la.getUTCDate() === lb.getUTCDate()
  );
}

/**
 * Пользователи, у которых включено дневное напоминание, наступило выбранное
 * ими время и за сегодня не внесено ни одной операции.
 *
 * Окно срабатывания — несколько минут, а бот опрашивает раз в минуту, поэтому
 * без отметки об отправке человек получал бы одно и то же сообщение подряд.
 */
export async function usersToRemind(now: Date) {
  const candidates = await prisma.userSettings.findMany({
    where: { dailyReminder: true },
    include: { user: { select: { id: true, telegramId: true, name: true } } },
  });

  const result: { userId: number; telegramId: string; name: string }[] = [];

  for (const settings of candidates) {
    if (!isTimeToNotify(now, settings.tzOffsetMinutes, settings.dailyReminderTime)) continue;

    // Сегодня уже напоминали — второй раз не тревожим.
    if (
      settings.dailyLastSentAt &&
      sameLocalDay(settings.dailyLastSentAt, now, settings.tzOffsetMinutes)
    ) {
      continue;
    }

    // По умолчанию напоминание нужно только тем, кто сегодня ничего не записал.
    // Тем, кто выбрал «напоминать всегда», шлём независимо от операций.
    let needed = true;
    if (!settings.dailyAlways) {
      const since = localDayStart(now, settings.tzOffsetMinutes);
      const count = await prisma.transaction.count({
        where: { userId: settings.user.id, createdAt: { gte: since } },
      });
      needed = count === 0;
    }

    if (needed) {
      result.push({
        userId: settings.user.id,
        telegramId: settings.user.telegramId,
        name: settings.user.name,
      });
    }
  }

  return result;
}

/** Отметка, что дневное напоминание отправлено. */
export async function markDailySent(userId: number, at = new Date()) {
  await prisma.userSettings.update({
    where: { userId },
    data: { dailyLastSentAt: at },
  });
}
