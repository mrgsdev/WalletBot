import express from 'express';
import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import { env, isProd } from './lib/env.js';
import { HttpError } from './lib/errors.js';
import { authMiddleware, scopeMiddleware } from './middleware/auth.js';
import { requestLogger } from './middleware/logging.js';
import { sessionRouter } from './routes/session.js';
import { accountsRouter } from './routes/accounts.js';
import { categoriesRouter } from './routes/categories.js';
import { transactionsRouter } from './routes/transactions.js';
import { statsRouter } from './routes/stats.js';
import { budgetsRouter } from './routes/budgets.js';
import { demoRouter } from './routes/demo.js';
import { plansRouter } from './routes/plans.js';
import { ratesRouter } from './routes/rates.js';
import { exportRouter } from './routes/export.js';
import { uploadsRouter, UPLOAD_DIR } from './routes/uploads.js';
import { recurringRouter } from './routes/recurring.js';
import { internalRouter } from './routes/internal.js';

// systemd читает stdout через pipe, а Node буферизует запись в него.
// Без этого журнал долгоживущего процесса отстаёт или остаётся пустым.
for (const stream of [process.stdout, process.stderr]) {
  const handle = (stream as unknown as { _handle?: { setBlocking?: (v: boolean) => void } })._handle;
  handle?.setBlocking?.(true);
}

const app = express();

app.use(
  cors({
    origin: true,
    credentials: false,
    allowedHeaders: [
      'Content-Type',
      'X-Telegram-Init-Data',
      'X-Budget-Id',
      'X-Internal-Key',
      'X-Telegram-Id',
      'X-Telegram-Name',
      'X-Telegram-Username',
    ],
    exposedHeaders: ['Content-Disposition'],
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));

app.use(requestLogger);

app.get('/health', (_req, res) => res.json({ ok: true, env: env.nodeEnv }));

// Служебные ручки бота живут до пользовательской аутентификации.
app.use('/api/internal', internalRouter);

// Всё остальное требует валидного Telegram initData.
app.use('/api', authMiddleware, scopeMiddleware);

app.use('/api/session', sessionRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/budgets', budgetsRouter);
app.use('/api/demo', demoRouter);
app.use('/api/plans', plansRouter);
app.use('/api/rates', ratesRouter);
app.use('/api/export', exportRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/recurring', recurringRouter);

app.use((_req, res) => res.status(404).json({ error: 'not_found', message: 'Маршрут не найден' }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  console.error('[api] unhandled error:', err);
  res.status(500).json({
    error: 'internal_error',
    message: isProd ? 'Внутренняя ошибка сервера' : String((err as Error)?.message ?? err),
  });
});

app.listen(env.port, () => {
  console.log(`[api] слушает http://localhost:${env.port}`);
  if (!env.botToken) {
    console.warn('[api] BOT_TOKEN не задан — проверка initData работать не будет');
  }
  if (env.allowDevAuth) {
    console.warn('[api] ALLOW_DEV_AUTH=true — вход без подписи Telegram разрешён (только для разработки)');
  }
});
