import { Telegraf, Markup } from 'telegraf';
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
        `Не удалось принять приглашение: ${(err as Error).message}\n\n` +
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
    if (budgets.length === 0) {
      await ctx.reply(
        'У вас пока нет семейных бюджетов.\n\n' +
          'Создайте командой: /newbudget Семья Ивановых\n' +
          'Или в приложении: «Ещё» → «Бюджеты и участники».',
        openAppKeyboard(),
      );
      return;
    }

    for (const budget of budgets) {
      await ctx.reply(
        `${budget.kind === 'family' ? '👨‍👩‍👧' : '👛'} <b>${escapeHtml(budget.name)}</b>\n` +
          `Участников: ${budget.membersCount}\n` +
          (budget.inviteCode ? `Код приглашения: <code>${budget.inviteCode}</code>\n\n` : '\n') +
          (budget.inviteLink ? `Ссылка: ${budget.inviteLink}` : ''),
        {
          parse_mode: 'HTML',
          ...(budget.inviteLink
            ? Markup.inlineKeyboard([
                [
                  Markup.button.url(
                    '📨 Поделиться приглашением',
                    `https://t.me/share/url?url=${encodeURIComponent(budget.inviteLink)}&text=${encodeURIComponent(
                      `Присоединяйся к бюджету «${budget.name}»`,
                    )}`,
                  ),
                ],
                [Markup.button.webApp('💰 Открыть бюджет', env.miniappUrl)],
              ])
            : {}),
        },
      );
    }
  } catch (err) {
    await ctx.reply(`Не получилось получить список семей: ${(err as Error).message}`);
  }
});

/** /newfamily Название — создать семью прямо из чата. */
bot.command('newbudget', async (ctx) => {
  const name = (ctx.payload ?? '').trim();
  if (!name) {
    await ctx.reply('Укажите название: /newfamily Семья Ивановых');
    return;
  }

  try {
    const budget = await api.createBudget(ctx.from.id, name);
    await ctx.reply(
      `Бюджет «${escapeHtml(budget.name)}» создан 🎉\n\n` +
        `Отправьте эту ссылку тем, кого хотите пригласить:\n${budget.inviteLink ?? budget.inviteCode ?? ''}`,
      openAppKeyboard(),
    );
  } catch (err) {
    await ctx.reply(`Не удалось создать бюджет: ${(err as Error).message}`);
  }
});

bot.on('message', (ctx) =>
  ctx.reply('Учёт ведётся в приложении — откройте его кнопкой ниже.', openAppKeyboard()),
);

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

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
