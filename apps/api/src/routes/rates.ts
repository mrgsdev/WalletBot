import { Router } from 'express';
import { ah } from '../lib/asyncHandler.js';
import { getRatesFor } from '../services/currency.js';

export const ratesRouter = Router();

/** Курсы валют относительно базы (кэш обновляется раз в сутки). */
ratesRouter.get(
  '/',
  ah(async (req, res) => {
    const base = typeof req.query.base === 'string' && req.query.base.length === 3
      ? req.query.base.toUpperCase()
      : 'RUB';
    res.json(await getRatesFor(base));
  }),
);
