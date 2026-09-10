import { Router } from 'express';
import { ah } from '../lib/asyncHandler.js';
import { clearDemo, demoStatus, seedDemo } from '../services/demo.js';

export const demoRouter = Router();

/** Есть ли в бюджете демо-данные. */
demoRouter.get(
  '/',
  ah(async (req, res) => {
    res.json(await demoStatus(req.scope));
  }),
);

/** Наполнить бюджет демо-историей перед обучением. */
demoRouter.post(
  '/seed',
  ah(async (req, res) => {
    res.json(await seedDemo(req.user, req.scope));
  }),
);

/** Удалить демо-историю, оставив всё, что пользователь добавил сам. */
demoRouter.delete(
  '/',
  ah(async (req, res) => {
    res.json(await clearDemo(req.user, req.scope));
  }),
);
