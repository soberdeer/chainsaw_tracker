import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { accessibleSpaceIds, requireSpacePermission } from '../services/permissions.js';

export const referencesRouter = Router();

referencesRouter.get('/departments', async (req, res) => {
  const workspaceId = z.string().parse(req.query.workspaceId);
  const visibleSpaceIds = await accessibleSpaceIds(req, workspaceId);
  const departments = await prisma.space.findMany({
    where: { workspaceId, id: { in: visibleSpaceIds } },
    orderBy: { createdAt: 'asc' }
  });
  res.json(departments);
});

referencesRouter.get('/teams', async (req, res) => {
  const query = z.object({
    workspaceId: z.string(),
    departmentId: z.string().optional()
  }).parse(req.query);
  const visibleSpaceIds = await accessibleSpaceIds(req, query.workspaceId);
  const teams = await prisma.folder.findMany({
    where: {
      spaceId: { in: query.departmentId ? [query.departmentId].filter((id) => visibleSpaceIds.includes(id)) : visibleSpaceIds },
      kind: { not: 'DOCS' }
    },
    include: { space: true },
    orderBy: { createdAt: 'asc' }
  });
  res.json(teams);
});

referencesRouter.get('/task-lists', async (req, res) => {
  const query = z.object({
    workspaceId: z.string(),
    teamId: z.string().optional()
  }).parse(req.query);
  const visibleSpaceIds = await accessibleSpaceIds(req, query.workspaceId);
  const lists = await prisma.taskList.findMany({
    where: {
      folder: {
        ...(query.teamId ? { id: query.teamId } : {}),
        spaceId: { in: visibleSpaceIds }
      }
    },
    include: { folder: { include: { space: true } }, statuses: { orderBy: { position: 'asc' } } },
    orderBy: { createdAt: 'asc' }
  });
  res.json(lists);
});

referencesRouter.get('/milestones', async (req, res) => {
  const query = z.object({
    workspaceId: z.string(),
    teamId: z.string().optional()
  }).parse(req.query);
  const visibleSpaceIds = await accessibleSpaceIds(req, query.workspaceId);
  const milestones = await prisma.milestone.findMany({
    where: {
      workspaceId: query.workspaceId,
      ...(query.teamId ? { folderId: query.teamId } : { OR: [{ folderId: null }, { folder: { spaceId: { in: visibleSpaceIds } } }] })
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
  });
  res.json(milestones);
});

referencesRouter.post('/milestones', async (req, res) => {
  const body = z.object({
    workspaceId: z.string(),
    teamId: z.string().nullable().optional(),
    title: z.string().min(2),
    dueDate: z.string().nullable().optional()
  }).parse(req.body);
  if (body.teamId) {
    const folder = await prisma.folder.findUniqueOrThrow({ where: { id: body.teamId } });
    await requireSpacePermission(req, folder.spaceId, 'edit');
  }
  const milestone = await prisma.milestone.upsert({
    where: { workspaceId_title: { workspaceId: body.workspaceId, title: body.title } },
    create: {
      workspaceId: body.workspaceId,
      folderId: body.teamId || null,
      title: body.title,
      dueDate: body.dueDate ? new Date(body.dueDate) : null
    },
    update: {
      folderId: body.teamId || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null
    }
  });
  res.status(201).json(milestone);
});

referencesRouter.get('/task-statuses', async (req, res) => {
  const workspaceId = z.string().parse(req.query.workspaceId);
  const visibleSpaceIds = await accessibleSpaceIds(req, workspaceId);
  const statuses = await prisma.taskStatus.findMany({
    where: { taskList: { folder: { spaceId: { in: visibleSpaceIds } } } },
    include: { taskList: true },
    orderBy: [{ position: 'asc' }, { name: 'asc' }]
  });
  res.json(statuses);
});
