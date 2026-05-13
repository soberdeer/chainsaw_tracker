import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireSpacePermission } from '../services/permissions.js';

export const foldersRouter = Router();

foldersRouter.post('/:folderId/task-lists', async (req, res) => {
  const body = z.object({
    name: z.string().min(2),
    icon: z.string().optional()
  }).parse(req.body);

  const folder = await prisma.folder.findUniqueOrThrow({
    where: { id: req.params.folderId },
    include: { space: true }
  });
  await requireSpacePermission(req, folder.spaceId, 'edit');

  const taskList = await prisma.taskList.create({
    data: {
      folderId: folder.id,
      name: body.name,
      icon: body.icon,
      statuses: {
        create: [
          { name: 'backlog', color: '#868e96', position: 0 },
          { name: 'in development', color: '#3b82f6', position: 1 },
          { name: 'in review', color: '#d6336c', position: 2 },
          { name: 'shipped', color: '#4d9f87', position: 3, isDone: true }
        ]
      }
    },
    include: { statuses: true }
  });

  res.status(201).json(taskList);
});

foldersRouter.post('/task-lists/:taskListId/statuses', async (req, res) => {
  const body = z.object({
    name: z.string().min(2),
    color: z.string().default('#868e96'),
    isDone: z.boolean().default(false)
  }).parse(req.body);

  const taskList = await prisma.taskList.findUniqueOrThrow({
    where: { id: req.params.taskListId },
    include: { folder: { include: { space: true } }, statuses: true }
  });
  await requireSpacePermission(req, taskList.folder.spaceId, 'edit');

  const status = await prisma.taskStatus.create({
    data: {
      taskListId: taskList.id,
      name: body.name,
      color: body.color,
      isDone: body.isDone,
      position: taskList.statuses.length
    }
  });

  res.status(201).json(status);
});
