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

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? 3000),
  publicUrl: process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.API_PORT ?? 3000}`,
  botToken: process.env.BOT_TOKEN ?? '',
  botUsername: (process.env.BOT_USERNAME ?? '').replace(/^@/, ''),
  miniappUrl: process.env.MINIAPP_URL ?? '',
  internalApiKey: process.env.INTERNAL_API_KEY ?? '',
  exchangeApiBase: process.env.EXCHANGE_API_BASE ?? 'https://api.exchangerate.host',
  /**
   * Куда складывать фото чеков. На сервере это отдельный каталог с данными
   * (/var/lib/budget/uploads), чтобы выкладка новой версии его не затирала.
   */
  uploadDir: process.env.UPLOAD_DIR ?? '',
  /**
   * Прокси для обращений к api.telegram.org (отправка экспорта в чат).
   * Node, в отличие от curl, системные HTTP_PROXY сам не применяет.
   */
  telegramProxy:
    process.env.TELEGRAM_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    '',
  allowDevAuth: bool(process.env.ALLOW_DEV_AUTH, false),
  devUserId: process.env.DEV_USER_ID ?? '1000001',
  devUserName: process.env.DEV_USER_NAME ?? 'Dev User',
  /** Максимальный возраст initData в секундах — защита от переигрывания. */
  initDataMaxAgeSec: Number(process.env.INIT_DATA_MAX_AGE_SEC ?? 24 * 60 * 60),
};

export const isProd = env.nodeEnv === 'production';
