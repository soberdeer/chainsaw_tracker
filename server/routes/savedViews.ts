import { Router } from 'express';
import { z } from 'zod';
import { requireCurrentUser } from '../services/auth.js';

export const savedViewsRouter = Router();

savedViewsRouter.use(async (req, _res, next) => {
  try {
    await requireCurrentUser(req);
    next();
  } catch (error) {
    next(error);
  }
});

interface SavedView {
  id: string;
  workspaceId: string;
  projectId: string | null;
  listId: string | null;
  name: string;
  filters: Record<string, unknown>;
  sort: Record<string, unknown>;
  visibility: 'PRIVATE' | 'WORKSPACE';
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

const views: SavedView[] = [];
let seq = 1;

savedViewsRouter.get('/', async (req, res) => {
  const current = await requireCurrentUser(req);
  const { workspaceId } = req.query as { workspaceId?: string };
  const result = (workspaceId ? views.filter((v) => v.workspaceId === workspaceId) : views).filter(
    (v) => v.visibility === 'WORKSPACE' || v.ownerId === current.id
  );
  res.json(result);
});

savedViewsRouter.post('/', async (req, res) => {
  const current = await requireCurrentUser(req);
  const input = z
    .object({
      workspaceId: z.string(),
      projectId: z.string().nullable().optional(),
      listId: z.string().nullable().optional(),
      name: z.string().min(1).max(120),
      filters: z.record(z.string(), z.unknown()),
      sort: z.record(z.string(), z.unknown()).optional(),
      visibility: z.enum(['PRIVATE', 'WORKSPACE']).optional(),
    })
    .parse(req.body);
  const now = new Date().toISOString();
  const view: SavedView = {
    id: `sv-${seq++}`,
    workspaceId: input.workspaceId,
    projectId: input.projectId ?? null,
    listId: input.listId ?? null,
    name: input.name,
    filters: input.filters,
    sort: input.sort ?? {},
    visibility: input.visibility ?? 'PRIVATE',
    ownerId: current.id,
    createdAt: now,
    updatedAt: now,
  };
  views.push(view);
  res.status(201).json(view);
});

savedViewsRouter.patch('/:id', async (req, res) => {
  const current = await requireCurrentUser(req);
  const view = views.find((v) => v.id === req.params.id);
  if (!view) {
    res.status(404).json({ error: 'Saved view not found' });
    return;
  }
  if (view.ownerId !== current.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const input = z
    .object({
      name: z.string().min(1).max(120).optional(),
      filters: z.record(z.string(), z.unknown()).optional(),
      sort: z.record(z.string(), z.unknown()).optional(),
      visibility: z.enum(['PRIVATE', 'WORKSPACE']).optional(),
    })
    .parse(req.body);
  if (input.name !== undefined) view.name = input.name;
  if (input.filters !== undefined) view.filters = input.filters;
  if (input.sort !== undefined) view.sort = input.sort;
  if (input.visibility !== undefined) view.visibility = input.visibility;
  view.updatedAt = new Date().toISOString();
  res.json(view);
});

savedViewsRouter.delete('/:id', async (req, res) => {
  const current = await requireCurrentUser(req);
  const idx = views.findIndex((v) => v.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Saved view not found' });
    return;
  }
  if (views[idx].ownerId !== current.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  views.splice(idx, 1);
  res.status(204).send();
});
