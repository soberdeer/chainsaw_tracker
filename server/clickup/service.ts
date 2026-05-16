import { clickUpRequest } from './client.js';
import {
  mapCommentActivity,
  mapFolder,
  mapFolderlessListFolder,
  mapSpace,
  mapTask,
  mapTeam,
  priorityToClickUp,
} from './mappers.js';
import type {
  ClickUpComment,
  ClickUpFolder,
  ClickUpList,
  ClickUpSpace,
  ClickUpTask,
  ClickUpTeam,
} from './types.js';

type PageQuery = {
  page?: number;
  limit?: number;
  status?: string;
  assignee?: string;
  assignees?: string[];
  search?: string;
  priority?: string;
};

function toMillis(value?: string | null) {
  if (!value) {
    return undefined;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? undefined : time;
}

export async function getTeams() {
  const payload = await clickUpRequest<{ teams: ClickUpTeam[] }>('/team');
  return payload.teams || [];
}

export async function getSpaces(teamId: string, archived = false) {
  const payload = await clickUpRequest<{ spaces: ClickUpSpace[] }>(`/team/${teamId}/space`, {
    query: { archived },
  });
  return payload.spaces || [];
}

export async function getFolders(spaceId: string, archived = false) {
  const payload = await clickUpRequest<{ folders: ClickUpFolder[] }>(`/space/${spaceId}/folder`, {
    query: { archived },
  });
  return payload.folders || [];
}

export async function getFolderlessLists(spaceId: string, archived = false) {
  const payload = await clickUpRequest<{ lists: ClickUpList[] }>(`/space/${spaceId}/list`, {
    query: { archived },
  });
  return payload.lists || [];
}

export async function getLists(folderId: string, archived = false) {
  const payload = await clickUpRequest<{ lists: ClickUpList[] }>(`/folder/${folderId}/list`, {
    query: { archived },
  });
  return payload.lists || [];
}

export async function getList(listId: string) {
  return clickUpRequest<ClickUpList>(`/list/${listId}`);
}

export async function getWorkspaceTree() {
  const teams = await getTeams();
  return await Promise.all(
    teams.map(async (team) => {
      const spaces = await getSpaces(team.id);
      const mappedSpaces = await Promise.all(
        spaces.map(async (space) => {
          const [folders, folderlessLists] = await Promise.all([
            getFolders(space.id).catch(() => []),
            getFolderlessLists(space.id).catch(() => []),
          ]);
          const mappedFolders = folders.map((folder) =>
            mapFolder(folder, space.id, space.statuses || [])
          );
          const folderless = mapFolderlessListFolder(space, folderlessLists);
          return mapSpace(space, folderless ? [...mappedFolders, folderless] : mappedFolders);
        })
      );
      return mapTeam(team, mappedSpaces);
    })
  );
}

export async function createSpace(
  teamId: string,
  input: { name: string; color?: string; private?: boolean }
) {
  return clickUpRequest<ClickUpSpace>(`/team/${teamId}/space`, {
    method: 'POST',
    body: {
      name: input.name,
      multiple_assignees: true,
      features: {},
      private: Boolean(input.private),
    },
  });
}

export async function updateSpace(
  spaceId: string,
  input: { name?: string; color?: string; private?: boolean }
) {
  return clickUpRequest<ClickUpSpace>(`/space/${spaceId}`, { method: 'PUT', body: input });
}

export async function createFolder(spaceId: string, input: { name: string }) {
  return clickUpRequest<ClickUpFolder>(`/space/${spaceId}/folder`, {
    method: 'POST',
    body: { name: input.name },
  });
}

export async function createList(parentId: string, input: { name: string; folderless?: boolean }) {
  const path = input.folderless ? `/space/${parentId}/list` : `/folder/${parentId}/list`;
  return clickUpRequest<ClickUpList>(path, { method: 'POST', body: { name: input.name } });
}

export async function getTasks(listId: string, query: PageQuery) {
  const page = Math.max(0, Number(query.page || 0));
  const payload = await clickUpRequest<{ tasks: ClickUpTask[] }>(`/list/${listId}/task`, {
    query: {
      archived: false,
      include_markdown_description: true,
      subtasks: true,
      page,
      order_by: 'updated',
      reverse: true,
      'statuses[]': query.status ? [query.status] : undefined,
      'assignees[]': query.assignees?.length
        ? query.assignees
        : query.assignee
          ? [query.assignee]
          : undefined,
    },
  });
  let tasks = (payload.tasks || []).map((task) => mapTask(task, { listId }));
  if (query.search) {
    const search = query.search.toLowerCase();
    tasks = tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(search) ||
        (task.description || '').toLowerCase().includes(search) ||
        (task.taskKey || '').toLowerCase().includes(search) ||
        task.id.toLowerCase().includes(search)
    );
  }
  if (query.priority) {
    tasks = tasks.filter((task) => task.priority === query.priority);
  }
  return {
    items: tasks.slice(0, query.limit || 100),
    nextCursor: tasks.length >= (query.limit || 100) ? String(page + 1) : null,
  };
}

export async function getTask(taskId: string) {
  const task = await clickUpRequest<ClickUpTask>(`/task/${taskId}`, {
    query: { include_markdown_description: true },
  });
  return mapTask(task);
}

export async function createTask(
  listId: string,
  input: {
    title: string;
    description?: string;
    statusId?: string;
    priority?: string;
    assigneeId?: string;
    assigneeIds?: string[];
    parentId?: string;
    startDate?: string;
    dueDate?: string;
  }
) {
  const assigneeIds = input.assigneeIds?.length
    ? input.assigneeIds
    : input.assigneeId
      ? [input.assigneeId]
      : [];
  const task = await clickUpRequest<ClickUpTask>(`/list/${listId}/task`, {
    method: 'POST',
    body: {
      name: input.title,
      markdown_description: input.description,
      status: input.statusId,
      priority: priorityToClickUp(input.priority),
      assignees: assigneeIds.length ? assigneeIds.map(Number) : undefined,
      parent: input.parentId,
      start_date: toMillis(input.startDate),
      due_date: toMillis(input.dueDate),
    },
  });
  return mapTask(task, { listId });
}

export async function updateTask(
  taskId: string,
  input: {
    title?: string;
    description?: string | null;
    statusId?: string;
    priority?: string;
    assigneeId?: string | null;
    assigneeIds?: string[];
    startDate?: string | null;
    dueDate?: string | null;
  }
) {
  const shouldUpdateAssignees = input.assigneeIds !== undefined || input.assigneeId !== undefined;
  const existing = shouldUpdateAssignees ? await getTask(taskId).catch(() => null) : null;
  const currentAssigneeIds = (
    existing?.assignees || (existing?.assignee ? [existing.assignee] : [])
  ).map((user) => Number(user.id));
  const nextAssigneeIds =
    input.assigneeIds !== undefined
      ? input.assigneeIds.map(Number)
      : input.assigneeId
        ? [Number(input.assigneeId)]
        : [];
  const task = await clickUpRequest<ClickUpTask>(`/task/${taskId}`, {
    method: 'PUT',
    body: {
      name: input.title,
      markdown_description: input.description === null ? '' : input.description,
      status: input.statusId,
      priority: priorityToClickUp(input.priority),
      assignees: shouldUpdateAssignees
        ? {
            add: nextAssigneeIds.filter((id) => !currentAssigneeIds.includes(id)),
            rem: currentAssigneeIds.filter((id) => !nextAssigneeIds.includes(id)),
          }
        : undefined,
      start_date: input.startDate === null ? null : toMillis(input.startDate),
      due_date: input.dueDate === null ? null : toMillis(input.dueDate),
    },
  });
  return mapTask(task);
}

export async function deleteTask(taskId: string) {
  await clickUpRequest<void>(`/task/${taskId}`, { method: 'DELETE' });
}

export async function duplicateTask(taskId: string) {
  const task = await getTask(taskId);
  if (!task.taskListId) {
    const error = new Error('Cannot duplicate a task without a ClickUp list');
    Object.assign(error, { statusCode: 400 });
    throw error;
  }
  return createTask(task.taskListId, {
    title: `${task.title} copy`,
    description: task.description,
    statusId: task.statusId,
    priority: task.priority,
    assigneeIds: task.assignees?.map((assignee) => assignee.id),
    startDate: task.startDate,
    dueDate: task.dueDate,
  });
}

export async function getTaskComments(taskId: string) {
  const payload = await clickUpRequest<{ comments: ClickUpComment[] }>(`/task/${taskId}/comment`);
  return mapCommentActivity(taskId, payload.comments || []);
}

export async function getTaskListOptions(workspaceId: string, teamId?: string) {
  const workspaces = await getWorkspaceTree();
  const workspace = workspaces.find((item) => item.id === workspaceId);
  return (
    workspace?.spaces.flatMap((space) =>
      space.folders
        .filter((folder) => !teamId || folder.id === teamId)
        .flatMap((folder) => folder.taskLists || [])
    ) || []
  );
}

export async function getStatuses(workspaceId: string, listId?: string) {
  const lists = await getTaskListOptions(workspaceId);
  return lists
    .filter((list) => !listId || list.id === listId)
    .flatMap((list) => list.statuses.map((status) => ({ ...status, taskListId: list.id })));
}

export async function searchTasks(query: string, workspaceId?: string) {
  if (!workspaceId || !query.trim()) {
    return [];
  }
  const lists = await getTaskListOptions(workspaceId);
  const limitedLists = lists.slice(0, 8);
  const pages = await Promise.all(
    limitedLists.map((list) =>
      getTasks(list.id, { search: query, limit: 10 }).catch(() => ({ items: [], nextCursor: null }))
    )
  );
  return pages.flatMap((page) => page.items).slice(0, 20);
}
