import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Ищем .env, поднимаясь по дереву от текущего файла.
 * Так один и тот же код работает и из src (tsx), и из dist (node),
 * и не зависит от глубины вложенности.
 */
function loadEnvFile() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

loadEnvFile();
dotenv.config();

export const env = {
  botToken: process.env.BOT_TOKEN ?? '',
  botUsername: (process.env.BOT_USERNAME ?? '').replace(/^@/, ''),
  miniappUrl: process.env.MINIAPP_URL ?? '',
  apiUrl: (process.env.API_PUBLIC_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  internalApiKey: process.env.INTERNAL_API_KEY ?? '',
  /** Во сколько (по UTC) проверять регулярные платежи. */
  recurringCheckHour: Number(process.env.RECURRING_CHECK_HOUR ?? 9),
  /**
   * Прокси для обращений к api.telegram.org.
   * Берём явный TELEGRAM_PROXY, иначе — стандартные HTTPS_PROXY/HTTP_PROXY,
   * которые Node, в отличие от curl, сам не применяет.
   */
  telegramProxy:
    process.env.TELEGRAM_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    '',
};
