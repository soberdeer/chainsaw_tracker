import { openProjectMultipartRequest, openProjectRequest } from './client.js';
import {
  findSeededListById,
  findSeededListByImportedDescription,
  findSeededListByProjectId,
  listOpenProjectProjectId,
  loadSeededHierarchy,
  openProjectStatusId,
  seededLists,
  type SeededTaskList,
} from './hierarchyStore.js';
import {
  mapActivity,
  mapStatus,
  mapUser,
  mapWorkPackage,
  mapWorkspace,
  priorityHref,
} from './mappers.js';
import type {
  HalCollection,
  OpenProjectActivity,
  OpenProjectAttachment,
  OpenProjectPriority,
  OpenProjectProject,
  OpenProjectRelation,
  OpenProjectStatus,
  OpenProjectTimeEntry,
  OpenProjectTimeEntryActivity,
  OpenProjectType,
  OpenProjectUser,
  OpenProjectWorkPackage,
} from './types.js';

type PageQuery = {
  offset?: number;
  limit?: number;
  status?: string;
  assignees?: string[];
  search?: string;
  priority?: string;
};

const relationTypes = new Set(['relates', 'blocks', 'blocked', 'precedes', 'follows']);
const reverseRelationTypes = new Set(['blockedBy']);

const hiddenRuntimeProjectKeys = new Set(['clickupimport', 'scrumproject', 'demoproject']);

function useSeededHierarchy() {
  return process.env.OPENPROJECT_USE_CLICKUP_HIERARCHY === 'true';
}

function projectRuntimeKey(value?: string | null) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isHiddenRuntimeProject(project: OpenProjectProject) {
  return (
    hiddenRuntimeProjectKeys.has(projectRuntimeKey(project.identifier)) ||
    hiddenRuntimeProjectKeys.has(projectRuntimeKey(project.name))
  );
}

function href(path: string) {
  return path;
}

function toStatusHref(statusId?: string) {
  const id = openProjectStatusId(statusId);
  return id ? href(`/api/v3/statuses/${id}`) : undefined;
}

function toUserHref(userId?: string) {
  return userId ? href(`/api/v3/users/${userId}`) : undefined;
}

function toMillisDate(value?: string | null) {
  if (!value) return undefined;
  return value.slice(0, 10);
}

function linkTail(href?: string | null) {
  return href?.split('/').filter(Boolean).at(-1);
}

function seededListSpaceId(
  seed: Awaited<ReturnType<typeof loadSeededHierarchy>>,
  list?: SeededTaskList
) {
  return seed?.spaces.find((space) =>
    space.folders.some((folder) => folder.taskLists.some((item) => item.id === list?.id))
  )?.id;
}

function matchesImportFilter(task: OpenProjectWorkPackage, list?: SeededTaskList) {
  if (!list?.importFilter) return true;
  const description = task.description?.raw || '';
  const spaceName = description.match(/^Space:\s*(.+)$/m)?.[1]?.trim();
  const listName = description.match(/^List:\s*(.+)$/m)?.[1]?.trim();
  return (
    (!list.importFilter.spaceName || list.importFilter.spaceName === spaceName) &&
    (!list.importFilter.listName || list.importFilter.listName === listName)
  );
}

export async function getProjects() {
  const page = await openProjectRequest<HalCollection<OpenProjectProject>>('/api/v3/projects', {
    query: { pageSize: 200 },
  });
  return (page._embedded?.elements || []).filter((project) => !isHiddenRuntimeProject(project));
}

export async function getStatuses() {
  const page = await openProjectRequest<HalCollection<OpenProjectStatus>>('/api/v3/statuses', {
    query: { pageSize: 200 },
  });
  return (page._embedded?.elements || [])
    .map((status) => mapStatus(status, 'openproject'))
    .sort((a, b) => a.position - b.position);
}

export async function getUsers() {
  const page = await openProjectRequest<HalCollection<OpenProjectUser>>('/api/v3/users', {
    query: { pageSize: 200 },
  });
  return (page._embedded?.elements || []).map(mapUser);
}

async function usersByHref() {
  const page = await openProjectRequest<HalCollection<OpenProjectUser>>('/api/v3/users', {
    query: { pageSize: 200 },
  });
  return new Map(
    (page._embedded?.elements || []).map((user) => [
      user._links.self.href || `/api/v3/users/${user.id}`,
      mapUser(user),
    ])
  );
}

export async function getWorkspaceTree() {
  const [projects, statuses, users] = await Promise.all([getProjects(), getStatuses(), getUsers()]);
  const seeded = useSeededHierarchy() ? await loadSeededHierarchy() : null;
  if (seeded) {
    return [
      {
        ...seeded,
        memberships: [
          {
            id: 'openproject:local-user',
            role: 'OWNER' as const,
            user: { id: 'local-user', email: 'owner@local.app', name: 'Workspace Owner' },
          },
          ...users
            .filter((user) => user.id !== 'local-user')
            .map((user) => ({ id: `openproject:${user.id}`, role: 'MEMBER' as const, user })),
        ],
        permissionSets: seeded.permissionSets.map((set) =>
          set.role === 'LEAD' || set.role === 'MEMBER' ? { ...set, manageTasks: false } : set
        ),
      },
    ];
  }
  return [mapWorkspace(projects, statuses, users)];
}

export async function createProject(input: {
  name: string;
  identifier?: string;
  description?: string;
  parentId?: string;
  public?: boolean;
}) {
  const identifier =
    input.identifier ||
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) ||
    `project-${Date.now()}`;
  return openProjectRequest<OpenProjectProject>('/api/v3/projects', {
    method: 'POST',
    body: {
      name: input.name,
      identifier,
      public: Boolean(input.public),
      description: { format: 'markdown', raw: input.description || 'Created from tracker UI.' },
      ...(input.parentId
        ? { _links: { parent: { href: `/api/v3/projects/${input.parentId}` } } }
        : {}),
    },
  });
}

export async function getTaskListOptions() {
  const seeded = useSeededHierarchy() ? await loadSeededHierarchy() : null;
  if (seeded) return seededLists(seeded);
  const [projects, statuses] = await Promise.all([getProjects(), getStatuses()]);
  return projects.map((project) => ({
    id: String(project.id),
    folderId: `${project.id}:work-packages`,
    name: project.name,
    icon: '✓',
    statuses: statuses.map((status) => ({ ...status, taskListId: String(project.id) })),
    _count: { tasks: 0 },
  }));
}

export async function getTaskStatuses(listId?: string) {
  const seeded = useSeededHierarchy() ? await loadSeededHierarchy() : null;
  if (seeded) {
    if (listId) return findSeededListById(seeded, listId)?.statuses || [];
    return seededLists(seeded).flatMap((list) => list.statuses);
  }
  return getStatuses();
}

export async function getTasks(projectId: string, query: PageQuery) {
  const seeded = useSeededHierarchy() ? await loadSeededHierarchy() : null;
  const seededList = findSeededListById(seeded, projectId);
  const openProjectProjectId = listOpenProjectProjectId(projectId);
  const offset = Math.max(1, Number(query.offset || 1));
  const pageSize = Math.max(1, Math.min(100, Number(query.limit || 50)));
  const users = await usersByHref();
  const page = await openProjectRequest<HalCollection<OpenProjectWorkPackage>>(
    `/api/v3/projects/${openProjectProjectId}/work_packages`,
    {
      query: {
        pageSize,
        offset,
        filters: JSON.stringify(await buildWorkPackageFilters(query)),
      },
    }
  );
  const items = (page._embedded?.elements || [])
    .filter((item) => matchesImportFilter(item, seededList))
    .map((item) => {
      const taskList = seededList || findSeededListByProjectId(seeded, openProjectProjectId);
      return mapWorkPackage(
        item,
        {
          projectId: openProjectProjectId,
          projectName: taskList?.name,
          taskList,
          folderId: taskList?.folderId,
          spaceId: seededListSpaceId(seeded, taskList),
        },
        users
      );
    });
  const total = Number(page.total || 0);
  const nextOffset = offset + pageSize;
  return {
    items: items.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    nextCursor: nextOffset <= total ? String(nextOffset) : null,
  };
}

export async function getTask(taskId: string) {
  const [workPackage, users, seeded, childPage] = await Promise.all([
    openProjectRequest<OpenProjectWorkPackage>(`/api/v3/work_packages/${taskId}`),
    usersByHref(),
    useSeededHierarchy() ? loadSeededHierarchy() : Promise.resolve(null),
    openProjectRequest<HalCollection<OpenProjectWorkPackage>>('/api/v3/work_packages', {
      query: {
        pageSize: 100,
        filters: JSON.stringify([
          { parent: { operator: '=', values: [taskId] } },
          { status: { operator: '*', values: [] } },
        ]),
      },
    }).catch(() => ({ _embedded: { elements: [] } })),
  ]);
  const projectId = workPackage._links.project?.href?.split('/').filter(Boolean).at(-1);
  const taskList =
    findSeededListByImportedDescription(seeded, workPackage.description?.raw || '') ||
    (projectId ? findSeededListByProjectId(seeded, projectId) : undefined);
  const spaceId = seededListSpaceId(seeded, taskList);
  const mapped = mapWorkPackage(
    workPackage,
    { projectId, projectName: taskList?.name, taskList, folderId: taskList?.folderId, spaceId },
    users
  );
  mapped.subtasks = (childPage._embedded?.elements || []).map((child) =>
    mapWorkPackage(
      child,
      { projectId, projectName: taskList?.name, taskList, folderId: taskList?.folderId, spaceId },
      users
    )
  );
  return mapped;
}

async function firstTaskType(projectId: string) {
  const page = await openProjectRequest<HalCollection<OpenProjectType>>(
    `/api/v3/projects/${projectId}/types`,
    { query: { pageSize: 100 } }
  );
  return (
    (page._embedded?.elements || []).find((type) => type.name.toLowerCase() === 'task') ||
    page._embedded?.elements?.[0]
  );
}

async function priorities() {
  const page = await openProjectRequest<HalCollection<OpenProjectPriority>>('/api/v3/priorities', {
    query: { pageSize: 100 },
  });
  return page._embedded?.elements || [];
}

export async function buildWorkPackageFilters(query: PageQuery) {
  const filters: Array<Record<string, { operator: string; values: string[] }>> = [];
  if (query.status) {
    const statusId = openProjectStatusId(query.status);
    if (statusId) filters.push({ status: { operator: '=', values: [statusId] } });
  } else {
    filters.push({ status: { operator: '*', values: [] } });
  }

  if (query.assignees?.length) {
    filters.push({ assignee: { operator: '=', values: query.assignees } });
  }

  if (query.priority) {
    const priorityItems = await priorities();
    const href = priorityHref(priorityItems, query.priority);
    const priorityId = linkTail(href);
    if (priorityId) filters.push({ priority: { operator: '=', values: [priorityId] } });
  }

  if (query.search?.trim()) {
    filters.push({ subject: { operator: '~', values: [query.search.trim()] } });
  }

  return filters;
}

function taskFilter(taskId: string) {
  return JSON.stringify([{ work_package: { operator: '=', values: [taskId] } }]);
}

function relationLinkId(relation: OpenProjectRelation, key: string) {
  const value = relation._links[key];
  return Array.isArray(value) ? value[0]?.href : value?.href;
}

function relationLinkTitle(relation: OpenProjectRelation, key: string) {
  const value = relation._links[key];
  return Array.isArray(value) ? value[0]?.title : value?.title;
}

function mapRelation(relation: OpenProjectRelation) {
  return {
    id: String(relation.id),
    type: relation.type,
    reverseType: relation.reverseType,
    fromId: linkTail(relationLinkId(relation, 'from')),
    fromTitle: relationLinkTitle(relation, 'from'),
    toId: linkTail(relationLinkId(relation, 'to')),
    toTitle: relationLinkTitle(relation, 'to'),
    description: relation.description,
  };
}

export async function getTaskRelations(taskId: string) {
  const page = await openProjectRequest<HalCollection<OpenProjectRelation>>(
    `/api/v3/work_packages/${taskId}/relations`,
    { query: { pageSize: 100 } }
  );
  return (page._embedded?.elements || []).map(mapRelation);
}

export async function createTaskRelation(
  taskId: string,
  input: { targetTaskId: string; type: string; description?: string }
) {
  if (taskId === input.targetTaskId) {
    const error = new Error('A task cannot be related to itself');
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }
  const isReverse = reverseRelationTypes.has(input.type);
  const type = isReverse ? 'blocks' : relationTypes.has(input.type) ? input.type : 'relates';
  const fromId = isReverse ? input.targetTaskId : taskId;
  const toId = isReverse ? taskId : input.targetTaskId;
  const relation = await openProjectRequest<OpenProjectRelation>(
    `/api/v3/work_packages/${fromId}/relations`,
    {
      method: 'POST',
      body: {
        type,
        description: input.description || undefined,
        _links: { to: { href: `/api/v3/work_packages/${toId}` } },
      },
    }
  );
  return mapRelation(relation);
}

export async function bulkUpdateTasks(
  taskIds: string[],
  input: {
    statusId?: string;
    priority?: string;
    assigneeIds?: string[];
  }
) {
  const results = [];
  for (const taskId of taskIds) {
    try {
      const task = await updateTask(taskId, input);
      results.push({ taskId, status: 'updated', task });
    } catch (error) {
      results.push({
        taskId,
        status: 'failed',
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    updated: results.filter((item) => item.status === 'updated').length,
    failed: results.filter((item) => item.status === 'failed').length,
    skipped: 0,
    results,
  };
}

export async function deleteTaskRelation(relationId: string) {
  await openProjectRequest<void>(`/api/v3/relations/${relationId}`, { method: 'DELETE' });
}

function durationToHours(value: string | number) {
  if (typeof value === 'number') return value;
  const hourMatch = value.match(/(\d+(?:\.\d+)?)H/);
  const minuteMatch = value.match(/(\d+(?:\.\d+)?)M/);
  return Number(hourMatch?.[1] || 0) + Number(minuteMatch?.[1] || 0) / 60;
}

function hoursToDuration(hours: number) {
  const safe = Math.max(0.01, hours);
  const wholeHours = Math.floor(safe);
  const minutes = Math.round((safe - wholeHours) * 60);
  return `PT${wholeHours ? `${wholeHours}H` : ''}${minutes ? `${minutes}M` : ''}`;
}

function mapTimeEntry(
  entry: OpenProjectTimeEntry,
  users = new Map<string, ReturnType<typeof mapUser>>()
) {
  const userHref = entry._links.user?.href || '';
  return {
    id: String(entry.id),
    hours: String(durationToHours(entry.hours)),
    spentOn: entry.spentOn,
    comment: entry.comment?.raw,
    user: users.get(userHref),
    activity: entry._links.activity?.title || undefined,
    createdAt: entry.createdAt,
  };
}

export async function getTaskTimeEntries(taskId: string) {
  const [page, users] = await Promise.all([
    openProjectRequest<HalCollection<OpenProjectTimeEntry>>('/api/v3/time_entries', {
      query: {
        pageSize: 100,
        filters: taskFilter(taskId),
        sortBy: JSON.stringify([['spent_on', 'desc']]),
      },
    }),
    usersByHref(),
  ]);
  const items = (page._embedded?.elements || []).map((entry) => mapTimeEntry(entry, users));
  return {
    items,
    totalHours: items.reduce((sum, entry) => sum + Number(entry.hours || 0), 0),
  };
}

async function firstTimeEntryActivity() {
  const page = await openProjectRequest<HalCollection<OpenProjectTimeEntryActivity>>(
    '/api/v3/time_entries/activities',
    { query: { pageSize: 100 } }
  );
  return page._embedded?.elements?.[0];
}

export async function addTaskTimeEntry(
  taskId: string,
  input: { hours: number; spentOn: string; comment?: string }
) {
  const activity = await firstTimeEntryActivity();
  const entry = await openProjectRequest<OpenProjectTimeEntry>('/api/v3/time_entries', {
    method: 'POST',
    body: {
      hours: hoursToDuration(input.hours),
      spentOn: input.spentOn,
      comment: { format: 'markdown', raw: input.comment || '' },
      _links: {
        workPackage: { href: `/api/v3/work_packages/${taskId}` },
        ...(activity ? { activity: { href: activity._links.self.href } } : {}),
      },
    },
  });
  const users = await usersByHref();
  return mapTimeEntry(entry, users);
}

function mapAttachment(attachment: OpenProjectAttachment) {
  return {
    id: String(attachment.id),
    fileName: attachment.fileName || attachment._links.self?.title || `Attachment ${attachment.id}`,
    fileSize: attachment.fileSize,
    contentType: attachment.contentType,
    description: attachment.description?.raw,
    downloadUrl:
      attachment._links.downloadLocation?.href || attachment._links.staticDownloadLocation?.href,
    createdAt: attachment.createdAt,
  };
}

export async function getTaskAttachments(taskId: string) {
  const workPackage = await openProjectRequest<OpenProjectWorkPackage>(
    `/api/v3/work_packages/${taskId}`,
    { query: { include: 'attachments' } }
  );
  const embedded = workPackage._embedded?.attachments?._embedded?.elements || [];
  if (embedded.length) return embedded.map(mapAttachment);
  const page = await openProjectRequest<HalCollection<OpenProjectAttachment>>(
    `/api/v3/work_packages/${taskId}/attachments`,
    { query: { pageSize: 100 } }
  ).catch(() => ({ _embedded: { elements: [] } }));
  return (page._embedded?.elements || []).map(mapAttachment);
}

export async function addTaskAttachment(
  taskId: string,
  file: Express.Multer.File,
  description?: string
) {
  const form = new FormData();
  form.set(
    'metadata',
    new Blob(
      [
        JSON.stringify({
          fileName: file.originalname,
          description: { format: 'plain', raw: description || '' },
        }),
      ],
      { type: 'application/json' }
    )
  );
  const fileBytes = file.buffer.buffer.slice(
    file.buffer.byteOffset,
    file.buffer.byteOffset + file.buffer.length
  ) as ArrayBuffer;
  form.set('file', new Blob([fileBytes], { type: file.mimetype }), file.originalname);
  const attachment = await openProjectMultipartRequest<OpenProjectAttachment>(
    `/api/v3/work_packages/${taskId}/attachments`,
    form
  );
  return mapAttachment(attachment);
}

function customFieldLabel(key: string) {
  return key.replace(/^customField/, 'Custom field ');
}

function customFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(customFieldValue).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    const item = value as { title?: unknown; name?: unknown; href?: unknown; raw?: unknown };
    return String(item.title || item.name || item.raw || item.href || JSON.stringify(value));
  }
  return String(value);
}

export async function getTaskCustomFields(taskId: string) {
  const workPackage = await openProjectRequest<OpenProjectWorkPackage>(
    `/api/v3/work_packages/${taskId}`
  );
  return Object.entries(workPackage)
    .filter(([key]) => /^customField\d+$/.test(key))
    .map(([key, value]) => ({
      key,
      label: customFieldLabel(key),
      value: customFieldValue(value),
      editable: true,
    }))
    .filter((item) => item.value);
}

export async function updateTaskCustomField(taskId: string, key: string, value: unknown) {
  if (!/^customField\d+$/.test(key)) {
    const error = new Error('Unsupported custom field key');
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }
  const existing = await openProjectRequest<OpenProjectWorkPackage>(
    `/api/v3/work_packages/${taskId}`
  );
  await openProjectRequest<OpenProjectWorkPackage>(`/api/v3/work_packages/${taskId}`, {
    method: 'PATCH',
    body: {
      lockVersion: existing.lockVersion,
      [key]: value,
    },
  });
  return getTaskCustomFields(taskId);
}

export async function createTask(
  projectId: string,
  input: {
    title: string;
    description?: string;
    statusId?: string;
    priority?: string;
    assigneeIds?: string[];
    parentId?: string;
    startDate?: string;
    dueDate?: string;
  }
) {
  const seeded = useSeededHierarchy() ? await loadSeededHierarchy() : null;
  const taskList = findSeededListById(seeded, projectId);
  const openProjectProjectId = listOpenProjectProjectId(projectId);
  const [type, priorityItems] = await Promise.all([
    firstTaskType(openProjectProjectId),
    priorities(),
  ]);
  const body: Record<string, unknown> = {
    subject: input.title,
    description: { format: 'markdown', raw: input.description || '' },
    _links: {
      type: { href: type?._links.self.href },
      ...(input.statusId ? { status: { href: toStatusHref(input.statusId) } } : {}),
      ...(priorityHref(priorityItems, input.priority)
        ? { priority: { href: priorityHref(priorityItems, input.priority) } }
        : {}),
      ...(input.assigneeIds?.[0] ? { assignee: { href: toUserHref(input.assigneeIds[0]) } } : {}),
      ...(input.assigneeIds?.[1]
        ? { responsible: { href: toUserHref(input.assigneeIds[1]) } }
        : {}),
      ...(input.parentId ? { parent: { href: `/api/v3/work_packages/${input.parentId}` } } : {}),
    },
  };
  if (input.startDate) body.startDate = toMillisDate(input.startDate);
  if (input.dueDate) body.dueDate = toMillisDate(input.dueDate);
  const created = await openProjectRequest<OpenProjectWorkPackage>(
    `/api/v3/projects/${openProjectProjectId}/work_packages`,
    { method: 'POST', body }
  );
  const users = await usersByHref();
  return mapWorkPackage(
    created,
    {
      projectId: openProjectProjectId,
      projectName: taskList?.name,
      taskList,
      folderId: taskList?.folderId,
    },
    users
  );
}

export async function updateTask(
  taskId: string,
  input: {
    title?: string;
    description?: string | null;
    statusId?: string;
    priority?: string;
    assigneeIds?: string[];
    startDate?: string | null;
    dueDate?: string | null;
  }
) {
  const [existing, priorityItems] = await Promise.all([
    openProjectRequest<OpenProjectWorkPackage>(`/api/v3/work_packages/${taskId}`),
    priorities(),
  ]);
  const links: Record<string, { href: string | null | undefined }> = {};
  if (input.statusId !== undefined) links.status = { href: toStatusHref(input.statusId) };
  const priority = priorityHref(priorityItems, input.priority);
  if (input.priority !== undefined) links.priority = { href: priority };
  if (input.assigneeIds !== undefined) {
    links.assignee = { href: toUserHref(input.assigneeIds[0]) || null };
    links.responsible = { href: toUserHref(input.assigneeIds[1]) || null };
  }
  const body: Record<string, unknown> = {
    lockVersion: existing.lockVersion,
    ...(input.title !== undefined ? { subject: input.title } : {}),
    ...(input.description !== undefined
      ? { description: { format: 'markdown', raw: input.description || '' } }
      : {}),
    ...(Object.keys(links).length ? { _links: links } : {}),
  };
  if (input.startDate !== undefined)
    body.startDate = input.startDate ? toMillisDate(input.startDate) : null;
  if (input.dueDate !== undefined)
    body.dueDate = input.dueDate ? toMillisDate(input.dueDate) : null;
  const updated = await openProjectRequest<OpenProjectWorkPackage>(
    `/api/v3/work_packages/${taskId}`,
    { method: 'PATCH', body }
  );
  const [users, seeded] = await Promise.all([
    usersByHref(),
    useSeededHierarchy() ? loadSeededHierarchy() : Promise.resolve(null),
  ]);
  const projectId = updated._links.project?.href?.split('/').filter(Boolean).at(-1);
  const taskList =
    findSeededListByImportedDescription(seeded, updated.description?.raw || '') ||
    (projectId ? findSeededListByProjectId(seeded, projectId) : undefined);
  return mapWorkPackage(
    updated,
    {
      projectId,
      projectName: taskList?.name,
      taskList,
      folderId: taskList?.folderId,
      spaceId: seededListSpaceId(seeded, taskList),
    },
    users
  );
}

export async function renameProject(projectId: string, input: { name: string }) {
  return openProjectRequest<OpenProjectProject>(`/api/v3/projects/${projectId}`, {
    method: 'PATCH',
    body: { name: input.name },
  });
}

export async function deleteTask(taskId: string) {
  await openProjectRequest<void>(`/api/v3/work_packages/${taskId}`, { method: 'DELETE' });
}

export async function duplicateTask(taskId: string) {
  const task = await getTask(taskId);
  return createTask(task.taskListId || task.departmentId || '', {
    title: `${task.title} copy`,
    description: task.description,
    statusId: task.statusId,
    priority: task.priority,
    assigneeIds: task.assignees.map((assignee) => assignee.id),
    startDate: task.startDate,
    dueDate: task.dueDate,
  });
}

export async function getTaskActivities(taskId: string, limit: number) {
  const page = await openProjectRequest<HalCollection<OpenProjectActivity>>(
    `/api/v3/work_packages/${taskId}/activities`,
    { query: { pageSize: limit } }
  );
  return (page._embedded?.elements || []).map((activity) => mapActivity(taskId, activity));
}

export async function addTaskComment(taskId: string, comment: string) {
  const activity = await openProjectRequest<OpenProjectActivity>(
    `/api/v3/work_packages/${taskId}/activities`,
    {
      method: 'POST',
      body: {
        comment: {
          raw: comment,
        },
      },
    }
  );
  return mapActivity(taskId, activity);
}

export async function searchTasks(query: string) {
  if (!query.trim()) return [];
  const [page, users, seeded] = await Promise.all([
    openProjectRequest<HalCollection<OpenProjectWorkPackage>>('/api/v3/work_packages', {
      query: {
        pageSize: 50,
        filters: JSON.stringify([
          { subject: { operator: '~', values: [query.trim()] } },
          { status: { operator: '*', values: [] } },
        ]),
      },
    }),
    usersByHref(),
    useSeededHierarchy() ? loadSeededHierarchy() : Promise.resolve(null),
  ]);
  return (page._embedded?.elements || []).slice(0, 50).map((item) => {
    const projectId = item._links.project?.href?.split('/').filter(Boolean).at(-1);
    const taskList = projectId ? findSeededListByProjectId(seeded, projectId) : undefined;
    return mapWorkPackage(
      item,
      {
        projectId,
        projectName: taskList?.name,
        taskList,
        folderId: taskList?.folderId,
        spaceId: seededListSpaceId(seeded, taskList),
      },
      users
    );
  });
}
