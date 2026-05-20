import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireCurrentUser } from '../services/auth.js';
import { requireOpenProjectProjectWrite, requireOpenProjectTaskWrite } from './permissions.js';
import * as service from './service.js';

export const openProjectRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

async function notifyAssignedUsers(task: {
  id: string;
  title: string;
  assignees?: Array<{ email?: string; id?: string }>;
}) {
  const emails = (task.assignees || []).map((user) => user.email).filter(Boolean) as string[];
  if (!emails.length) return;
  const users = await prisma.user.findMany({ where: { email: { in: emails } } });
  await prisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      type: 'TASK_ASSIGNED',
      title: `Assigned: ${task.title}`,
      message: 'You are assigned or responsible on this OpenProject work package.',
      workPackageId: task.id,
    })),
    skipDuplicates: false,
  });
}

async function notifyCommentOnAssignedTask(taskId: string, comment: string) {
  const task = await service.getTask(taskId).catch(() => null);
  if (!task?.assignees?.length) return;
  const emails = task.assignees.map((user) => user.email).filter(Boolean);
  const users = await prisma.user.findMany({ where: { email: { in: emails } } });
  await prisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      type: 'TASK_COMMENTED',
      title: `Comment: ${task.title}`,
      message: comment.slice(0, 240),
      workPackageId: task.id,
    })),
  });
}

openProjectRouter.use(async (req, _res, next) => {
  try {
    await requireCurrentUser(req);
    next();
  } catch (error) {
    next(error);
  }
});

openProjectRouter.get('/workspaces', async (_req, res) => {
  res.json(await service.getWorkspaceTree());
});

openProjectRouter.get('/projects', async (_req, res) => {
  res.json(await service.getProjects());
});

openProjectRouter.get('/spaces', async (_req, res) => {
  const [workspace] = await service.getWorkspaceTree();
  res.json(workspace?.spaces || []);
});

openProjectRouter.post('/spaces', async (req, res) => {
  await requireOpenProjectProjectWrite(req);
  const body = z
    .object({
      name: z.string().min(1),
      identifier: z.string().optional(),
      description: z.string().optional(),
      parentId: z.string().optional(),
      public: z.boolean().optional(),
    })
    .parse(req.body);
  res.status(201).json(await service.createProject(body));
});

openProjectRouter.patch('/spaces/:spaceId', async (_req, res) => {
  res.status(405).json({ error: 'Rename the OpenProject project in OpenProject settings' });
});

openProjectRouter.post('/spaces/:spaceId/folders', async (_req, res) => {
  res.status(405).json({ error: 'Folders are not supported by the OpenProject adapter' });
});

openProjectRouter.post('/folders/:folderId/lists', async (_req, res) => {
  res.status(405).json({ error: 'Lists are not supported by the OpenProject adapter' });
});

openProjectRouter.get('/task-lists', async (_req, res) => {
  res.json(await service.getTaskListOptions());
});

openProjectRouter.get('/task-statuses', async (req, res) => {
  const query = z.object({ listId: z.string().optional() }).parse(req.query);
  res.json(await service.getTaskStatuses(query.listId));
});

openProjectRouter.get('/tasks', async (req, res) => {
  const query = z
    .object({
      listId: z.string().optional(),
      taskListId: z.string().optional(),
      statusId: z.string().optional(),
      assigneeIds: z.string().optional(),
      search: z.string().optional(),
      priority: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      cursor: z.string().optional(),
    })
    .parse(req.query);
  const projectId = query.listId || query.taskListId;
  if (!projectId) {
    res
      .status(400)
      .json({ error: 'listId/projectId is required for OpenProject work package loading' });
    return;
  }
  res.json(
    await service.getTasks(projectId, {
      offset: query.cursor ? Number(query.cursor) : 1,
      status: query.statusId,
      assignees: query.assigneeIds
        ?.split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      search: query.search,
      priority: query.priority,
      limit: query.limit,
    })
  );
});

openProjectRouter.post('/tasks', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z
    .object({
      listId: z.string().optional(),
      taskListId: z.string().optional(),
      title: z.string().min(1),
      description: z.string().optional(),
      statusId: z.string().optional(),
      priority: z.string().optional(),
      assigneeIds: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      startDate: z.string().optional(),
      dueDate: z.string().optional(),
    })
    .parse(req.body);
  const projectId = body.listId || body.taskListId;
  if (!projectId) {
    res.status(400).json({ error: 'listId/projectId is required' });
    return;
  }
  const task = await service.createTask(projectId, body);
  await notifyAssignedUsers(task);
  res.status(201).json(task);
});

openProjectRouter.post('/tasks/bulk-update', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z
    .object({
      taskIds: z.array(z.string().min(1)).min(1),
      statusId: z.string().optional(),
      priority: z.string().optional(),
      assigneeIds: z.array(z.string()).optional(),
    })
    .parse(req.body);
  res.json(await service.bulkUpdateTasks(body.taskIds, body));
});

openProjectRouter.get('/tasks/:taskId', async (req, res) => {
  res.json(await service.getTask(req.params.taskId));
});

openProjectRouter.patch('/tasks/:taskId', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z
    .object({
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      statusId: z.string().optional(),
      priority: z.string().optional(),
      assigneeIds: z.array(z.string()).optional(),
      startDate: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
    })
    .parse(req.body);
  const task = await service.updateTask(req.params.taskId, body);
  await notifyAssignedUsers(task);
  res.json(task);
});

openProjectRouter.delete('/tasks/:taskId', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  await service.deleteTask(req.params.taskId);
  res.status(204).send();
});

openProjectRouter.post('/tasks/:taskId/duplicate', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  res.status(201).json(await service.duplicateTask(req.params.taskId));
});

openProjectRouter.get('/tasks/:taskId/activity', async (req, res) => {
  const query = z
    .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
    .parse(req.query);
  const items = await service.getTaskActivities(req.params.taskId, query.limit);
  res.json({ items, nextCursor: null });
});

openProjectRouter.post('/tasks/:taskId/activity', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z.object({ comment: z.string().min(1) }).parse(req.body);
  const activity = await service.addTaskComment(req.params.taskId, body.comment);
  await notifyCommentOnAssignedTask(req.params.taskId, body.comment);
  res.status(201).json(activity);
});

openProjectRouter.get('/tasks/:taskId/relations', async (req, res) => {
  res.json({ items: await service.getTaskRelations(req.params.taskId) });
});

openProjectRouter.post('/tasks/:taskId/relations', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z
    .object({
      targetTaskId: z.string().min(1),
      type: z.enum(['relates', 'blocks', 'blockedBy', 'precedes', 'follows']).default('relates'),
      description: z.string().optional(),
    })
    .parse(req.body);
  res.status(201).json(await service.createTaskRelation(req.params.taskId, body));
});

openProjectRouter.delete('/tasks/:taskId/relations/:relationId', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  await service.deleteTaskRelation(req.params.relationId);
  res.status(204).send();
});

openProjectRouter.get('/tasks/:taskId/time-entries', async (req, res) => {
  res.json(await service.getTaskTimeEntries(req.params.taskId));
});

openProjectRouter.post('/tasks/:taskId/time-entries', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z
    .object({
      hours: z.coerce.number().positive(),
      spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      comment: z.string().optional(),
    })
    .parse(req.body);
  res.status(201).json(await service.addTaskTimeEntry(req.params.taskId, body));
});

openProjectRouter.get('/tasks/:taskId/attachments', async (req, res) => {
  res.json({ items: await service.getTaskAttachments(req.params.taskId) });
});

openProjectRouter.post('/tasks/:taskId/attachments', upload.single('file'), async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  if (!req.file) {
    res.status(400).json({ error: 'file is required' });
    return;
  }
  const description = typeof req.body.description === 'string' ? req.body.description : undefined;
  res
    .status(201)
    .json(await service.addTaskAttachment(String(req.params.taskId), req.file, description));
});

openProjectRouter.get('/tasks/:taskId/custom-fields', async (req, res) => {
  res.json({ items: await service.getTaskCustomFields(req.params.taskId) });
});

openProjectRouter.patch('/tasks/:taskId/custom-fields/:fieldKey', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z.object({ value: z.unknown() }).parse(req.body);
  res.json({
    items: await service.updateTaskCustomField(req.params.taskId, req.params.fieldKey, body.value),
  });
});

openProjectRouter.get('/search', async (req, res) => {
  const query = z.object({ q: z.string().optional() }).parse(req.query);
  const tasks = await service.searchTasks(query.q || '');
  res.json(
    tasks.map((task) => ({
      id: task.id,
      type: 'task',
      title: task.title,
      subtitle: task.status,
      url: `/space/${task.departmentId || 'openproject'}/folder/${task.folderId}/task/${task.id}`,
    }))
  );
});
