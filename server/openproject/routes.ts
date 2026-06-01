import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireCurrentUser } from '../services/auth.js';
import { openProjectRequest } from './client.js';
import * as docs from './documents.js';
import { loadSeededHierarchy } from './hierarchyStore.js';
import { requireOpenProjectProjectWrite, requireOpenProjectTaskWrite } from './permissions.js';
import * as service from './service.js';
import type { OpenProjectProject } from './types.js';

/**
 * Resolve a space ID (which may be a ClickUp space ID stored in the seeded
 * hierarchy) to the real OpenProject root-project ID so that docs operations
 * target the correct OP project tree.
 *
 * Strategy:
 *   1. Look up the space in the seeded hierarchy by ID.
 *   2. Pick the first task-list that carries a known OP project ID.
 *   3. Fetch that project from OP and follow its `parent` link – the parent
 *      is the space root OP project we need.
 *   4. If nothing resolves, return the original spaceId (it may already be a
 *      numeric OP project ID when seeded hierarchy is absent).
 */
async function resolveOpSpaceId(spaceId: string): Promise<string> {
  try {
    const seeded = await loadSeededHierarchy();
    if (seeded) {
      const space = seeded.spaces.find((s) => s.id === spaceId || s.clickupSpaceId === spaceId);
      if (space) {
        for (const folder of space.folders) {
          for (const list of folder.taskLists) {
            const opId = list.openProjectProjectId;
            if (!opId) continue;
            const proj = await openProjectRequest<OpenProjectProject>(`/api/v3/projects/${opId}`);
            const parentLink = Array.isArray(proj._links.parent)
              ? proj._links.parent[0]
              : proj._links.parent;
            const parentId = parentLink?.href?.split('/').filter(Boolean).at(-1);
            if (parentId) return parentId;
            return opId;
          }
        }
      }
    }
  } catch {
    /* fall through to identity */
  }
  return spaceId;
}

export const openProjectRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

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

openProjectRouter.get('/connection-status', async (_req, res) => {
  res.json(await service.getOpenProjectConnectionStatus());
});

openProjectRouter.get('/projects/:projectId/members', async (req, res) => {
  res.json(await service.getOpenProjectProjectMembers(req.params.projectId));
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

openProjectRouter.get('/task-types', async (req, res) => {
  const query = z.object({ listId: z.string().optional() }).parse(req.query);
  res.json(await service.getTaskTypes(query.listId));
});

openProjectRouter.get('/tags', async (_req, res) => {
  res.json(await service.getOpenProjectTags());
});

openProjectRouter.post('/tags', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z
    .object({
      workspaceId: z.string().optional(),
      name: z.string().min(1),
      color: z.string().optional(),
    })
    .parse(req.body);
  res.status(201).json(await service.createOpenProjectTag(body));
});

openProjectRouter.patch('/tags/:tagId', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z
    .object({
      name: z.string().min(1).optional(),
      color: z.string().optional(),
    })
    .parse(req.body);
  res.json(await service.updateOpenProjectTag(req.params.tagId, body));
});

openProjectRouter.delete('/tags/:tagId', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  await service.deleteOpenProjectTag(req.params.tagId);
  res.status(204).send();
});

openProjectRouter.get('/tasks', async (req, res) => {
  const query = z
    .object({
      workspaceId: z.string().optional(),
      listId: z.string().optional(),
      taskListId: z.string().optional(),
      statusId: z.string().optional(),
      assigneeIds: z.string().optional(),
      responsibleIds: z.string().optional(),
      typeIds: z.string().optional(),
      dueBefore: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      overdue: z
        .union([z.literal('true'), z.literal('false')])
        .optional()
        .transform((value) => value === 'true'),
      updatedSince: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      tagIds: z.string().optional(),
      hasGitHubPr: z
        .union([z.literal('true'), z.literal('false')])
        .optional()
        .transform((value) => value === 'true'),
      search: z.string().optional(),
      priority: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      cursor: z.string().optional(),
    })
    .parse(req.query);
  const projectId = query.listId || query.taskListId;
  if (!projectId && !query.workspaceId) {
    res.status(400).json({
      error: 'listId/projectId is required unless a workspace-wide task query is requested',
    });
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
      responsibles: query.responsibleIds
        ?.split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      typeIds: query.typeIds
        ?.split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      dueBefore: query.dueBefore,
      overdue: query.overdue,
      updatedSince: query.updatedSince,
      tagIds: query.tagIds
        ?.split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      hasGitHubPr: query.hasGitHubPr,
      search: query.search,
      priority: query.priority,
      limit: query.limit,
    })
  );
});

openProjectRouter.post('/board-order', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z
    .object({
      listId: z.string().min(1),
      orders: z
        .array(
          z.object({
            statusId: z.string().min(1),
            orderedTaskIds: z.array(z.string().min(1)),
          })
        )
        .min(1),
    })
    .parse(req.body);
  await service.saveBoardCardOrder(body.listId, body.orders);
  res.json({ ok: true });
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
      estimatedHours: z.coerce.number().nonnegative().nullable().optional(),
    })
    .parse(req.body);
  const task = await service.updateTask(req.params.taskId, body);

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
      activityId: z.string().optional(),
    })
    .parse(req.body);
  res.status(201).json(await service.addTaskTimeEntry(req.params.taskId, body));
});

openProjectRouter.get('/time-entry-activities', async (_req, res) => {
  res.json({ items: await service.getTimeEntryActivities() });
});

openProjectRouter.get('/tasks/:taskId/tags', async (req, res) => {
  res.json({ items: await service.getTaskTags(req.params.taskId) });
});

openProjectRouter.put('/tasks/:taskId/tags', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z.object({ tagIds: z.array(z.string()).default([]) }).parse(req.body);
  res.json({ items: await service.setTaskTags(req.params.taskId, body.tagIds) });
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

// ── Docs (Documentation work packages in a dedicated "Docs" child project) ────

openProjectRouter.get('/docs', async (req, res) => {
  const query = z.object({ folderId: z.string().min(1) }).parse(req.query);
  res.json({ items: await docs.getDocuments(query.folderId) });
});

openProjectRouter.get('/docs/:docId', async (req, res) => {
  res.json(await docs.getDocumentById(req.params.docId));
});

openProjectRouter.post('/docs', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z
    .object({
      folderId: z.string().min(1),
      spaceId: z.string().min(1),
      title: z.string().min(1),
      markdown: z.string().default(''),
    })
    .parse(req.body);
  res
    .status(201)
    .json(await docs.createDocument(body.folderId, body.spaceId, body.title, body.markdown));
});

openProjectRouter.post('/docs/ensure-folder', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z.object({ spaceId: z.string().min(1) }).parse(req.body);
  const opSpaceId = await resolveOpSpaceId(body.spaceId);
  const folderId = await docs.getOrCreateDocsProject(opSpaceId);
  res.json({ folderId });
});

openProjectRouter.patch('/docs/:docId', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  const body = z
    .object({
      title: z.string().min(1).optional(),
      markdown: z.string().optional(),
    })
    .parse(req.body);
  res.json(await docs.updateDocumentById(req.params.docId, body));
});

openProjectRouter.delete('/docs/:docId', async (req, res) => {
  await requireOpenProjectTaskWrite(req);
  await docs.deleteDocumentById(req.params.docId);
  res.status(204).send();
});

/**
 * Cache: OP root project ID → ClickUp space ID.
 * Built lazily on first search that encounters a doc result.
 */
const _opRootToClickUpSpace = new Map<string, string>();

async function buildOpRootSpaceMap(): Promise<void> {
  if (_opRootToClickUpSpace.size > 0) return;
  try {
    const seeded = await loadSeededHierarchy();
    if (!seeded) return;
    for (const space of seeded.spaces) {
      const clickUpSpaceId = space.clickupSpaceId || space.id;
      let mapped = false;
      for (const folder of space.folders) {
        for (const list of folder.taskLists) {
          if (!list.openProjectProjectId) continue;
          try {
            const proj = await openProjectRequest<OpenProjectProject>(
              `/api/v3/projects/${list.openProjectProjectId}`
            );
            const pLink = Array.isArray(proj._links.parent)
              ? proj._links.parent[0]
              : proj._links.parent;
            const rootId =
              pLink?.href?.split('/').filter(Boolean).at(-1) || list.openProjectProjectId;
            _opRootToClickUpSpace.set(rootId, clickUpSpaceId);
            mapped = true;
          } catch {
            /* skip */
          }
          break; // one list per folder
        }
        if (mapped) break;
      }
    }
  } catch {
    /* ignore */
  }
}

function projectParentLink(project: OpenProjectProject) {
  return Array.isArray(project._links.parent) ? project._links.parent[0] : project._links.parent;
}

async function resolveDocSearchSpaceId(task: { departmentId?: string; folderId?: string }) {
  await buildOpRootSpaceMap();

  if (task.departmentId) {
    const clickUpSpaceId = _opRootToClickUpSpace.get(task.departmentId);
    if (clickUpSpaceId) {
      return clickUpSpaceId;
    }
  }

  if (task.folderId) {
    try {
      const project = await openProjectRequest<OpenProjectProject>(
        `/api/v3/projects/${task.folderId}`
      );
      const rootId =
        projectParentLink(project)?.href?.split('/').filter(Boolean).at(-1) || task.folderId;
      const clickUpSpaceId = _opRootToClickUpSpace.get(rootId);
      if (clickUpSpaceId) {
        return clickUpSpaceId;
      }
    } catch {
      /* fall through */
    }
  }

  return task.departmentId || 'openproject';
}

openProjectRouter.get('/search', async (req, res) => {
  const query = z.object({ q: z.string().optional() }).parse(req.query);
  const tasks = await service.searchTasks(query.q || '');
  res.json(
    await Promise.all(
      tasks.map(async (task) => {
        const isDoc = task.type?.toLowerCase() === 'documentation';
        if (isDoc) {
          const clickUpSpaceId = await resolveDocSearchSpaceId(task);
          return {
            id: task.id,
            type: 'doc' as const,
            title: task.title,
            subtitle: 'Documentation',
            url: `/space/${clickUpSpaceId}/docs/${task.id}`,
          };
        }
        return {
          id: task.id,
          type: 'task' as const,
          title: task.title,
          subtitle: task.status,
          url: `/space/${task.departmentId || 'openproject'}/folder/${task.folderId}/task/${task.id}`,
        };
      })
    )
  );
});
