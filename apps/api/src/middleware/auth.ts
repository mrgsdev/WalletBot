import type { NextFunction, Request, Response } from 'express';
import { env } from '../lib/env.js';
import { verifyInitData } from '../lib/telegram.js';
import { ensureUser } from '../services/users.js';
import { prisma } from '../lib/prisma.js';
import { unauthorized } from '../lib/errors.js';
import { defaultBudgetId, resolveScope, type Scope } from '../services/scope.js';

export interface AuthUser {
  id: number;
  telegramId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

export type { Scope };

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
      scope: Scope;
      startParam?: string;
    }
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const internalKey = req.header('x-internal-key');
    if (internalKey && env.internalApiKey && internalKey === env.internalApiKey) {
      const tgId = req.header('x-telegram-id');
      if (!tgId) throw unauthorized('Не передан x-telegram-id');
      const user = await ensureUser({
        id: Number(tgId),
        first_name: req.header('x-telegram-name') ?? undefined,
        username: req.header('x-telegram-username') ?? undefined,
      });
      req.user = user;
      return next();
    }

    const initData =
      req.header('x-telegram-init-data') ??
      (typeof req.query.initData === 'string' ? req.query.initData : '');

    const parsed = initData ? verifyInitData(initData, env.botToken, env.initDataMaxAgeSec) : null;

    if (parsed) {
      req.user = await ensureUser(parsed.user);
      req.startParam = parsed.startParam;
      return next();
    }

    if (env.allowDevAuth) {
      req.user = await ensureUser({
        id: Number(env.devUserId),
        first_name: env.devUserName,
        username: 'dev_user',
      });
      return next();
    }

    throw unauthorized('Недействительные данные Telegram. Откройте приложение через бота.');
  } catch (err) {
    next(err);
  }
}

export async function scopeMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const raw =
      req.header('x-budget-id') ??
      (typeof req.query.budgetId === 'string' ? req.query.budgetId : '');

    const requested = Number(raw);

    if (Number.isFinite(requested) && requested > 0) {
      req.scope = await resolveScope(req.user.id, requested);
      return next();
    }

    const fallback = await defaultBudgetId(req.user.id);
    if (!fallback) throw unauthorized('У пользователя нет ни одного бюджета');

    req.scope = await resolveScope(req.user.id, fallback);
    next();
  } catch (err) {
    next(err);
  }
}
