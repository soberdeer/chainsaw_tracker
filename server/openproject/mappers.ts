import type {
  ActivityLog,
  Folder,
  Space,
  Task,
  TaskList,
  TaskPriority,
  TaskStatus,
  User,
  Workspace,
} from '../../src/lib/types.js';
import { extractTaskKey } from '../services/taskKeys.js';
import { openProjectWebUrl } from './client.js';
import { statusIdForOpenProjectStatus, type SeededTaskList } from './hierarchyStore.js';
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

function link(project: OpenProjectProject, key: string) {
  const value = project._links[key];
  return Array.isArray(value) ? value[0] : value;
}

function priorityFromOpenProject(name?: string | null): TaskPriority {
  const value = (name || '').toLowerCase();
  if (value.includes('immediate')) return 'URGENT';
  if (value.includes('high')) return 'HIGH';
  if (value.includes('low')) return 'LOW';
  return 'NORMAL';
}

export function priorityToOpenProjectName(priority?: string) {
  if (priority === 'URGENT') return 'Immediate';
  if (priority === 'HIGH') return 'High';
  if (priority === 'LOW') return 'Low';
  return 'Normal';
}

export function mapUser(user: OpenProjectUser): User {
  return {
    id: String(user.id),
    email: user.email || user.login || `${user.id}@openproject.local`,
    name: user.name || user.login || String(user.id),
    avatarUrl: user.avatar,
  };
}

export function mapStatus(status: OpenProjectStatus, taskListId: string): TaskStatus {
  return {
    id: String(status.id),
    taskListId,
    name: status.name,
    color: status.isClosed
      ? '#4d9f87'
      : status.name.toLowerCase().includes('progress')
        ? '#228be6'
        : '#868e96',
    position: Number(status.position || status.id),
    isDone: Boolean(status.isClosed),
  };
}

export function projectTaskList(project: OpenProjectProject, statuses: TaskStatus[]): TaskList {
  return {
    id: String(project.id),
    folderId: `${project.id}:work-packages`,
    name: 'Work packages',
    icon: '✓',
    statuses: statuses.map((status) => ({ ...status, taskListId: String(project.id) })),
    _count: { tasks: 0 },
  };
}

function mapProjectFolder(
  project: OpenProjectProject,
  statuses: TaskStatus[],
  spaceId: string,
  childFolders: Folder[] = []
): Folder {
  return {
    id: `${project.id}:project`,
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
  const ownList = projectTaskList(project, statuses);
  const ownFolder: Folder = {
    id: `${project.id}:work-packages`,
    spaceId: String(project.id),
    name: 'Work packages',
    kind: 'TEAM',
    locked: !project.public,
    taskLists: [ownList],
  };
  return {
    id: String(project.id),
    workspaceId: 'openproject',
    name: project.name,
    description: project.identifier,
    color: '#228be6',
    initials: project.name.slice(0, 1).toUpperCase(),
    locked: !project.public,
    folders: [ownFolder, ...childFolders],
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
  users: User[]
): Workspace {
  return {
    id: 'openproject',
    name: 'OpenProject',
    slug: 'openproject',
    spaces: buildProjectSpaces(projects, statuses),
    memberships: [
      {
        id: 'openproject:local-user',
        role: 'OWNER',
        user: { id: 'local-user', email: 'owner@local.app', name: 'Workspace Owner' },
      },
      ...users
        .filter((user) => user.id !== 'local-user')
        .map((user) => ({ id: `openproject:${user.id}`, role: 'MEMBER' as const, user })),
    ],
    permissionSets: [
      {
        role: 'OWNER',
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: false,
        manageTasks: true,
        inviteMembers: false,
      },
      {
        role: 'ADMIN',
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: false,
        manageTasks: true,
        inviteMembers: false,
      },
      {
        role: 'LEAD',
        manageWorkspace: false,
        manageSpaces: false,
        manageDocs: false,
        manageTasks: false,
        inviteMembers: false,
      },
      {
        role: 'MEMBER',
        manageWorkspace: false,
        manageSpaces: false,
        manageDocs: false,
        manageTasks: false,
        inviteMembers: false,
      },
      {
        role: 'VIEWER',
        manageWorkspace: false,
        manageSpaces: false,
        manageDocs: false,
        manageTasks: false,
        inviteMembers: false,
      },
    ],
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
  usersByHref = new Map<string, User>()
): Task {
  const projectId = linkId(workPackage._links.project?.href) || fallback?.projectId || '';
  const taskListId = fallback?.taskList?.id || projectId;
  const folderId =
    fallback?.folderId || fallback?.taskList?.folderId || `${projectId}:work-packages`;
  const rawStatusId = linkId(workPackage._links.status?.href) || '';
  const statusId = statusIdForOpenProjectStatus(fallback?.taskList, rawStatusId);
  const assigneeHref = workPackage._links.assignee?.href || undefined;
  const responsibleHref = workPackage._links.responsible?.href || undefined;
  const assignees = [assigneeHref, responsibleHref]
    .filter((href): href is string => Boolean(href))
    .map((href) => usersByHref.get(href))
    .filter((user): user is User => Boolean(user));
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
    startDate: workPackage.startDate || undefined,
    dueDate: workPackage.dueDate || undefined,
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
    folder: { id: folderId, spaceId: fallback?.spaceId || projectId, name: 'Work packages' },
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
    tags: [],
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

export function priorityHref(priorities: OpenProjectPriority[], priority?: string) {
  const name = priorityToOpenProjectName(priority);
  return priorities.find((item) => item.name.toLowerCase() === name.toLowerCase())?._links.self
    .href;
}
