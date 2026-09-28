import { HttpsProxyAgent } from 'https-proxy-agent';
import type { Agent } from 'node:https';
import { env } from './env.js';

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
