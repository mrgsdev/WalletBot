import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/asyncHandler.js';
import { categoryDto } from '../lib/serialize.js';
import { categoryWhere } from '../services/scope.js';
import { badRequest, notFound } from '../lib/errors.js';

export const categoriesRouter = Router();

categoriesRouter.get(
  '/',
  ah(async (req, res) => {
    const includeArchived = req.query.includeArchived === 'true';
    const type = req.query.type;

    const categories = await prisma.category.findMany({
      where: {
        ...categoryWhere(req.user, req.scope),
        ...(includeArchived ? {} : { isArchived: false }),
        ...(type === 'income' || type === 'expense' ? { type } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    res.json(categories.map(categoryDto));
  }),
);

const createSchema = z.object({
  name: z.string().min(1).max(40),
  type: z.enum(['income', 'expense']),
  icon: z.string().min(1).max(8),
  color: z.string().min(4).max(16),
  group: z.string().max(40).optional().nullable(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  type: z.never().optional(),
  icon: z.string().min(1).max(8).optional(),
  color: z.string().min(4).max(16).optional(),
  group: z.string().max(40).optional(),
  isArchived: z.boolean().optional(),
});

categoriesRouter.post(
  '/',
  ah(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Проверьте название, тип, иконку и цвет категории');

    const maxOrder = await prisma.category.aggregate({
      where: categoryWhere(req.user, req.scope),
      _max: { sortOrder: true },
    });

    const category = await prisma.category.create({
      data: {
        budgetId: req.scope.budgetId,
        name: parsed.data.name,
        type: parsed.data.type,
        icon: parsed.data.icon,
        color: parsed.data.color,
        group: parsed.data.group ?? 'Прочее',

        sortOrder: Math.max(1000, (maxOrder._max.sortOrder ?? 0) + 1),
      },
    });
    res.status(201).json(categoryDto(category));
  }),
);

categoriesRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const category = await prisma.category.findFirst({
      where: { id, ...categoryWhere(req.user, req.scope) },
    });
    if (!category) throw notFound('Категория не найдена');

    const parsed = patchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? 'Проверьте поля категории');
    }
    const body = parsed.data;

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.icon !== undefined) data.icon = body.icon;
    if (body.color !== undefined) data.color = body.color;
    if (body.group !== undefined) data.group = body.group;
    if (body.isArchived !== undefined) data.isArchived = body.isArchived;

    const updated = await prisma.category.update({ where: { id }, data });
    res.json(categoryDto(updated));
  }),
);

categoriesRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const category = await prisma.category.findFirst({
      where: { id, ...categoryWhere(req.user, req.scope) },
    });
    if (!category) throw notFound('Категория не найдена');

    const used = await prisma.transaction.count({ where: { categoryId: id } });
    if (used > 0) {
      await prisma.category.update({ where: { id }, data: { isArchived: true } });
      return res.json({ ok: true, archived: true });
    }

    await prisma.category.delete({ where: { id } });
    res.json({ ok: true, archived: false });
  }),
);
