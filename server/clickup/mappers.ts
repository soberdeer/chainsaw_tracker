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
import type {
  ClickUpFolder,
  ClickUpList,
  ClickUpSpace,
  ClickUpStatus,
  ClickUpTask,
  ClickUpTeam,
  ClickUpUser,
} from './types.js';

function fromMillis(value?: string | null) {
  if (!value) {
    return undefined;
  }
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function priorityFromClickUp(value: unknown): TaskPriority {
  const id =
    typeof value === 'object' && value && 'id' in value
      ? Number((value as { id?: unknown }).id)
      : Number(value);
  if (id === 1) {
    return 'URGENT';
  }
  if (id === 2) {
    return 'HIGH';
  }
  if (id === 4) {
    return 'LOW';
  }
  return 'NORMAL';
}

export function priorityToClickUp(priority?: string) {
  if (priority === 'URGENT') {
    return 1;
  }
  if (priority === 'HIGH') {
    return 2;
  }
  if (priority === 'LOW') {
    return 4;
  }
  if (priority === 'NORMAL') {
    return 3;
  }
  return undefined;
}

export function mapUser(user: ClickUpUser): User {
  return {
    id: String(user.id),
    email: user.email || `${user.id}@clickup.local`,
    name: user.username || user.email || String(user.id),
    avatarUrl: user.profilePicture,
  };
}

export function mapStatus(status: ClickUpStatus, taskListId: string): TaskStatus {
  return {
    id: status.status,
    taskListId,
    name: status.status,
    color: status.color || '#868e96',
    position: Number(status.orderindex || 0),
    isDone: status.type === 'closed' || status.type === 'done',
  };
}

function fallbackStatuses(taskListId: string): TaskStatus[] {
  return [
    { id: 'to do', taskListId, name: 'to do', color: '#868e96', position: 0, isDone: false },
    {
      id: 'in progress',
      taskListId,
      name: 'in progress',
      color: '#3b82f6',
      position: 1,
      isDone: false,
    },
    { id: 'complete', taskListId, name: 'complete', color: '#4d9f87', position: 2, isDone: true },
  ];
}

export function mapList(
  list: ClickUpList,
  folderId: string,
  inheritedStatuses: ClickUpStatus[] = []
): TaskList {
  const statuses = (list.statuses?.length ? list.statuses : inheritedStatuses)
    .map((status) => mapStatus(status, list.id))
    .sort((a, b) => a.position - b.position);
  return {
    id: list.id,
    folderId,
    name: list.name,
    icon: '☣',
    statuses: statuses.length ? statuses : fallbackStatuses(list.id),
    _count: { tasks: Number(list.task_count || 0) },
  };
}

export function mapFolder(
  folder: ClickUpFolder,
  spaceId: string,
  inheritedStatuses: ClickUpStatus[] = []
): Folder {
  return {
    id: folder.id,
    spaceId,
    name: folder.name,
    kind: 'TEAM',
    locked: false,
    taskLists: (folder.lists || []).map((list) =>
      mapList(list, folder.id, list.statuses || folder.statuses || inheritedStatuses)
    ),
  };
}

export function mapFolderlessListFolder(space: ClickUpSpace, lists: ClickUpList[]): Folder | null {
  if (!lists.length) {
    return null;
  }
  return {
    id: `${space.id}:folderless`,
    spaceId: space.id,
    name: 'Folderless lists',
    kind: 'TEAM',
    locked: false,
    taskLists: lists.map((list) =>
      mapList(list, `${space.id}:folderless`, list.statuses || space.statuses || [])
    ),
  };
}

export function mapSpace(space: ClickUpSpace, folders: Folder[] = []): Space {
  return {
    id: space.id,
    workspaceId: '',
    name: space.name,
    color: space.color || '#4c6ef5',
    initials: space.name.slice(0, 1).toUpperCase(),
    locked: Boolean(space.private),
    folders,
    documents: [],
  };
}

export function mapTeam(team: ClickUpTeam, spaces: Space[]): Workspace {
  const users = (team.members || []).map((member) => mapUser(member.user));
  return {
    id: team.id,
    name: team.name,
    slug: `clickup-${team.id}`,
    spaces: spaces.map((space) => ({ ...space, workspaceId: team.id })),
    memberships: users.map((user) => ({ id: `${team.id}:${user.id}`, role: 'MEMBER', user })),
    permissionSets: [
      {
        role: 'OWNER',
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: true,
        manageTasks: true,
        inviteMembers: true,
      },
      {
        role: 'ADMIN',
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: true,
        manageTasks: true,
        inviteMembers: true,
      },
      {
        role: 'LEAD',
        manageWorkspace: false,
        manageSpaces: false,
        manageDocs: false,
        manageTasks: true,
        inviteMembers: false,
      },
      {
        role: 'MEMBER',
        manageWorkspace: false,
        manageSpaces: false,
        manageDocs: false,
        manageTasks: true,
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

export function mapTask(
  task: ClickUpTask,
  fallback?: { listId?: string; folderId?: string; spaceId?: string }
): Task {
  const listId = task.list?.id || fallback?.listId || '';
  const folderId =
    task.folder?.id ||
    fallback?.folderId ||
    `${task.space?.id || fallback?.spaceId || 'clickup'}:folderless`;
  const statusName = task.status?.status || 'to do';
  const assignees = (task.assignees || []).map(mapUser);
  const assignee = assignees[0];
  return {
    id: task.id,
    workspaceId: undefined,
    departmentId: task.space?.id || fallback?.spaceId,
    teamId: folderId,
    listId,
    folderId,
    taskListId: listId,
    statusId: statusName,
    parentId: task.parent || undefined,
    title: task.name,
    description: task.markdown_description || task.description || task.text_content || '',
    status: statusName,
    priority: priorityFromClickUp(task.priority),
    startDate: fromMillis(task.start_date),
    dueDate: fromMillis(task.due_date),
    externalSource: 'CLICKUP',
    externalId: task.id,
    externalUrl: task.url,
    sourceExternalId: task.custom_id || task.id,
    sourceUrl: task.url,
    taskKey: task.custom_id || undefined,
    position: 0,
    createdAt: fromMillis(task.date_created),
    updatedAt: fromMillis(task.date_updated),
    syncedAt: new Date().toISOString(),
    taskList: listId
      ? {
          id: listId,
          folderId,
          name: task.list?.name || 'ClickUp List',
          icon: '☣',
          statuses: task.status ? [mapStatus(task.status, listId)] : [],
        }
      : undefined,
    folder: {
      id: folderId,
      spaceId: task.space?.id || fallback?.spaceId || '',
      name: task.folder?.name || 'ClickUp Folder',
    },
    statusRef: task.status ? mapStatus(task.status, listId) : undefined,
    assignee,
    assignees,
    tags: (task.tags || []).map((tag) => ({
      tag: { id: tag.name, name: tag.name, color: tag.tag_bg || tag.tag_fg || '#7048e8' },
    })),
    subtasks: (task.subtasks || []).map((subtask) =>
      mapTask(subtask, { listId, folderId, spaceId: task.space?.id || fallback?.spaceId })
    ),
    dependencies: [],
    dependents: [],
    githubBranches: [],
    githubPullRequests: [],
    activityLogs: [],
  };
}

export function mapCommentActivity(
  taskId: string,
  comments: Array<{ id: string; comment_text?: string; date?: string; user?: ClickUpUser }>
): ActivityLog[] {
  return comments.map((comment) => ({
    id: comment.id,
    taskId,
    type: 'CLICKUP_COMMENT',
    message: comment.comment_text || '',
    createdAt: fromMillis(comment.date) || new Date().toISOString(),
  }));
}
