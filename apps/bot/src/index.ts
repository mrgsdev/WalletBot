import { Telegraf, Markup } from 'telegraf';
import { escapeHtml, truncate } from '@budget/shared';
import { env } from './env.js';
import { api } from './api.js';
import { startReminders } from './reminders.js';
import { createTelegramAgent } from './proxy.js';
import { enableUnbufferedLogs } from './logging.js';

enableUnbufferedLogs();

if (!env.botToken) {
  console.error('[bot] BOT_TOKEN не задан — бот не запущен');
  process.exit(1);
}

const bot = new Telegraf(env.botToken, {
  telegram: { agent: createTelegramAgent() },
});

/** Сколько бюджетов показываем в одном сообщении. */
const BUDGET_LIST_LIMIT = 20;
/** Кнопок «поделиться» — не больше, иначе клавиатура становится простынёй. */
const SHARE_BUTTON_LIMIT = 5;

/**
 * Ссылка на пересылку приглашения.
 *
 * Название обрезаем: кириллица при кодировании раздувается до шести байт
 * на символ, и длинное имя превращало ссылку в килобайтную простыню.
 */
function shareUrl(link: string, budgetName: string): string {
  const text = `Присоединяйся к бюджету «${truncate(budgetName, 40)}»`;
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
}

const openAppKeyboard = (label = '💰 Открыть бюджет') =>
  Markup.inlineKeyboard([[Markup.button.webApp(label, env.miniappUrl)]]);

/** /start — регистрация и обработка инвайт-ссылки t.me/bot?start=join_CODE. */
bot.start(async (ctx) => {
  const from = ctx.from;
  await api
    .ensureUser({
      telegramId: from.id,
      firstName: from.first_name,
      lastName: from.last_name,
      username: from.username,
      languageCode: from.language_code,
    })
    .catch((err) => console.error('[bot] ensureUser:', err.message));

  const payload = (ctx.payload ?? '').trim();

  if (payload.startsWith('join_')) {
    const code = payload.slice('join_'.length);
    try {
      const budget = await api.joinBudget(from.id, code);
      await ctx.reply(
        `Готово! Вы присоединились к бюджету «${budget.name}».\n\n` +
          'Откройте приложение и переключите бюджет на семейный — увидите общие счета и операции всех участников.',
        openAppKeyboard(),
      );
    } catch (err) {
      await ctx.reply(
        `Не удалось принять приглашение: ${errorText(err)}\n\n` +
          'Попросите отправителя обновить ссылку.',
        openAppKeyboard(),
      );
    }
    return;
  }

  await ctx.reply(
    `Привет, ${from.first_name ?? 'друг'}! 👋\n\n` +
      'Это бюджет для личных и семейных финансов.\n' +
      '• Записывайте расходы и доходы в пару тапов\n' +
      '• Смотрите статистику по категориям\n' +
      '• Ведите общий бюджет с семьёй\n\n' +
      'Нажмите кнопку ниже или иконку меню слева от поля ввода.',
    openAppKeyboard(),
  );
});

bot.help(async (ctx) => {
  await ctx.reply(
    'Команды:\n' +
      '/app — открыть приложение\n' +
      '/budgets — бюджеты и приглашения\n' +
      '/newbudget Название — создать семейный бюджет\n' +
      '/add — быстро записать операцию\n\n' +
      'Все данные и настройки — внутри приложения.',
    openAppKeyboard(),
  );
});

bot.command('app', (ctx) => ctx.reply('Открываю бюджет:', openAppKeyboard()));

bot.command('add', (ctx) =>
  ctx.reply(
    'Записать операцию:',
    Markup.inlineKeyboard([
      [Markup.button.webApp('➕ Новая операция', `${env.miniappUrl}#add`)],
    ]),
  ),
);

/** /budgets — список бюджетов с готовыми ссылками-приглашениями. */
bot.command('budgets', async (ctx) => {
  try {
    const budgets = await api.listBudgets(ctx.from.id);

    /*
     * Одно сообщение, а не по штуке на бюджет: раньше десять бюджетов
     * превращались в десять сообщений подряд, Telegram придерживал часть
     * из них, и порядок в чате ломался.
     */
    const shown = budgets.slice(0, BUDGET_LIST_LIMIT);

    const lines = shown.map((budget) => {
      const head = `${budget.kind === 'family' ? '👨‍👩‍👧' : '👛'} <b>${escapeHtml(budget.name)}</b>`;
      const members = budget.kind === 'family' ? `\nУчастников: ${budget.membersCount}` : '';
      const code = budget.inviteCode ? `\nКод: <code>${budget.inviteCode}</code>` : '';
      return head + members + code;
    });

    const tail =
      budgets.length > shown.length
        ? `\n\nПоказаны первые ${shown.length} из ${budgets.length}. Остальные — в приложении.`
        : '';

    // Кнопка «Поделиться» — только у семейных, иначе делиться нечем.
    const shareRows = shown
      .filter((budget) => budget.inviteLink)
      .slice(0, SHARE_BUTTON_LIMIT)
      .map((budget) => [
        Markup.button.url(
          truncate(`📨 Позвать в «${budget.name}»`, 40),
          shareUrl(budget.inviteLink!, budget.name),
        ),
      ]);

    await ctx.reply(lines.join('\n\n') + tail, {
      parse_mode: 'HTML',
      // «Открыть бюджет» есть всегда: раньше карточка личного бюджета
      // оставалась вообще без кнопок и была тупиком.
      ...Markup.inlineKeyboard([
        ...shareRows,
        [Markup.button.webApp('💰 Открыть бюджет', env.miniappUrl)],
      ]),
    });
  } catch (err) {
    await ctx.reply(`Не получилось получить список бюджетов: ${errorText(err)}`);
  }
});

/** /newbudget Название — создать семейный бюджет прямо из чата. */
bot.command('newbudget', async (ctx) => {
  const name = (ctx.payload ?? '').trim();
  if (!name) {
    await ctx.reply('Укажите название: /newbudget Семья Ивановых');
    return;
  }

  try {
    const budget = await api.createBudget(ctx.from.id, name);
    await ctx.reply(
      `Бюджет «${escapeHtml(budget.name)}» создан 🎉\n\n` +
        `Отправьте эту ссылку тем, кого хотите пригласить:\n${budget.inviteLink ?? budget.inviteCode ?? ''}`,
      // Имя экранировано — без parse_mode пользователь увидел бы «&amp;».
      { parse_mode: 'HTML', ...openAppKeyboard() },
    );
  } catch (err) {
    await ctx.reply(`Не удалось создать бюджет: ${errorText(err)}`);
  }
});

/*
 * Ответ на всё остальное. Раньше одна и та же фраза приходила и на текст,
 * и на стикер, и на голосовое — на стикер это выглядело нелепо.
 */
bot.on('message', (ctx) => {
  const isText = 'text' in ctx.message;
  return ctx.reply(
    isText
      ? 'Учёт ведётся в приложении — откройте его кнопкой ниже.'
      : 'Такое я не понимаю. Записать операцию можно в приложении:',
    openAppKeyboard(),
  );
});

bot.catch((err) => console.error('[bot] необработанная ошибка:', err));

async function main() {
  // Кнопка Menu Button слева от поля ввода открывает Mini App.
  if (env.miniappUrl) {
    await bot.telegram
      .setChatMenuButton({
        menuButton: { type: 'web_app', text: 'Бюджет', web_app: { url: env.miniappUrl } },
      })
      .catch((err) => console.error('[bot] setChatMenuButton:', err.message));
  }

  await bot.telegram
    .setMyCommands([
      { command: 'app', description: 'Открыть бюджет' },
      { command: 'add', description: 'Записать операцию' },
      { command: 'budgets', description: 'Бюджеты и приглашения' },
      { command: 'newbudget', description: 'Создать семейный бюджет' },
      { command: 'help', description: 'Помощь' },
    ])
    .catch((err) => console.error('[bot] setMyCommands:', err.message));

  startReminders(bot);

  // launch() в Telegraf v4 резолвится только когда бот остановлен,
  // поэтому о старте сообщаем колбэком и не ждём промис здесь.
  void bot.launch(() => console.log(`[bot] запущен: @${env.botUsername || 'бот'}`));
}

main().catch((err) => {
  console.error('[bot] не удалось запустить:', err);
  process.exit(1);
});

/** Остановка может прийти до успешного launch() — тогда stop() бросает исключение. */
function shutdown(signal: 'SIGINT' | 'SIGTERM') {
  try {
    bot.stop(signal);
  } catch {
    /* бот и так не запустился */
  }
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

/**
 * Текст ошибки для пользователя.
 *
 * Сообщение приходит с сервера и подставляется в чат: без ограничения
 * длинный ответ уехал бы целиком и мог не влезть в лимит Telegram.
 */
function errorText(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return truncate(message.replace(/\s+/g, ' ').trim() || 'неизвестная ошибка', 200);
}
