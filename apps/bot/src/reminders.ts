import type { Telegraf } from 'telegraf';
import { Markup } from 'telegraf';
import { api } from './api.js';
import { env } from './env.js';
import { log, logError } from './logging.js';

const MINUTE = 60_000;

/**
 * Пуш-напоминания:
 * Оба вида напоминаний проверяются каждую минуту: у каждого пользователя
 * своё время и свой часовой пояс, поэтому решение принимает API.
 */
export function startReminders(bot: Telegraf) {
  const tick = async () => {
    const now = new Date();
    await sendRecurring(bot);
    await sendDaily(bot, now);
  };

  // Первый прогон через минуту после старта, дальше — раз в минуту.
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), MINUTE);
  }, MINUTE);
}

async function sendRecurring(bot: Telegraf) {
  try {
    const items = await api.dueRecurring();
    for (const item of items) {
      const icon = item.categoryIcon ?? '🔁';
      await bot.telegram
        .sendMessage(
          item.telegramId,
          `${icon} Напоминание о регулярном платеже\n\n` +
            `<b>${escapeHtml(item.title)}</b>\n` +
            `${item.amount} ${item.currency} · ${escapeHtml(item.accountName)}\n\n` +
            'Уже оплатили? Запишите операцию, чтобы бюджет сошёлся.',
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.webApp('➕ Записать', `${env.miniappUrl}#add`)],
            ]),
          },
        )
        .then(() => {
          log(`[bot] напоминание отправлено: «${item.title}» → ${item.telegramId}`);
          return api.markRecurringSent(item.id);
        })
        .catch((err) => logError('[bot] не удалось отправить напоминание:', err.message));
    }
  } catch (err) {
    console.error('[bot] recurring:', (err as Error).message);
  }
}

/** Напоминание о незаписанных тратах — по локальному времени каждого пользователя. */
async function sendDaily(bot: Telegraf, now: Date) {


  try {
    const users = await api.dailyReminders();
    for (const user of users) {
      await bot.telegram
        .sendMessage(
          user.telegramId,
          '🧾 Не забыли записать сегодняшние траты?\n\nЭто займёт меньше минуты.',
          Markup.inlineKeyboard([[Markup.button.webApp('➕ Записать', `${env.miniappUrl}#add`)]]),
        )
        .then(() => {
          log(`[bot] дневное напоминание отправлено → ${user.telegramId}`);
          return api.markDailySent(user.userId);
        })
        .catch((err) => logError('[bot] не удалось отправить дневное напоминание:', err.message));
    }
  } catch (err) {
    console.error('[bot] daily:', (err as Error).message);
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
