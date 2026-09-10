import { HttpsProxyAgent } from 'https-proxy-agent';
import type { Agent } from 'node:https';
import { env } from './env.js';

/**
 * Node не умеет читать HTTP_PROXY/HTTPS_PROXY сам — в отличие от curl.
 * Там, где api.telegram.org доступен только через прокси/VPN, без этого
 * бот молча падает на ETIMEDOUT, поэтому агент собираем вручную.
 */
export function createTelegramAgent(): Agent | undefined {
  const url = env.telegramProxy;
  if (!url) return undefined;

  try {
    const agent = new HttpsProxyAgent(url);
    console.log(`[bot] запросы к Telegram идут через прокси ${maskProxy(url)}`);
    return agent as unknown as Agent;
  } catch (err) {
    console.error(`[bot] некорректный адрес прокси «${url}»:`, (err as Error).message);
    return undefined;
  }
}

/** Прячем логин и пароль, если они есть в строке прокси. */
function maskProxy(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      parsed.username = '***';
      parsed.password = '';
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
