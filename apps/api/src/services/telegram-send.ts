import { ProxyAgent, type Dispatcher } from 'undici';
import { env } from '../lib/env.js';

/**
 * Отправка сообщений и файлов пользователю от имени бота.
 *
 * Node не применяет HTTP_PROXY сам, поэтому там, где api.telegram.org доступен
 * только через прокси, диспетчер собирается вручную.
 */
let dispatcher: Dispatcher | undefined;
let dispatcherReady = false;

function proxyDispatcher(): Dispatcher | undefined {
  if (dispatcherReady) return dispatcher;
  dispatcherReady = true;

  const url = env.telegramProxy;
  if (url) {
    try {
      dispatcher = new ProxyAgent(url);
    } catch (err) {
      console.error('[api] некорректный TELEGRAM_PROXY:', (err as Error).message);
    }
  }
  return dispatcher;
}

async function callBotApi(method: string, body: unknown, headers?: Record<string, string>) {
  if (!env.botToken) throw new Error('BOT_TOKEN не задан');

  const response = await fetch(`https://api.telegram.org/bot${env.botToken}/${method}`, {
    method: 'POST',
    body: body as never,
    headers,
    dispatcher: proxyDispatcher(),
    signal: AbortSignal.timeout(60_000),
  } as RequestInit);

  const json = (await response.json()) as { ok: boolean; description?: string };
  if (!json.ok) throw new Error(json.description ?? `Telegram отклонил ${method}`);
  return json;
}

export async function sendMessage(telegramId: string, text: string) {
  return callBotApi(
    'sendMessage',
    JSON.stringify({ chat_id: telegramId, text, parse_mode: 'HTML' }),
    { 'Content-Type': 'application/json' },
  );
}

/** Отправляет файл в чат с ботом. */
export async function sendDocument(
  telegramId: string,
  file: Buffer,
  filename: string,
  caption?: string,
) {
  const form = new FormData();
  form.append('chat_id', telegramId);
  if (caption) {
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
  }
  form.append(
    'document',
    new Blob([new Uint8Array(file)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
  );

  return callBotApi('sendDocument', form);
}
