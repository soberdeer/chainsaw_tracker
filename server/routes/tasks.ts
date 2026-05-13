import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { currentUserId, requireSpacePermission, accessibleSpaceIds, requireTaskEditPermission } from '../services/permissions.js';
import { logTaskActivity } from '../services/activity.js';
import { extractTaskKey } from '../services/taskKeys.js';
import { computeTaskDevelopmentStatus } from '../services/taskDevelopment.js';

export const tasksRouter = Router();

const fullTaskInclude = {
  assignee: true,
  tags: { include: { tag: true } },
  subtasks: { include: { assignee: true, tags: { include: { tag: true } } } },
  comments: { include: { author: true }, orderBy: { createdAt: 'asc' as const } },
  folder: { include: { space: true } },
  taskList: true,
  statusRef: true,
  dependencies: { include: { dependsOn: { include: { assignee: true, tags: { include: { tag: true } } } } } },
  dependents: { include: { task: { include: { assignee: true, tags: { include: { tag: true } } } } } },
  milestone: true,
  githubBranches: { include: { repository: true } },
  githubPullRequests: { include: { repository: true }, orderBy: { updatedAt: 'desc' as const } }
};

const listTaskInclude = {
  assignee: true,
  tags: { include: { tag: true } },
  subtasks: true,
  milestone: true,
  taskList: true,
  statusRef: true
};

function serializeValue(value: unknown) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeManualTaskKey(value: string | null | undefined) {
  if (!value) return value;
  const normalized = value.trim().toUpperCase();
  if (extractTaskKey(normalized) !== normalized) {
    const error = new Error('Invalid taskKey format');
    Object.assign(error, { statusCode: 400 });
    throw error;
  }
  return normalized;
}

tasksRouter.get('/', async (req, res) => {
  const query = z.object({
    workspaceId: z.string().optional(),
    departmentId: z.string().optional(),
    teamId: z.string().optional(),
    folderId: z.string().optional(),
    listId: z.string().optional(),
    taskListId: z.string().optional(),
    statusId: z.string().optional(),
    assigneeId: z.string().optional(),
    milestoneId: z.string().optional(),
    search: z.string().optional(),
    source: z.enum(['CLICKUP', 'LOCAL']).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().optional()
  }).parse(req.query);

  const folderId = query.folderId || query.teamId;
  const taskListId = query.taskListId || query.listId;
  if (!query.workspaceId && !folderId && !taskListId) {
    res.status(400).json({ error: 'workspaceId is required' });
    return;
  }
  if (folderId) {
    const folder = await prisma.folder.findUniqueOrThrow({ where: { id: folderId } });
    await requireSpacePermission(req, folder.spaceId, 'view');
  }
  if (taskListId) {
    const taskList = await prisma.taskList.findUniqueOrThrow({ where: { id: taskListId }, include: { folder: true } });
    await requireSpacePermission(req, taskList.folder.spaceId, 'view');
  }
  if (query.workspaceId && !folderId && !taskListId) {
    const spaceIds = await accessibleSpaceIds(req, query.workspaceId);
    if (!spaceIds.length) {
      res.json({ items: [], nextCursor: null });
      return;
    }
  }

  const visibleSpaceIds = query.workspaceId ? await accessibleSpaceIds(req, query.workspaceId) : undefined;
  const search = query.search?.trim();
  const where = {
    ...(taskListId ? { taskListId } : {}),
    ...(folderId ? { folderId } : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.statusId ? { statusId: query.statusId } : {}),
    ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
    ...(query.milestoneId ? { milestoneId: query.milestoneId } : {}),
    ...(query.source ? { externalSource: query.source } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    deletedAt: null,
    ...(query.workspaceId
      ? {
          OR: [
            { workspaceId: query.workspaceId },
            { folder: { space: { workspaceId: query.workspaceId, id: { in: visibleSpaceIds } } } }
          ]
        }
      : {}),
    ...(search
      ? {
          AND: [
            {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
                { taskKey: { contains: search, mode: 'insensitive' as const } },
                { externalId: { contains: search, mode: 'insensitive' as const } }
              ]
            }
          ]
        }
      : {})
  };

  const tasks = await prisma.task.findMany({
    where,
    include: listTaskInclude,
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
  });
  const page = tasks.slice(0, query.limit);
  res.json({
    items: page,
    nextCursor: tasks.length > query.limit ? page.at(-1)?.id || null : null
  });
});

tasksRouter.post('/', async (req, res) => {
  const body = z.object({
    folderId: z.string().optional(),
    workspaceId: z.string().optional(),
    departmentId: z.string().optional(),
    teamId: z.string().optional(),
    listId: z.string().optional(),
    taskListId: z.string().optional(),
    milestoneId: z.string().nullable().optional(),
    title: z.string().min(2),
    description: z.string().optional(),
    statusId: z.string().optional(),
    parentId: z.string().optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
    assigneeId: z.string().optional(),
    taskKey: z.string().nullable().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    githubUrl: z.string().url().optional()
  }).parse(req.body);

  const requestedTaskListId = body.taskListId || body.listId;
  if (!requestedTaskListId) {
    res.status(400).json({ error: 'listId or taskListId is required' });
    return;
  }
  const taskList = await prisma.taskList.findUniqueOrThrow({
    where: { id: requestedTaskListId },
    include: { folder: { include: { space: true } }, statuses: { orderBy: { position: 'asc' } } }
  });
  await requireSpacePermission(req, taskList.folder.spaceId, 'edit');
  const status = body.statusId
    ? await prisma.taskStatus.findUniqueOrThrow({ where: { id: body.statusId } })
    : taskList.statuses[0];

  const task = await prisma.task.create({
    data: {
      folderId: body.folderId || taskList.folderId,
      workspaceId: taskList.folder.space.workspaceId,
      departmentId: taskList.folder.spaceId,
      teamId: taskList.folderId,
      listId: taskList.id,
      taskListId: taskList.id,
      parentId: body.parentId,
      externalSource: 'LOCAL',
      milestoneId: body.milestoneId,
      taskKey: normalizeManualTaskKey(body.taskKey) || extractTaskKey(body.title),
      createdById: currentUserId(req),
      title: body.title,
      description: body.description,
      statusId: status?.id,
      status: status?.name || 'todo',
      priority: body.priority,
      position: await prisma.task.count({ where: { taskListId: taskList.id, statusId: status?.id } }),
      assigneeId: body.assigneeId,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      githubUrl: body.githubUrl
    }
  });
  await logTaskActivity({ workspaceId: taskList.folder.space.workspaceId, taskId: task.id, actorId: currentUserId(req), type: 'TASK_CREATED', message: 'Task created' });
  res.status(201).json(task);
});

tasksRouter.post('/reorder', async (req, res) => {
  const body = z.object({
    taskId: z.string(),
    statusId: z.string(),
    orderedTaskIds: z.array(z.string()).min(1)
  }).parse(req.body);

  const existing = await prisma.task.findUniqueOrThrow({
    where: { id: body.taskId },
    include: { folder: { include: { space: true } } }
  });
  await requireSpacePermission(req, existing.folder.spaceId, 'edit');

  const status = await prisma.taskStatus.findUniqueOrThrow({ where: { id: body.statusId } });
  await prisma.$transaction(
    body.orderedTaskIds.map((taskId, position) =>
      prisma.task.update({
        where: { id: taskId },
        data: {
          statusId: status.id,
          status: status.name,
          position
        }
      })
    )
  );

  const tasks = await prisma.task.findMany({
    where: { taskListId: status.taskListId },
    include: { assignee: true, tags: { include: { tag: true } }, subtasks: true },
    orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }]
  });
  res.json(tasks);
});

tasksRouter.post('/:taskId/duplicate', async (req, res) => {
  const existing = await prisma.task.findUniqueOrThrow({
    where: { id: req.params.taskId },
    include: { folder: { include: { space: true } }, tags: { include: { tag: true } } }
  });
  await requireTaskEditPermission(req, existing);

  const task = await prisma.task.create({
    data: {
      folderId: existing.folderId,
      taskListId: existing.taskListId,
      statusId: existing.statusId,
      parentId: existing.parentId,
      title: `${existing.title} copy`,
      description: existing.description,
      status: existing.status,
      priority: existing.priority,
      startDate: existing.startDate,
      dueDate: existing.dueDate,
      assigneeId: existing.assigneeId,
      workspaceId: existing.workspaceId,
      departmentId: existing.departmentId,
      teamId: existing.teamId,
      listId: existing.listId,
      externalSource: 'LOCAL',
      createdById: currentUserId(req),
      taskKey: existing.taskKey ? `${existing.taskKey}-COPY` : extractTaskKey(`${existing.title} copy`),
      tags: { create: existing.tags.map(({ tagId }) => ({ tagId })) }
    },
    include: fullTaskInclude
  });
  res.status(201).json(task);
});

tasksRouter.patch('/:taskId', async (req, res) => {
  const body = z.object({
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    statusId: z.string().optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    assigneeId: z.string().nullable().optional(),
    milestoneId: z.string().nullable().optional(),
    listId: z.string().nullable().optional(),
    teamId: z.string().nullable().optional(),
    departmentId: z.string().nullable().optional(),
    taskKey: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    githubUrl: z.string().url().nullable().optional(),
    tagNames: z.array(z.string().min(1)).optional()
  }).parse(req.body);

  const existing = await prisma.task.findUniqueOrThrow({
    where: { id: req.params.taskId },
    include: { folder: { include: { space: true } } }
  });
  await requireTaskEditPermission(req, existing);
  const status = body.statusId ? await prisma.taskStatus.findUniqueOrThrow({ where: { id: body.statusId } }) : null;
  const targetListId = body.listId || null;
  const list = targetListId ? await prisma.taskList.findUniqueOrThrow({ where: { id: targetListId }, include: { folder: { include: { space: true } } } }) : null;
  if (list) await requireSpacePermission(req, list.folder.spaceId, 'edit');
  const nextTaskKey = 'taskKey' in body ? normalizeManualTaskKey(body.taskKey) || null : body.title && !existing.taskKey ? extractTaskKey(body.title) : undefined;

  if (body.tagNames) {
    const workspaceId = existing.folder.space.workspaceId;
    const tags = await Promise.all(body.tagNames.map((name, index) =>
      prisma.tag.upsert({
        where: { workspaceId_name: { workspaceId, name } },
        create: { workspaceId, name, color: ['#7048e8', '#1864ab', '#0ca678', '#f08c00', '#d6336c'][index % 5] },
        update: {}
      })
    ));
    await prisma.taskTag.deleteMany({ where: { taskId: req.params.taskId } });
    if (tags.length) {
      await prisma.taskTag.createMany({
        data: tags.map((tag) => ({ taskId: req.params.taskId, tagId: tag.id })),
        skipDuplicates: true
      });
    }
  }

  const task = await prisma.task.update({
    where: { id: req.params.taskId },
    data: {
      title: body.title,
      description: body.description,
      statusId: body.statusId,
      status: status?.name,
      priority: body.priority,
      assigneeId: body.assigneeId,
      milestoneId: body.milestoneId,
      listId: list?.id,
      taskListId: list?.id,
      folderId: list?.folderId,
      departmentId: list?.folder.spaceId,
      teamId: list?.folderId,
      taskKey: nextTaskKey,
      locallyEditedAt: new Date(),
      startDate: body.startDate ? new Date(body.startDate) : body.startDate,
      dueDate: body.dueDate ? new Date(body.dueDate) : body.dueDate,
      githubUrl: body.githubUrl
    },
    include: fullTaskInclude
  });
  const actorId = currentUserId(req);
  const workspaceId = existing.workspaceId || existing.folder.space.workspaceId;
  const changes: Array<{ type: Parameters<typeof logTaskActivity>[0]['type']; field: string; previous: unknown; next: unknown }> = [];
  if ('title' in body && body.title !== existing.title) changes.push({ type: 'TASK_TITLE_CHANGED', field: 'title', previous: existing.title, next: body.title });
  if ('description' in body && body.description !== existing.description) changes.push({ type: 'TASK_DESCRIPTION_CHANGED', field: 'description', previous: existing.description, next: body.description });
  if ('priority' in body && body.priority !== existing.priority) changes.push({ type: 'TASK_PRIORITY_CHANGED', field: 'priority', previous: existing.priority, next: body.priority });
  if ('statusId' in body && body.statusId !== existing.statusId) changes.push({ type: 'TASK_STATUS_CHANGED', field: 'statusId', previous: existing.statusId, next: body.statusId });
  if ('assigneeId' in body && body.assigneeId !== existing.assigneeId) changes.push({ type: 'TASK_ASSIGNEE_CHANGED', field: 'assigneeId', previous: existing.assigneeId, next: body.assigneeId });
  if ('milestoneId' in body && body.milestoneId !== existing.milestoneId) changes.push({ type: 'TASK_MILESTONE_CHANGED', field: 'milestoneId', previous: existing.milestoneId, next: body.milestoneId });
  if (list && list.id !== existing.taskListId) changes.push({ type: 'TASK_LIST_CHANGED', field: 'listId', previous: existing.taskListId, next: list.id });
  if (nextTaskKey !== undefined && nextTaskKey !== existing.taskKey) changes.push({ type: 'TASK_KEY_CHANGED', field: 'taskKey', previous: existing.taskKey, next: nextTaskKey });
  if (changes.length) {
    await logTaskActivity({ workspaceId, taskId: task.id, actorId, type: 'TASK_UPDATED', message: 'Task updated', metadata: { fields: changes.map((change) => change.field) } });
    await Promise.all(changes.map((change) => logTaskActivity({
      workspaceId,
      taskId: task.id,
      actorId,
      type: change.type,
      message: `${change.field} changed`,
      previousValue: serializeValue(change.previous),
      nextValue: serializeValue(change.next)
    })));
  }
  res.json(task);
});

tasksRouter.get('/:taskId/activity', async (req, res) => {
  const query = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().optional()
  }).parse(req.query);
  const task = await prisma.task.findUniqueOrThrow({ where: { id: req.params.taskId }, include: { folder: true } });
  await requireSpacePermission(req, task.folder.spaceId, 'view');
  const activity = await prisma.activityLog.findMany({
    where: { taskId: task.id },
    orderBy: { createdAt: 'desc' },
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
  });
  const items = activity.slice(0, query.limit);
  res.json({ items, nextCursor: activity.length > query.limit ? items.at(-1)?.id || null : null });
});

tasksRouter.post('/:taskId/dependencies', async (req, res) => {
  const body = z.object({ dependsOnId: z.string() }).parse(req.body);
  if (body.dependsOnId === req.params.taskId) {
    res.status(400).json({ error: 'Task cannot depend on itself' });
    return;
  }

  const existing = await prisma.task.findUniqueOrThrow({
    where: { id: req.params.taskId },
    include: { folder: { include: { space: true } } }
  });
  await requireTaskEditPermission(req, existing);

  const dependency = await prisma.taskDependency.upsert({
    where: { taskId_dependsOnId: { taskId: req.params.taskId, dependsOnId: body.dependsOnId } },
    create: { taskId: req.params.taskId, dependsOnId: body.dependsOnId },
    update: {},
    include: { dependsOn: { include: { assignee: true, tags: { include: { tag: true } } } } }
  });

  res.status(201).json(dependency);
});

tasksRouter.delete('/:taskId/dependencies/:dependsOnId', async (req, res) => {
  const existing = await prisma.task.findUniqueOrThrow({
    where: { id: req.params.taskId },
    include: { folder: { include: { space: true } } }
  });
  await requireTaskEditPermission(req, existing);
  await prisma.taskDependency.delete({
    where: { taskId_dependsOnId: { taskId: req.params.taskId, dependsOnId: req.params.dependsOnId } }
  }).catch(() => null);
  res.status(204).send();
});

tasksRouter.delete('/:taskId', async (req, res) => {
  const existing = await prisma.task.findUniqueOrThrow({
    where: { id: req.params.taskId },
    include: { folder: { include: { space: true } } }
  });
  await requireTaskEditPermission(req, existing);
  await prisma.task.update({ where: { id: req.params.taskId }, data: { deletedAt: new Date(), locallyEditedAt: new Date() } });
  await logTaskActivity({
    workspaceId: existing.workspaceId || existing.folder.space.workspaceId,
    taskId: existing.id,
    actorId: currentUserId(req),
    type: 'TASK_DELETED',
    message: 'Task deleted'
  });
  res.status(204).send();
});

tasksRouter.get('/:taskId', async (req, res) => {
  const task = await prisma.task.findFirstOrThrow({
    where: { id: req.params.taskId, deletedAt: null },
    include: fullTaskInclude
  });
  await requireSpacePermission(req, task.folder.spaceId, 'view');

  res.json({
    ...task,
    developmentStatus: computeTaskDevelopmentStatus(task),
    appUrl: `/tasks/${task.id}`
  });
});
