import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requirePermission, requireSpacePermission } from '../services/permissions.js';

export const spacesRouter = Router();

spacesRouter.patch('/:spaceId', async (req, res) => {
  const body = z.object({
    name: z.string().min(2).optional(),
    description: z.string().nullable().optional(),
    color: z.string().optional(),
    initials: z.string().max(3).nullable().optional(),
    locked: z.boolean().optional()
  }).parse(req.body);
  const space = await prisma.space.findUniqueOrThrow({ where: { id: req.params.spaceId } });
  await requireSpacePermission(req, space.id, 'manage');
  res.json(await prisma.space.update({ where: { id: space.id }, data: body }));
});

spacesRouter.post('/', async (req, res) => {
  const body = z.object({
    workspaceId: z.string(),
    name: z.string().min(2),
    description: z.string().optional(),
    color: z.string().default('#228be6'),
    initials: z.string().max(3).optional(),
    locked: z.boolean().default(false)
  }).parse(req.body);

  await requirePermission(req, body.workspaceId, 'manageSpaces');
  const space = await prisma.space.create({
    data: {
      ...body,
      permissions: {
        create: [
          { role: 'OWNER', canView: true, canEdit: true, canManage: true },
          { role: 'ADMIN', canView: true, canEdit: true, canManage: true },
          { role: 'LEAD', canView: true, canEdit: true },
          { role: 'MEMBER', canView: true, canEdit: true },
          { role: 'VIEWER', canView: true }
        ]
      }
    }
  });
  res.status(201).json(space);
});

spacesRouter.post('/:spaceId/folders', async (req, res) => {
  const body = z.object({
    name: z.string().min(2),
    kind: z.enum(['DOCS', 'TEAM', 'GENERAL']).default('GENERAL'),
    locked: z.boolean().default(false)
  }).parse(req.body);
  const space = await prisma.space.findUniqueOrThrow({ where: { id: req.params.spaceId } });
  await requireSpacePermission(req, space.id, 'manage');
  const folder = await prisma.folder.create({
    data: { spaceId: req.params.spaceId, ...body }
  });
  res.status(201).json(folder);
});

spacesRouter.post('/:spaceId/permissions/:role', async (req, res) => {
  const role = z.enum(['OWNER', 'ADMIN', 'LEAD', 'MEMBER', 'VIEWER']).parse(req.params.role);
  const body = z.object({
    canView: z.boolean(),
    canEdit: z.boolean(),
    canManage: z.boolean()
  }).parse(req.body);
  const space = await prisma.space.findUniqueOrThrow({ where: { id: req.params.spaceId } });
  await requireSpacePermission(req, space.id, 'manage');
  const permission = await prisma.spacePermission.upsert({
    where: { spaceId_role: { spaceId: req.params.spaceId, role } },
    create: { spaceId: req.params.spaceId, role, ...body },
    update: body
  });
  res.json(permission);
});
