import { Router } from 'express';
import { z } from 'zod';
import { requireClickUpSpaceWrite, requireClickUpTaskWrite } from './permissions.js';
import * as service from './service.js';

export const clickupRouter = Router();

clickupRouter.get('/team', async (_req, res) => {
  res.json(await service.getTeams());
});

clickupRouter.get('/workspaces', async (_req, res) => {
  res.json(await service.getWorkspaceTree());
});

clickupRouter.get('/spaces', async (req, res) => {
  const query = z
    .object({ workspaceId: z.string(), archived: z.coerce.boolean().optional() })
    .parse(req.query);
  const spaces = await service.getSpaces(query.workspaceId, Boolean(query.archived));
  res.json(
    spaces.map((space) => ({
      id: space.id,
      workspaceId: query.workspaceId,
      name: space.name,
      color: space.color || '#4c6ef5',
      initials: space.name.slice(0, 1).toUpperCase(),
      locked: Boolean(space.private),
      folders: [],
      documents: [],
    }))
  );
});

clickupRouter.post('/spaces', async (req, res) => {
  await requireClickUpSpaceWrite(req);
  const body = z
    .object({
      workspaceId: z.string(),
      name: z.string().min(1),
      color: z.string().optional(),
      private: z.boolean().optional(),
    })
    .parse(req.body);
  res.status(201).json(await service.createSpace(body.workspaceId, body));
});

clickupRouter.patch('/spaces/:spaceId', async (req, res) => {
  await requireClickUpSpaceWrite(req);
  const body = z
    .object({
      name: z.string().min(1).optional(),
      color: z.string().optional(),
      private: z.boolean().optional(),
    })
    .parse(req.body);
  res.json(await service.updateSpace(req.params.spaceId, body));
});

clickupRouter.post('/spaces/:spaceId/folders', async (req, res) => {
  await requireClickUpSpaceWrite(req);
  const body = z.object({ name: z.string().min(1) }).parse(req.body);
  res.status(201).json(await service.createFolder(req.params.spaceId, body));
});

clickupRouter.post('/folders/:folderId/lists', async (req, res) => {
  await requireClickUpSpaceWrite(req);
  const body = z
    .object({ name: z.string().min(1), folderless: z.boolean().optional() })
    .parse(req.body);
  res.status(201).json(await service.createList(req.params.folderId, body));
});

clickupRouter.get('/task-lists', async (req, res) => {
  const query = z
    .object({ workspaceId: z.string(), teamId: z.string().optional() })
    .parse(req.query);
  res.json(await service.getTaskListOptions(query.workspaceId, query.teamId));
});

clickupRouter.get('/task-statuses', async (req, res) => {
  const query = z
    .object({ workspaceId: z.string(), listId: z.string().optional() })
    .parse(req.query);
  res.json(await service.getStatuses(query.workspaceId, query.listId));
});

clickupRouter.get('/tasks', async (req, res) => {
  const query = z
    .object({
      listId: z.string().optional(),
      taskListId: z.string().optional(),
      statusId: z.string().optional(),
      assigneeId: z.string().optional(),
      assigneeIds: z.string().optional(),
      search: z.string().optional(),
      priority: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      cursor: z.string().optional(),
    })
    .parse(req.query);
  const listId = query.listId || query.taskListId;
  if (!listId) {
    res.status(400).json({ error: 'listId is required for ClickUp task list loading' });
    return;
  }
  res.json(
    await service.getTasks(listId, {
      page: query.cursor ? Number(query.cursor) : 0,
      status: query.statusId,
      assignee: query.assigneeId,
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

clickupRouter.post('/tasks', async (req, res) => {
  await requireClickUpTaskWrite(req);
  const body = z
    .object({
      listId: z.string().optional(),
      taskListId: z.string().optional(),
      title: z.string().min(1),
      description: z.string().optional(),
      statusId: z.string().optional(),
      priority: z.string().optional(),
      assigneeId: z.string().optional(),
      assigneeIds: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      startDate: z.string().optional(),
      dueDate: z.string().optional(),
    })
    .parse(req.body);
  const listId = body.listId || body.taskListId;
  if (!listId) {
    res.status(400).json({ error: 'listId or taskListId is required' });
    return;
  }
  res.status(201).json(await service.createTask(listId, body));
});

clickupRouter.get('/tasks/:taskId', async (req, res) => {
  res.json(await service.getTask(req.params.taskId));
});

clickupRouter.patch('/tasks/:taskId', async (req, res) => {
  await requireClickUpTaskWrite(req);
  const body = z
    .object({
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      statusId: z.string().optional(),
      priority: z.string().optional(),
      assigneeId: z.string().nullable().optional(),
      assigneeIds: z.array(z.string()).optional(),
      startDate: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
    })
    .parse(req.body);
  res.json(await service.updateTask(req.params.taskId, body));
});

clickupRouter.delete('/tasks/:taskId', async (req, res) => {
  await requireClickUpTaskWrite(req);
  await service.deleteTask(req.params.taskId);
  res.status(204).send();
});

clickupRouter.post('/tasks/:taskId/duplicate', async (req, res) => {
  await requireClickUpTaskWrite(req);
  res.status(201).json(await service.duplicateTask(req.params.taskId));
});

clickupRouter.get('/tasks/:taskId/activity', async (req, res) => {
  const query = z
    .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
    .parse(req.query);
  const items = await service.getTaskComments(req.params.taskId);
  res.json({ items: items.slice(0, query.limit), nextCursor: null });
});

clickupRouter.get('/search', async (req, res) => {
  const query = z
    .object({ q: z.string().optional(), workspaceId: z.string().optional() })
    .parse(req.query);
  const tasks = await service.searchTasks(query.q || '', query.workspaceId);
  res.json(
    tasks.map((task) => ({
      id: task.id,
      type: 'task',
      title: task.title,
      subtitle: task.status,
      url: `/space/${task.departmentId || 'clickup'}/folder/${task.folderId}/task/${task.id}`,
    }))
  );
});
