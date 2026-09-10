import type { NextFunction, Request, Response } from 'express';

/**
 * Лог запросов в journald.
 *
 * Специально не пишем заголовок X-Telegram-Init-Data и тело: там подпись
 * пользователя и суммы операций, которым в логах не место.
 * /health пропускаем, чтобы проверки живости не забивали журнал.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health') return next();

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const who = req.user ? `user=${req.user.id}` : 'user=—';
    const scope = req.scope ? `budget=${req.scope.budgetId}` : '';

    const line = [
      `${req.method} ${req.originalUrl.split('?')[0]}`,
      String(res.statusCode),
      `${ms.toFixed(0)}ms`,
      who,
      scope,
    ]
      .filter(Boolean)
      .join(' ');

    // Ошибки — в stderr, чтобы `journalctl -p err` показывал только их.
    if (res.statusCode >= 500) console.error(`[api] ${line}`);
    else console.log(`[api] ${line}`);
  });

  next();
}
