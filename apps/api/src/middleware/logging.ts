import type { NextFunction, Request, Response } from 'express';

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

    if (res.statusCode >= 500) console.error(`[api] ${line}`);
    else console.log(`[api] ${line}`);
  });

  next();
}
