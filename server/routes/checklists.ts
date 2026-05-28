import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireOpenProjectTaskWrite } from '../openproject/permissions.js';
import { getRuntimeWorkspaceSettings } from '../openproject/service.js';
import { requireCurrentUser } from '../services/auth.js';

export const checklistsRouter = Router();

function serializeChecklist(
  checklist: Awaited<ReturnType<typeof prisma.checklist.findMany>>[number] & {
    items: Awaited<ReturnType<typeof prisma.checklistItem.findMany>>;
  }
) {
  const totalItems = checklist.items.length;
  const completedItems = checklist.items.filter((item) => item.completed).length;
  return {
    id: checklist.id,
    workPackageId: checklist.workPackageId,
    title: checklist.title,
    position: checklist.position,
    items: checklist.items.map((item) => ({
      id: item.id,
      text: item.text,
      completed: item.completed,
      position: item.position,
      completedAt: item.completedAt?.toISOString() || null,
      completedByUserId: item.completedByUserId || null,
    })),
    completedItems,
    totalItems,
  };
}

async function listTaskChecklists(workPackageId: string) {
  const runtimeWorkspace = await getRuntimeWorkspaceSettings();
  const checklists = await prisma.checklist.findMany({
    where: {
      workspaceId: runtimeWorkspace.id,
      workPackageId,
    },
    include: {
      items: {
        orderBy: { position: 'asc' },
      },
    },
    orderBy: { position: 'asc' },
  });
  return checklists.map(serializeChecklist);
}

checklistsRouter.use(async (req, _res, next) => {
  try {
    await requireCurrentUser(req);
    next();
  } catch (error) {
    next(error);
  }
});

checklistsRouter.get('/tasks/:workPackageId/checklists', async (req, res) => {
  res.json({ items: await listTaskChecklists(req.params.workPackageId) });
});

checklistsRouter.post('/tasks/:workPackageId/checklists', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z.object({ title: z.string().min(1) }).parse(req.body);
  const runtimeWorkspace = await getRuntimeWorkspaceSettings();
  const existingCount = await prisma.checklist.count({
    where: {
      workspaceId: runtimeWorkspace.id,
      workPackageId: req.params.workPackageId,
    },
  });
  const checklist = await prisma.checklist.create({
    data: {
      workspaceId: runtimeWorkspace.id,
      workPackageId: req.params.workPackageId,
      title: body.title.trim(),
      position: existingCount,
    },
    include: {
      items: {
        orderBy: { position: 'asc' },
      },
    },
  });
  res.status(201).json(serializeChecklist(checklist));
});

checklistsRouter.delete('/checklists/:id', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const runtimeWorkspace = await getRuntimeWorkspaceSettings();
  await prisma.checklist.deleteMany({
    where: {
      id: req.params.id,
      workspaceId: runtimeWorkspace.id,
    },
  });
  res.status(204).send();
});

checklistsRouter.patch('/checklists/:id', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z
    .object({
      title: z.string().min(1).optional(),
      position: z.number().int().min(0).optional(),
    })
    .parse(req.body);
  const runtimeWorkspace = await getRuntimeWorkspaceSettings();
  const checklist = await prisma.checklist.findFirstOrThrow({
    where: {
      id: req.params.id,
      workspaceId: runtimeWorkspace.id,
    },
    include: {
      items: {
        orderBy: { position: 'asc' },
      },
    },
  });
  const updated = await prisma.checklist.update({
    where: { id: checklist.id },
    data: {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.position !== undefined ? { position: body.position } : {}),
    },
    include: {
      items: {
        orderBy: { position: 'asc' },
      },
    },
  });
  res.json(serializeChecklist(updated));
});

checklistsRouter.post('/checklists/:id/items', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z.object({ text: z.string().min(1) }).parse(req.body);
  const runtimeWorkspace = await getRuntimeWorkspaceSettings();
  const checklist = await prisma.checklist.findFirstOrThrow({
    where: {
      id: req.params.id,
      workspaceId: runtimeWorkspace.id,
    },
    include: {
      items: true,
    },
  });
  await prisma.checklistItem.create({
    data: {
      checklistId: checklist.id,
      text: body.text.trim(),
      position: checklist.items.length,
    },
  });
  const refreshed = await prisma.checklist.findUniqueOrThrow({
    where: { id: checklist.id },
    include: {
      items: {
        orderBy: { position: 'asc' },
      },
    },
  });
  res.status(201).json(serializeChecklist(refreshed));
});

checklistsRouter.patch('/checklist-items/:id', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z
    .object({
      text: z.string().min(1).optional(),
      completed: z.boolean().optional(),
      position: z.number().int().min(0).optional(),
    })
    .parse(req.body);
  const item = await prisma.checklistItem.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { checklist: true },
  });
  const runtimeWorkspace = await getRuntimeWorkspaceSettings();
  if (item.checklist.workspaceId !== runtimeWorkspace.id) {
    res.status(404).json({ error: 'Checklist item not found' });
    return;
  }
  await prisma.checklistItem.update({
    where: { id: item.id },
    data: {
      ...(body.text !== undefined ? { text: body.text.trim() } : {}),
      ...(body.position !== undefined ? { position: body.position } : {}),
      ...(body.completed !== undefined
        ? {
            completed: body.completed,
            completedAt: body.completed ? new Date() : null,
          }
        : {}),
    },
  });
  const refreshed = await prisma.checklist.findUniqueOrThrow({
    where: { id: item.checklistId },
    include: {
      items: {
        orderBy: { position: 'asc' },
      },
    },
  });
  res.json(serializeChecklist(refreshed));
});

checklistsRouter.delete('/checklist-items/:id', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const item = await prisma.checklistItem.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { checklist: true },
  });
  const runtimeWorkspace = await getRuntimeWorkspaceSettings();
  if (item.checklist.workspaceId !== runtimeWorkspace.id) {
    res.status(404).json({ error: 'Checklist item not found' });
    return;
  }
  await prisma.checklistItem.delete({ where: { id: item.id } });
  res.status(204).send();
});
