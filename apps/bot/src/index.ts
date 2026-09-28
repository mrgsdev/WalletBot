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

const BUDGET_LIST_LIMIT = 20;

const SHARE_BUTTON_LIMIT = 5;

function shareUrl(link: string, budgetName: string): string {
  const text = `Присоединяйся к бюджету «${truncate(budgetName, 40)}»`;
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
}

const openAppKeyboard = (label = '💰 Открыть бюджет') =>
  Markup.inlineKeyboard([[Markup.button.webApp(label, env.miniappUrl)]]);

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
          'Откройте приложение и переключите бюджет на семейный, тогда увидите общие счета и операции всех участников.',
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
      '/app: открыть приложение\n' +
      '/budgets: бюджеты и приглашения\n' +
      '/newbudget Название: создать семейный бюджет\n' +
      '/add: быстро записать операцию\n\n' +
      'Все данные и настройки хранятся в приложении.',
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

bot.command('budgets', async (ctx) => {
  try {
    const budgets = await api.listBudgets(ctx.from.id);

    const shown = budgets.slice(0, BUDGET_LIST_LIMIT);

    const lines = shown.map((budget) => {
      const head = `${budget.kind === 'family' ? '👨‍👩‍👧' : '👛'} <b>${escapeHtml(budget.name)}</b>`;
      const members = budget.kind === 'family' ? `\nУчастников: ${budget.membersCount}` : '';
      const code = budget.inviteCode ? `\nКод: <code>${budget.inviteCode}</code>` : '';
      return head + members + code;
    });

    const tail =
      budgets.length > shown.length
        ? `\n\nПоказаны первые ${shown.length} из ${budgets.length}. Остальные ищите в приложении.`
        : '';

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

      ...Markup.inlineKeyboard([
        ...shareRows,
        [Markup.button.webApp('💰 Открыть бюджет', env.miniappUrl)],
      ]),
    });
  } catch (err) {
    await ctx.reply(`Не получилось получить список бюджетов: ${errorText(err)}`);
  }
});

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

      { parse_mode: 'HTML', ...openAppKeyboard() },
    );
  } catch (err) {
    await ctx.reply(`Не удалось создать бюджет: ${errorText(err)}`);
  }
});

bot.on('message', (ctx) => {
  const isText = 'text' in ctx.message;
  return ctx.reply(
    isText
      ? 'Учёт ведётся в приложении, откройте его кнопкой ниже.'
      : 'Такое я не понимаю. Записать операцию можно в приложении:',
    openAppKeyboard(),
  );
});

bot.catch((err) => console.error('[bot] необработанная ошибка:', err));

async function main() {
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

  void bot.launch(() => console.log(`[bot] запущен: @${env.botUsername || 'бот'}`));
}

main().catch((err) => {
  console.error('[bot] не удалось запустить:', err);
  process.exit(1);
});

function shutdown(signal: 'SIGINT' | 'SIGTERM') {
  try {
    bot.stop(signal);
  } catch {
  }
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

function errorText(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return truncate(message.replace(/\s+/g, ' ').trim() || 'неизвестная ошибка', 200);
}
