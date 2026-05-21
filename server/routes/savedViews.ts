import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireCurrentUser } from '../services/auth.js';

export const savedViewsRouter = Router();

const filterSchema = z.record(z.string(), z.unknown());
const sortSchema = z.record(z.string(), z.unknown()).optional();

savedViewsRouter.use(async (req, _res, next) => {
  try {
    await requireCurrentUser(req);
    next();
  } catch (error) {
    next(error);
  }
});

savedViewsRouter.get('/', async (req, res) => {
  const user = await requireCurrentUser(req);
  const query = z.object({ workspaceId: z.string().min(1) }).parse(req.query);
  const views = await prisma.savedView.findMany({
    where: {
      workspaceId: query.workspaceId,
      OR: [{ ownerUserId: user.id }, { visibility: 'WORKSPACE' }],
    },
    orderBy: [{ visibility: 'asc' }, { updatedAt: 'desc' }],
  });
  res.json(views);
});

savedViewsRouter.post('/', async (req, res) => {
  const user = await requireCurrentUser(req);
  const body = z
    .object({
      workspaceId: z.string().min(1),
      projectId: z.string().nullable().optional(),
      listId: z.string().nullable().optional(),
      name: z.string().min(1),
      filters: filterSchema,
      sort: sortSchema,
      visibility: z.enum(['PRIVATE', 'WORKSPACE']).default('PRIVATE'),
    })
    .parse(req.body);
  const view = await prisma.savedView.create({
    data: {
      workspaceId: body.workspaceId,
      ownerUserId: user.id,
      projectId: body.projectId || undefined,
      listId: body.listId || undefined,
      name: body.name,
      filters: body.filters as Prisma.InputJsonValue,
      sort: body.sort as Prisma.InputJsonValue | undefined,
      visibility: body.visibility,
    },
  });
  res.status(201).json(view);
});

savedViewsRouter.patch('/:id', async (req, res) => {
  const user = await requireCurrentUser(req);
  const body = z
    .object({
      name: z.string().min(1).optional(),
      filters: filterSchema.optional(),
      sort: sortSchema,
      visibility: z.enum(['PRIVATE', 'WORKSPACE']).optional(),
    })
    .parse(req.body);
  const existing = await prisma.savedView.findUniqueOrThrow({ where: { id: req.params.id } });
  if (existing.ownerUserId !== user.id) {
    res.status(403).json({ error: 'Only the owner can edit this saved view' });
    return;
  }
  res.json(
    await prisma.savedView.update({
      where: { id: existing.id },
      data: {
        ...body,
        filters: body.filters as Prisma.InputJsonValue | undefined,
        sort: body.sort as Prisma.InputJsonValue | undefined,
      },
    })
  );
});

savedViewsRouter.delete('/:id', async (req, res) => {
  const user = await requireCurrentUser(req);
  const existing = await prisma.savedView.findUniqueOrThrow({ where: { id: req.params.id } });
  if (existing.ownerUserId !== user.id) {
    res.status(403).json({ error: 'Only the owner can delete this saved view' });
    return;
  }
  await prisma.savedView.delete({ where: { id: existing.id } });
  res.status(204).send();
});
