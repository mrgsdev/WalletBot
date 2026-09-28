import { Router } from 'express';
import { ah } from '../lib/asyncHandler.js';
import { clearDemo, demoStatus, seedDemo } from '../services/demo.js';

export const demoRouter = Router();

demoRouter.get(
  '/',
  ah(async (req, res) => {
    res.json(await demoStatus(req.scope));
  }),
);

demoRouter.post(
  '/seed',
  ah(async (req, res) => {
    res.json(await seedDemo(req.user, req.scope));
  }),
);

demoRouter.delete(
  '/',
  ah(async (req, res) => {
    res.json(await clearDemo(req.user, req.scope));
  }),
);
