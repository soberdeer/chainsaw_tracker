import { Router } from 'express';
import { z } from 'zod';
import { requireOpenProjectProjectWrite, requireOpenProjectTaskWrite } from './permissions.js';
import * as service from './service.js';

export const openProjectRouter = Router();

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
  const body = z.object({ name: z.string().min(1) }).parse(req.body);
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
  res.status(201).json(await service.createTask(projectId, body));
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
  res.json(await service.updateTask(req.params.taskId, body));
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
