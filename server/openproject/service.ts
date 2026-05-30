import type { WorkspaceRole } from '../../src/lib/types.js';
import { prisma } from '../db.js';
import { ROLE_PERMISSIONS } from '../services/permissions.js';
import { computeTaskDevelopmentStatus } from '../services/taskDevelopment.js';
import { openProjectMultipartRequest, openProjectRequest, openProjectWebUrl } from './client.js';
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
  getOpenProjectRuntimeWorkspace,
  openProjectRuntimeWorkspaceSlug,
} from './localPermissions.js';
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
  responsibles?: string[];
  search?: string;
  priority?: string;
  typeIds?: string[];
  dueBefore?: string;
  overdue?: boolean;
  updatedSince?: string;
  tagIds?: string[];
  hasGitHubPr?: boolean;
};

function mapLocalUser(user: {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  source?: string | null;
  openProjectUserId?: string | null;
  openProjectLogin?: string | null;
  lastLoginAt?: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl || undefined,
    source: user.source || undefined,
    openProjectUserId: user.openProjectUserId || undefined,
    openProjectLogin: user.openProjectLogin || undefined,
    lastLoginAt: user.lastLoginAt?.toISOString(),
  };
}

function applyRuntimeWorkspaceState(
  workspace: Awaited<ReturnType<typeof mapWorkspace>>,
  runtimeWorkspace: Awaited<ReturnType<typeof getOpenProjectRuntimeWorkspace>> | null,
  openProjectUsers: Awaited<ReturnType<typeof getUsers>>
) {
  if (!runtimeWorkspace) {
    return {
      ...workspace,
      openProjectUsers,
    };
  }

  return {
    ...workspace,
    id: 'openproject',
    name: runtimeWorkspace.name,
    slug: runtimeWorkspace.slug,
    description: runtimeWorkspace.description || undefined,
    avatarUrl: runtimeWorkspace.avatarUrl || undefined,
    color: runtimeWorkspace.color || '#228be6',
    memberships: runtimeWorkspace.memberships.map((membership) => ({
      id: membership.id,
      role: membership.role,
      user: mapLocalUser(membership.user),
    })),
    permissionSets: Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => ({
      role: role as WorkspaceRole,
      manageWorkspace: Boolean(perms.manageWorkspace),
      manageSpaces: Boolean(perms.manageSpaces),
      manageDocs: Boolean(perms.manageDocs),
      manageTasks: Boolean(perms.manageTasks),
      inviteMembers: Boolean(perms.inviteMembers),
      manageIntegrations: Boolean(perms.manageIntegrations),
      manageImports: Boolean(perms.manageImports),
      viewReports: Boolean(perms.viewReports),
    })),
    openProjectUsers,
  };
}

const relationTypes = new Set(['relates', 'blocks', 'blocked', 'precedes', 'follows']);
const reverseRelationTypes = new Set(['blockedBy']);

const hiddenRuntimeProjectKeys = new Set(['clickupimport', 'scrumproject', 'demoproject']);

// Tags created by ClickUp import that should not be shown to users
const clickUpNoisyTagPatterns = [
  /^cl-[a-z0-9]+-\d+/i, // CL-PROTO-007, CL-ABC-123, etc.
  /^clickup.?import$/i, // "clickup import", "clickup-import"
  /^clickup$/i, // just "clickup"
  /^imported$/i, // bare "imported"
];

function isClickUpNoisyTag(name: string) {
  return clickUpNoisyTagPatterns.some((pattern) => pattern.test(name.trim()));
}

function useSeededHierarchy() {
  return process.env.OPENPROJECT_USE_CLICKUP_HIERARCHY === 'true';
}

function projectRuntimeKey(value?: string | null) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const defaultOpenProjectTagPalette = [
  { name: 'bug', color: '#e03131' },
  { name: 'feature', color: '#1971c2' },
  { name: 'art', color: '#9c36b5' },
  { name: 'audio', color: '#f08c00' },
  { name: 'level', color: '#2b8a3e' },
  { name: 'ui', color: '#5f3dc4' },
  { name: 'build', color: '#495057' },
  { name: 'playtest', color: '#0c8599' },
  { name: 'blocker', color: '#c2255c' },
  { name: 'polish', color: '#fab005' },
];

const localFilterPageScanSize = 100;
const localFilterMaxScan = Math.max(
  localFilterPageScanSize,
  Number(process.env.OPENPROJECT_LOCAL_FILTER_MAX_SCAN || 1000)
);

function normalizeOpenProjectTagName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function serializeOpenProjectTag(tag: { id: string; name: string; color: string }) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
  };
}

async function ensureDefaultOpenProjectTags(workspaceId: string) {
  await prisma.openProjectTag.createMany({
    data: defaultOpenProjectTagPalette.map((tag) => ({
      workspaceId,
      name: tag.name,
      normalizedName: normalizeOpenProjectTagName(tag.name),
      color: tag.color,
    })),
    skipDuplicates: true,
  });
}

function serializeGitHubRepository(repository: {
  id: string;
  workspaceId: string;
  owner: string;
  repo: string;
  defaultBranch: string;
}) {
  return {
    id: repository.id,
    workspaceId: repository.workspaceId,
    owner: repository.owner,
    repo: repository.repo,
    defaultBranch: repository.defaultBranch,
  };
}

function serializeGitHubPullRequest(
  pullRequest: Awaited<ReturnType<typeof prisma.gitHubPullRequest.findMany>>[number] & {
    repository: {
      id: string;
      workspaceId: string;
      owner: string;
      repo: string;
      defaultBranch: string;
    };
  }
) {
  return {
    id: pullRequest.id,
    repositoryId: pullRequest.repositoryId,
    taskId: pullRequest.taskId || undefined,
    workPackageId: pullRequest.workPackageId || undefined,
    number: pullRequest.number,
    title: pullRequest.title,
    url: pullRequest.url,
    state: pullRequest.state,
    draft: pullRequest.draft,
    isMerged: pullRequest.isMerged,
    baseBranch: pullRequest.baseBranch,
    headBranch: pullRequest.headBranch,
    headSha: pullRequest.headSha,
    authorLogin: pullRequest.authorLogin || undefined,
    reviewStatus: pullRequest.reviewStatus,
    syncedAt: pullRequest.syncedAt?.toISOString(),
    repository: serializeGitHubRepository(pullRequest.repository),
  };
}

function serializeGitHubBranch(
  branch: Awaited<ReturnType<typeof prisma.gitHubBranch.findMany>>[number] & {
    repository: {
      id: string;
      workspaceId: string;
      owner: string;
      repo: string;
      defaultBranch: string;
    };
  }
) {
  return {
    id: branch.id,
    repositoryId: branch.repositoryId,
    taskId: branch.taskId || undefined,
    workPackageId: branch.workPackageId || undefined,
    name: branch.name,
    lastCommitSha: branch.lastCommitSha || undefined,
    url: branch.url || undefined,
    repository: serializeGitHubRepository(branch.repository),
  };
}

export function matchesLocalTaskFilters(
  task: Awaited<ReturnType<typeof mapWorkPackage>>,
  query: PageQuery
) {
  if (query.overdue) {
    if (!task.dueDate) {
      return false;
    }
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!(dueDate < today)) {
      return false;
    }
  }

  if (query.dueBefore) {
    if (!task.dueDate) {
      return false;
    }
    if (new Date(task.dueDate) > new Date(query.dueBefore)) {
      return false;
    }
  }

  if (query.updatedSince) {
    if (!task.updatedAt) {
      return false;
    }
    if (new Date(task.updatedAt) < new Date(query.updatedSince)) {
      return false;
    }
  }

  if (query.tagIds?.length) {
    const tagIds = new Set(task.tags.map(({ tag }) => tag.id));
    if (!query.tagIds.every((tagId) => tagIds.has(tagId))) {
      return false;
    }
  }

  return !(query.hasGitHubPr && !(task.githubPullRequests || []).length);
}

function usesLocalTaskFiltering(query: PageQuery) {
  return Boolean(
    query.overdue ||
    query.dueBefore ||
    query.updatedSince ||
    query.tagIds?.length ||
    query.hasGitHubPr
  );
}

async function attachRuntimeMetadata(items: Awaited<ReturnType<typeof mapWorkPackage>>[]) {
  if (!items.length) {
    return items;
  }

  const workPackageIds = items.map((item) => item.id);
  const runtimeWorkspace = await getOpenProjectRuntimeWorkspace().catch(() => null);
  const [pullRequests, branches, workPackageTags, checklists] = await Promise.all([
    prisma.gitHubPullRequest.findMany({
      where: { workPackageId: { in: workPackageIds } },
      include: { repository: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.gitHubBranch.findMany({
      where: { workPackageId: { in: workPackageIds } },
      include: { repository: true },
      orderBy: { updatedAt: 'desc' },
    }),
    runtimeWorkspace
      ? prisma.openProjectWorkPackageTag.findMany({
          where: {
            workspaceId: runtimeWorkspace.id,
            workPackageId: { in: workPackageIds },
          },
          include: { tag: true },
          orderBy: { tag: { name: 'asc' } },
        })
      : Promise.resolve([]),
    runtimeWorkspace
      ? prisma.checklist
          .findMany({
            where: {
              workspaceId: runtimeWorkspace.id,
              workPackageId: { in: workPackageIds },
            },
            include: {
              items: true,
            },
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const prsByWorkPackageId = new Map<string, typeof pullRequests>();
  const branchesByWorkPackageId = new Map<string, typeof branches>();
  const tagsByWorkPackageId = new Map<string, typeof workPackageTags>();
  const checklistsByWorkPackageId = new Map<
    string,
    Array<{ items: Array<{ completed: boolean }> }>
  >();
  for (const pullRequest of pullRequests) {
    if (!pullRequest.workPackageId) {
      continue;
    }
    const bucket = prsByWorkPackageId.get(pullRequest.workPackageId) || [];
    bucket.push(pullRequest);
    prsByWorkPackageId.set(pullRequest.workPackageId, bucket);
  }
  for (const branch of branches) {
    if (!branch.workPackageId) {
      continue;
    }
    const bucket = branchesByWorkPackageId.get(branch.workPackageId) || [];
    bucket.push(branch);
    branchesByWorkPackageId.set(branch.workPackageId, bucket);
  }
  for (const workPackageTag of workPackageTags) {
    const bucket = tagsByWorkPackageId.get(workPackageTag.workPackageId) || [];
    bucket.push(workPackageTag);
    tagsByWorkPackageId.set(workPackageTag.workPackageId, bucket);
  }
  for (const checklist of checklists) {
    const bucket = checklistsByWorkPackageId.get(checklist.workPackageId) || [];
    bucket.push(checklist);
    checklistsByWorkPackageId.set(checklist.workPackageId, bucket);
  }

  return items.map((item) => {
    const githubPullRequests = (prsByWorkPackageId.get(item.id) || []).map(
      serializeGitHubPullRequest
    );
    const githubBranches = (branchesByWorkPackageId.get(item.id) || []).map(serializeGitHubBranch);
    const tags = (tagsByWorkPackageId.get(item.id) || [])
      .filter((wpt) => !isClickUpNoisyTag(wpt.tag.name))
      .map((workPackageTag) => ({
        tag: serializeOpenProjectTag(workPackageTag.tag),
      }));
    const checklists = checklistsByWorkPackageId.get(item.id) || [];
    const checklistSummary = checklists.length
      ? {
          completed: checklists.reduce(
            (sum, checklist) =>
              sum + checklist.items.filter((checklistItem) => checklistItem.completed).length,
            0
          ),
          total: checklists.reduce((sum, checklist) => sum + checklist.items.length, 0),
        }
      : null;
    return {
      ...item,
      tags,
      checklistSummary,
      githubPullRequests,
      githubBranches,
      developmentStatus: computeTaskDevelopmentStatus({
        status: item.status,
        githubPullRequests,
        githubBranches,
      }),
    };
  });
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

export async function findOpenProjectUserByEmail(email: string) {
  const page = await openProjectRequest<HalCollection<OpenProjectUser>>('/api/v3/users', {
    query: {
      pageSize: 200,
      filters: JSON.stringify([{ login: { operator: '~', values: [email] } }]),
    },
  });
  const users = page._embedded?.elements || [];
  // Exact email match (OP might return partial matches)
  return users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
}

export async function getOpenProjectConnectionStatus() {
  try {
    const [projectsPage, usersPage, runtimeWorkspace] = await Promise.all([
      openProjectRequest<HalCollection<OpenProjectProject>>('/api/v3/projects', {
        query: { pageSize: 1 },
      }),
      openProjectRequest<HalCollection<OpenProjectUser>>('/api/v3/users', {
        query: { pageSize: 1 },
      }),
      getOpenProjectRuntimeWorkspace(),
    ]);

    return {
      ok: true,
      baseUrl: process.env.OPENPROJECT_BASE_URL || 'http://localhost:8080',
      authMode: process.env.OPENPROJECT_AUTH_MODE === 'bearer' ? 'bearer' : 'basic',
      apiUser: null,
      projectsVisible: Number(projectsPage.total || projectsPage.count || 0),
      usersVisible: Number(usersPage.total || usersPage.count || 0),
      runtimeWorkspaceId: runtimeWorkspace?.id || null,
      lastImportReportId: runtimeWorkspace?.migrationRuns?.[0]?.id || null,
    };
  } catch (error) {
    return {
      ok: false,
      baseUrl: process.env.OPENPROJECT_BASE_URL || 'http://localhost:8080',
      authMode: process.env.OPENPROJECT_AUTH_MODE === 'bearer' ? 'bearer' : 'basic',
      apiUser: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
  const [projects, statuses, users, runtimeWorkspace] = await Promise.all([
    getProjects(),
    getStatuses(),
    getUsers(),
    getOpenProjectRuntimeWorkspace(),
  ]);
  const seeded = useSeededHierarchy() ? await loadSeededHierarchy() : null;
  if (seeded) {
    return [applyRuntimeWorkspaceState(seeded, runtimeWorkspace, users)];
  }
  return [
    applyRuntimeWorkspaceState(mapWorkspace(projects, statuses, users), runtimeWorkspace, users),
  ];
}

export async function getRuntimeWorkspaceSettings() {
  const runtimeWorkspace = await getOpenProjectRuntimeWorkspace().catch(() => null);
  if (!runtimeWorkspace) {
    const error = new Error(`Missing runtime workspace ${openProjectRuntimeWorkspaceSlug}`);
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }
  return runtimeWorkspace;
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
    folderId: String(project.id),
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

export async function getTaskTypes(listId?: string) {
  if (listId) {
    const openProjectProjectId = listOpenProjectProjectId(listId);
    const page = await openProjectRequest<HalCollection<OpenProjectType>>(
      `/api/v3/projects/${openProjectProjectId}/types`,
      { query: { pageSize: 100 } }
    );
    return (page._embedded?.elements || []).map((type) => ({
      id: String(type.id),
      name: type.name,
    }));
  }

  const page = await openProjectRequest<HalCollection<OpenProjectType>>('/api/v3/types', {
    query: { pageSize: 100 },
  });
  return (page._embedded?.elements || []).map((type) => ({
    id: String(type.id),
    name: type.name,
  }));
}

export async function getOpenProjectTags() {
  const runtimeWorkspace = await getRuntimeWorkspaceSettings();
  await ensureDefaultOpenProjectTags(runtimeWorkspace.id);
  const tags = await prisma.openProjectTag.findMany({
    where: { workspaceId: runtimeWorkspace.id },
    orderBy: { name: 'asc' },
  });
  return tags.map(serializeOpenProjectTag);
}

export async function createOpenProjectTag(input: { name: string; color?: string }) {
  const runtimeWorkspace = await getRuntimeWorkspaceSettings();
  const normalizedName = normalizeOpenProjectTagName(input.name);
  const name = input.name.trim().replace(/\s+/g, ' ');
  const tag = await prisma.openProjectTag.upsert({
    where: {
      workspaceId_normalizedName: {
        workspaceId: runtimeWorkspace.id,
        normalizedName,
      },
    },
    update: {
      name,
      color: input.color || undefined,
    },
    create: {
      workspaceId: runtimeWorkspace.id,
      name,
      normalizedName,
      color: input.color || '#868e96',
    },
  });
  return serializeOpenProjectTag(tag);
}

export async function updateOpenProjectTag(
  tagId: string,
  input: { name?: string; color?: string }
) {
  const runtimeWorkspace = await getRuntimeWorkspaceSettings();
  const existing = await prisma.openProjectTag.findFirstOrThrow({
    where: { id: tagId, workspaceId: runtimeWorkspace.id },
  });
  const nextName = input.name ? input.name.trim().replace(/\s+/g, ' ') : existing.name;
  const tag = await prisma.openProjectTag.update({
    where: { id: existing.id },
    data: {
      name: nextName,
      normalizedName: normalizeOpenProjectTagName(nextName),
      color: input.color || existing.color,
    },
  });
  return serializeOpenProjectTag(tag);
}

export async function deleteOpenProjectTag(tagId: string) {
  const runtimeWorkspace = await getRuntimeWorkspaceSettings();
  await prisma.openProjectTag.deleteMany({
    where: { id: tagId, workspaceId: runtimeWorkspace.id },
  });
}

export async function getTaskTags(taskId: string) {
  const runtimeWorkspace = await getRuntimeWorkspaceSettings();
  const tags = await prisma.openProjectWorkPackageTag.findMany({
    where: { workspaceId: runtimeWorkspace.id, workPackageId: taskId },
    include: { tag: true },
    orderBy: { tag: { name: 'asc' } },
  });
  return tags
    .filter((item) => !isClickUpNoisyTag(item.tag.name))
    .map((item) => serializeOpenProjectTag(item.tag));
}

export async function setTaskTags(taskId: string, tagIds: string[]) {
  const runtimeWorkspace = await getRuntimeWorkspaceSettings();
  const uniqueTagIds = [...new Set(tagIds.filter(Boolean))];
  const workPackage = await openProjectRequest<OpenProjectWorkPackage>(
    `/api/v3/work_packages/${taskId}`
  );
  const projectId = linkTail(workPackage._links.project?.href) || undefined;

  await prisma.$transaction(async (tx) => {
    await tx.openProjectWorkPackageTag.deleteMany({
      where: { workspaceId: runtimeWorkspace.id, workPackageId: taskId },
    });
    if (!uniqueTagIds.length) {
      return;
    }
    const validTags = await tx.openProjectTag.findMany({
      where: {
        workspaceId: runtimeWorkspace.id,
        id: { in: uniqueTagIds },
      },
      select: { id: true },
    });
    if (!validTags.length) {
      return;
    }
    await tx.openProjectWorkPackageTag.createMany({
      data: validTags.map((tag) => ({
        workspaceId: runtimeWorkspace.id,
        projectId,
        workPackageId: taskId,
        tagId: tag.id,
      })),
      skipDuplicates: true,
    });
  });

  return getTaskTags(taskId);
}

async function applyBoardOrder(taskListId: string, items: ReturnType<typeof mapWorkPackage>[]) {
  if (!items.length) {
    return items;
  }

  const runtimeWorkspace = await getOpenProjectRuntimeWorkspace();
  if (!runtimeWorkspace) {
    return items;
  }

  const rows = await prisma.openProjectBoardCardOrder.findMany({
    where: {
      workspaceId: runtimeWorkspace.id,
      taskListId,
      workPackageId: { in: items.map((item) => item.id) },
    },
    orderBy: { position: 'asc' },
  });
  if (!rows.length) {
    return items;
  }

  const rowByTaskId = new Map(
    rows
      .filter(
        (row) => items.find((item) => item.id === row.workPackageId)?.statusId === row.statusId
      )
      .map((row) => [row.workPackageId, row])
  );
  const originalIndex = new Map(items.map((item, index) => [item.id, index]));

  return [...items].sort((left, right) => {
    if ((left.statusId || '') !== (right.statusId || '')) {
      return (originalIndex.get(left.id) || 0) - (originalIndex.get(right.id) || 0);
    }

    const leftPosition = rowByTaskId.get(left.id)?.position;
    const rightPosition = rowByTaskId.get(right.id)?.position;
    if (leftPosition !== undefined || rightPosition !== undefined) {
      return (leftPosition ?? Number.MAX_SAFE_INTEGER) - (rightPosition ?? Number.MAX_SAFE_INTEGER);
    }

    return (left.position ?? 0) - (right.position ?? 0);
  });
}

export async function saveBoardCardOrder(
  taskListId: string,
  orders: Array<{ statusId: string; orderedTaskIds: string[] }>
) {
  const runtimeWorkspace = await getRuntimeWorkspaceSettings();
  const cleaned = orders
    .map((order) => ({
      statusId: order.statusId,
      orderedTaskIds: [...new Set(order.orderedTaskIds.filter(Boolean))],
    }))
    .filter((order) => order.statusId && order.orderedTaskIds.length);

  await prisma.$transaction(async (tx) => {
    for (const order of cleaned) {
      await tx.openProjectBoardCardOrder.deleteMany({
        where: {
          workspaceId: runtimeWorkspace.id,
          taskListId,
          workPackageId: { in: order.orderedTaskIds },
        },
      });

      await tx.openProjectBoardCardOrder.createMany({
        data: order.orderedTaskIds.map((workPackageId, position) => ({
          workspaceId: runtimeWorkspace.id,
          taskListId,
          statusId: order.statusId,
          workPackageId,
          position,
        })),
      });
    }
  });
}

/**
 * Given a flat list of mapped tasks, nest children under their parents.
 *
 * Tasks whose `parentId` references another task in the same page are removed
 * from the top-level array and placed inside their parent's `subtasks` list.
 * Tasks whose parent is not in the current page are kept at the top level so
 * they remain visible (e.g. when paginating).
 */
function nestSubtasks<T extends { id: string; parentId?: string; subtasks?: T[] }>(
  items: T[]
): T[] {
  const byId = new Map(items.map((t) => [t.id, t]));
  const topLevel: T[] = [];

  for (const item of items) {
    if (item.parentId && byId.has(item.parentId)) {
      const parent = byId.get(item.parentId)!;
      if (!parent.subtasks) (parent as { subtasks: T[] }).subtasks = [];
      (parent.subtasks as T[]).push(item);
    } else {
      topLevel.push(item);
    }
  }

  return topLevel;
}

export async function getTasks(projectId: string | undefined, query: PageQuery) {
  const seeded = useSeededHierarchy() ? await loadSeededHierarchy() : null;
  const seededList = projectId ? findSeededListById(seeded, projectId) : undefined;
  const openProjectProjectId = projectId ? listOpenProjectProjectId(projectId) : undefined;
  const offset = Math.max(1, Number(query.offset || 1));
  const pageSize = Math.max(1, Math.min(100, Number(query.limit || 50)));
  const applyLocalFilters = usesLocalTaskFiltering(query);
  const users = await usersByHref();
  const path = projectId
    ? `/api/v3/projects/${openProjectProjectId}/work_packages`
    : `/api/v3/work_packages`;
  const filters = JSON.stringify(await buildWorkPackageFilters(query));

  if (!applyLocalFilters) {
    const page = await openProjectRequest<HalCollection<OpenProjectWorkPackage>>(path, {
      query: {
        pageSize,
        offset,
        filters,
      },
    });
    const items = (page._embedded?.elements || [])
      .filter((item) => matchesImportFilter(item, seededList))
      .map((item) => {
        const itemProjectId = item._links.project?.href?.split('/').filter(Boolean).at(-1);
        const taskList =
          seededList ||
          (itemProjectId ? findSeededListByProjectId(seeded, itemProjectId) : undefined);
        return mapWorkPackage(
          item,
          {
            projectId: itemProjectId || openProjectProjectId,
            projectName: taskList?.name || item._links.project?.title || undefined,
            taskList,
            folderId: taskList?.folderId,
            spaceId: seededListSpaceId(seeded, taskList),
          },
          users
        );
      });
    const total = Number(page.total || 0);
    const nextOffset = offset + (page._embedded?.elements?.length || 0);
    const orderedItems = projectId ? await applyBoardOrder(projectId, items) : items;
    const enrichedItems = await attachRuntimeMetadata(orderedItems);
    return {
      items: nestSubtasks(enrichedItems),
      nextCursor: nextOffset <= total ? String(nextOffset) : null,
    };
  }

  let scanOffset = offset;
  let scannedCount = 0;
  let total = Number.POSITIVE_INFINITY;
  const matchedItems: Awaited<ReturnType<typeof mapWorkPackage>>[] = [];

  while (
    matchedItems.length < pageSize &&
    scannedCount < localFilterMaxScan &&
    scanOffset <= total
  ) {
    const currentPageSize = Math.min(localFilterPageScanSize, localFilterMaxScan - scannedCount);
    if (currentPageSize <= 0) {
      break;
    }

    const page = await openProjectRequest<HalCollection<OpenProjectWorkPackage>>(path, {
      query: {
        pageSize: currentPageSize,
        offset: scanOffset,
        filters,
      },
    });

    total = Number(page.total || 0);
    const rawItems = page._embedded?.elements || [];
    if (!rawItems.length) {
      break;
    }

    const mappedItems = rawItems
      .filter((item) => matchesImportFilter(item, seededList))
      .map((item) => {
        const itemProjectId = item._links.project?.href?.split('/').filter(Boolean).at(-1);
        const taskList =
          seededList ||
          (itemProjectId ? findSeededListByProjectId(seeded, itemProjectId) : undefined);
        return mapWorkPackage(
          item,
          {
            projectId: itemProjectId || openProjectProjectId,
            projectName: taskList?.name || item._links.project?.title || undefined,
            taskList,
            folderId: taskList?.folderId,
            spaceId: seededListSpaceId(seeded, taskList),
          },
          users
        );
      });
    const enrichedItems = await attachRuntimeMetadata(mappedItems);
    const taskById = new Map(enrichedItems.map((item) => [item.id, item]));

    for (const rawItem of rawItems) {
      const item = taskById.get(String(rawItem.id));
      scanOffset += 1;
      scannedCount += 1;

      if (!item) {
        continue;
      }

      if (!matchesLocalTaskFilters(item, query)) {
        continue;
      }

      matchedItems.push(item);
      if (matchedItems.length >= pageSize) {
        break;
      }
    }

    if (rawItems.length < currentPageSize) {
      break;
    }
  }

  const orderedItems = projectId ? await applyBoardOrder(projectId, matchedItems) : matchedItems;

  return {
    items: nestSubtasks(orderedItems.slice(0, pageSize)),
    nextCursor: scanOffset <= total ? String(scanOffset) : null,
  };
}

/**
 * Resolves the best seeded-list context for a work package.
 *
 * Priority:
 * 1. Seeded list identified by ClickUp import metadata in the description
 * 2. Seeded list whose `openProjectProjectId` matches the work-package's project directly
 * 3. Seeded list for the *parent* OP project (sub-projects are served by their parent's list)
 */
async function resolveSeededListForWorkPackage(
  seeded: Awaited<ReturnType<typeof loadSeededHierarchy>>,
  projectId: string | undefined,
  description: string
): Promise<SeededTaskList | undefined> {
  const byDesc = findSeededListByImportedDescription(seeded, description);
  if (byDesc) return byDesc;

  if (!projectId) return undefined;

  const direct = findSeededListByProjectId(seeded, projectId);
  if (direct) return direct;

  // Walk one level up the OP project hierarchy to handle sub-projects whose tasks
  // are served under a parent project's list (e.g. project 84 under project 82).
  try {
    const project = await openProjectRequest<{ _links: Record<string, { href?: string | null }> }>(
      `/api/v3/projects/${projectId}`
    );
    const parentId = linkTail(project._links.parent?.href);
    if (parentId) {
      return findSeededListByProjectId(seeded, parentId);
    }
  } catch {
    // ignore – fall through without parent resolution
  }

  return undefined;
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
  const taskList = await resolveSeededListForWorkPackage(
    seeded,
    projectId,
    workPackage.description?.raw || ''
  );
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
  const [enrichedTask, ...enrichedSubtasks] = await attachRuntimeMetadata([
    mapped,
    ...(mapped.subtasks || []),
  ]);
  enrichedTask.subtasks = enrichedSubtasks;
  return enrichedTask;
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

  if (query.responsibles?.length) {
    filters.push({ responsible: { operator: '=', values: query.responsibles } });
  }

  if (query.typeIds?.length) {
    filters.push({ type: { operator: '=', values: query.typeIds } });
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

function mapTimeEntryActivity(activity: OpenProjectTimeEntryActivity) {
  return {
    id: String(activity.id),
    name: activity.name,
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

export async function getTimeEntryActivities() {
  const page = await openProjectRequest<HalCollection<OpenProjectTimeEntryActivity>>(
    '/api/v3/time_entries/activities',
    { query: { pageSize: 100 } }
  );
  return (page._embedded?.elements || []).map(mapTimeEntryActivity);
}

export async function addTaskTimeEntry(
  taskId: string,
  input: { hours: number; spentOn: string; comment?: string; activityId?: string }
) {
  const activity = input.activityId
    ? { _links: { self: { href: `/api/v3/time_entries/activities/${input.activityId}` } } }
    : await firstTimeEntryActivity();
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

export function inferCustomFieldKind(value: unknown) {
  if (typeof value === 'boolean') return 'boolean' as const;
  if (typeof value === 'number')
    return Number.isInteger(value) ? ('integer' as const) : ('float' as const);
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date' as const;
    if (value.includes('\n') || value.length > 120) return 'textarea' as const;
    return 'text' as const;
  }
  return 'readonly' as const;
}

function customFieldRawValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return null;
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
      rawValue: customFieldRawValue(value),
      kind: inferCustomFieldKind(value),
      value: customFieldValue(value),
      editable: inferCustomFieldKind(value) !== 'readonly',
    }))
    .filter((item) => item.value || item.rawValue !== null);
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

function membershipRoles(membership: { _links: Record<string, unknown> }) {
  const value = membership._links.roles;
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .map((role) => {
      if (!role || typeof role !== 'object') return '';
      const typed = role as { title?: string | null; href?: string | null };
      return typed.title || linkTail(typed.href) || '';
    })
    .filter(Boolean);
}

export async function getOpenProjectProjectMembers(projectId: string) {
  const [membershipsPage, usersPage, projects] = await Promise.all([
    openProjectRequest<HalCollection<{ id: number; _links: Record<string, unknown> }>>(
      '/api/v3/memberships',
      {
        query: {
          pageSize: 1000,
          filters: JSON.stringify([{ project: { operator: '=', values: [projectId] } }]),
        },
      }
    ),
    openProjectRequest<HalCollection<OpenProjectUser>>('/api/v3/users', {
      query: { pageSize: 1000 },
    }),
    getProjects(),
  ]);

  const usersByHref = new Map(
    (usersPage._embedded?.elements || []).map((user) => [
      user._links.self.href || `/api/v3/users/${user.id}`,
      user,
    ])
  );
  const project = projects.find((item) => String(item.id) === String(projectId));

  const items = (membershipsPage._embedded?.elements || []).flatMap((membership) => {
    const principal = membership._links.principal;
    const principalLink =
      Array.isArray(principal) || !principal || typeof principal !== 'object'
        ? null
        : (principal as { href?: string | null; title?: string | null });
    const principalHref = principalLink?.href || null;
    const openProjectUser = principalHref ? usersByHref.get(principalHref) : undefined;
    if (!openProjectUser) return [];
    return [
      {
        membershipId: String(membership.id),
        openProjectUserId: String(openProjectUser.id),
        openProjectLogin: openProjectUser.login || undefined,
        openProjectName:
          openProjectUser.name || openProjectUser.login || String(openProjectUser.id),
        openProjectEmail: openProjectUser.email || undefined,
        avatarUrl: openProjectUser.avatar || undefined,
        roles: membershipRoles(membership),
      },
    ];
  });

  return {
    items,
    settingsUrl: project
      ? openProjectWebUrl(`/projects/${project.identifier}/settings`)
      : openProjectWebUrl(`/projects/${projectId}`),
  };
}

export async function getOpenProjectUserMemberships(openProjectUserId: string) {
  const [membershipsPage, projects] = await Promise.all([
    openProjectRequest<HalCollection<{ id: number; _links: Record<string, unknown> }>>(
      '/api/v3/memberships',
      {
        query: {
          pageSize: 1000,
          filters: JSON.stringify([{ principal: { operator: '=', values: [openProjectUserId] } }]),
        },
      }
    ),
    getProjects(),
  ]);
  const projectsById = new Map(projects.map((project) => [String(project.id), project]));

  return (membershipsPage._embedded?.elements || []).map((membership) => {
    const projectLink = membership._links.project;
    const projectInfo =
      Array.isArray(projectLink) || !projectLink || typeof projectLink !== 'object'
        ? null
        : (projectLink as { href?: string | null; title?: string | null });
    const projectId = linkTail(projectInfo?.href);
    const project = projectId ? projectsById.get(projectId) : undefined;
    return {
      membershipId: String(membership.id),
      projectId: projectId || '',
      projectName: project?.name || projectInfo?.title || 'OpenProject project',
      projectIdentifier: project?.identifier || undefined,
      roles: membershipRoles(membership),
      projectUrl: project
        ? openProjectWebUrl(`/projects/${project.identifier}`)
        : projectId
          ? openProjectWebUrl(`/projects/${projectId}`)
          : openProjectWebUrl('/projects'),
    };
  });
}

export async function getMyWorkSummary(openProjectUserId: string) {
  const [page, users] = await Promise.all([
    openProjectRequest<HalCollection<OpenProjectWorkPackage>>('/api/v3/work_packages', {
      query: {
        pageSize: 200,
        filters: JSON.stringify([
          { assignee: { operator: '=', values: [openProjectUserId] } },
          { status: { operator: '*', values: [] } },
        ]),
      },
    }),
    usersByHref(),
  ]);

  const items = (page._embedded?.elements || []).map((item) =>
    mapWorkPackage(item, undefined, users)
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return {
    assignedCount: items.length,
    overdueCount: items.filter((task) => task.dueDate && new Date(task.dueDate) < today).length,
    dueThisWeekCount: items.filter(
      (task) => task.dueDate && new Date(task.dueDate) >= today && new Date(task.dueDate) <= weekEnd
    ).length,
    recentlyUpdated: items
      .sort((a, b) => {
        const left = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const right = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return right - left;
      })
      .slice(0, 5),
  };
}

export async function createTask(
  projectId: string,
  input: {
    title: string;
    description?: string;
    statusId?: string;
    priority?: string | null;
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
    priority?: string | null;
    assigneeIds?: string[];
    startDate?: string | null;
    dueDate?: string | null;
    estimatedHours?: number | null;
  }
) {
  const [existing, priorityItems] = await Promise.all([
    openProjectRequest<OpenProjectWorkPackage>(`/api/v3/work_packages/${taskId}`),
    priorities(),
  ]);
  const links: Record<string, { href: string | null | undefined }> = {};
  if (input.statusId !== undefined) links.status = { href: toStatusHref(input.statusId) };
  // undefined → don't touch; null → clear (no href); string → set
  if (input.priority !== undefined) {
    links.priority = { href: input.priority ? priorityHref(priorityItems, input.priority) : null };
  }
  if (input.assigneeIds !== undefined) {
    links.assignee = { href: toUserHref(input.assigneeIds[0]) || null };
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
  if (input.estimatedHours !== undefined) {
    body.estimatedTime =
      input.estimatedHours === null ? null : hoursToDuration(Number(input.estimatedHours));
  }
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
    assigneeIds: task.assignee ? [task.assignee.id] : [],
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
