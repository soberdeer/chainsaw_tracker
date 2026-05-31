import type {
  ActivityLog,
  Folder,
  Space,
  Task,
  TaskList,
  TaskPriority,
  TaskStatus,
  TaskStatusType,
  User,
  Workspace,
  WorkspaceRole,
} from '../../src/lib/types.js';
import { ROLE_PERMISSIONS } from '../services/permissions.js';
import { extractTaskKey } from '../services/taskKeys.js';
import { openProjectWebUrl } from './client.js';
import { statusIdForOpenProjectStatus, type SeededTaskList } from './hierarchyStore.js';
import { extractTagsFromLinks, tagMetaFromName } from './tagsCustomField.js';
import type {
  OpenProjectActivity,
  OpenProjectPriority,
  OpenProjectProject,
  OpenProjectStatus,
  OpenProjectUser,
  OpenProjectWorkPackage,
} from './types.js';

function linkId(href?: string | null) {
  return href?.split('/').filter(Boolean).at(-1);
}

/** Colors for ClickUp-imported category tags (matches the default palette in service.ts) */
const CATEGORY_COLOR_PALETTE: Record<string, string> = {
  bug: '#e03131',
  feature: '#1971c2',
  art: '#9c36b5',
  audio: '#f08c00',
  level: '#2b8a3e',
  ui: '#5f3dc4',
  build: '#495057',
  playtest: '#0c8599',
  blocker: '#c2255c',
  polish: '#fab005',
};

export function categoryTitleToTag(title: string): {
  tag: { id: string; name: string; color: string };
} {
  const normalized = title.trim().toLowerCase().replace(/\s+/g, ' ');
  const color = CATEGORY_COLOR_PALETTE[normalized] || '#868e96';
  return { tag: { id: `category:${normalized}`, name: title.trim(), color } };
}

function link(project: OpenProjectProject, key: string) {
  const value = project._links[key];
  return Array.isArray(value) ? value[0] : value;
}

function priorityFromOpenProject(name?: string | null): TaskPriority | undefined {
  if (!name) return undefined;
  const value = name.toLowerCase();
  if (value.includes('immediate')) return 'URGENT';
  if (value.includes('high')) return 'HIGH';
  if (value.includes('low')) return 'LOW';
  if (value.includes('normal')) return 'NORMAL';
  return undefined;
}

export function parseDuration(iso: string | null | undefined): number | null {
  if (!iso) {
    return null;
  }
  const match = iso.match(/^P(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?)$/i);
  if (!match) {
    return null;
  }
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  return hours + minutes / 60;
}

export function priorityToOpenProjectName(priority?: string | null): string | undefined {
  if (priority === 'URGENT') return 'Immediate';
  if (priority === 'HIGH') return 'High';
  if (priority === 'NORMAL') return 'Normal';
  if (priority === 'LOW') return 'Low';
  return undefined;
}

export function mapUser(user: OpenProjectUser): User {
  return {
    id: String(user.id),
    email: user.email || user.login || `${user.id}@openproject.local`,
    name: user.name || user.login || String(user.id),
    avatarUrl: user.avatar,
    opAdmin: user.admin === true,
    opStatus: user.status,
  };
}

// Theme colors for each required status (Mantine palette tone 5).
// Used both here and in the seed script so colours are always consistent.
export const STATUS_THEME: Record<string, { color: string; type: TaskStatusType }> = {
  backlog: { color: '#adb5bd', type: 'open' },
  scoping: { color: '#339af0', type: 'prep' },
  'in progress': { color: '#cc5de8', type: 'progress' },
  'in testing': { color: '#22b8cf', type: 'test' },
  shipped: { color: '#51cf66', type: 'done' },
  closed: { color: '#adb5bd', type: 'closed' },
  'on hold': { color: '#fcc419', type: 'open' },
};

export function statusThemeColor(opName: string): string {
  return STATUS_THEME[opName.toLowerCase()]?.color ?? '#adb5bd';
}

export function statusThemeType(opName: string): TaskStatusType {
  return STATUS_THEME[opName.toLowerCase()]?.type ?? 'open';
}

export function mapStatus(status: OpenProjectStatus, taskListId: string): TaskStatus {
  return {
    id: String(status.id),
    taskListId,
    name: status.name,
    color: statusThemeColor(status.name),
    position: Number(status.position || status.id),
    isDone: Boolean(status.isClosed),
    statusType: statusThemeType(status.name),
  };
}

export function projectTaskList(project: OpenProjectProject, statuses: TaskStatus[]): TaskList {
  return {
    id: String(project.id),
    folderId: `${project.id}`,
    name: project.name,
    icon: '✓',
    statuses: statuses.map((status) => ({ ...status, taskListId: String(project.id) })),
    _count: { tasks: 0 },
  };
}

/**
 * Maps a child OP project to a Folder.
 * ID uses the same `{projectId}` scheme so it always matches the task
 * list's `folderId` and task records' `folderId` field.
 */
function mapProjectFolder(
  project: OpenProjectProject,
  statuses: TaskStatus[],
  spaceId: string,
  childFolders: Folder[] = []
): Folder {
  return {
    id: `${project.id}`,
    spaceId,
    name: project.name,
    kind: 'TEAM',
    locked: !project.public,
    taskLists: [projectTaskList(project, statuses)],
    folders: childFolders,
  };
}

export function mapProject(project: OpenProjectProject, statuses: TaskStatus[]): Space {
  return mapProjectTree(project, statuses, []);
}

export function mapProjectTree(
  project: OpenProjectProject,
  statuses: TaskStatus[],
  childFolders: Folder[] = []
): Space {
  // When the root project has child-project folders, expose those directly as
  // the space's top-level folders – no extra "Work packages" wrapper in between.
  // When there are no children, create a single folder using the project name
  // (not "Work packages") so the sidebar always shows a meaningful label.
  const folders: Folder[] =
    childFolders.length > 0
      ? childFolders
      : [
          {
            id: `${project.id}`,
            spaceId: String(project.id),
            name: project.name,
            kind: 'TEAM' as const,
            locked: !project.public,
            taskLists: [projectTaskList(project, statuses)],
          },
        ];

  return {
    id: String(project.id),
    workspaceId: 'openproject',
    name: project.name,
    description: project.identifier,
    color: '#228be6',
    initials: project.name.slice(0, 1).toUpperCase(),
    locked: !project.public,
    folders,
    documents: [],
  };
}

export function buildProjectSpaces(
  projects: OpenProjectProject[],
  statuses: TaskStatus[]
): Space[] {
  const byId = new Map(projects.map((project) => [String(project.id), project]));
  const children = new Map<string, OpenProjectProject[]>();
  const roots: OpenProjectProject[] = [];

  projects.forEach((project) => {
    const parentId = linkId(link(project, 'parent')?.href);
    if (parentId && byId.has(parentId)) {
      children.set(parentId, [...(children.get(parentId) || []), project]);
    } else {
      roots.push(project);
    }
  });

  const toFolder = (project: OpenProjectProject, spaceId: string): Folder =>
    mapProjectFolder(
      project,
      statuses,
      spaceId,
      (children.get(String(project.id)) || []).map((child) => toFolder(child, spaceId))
    );

  return roots.map((project) =>
    mapProjectTree(
      project,
      statuses,
      (children.get(String(project.id)) || []).map((child) => toFolder(child, String(project.id)))
    )
  );
}

export function mapWorkspace(
  projects: OpenProjectProject[],
  statuses: TaskStatus[],
  _users: User[]
): Workspace {
  return {
    id: 'openproject',
    name: 'OpenProject',
    slug: 'openproject',
    spaces: buildProjectSpaces(projects, statuses),
    memberships: [],
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
  };
}

export function mapWorkPackage(
  workPackage: OpenProjectWorkPackage,
  fallback?: {
    projectId?: string;
    projectName?: string;
    taskList?: SeededTaskList;
    folderId?: string;
    spaceId?: string;
  },
  usersByHref = new Map<string, User>(),
  tagsCfId?: number | null
): Task {
  const projectId = linkId(workPackage._links.project?.href) || fallback?.projectId || '';
  const taskListId = fallback?.taskList?.id || projectId;
  const folderId = fallback?.folderId || fallback?.taskList?.folderId || `${projectId}`;
  const rawStatusId = linkId(workPackage._links.status?.href) || '';
  const statusId = statusIdForOpenProjectStatus(fallback?.taskList, rawStatusId);
  const typeId = linkId(workPackage._links.type?.href) || undefined;
  const assigneeHref = workPackage._links.assignee?.href || undefined;
  const assigneeUser = assigneeHref ? usersByHref.get(assigneeHref) : undefined;
  const assignees = assigneeUser ? [assigneeUser] : [];
  const description = workPackage.description?.raw || '';
  return {
    id: String(workPackage.id),
    workspaceId: 'openproject',
    departmentId: fallback?.spaceId || projectId,
    teamId: folderId,
    listId: taskListId,
    folderId,
    taskListId,
    statusId,
    parentId: linkId(workPackage._links.parent?.href),
    title: workPackage.subject,
    description,
    status: workPackage._links.status?.title || 'New',
    priority: priorityFromOpenProject(workPackage._links.priority?.title),
    typeId,
    type: workPackage._links.type?.title || undefined,
    startDate: workPackage.startDate || undefined,
    dueDate: workPackage.dueDate || undefined,
    estimatedHours: parseDuration(workPackage.estimatedTime),
    remainingHours: parseDuration(workPackage.remainingTime),
    spentHours: parseDuration(workPackage.spentTime),
    externalSource: 'OPENPROJECT',
    externalId: String(workPackage.id),
    externalUrl: openProjectWebUrl(`/work_packages/${workPackage.id}`),
    sourceExternalId: String(workPackage.id),
    sourceUrl: openProjectWebUrl(`/work_packages/${workPackage.id}`),
    syncedAt: new Date().toISOString(),
    taskKey: extractTaskKey(workPackage.subject) || undefined,
    position: Number(workPackage.id),
    createdAt: workPackage.createdAt,
    updatedAt: workPackage.updatedAt,
    taskList: {
      id: taskListId,
      folderId,
      name: fallback?.projectName || workPackage._links.project?.title || 'OpenProject Project',
      icon: '✓',
      statuses: fallback?.taskList?.statuses || [],
    },
    folder: {
      id: folderId,
      spaceId: fallback?.spaceId || projectId,
      name: fallback?.projectName || workPackage._links.project?.title || 'Work packages',
    },
    statusRef: statusId
      ? {
          id: statusId,
          taskListId,
          name:
            fallback?.taskList?.statuses.find((status) => status.id === statusId)?.name ||
            workPackage._links.status?.title ||
            'New',
          color: '#868e96',
          position: Number(rawStatusId),
          isDone: false,
        }
      : undefined,
    assignee: assignees[0],
    assignees,
    tags: tagsCfId
      ? extractTagsFromLinks(workPackage._links as Record<string, unknown>, tagsCfId).map(
          ({ id, name }) => {
            const meta = tagMetaFromName(name);
            return { tag: { id, name, ...meta } };
          }
        )
      : workPackage._links.category?.title
        ? [categoryTitleToTag(workPackage._links.category.title)]
        : [],
    subtasks: [],
    dependencies: [],
    dependents: [],
    githubBranches: [],
    githubPullRequests: [],
    activityLogs: [],
  };
}

export function mapActivity(workPackageId: string, activity: OpenProjectActivity): ActivityLog {
  const message =
    activity.comment?.raw ||
    activity.details
      ?.map((detail) => detail.raw)
      .filter(Boolean)
      .join('\n') ||
    '';
  return {
    id: String(activity.id),
    taskId: workPackageId,
    type: 'OPENPROJECT_ACTIVITY',
    message,
    createdAt: activity.createdAt,
  };
}

export function priorityHref(priorities: OpenProjectPriority[], priority?: string | null) {
  const name = priorityToOpenProjectName(priority);
  if (!name) return undefined;
  return priorities.find((item) => item.name.toLowerCase() === name.toLowerCase())?._links.self
    .href;
}
