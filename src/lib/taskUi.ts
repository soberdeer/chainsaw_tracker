import type {
  Folder,
  Space,
  Task,
  TaskList,
  TaskPriority,
  TaskStatus,
  Workspace,
} from './types.js';

// Matches exactly the statuses set up in OpenProject via setup-openproject.ts.
export const statusMeta: Record<
  string,
  { label: string; color: string; tone: string; type: string }
> = {
  backlog: { label: 'Backlog', color: '#adb5bd', tone: 'gray', type: 'open' }, // gray-5
  scoping: { label: 'Scoping', color: '#339af0', tone: 'blue', type: 'prep' }, // blue-5
  'in progress': { label: 'In progress', color: '#cc5de8', tone: 'grape', type: 'progress' }, // grape-5
  'in testing': { label: 'In Testing', color: '#22b8cf', tone: 'cyan', type: 'test' }, // cyan-5
  shipped: { label: 'Shipped', color: '#51cf66', tone: 'green', type: 'done' }, // green-5
  closed: { label: 'Closed', color: '#adb5bd', tone: 'gray', type: 'closed' }, // gray-5
  'on hold': { label: 'On Hold', color: '#fcc419', tone: 'yellow', type: 'open' }, // yellow-5
};

export const priorityColorMap: Record<TaskPriority, string> = {
  LOW: 'gray',
  NORMAL: 'blue',
  HIGH: 'orange',
  URGENT: 'red',
};

export function priorityColor(priority?: TaskPriority | null): string | undefined {
  if (!priority) return undefined;
  return priorityColorMap[priority];
}

export function firstTaskFolder(space?: Space) {
  return findFirstTaskFolder(space?.folders || []) || space?.folders[0];
}

export function firstTaskList(folder?: Folder) {
  return folder?.taskLists?.[0] || findFirstTaskList(folder?.folders || []);
}

function findFirstTaskFolder(folders: Folder[]): Folder | undefined {
  for (const folder of folders) {
    if (folder.taskLists?.length || (folder.tasks?.length || folder._count?.tasks || 0) > 0) {
      return folder;
    }
    const child = findFirstTaskFolder(folder.folders || []);
    if (child) return child;
  }
  return undefined;
}

function findFirstTaskList(folders: Folder[]): TaskList | undefined {
  for (const folder of folders) {
    const list = folder.taskLists?.[0] || findFirstTaskList(folder.folders || []);
    if (list) return list;
  }
  return undefined;
}

export function tasksWithList(taskList?: TaskList) {
  return taskList
    ? (taskList.tasks || []).map((task) => ({ ...task, folderName: taskList.name }))
    : [];
}

export function displayStatus(status?: TaskStatus, fallback?: string) {
  const key = (status?.name || fallback || 'backlog').toLowerCase();
  return statusMeta[key] || { label: key, color: status?.color || '#868e96', tone: 'gray' };
}

export function getErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  const normalized = message.toLowerCase();

  if (
    normalized.includes('workflow') ||
    normalized.includes('transition not allowed') ||
    normalized.includes('status is not available')
  ) {
    return 'OpenProject does not allow moving this task to that status in the current workflow.';
  }

  if (
    normalized.includes('lockversion') ||
    normalized.includes('stale object') ||
    normalized.includes('modified by another user')
  ) {
    return 'This task was changed by someone else in OpenProject. Refresh the task and try again.';
  }

  if (
    normalized.includes('permission') ||
    normalized.includes('forbidden') ||
    normalized.includes('not authorized')
  ) {
    return 'You do not have permission to perform this action in OpenProject.';
  }

  if (
    normalized.includes('assignee') &&
    (normalized.includes('access') ||
      normalized.includes('membership') ||
      normalized.includes('project'))
  ) {
    return 'OpenProject rejected the assignee because that user does not have access to this project.';
  }

  if (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('networkerror')
  ) {
    return 'OpenProject took too long to respond. Try again in a moment.';
  }

  if (
    normalized.includes('validation') ||
    normalized.includes('required') ||
    normalized.includes('must be filled')
  ) {
    return 'OpenProject rejected the data. Check required fields and try again.';
  }

  if (
    normalized.includes('custom field') ||
    normalized.includes('schema') ||
    normalized.includes('unsupported field')
  ) {
    return 'This field is not editable through the current OpenProject schema.';
  }

  if (normalized.includes('upload') || normalized.includes('attachment')) {
    return 'The file could not be uploaded to OpenProject. Check project permissions and file limits.';
  }

  if (normalized.includes('unavailable') || normalized.includes('failed to fetch')) {
    return 'OpenProject is currently unavailable. Try again after the connection recovers.';
  }

  return message;
}

export function folderPath(spaceId: string, folderId: string) {
  return `/space/${spaceId}/folder/${folderId}`;
}

export function taskPath(spaceId: string, folderId: string, taskId: string) {
  return `${folderPath(spaceId, folderId)}/task/${taskId}`;
}

/** /space/:spaceId/docs */
export function docsPath(spaceId: string) {
  return `/space/${spaceId}/docs`;
}

/** /space/:spaceId/docs/:docId */
export function docPath(spaceId: string, docId: string) {
  return `/space/${spaceId}/docs/${docId}`;
}

export function allTasksPath() {
  return '/tasks';
}

export function myTasksPath() {
  return '/my-tasks';
}

export function reorderBoardTasks(
  tasks: Task[],
  statuses: TaskStatus[],
  input: { taskId: string; toStatusId: string; targetTaskId?: string | null }
) {
  const movedTask = tasks.find((task) => task.id === input.taskId);
  if (!movedTask) {
    return null;
  }

  const sourceStatusId = movedTask.statusId || statuses[0]?.id;
  if (!sourceStatusId) {
    return null;
  }
  if (input.targetTaskId && input.targetTaskId === input.taskId) {
    return null;
  }

  const grouped = new Map<string, Task[]>();
  statuses.forEach((status) => {
    grouped.set(status.id, []);
  });
  tasks.forEach((task) => {
    const statusId = task.statusId || statuses[0]?.id;
    if (!statusId) {
      return;
    }
    grouped.set(statusId, [...(grouped.get(statusId) || []), task]);
  });

  const sourceColumn = [...(grouped.get(sourceStatusId) || [])].filter(
    (task) => task.id !== input.taskId
  );
  grouped.set(sourceStatusId, sourceColumn);

  const destinationColumn =
    sourceStatusId === input.toStatusId ? sourceColumn : [...(grouped.get(input.toStatusId) || [])];
  const nextStatusName = statuses.find((status) => status.id === input.toStatusId)?.name;
  const nextTask =
    sourceStatusId === input.toStatusId && !nextStatusName
      ? movedTask
      : {
          ...movedTask,
          statusId: input.toStatusId,
          ...(nextStatusName ? { status: nextStatusName } : {}),
        };

  const targetIndex = input.targetTaskId
    ? destinationColumn.findIndex((task) => task.id === input.targetTaskId)
    : -1;
  if (targetIndex >= 0) {
    destinationColumn.splice(targetIndex, 0, nextTask);
  } else {
    destinationColumn.push(nextTask);
  }
  grouped.set(input.toStatusId, destinationColumn);

  const flattened = statuses.flatMap((status) => grouped.get(status.id) || []);
  const affectedStatusIds = [...new Set([sourceStatusId, input.toStatusId])];
  return {
    tasks: flattened,
    updatedTask: nextTask,
    orders: affectedStatusIds.map((statusId) => ({
      statusId,
      orderedTaskIds: (grouped.get(statusId) || []).map((task) => task.id),
    })),
  };
}

export function workspaceHasWork(workspace: Workspace) {
  return workspace.spaces.some((space) => Boolean(findFirstTaskFolder(space.folders)));
}

/** Formats hours as "Xh" or "X.Xh". Returns null for zero/null values. */
export function formatHours(hours?: number | null): string | null {
  if (!hours || hours <= 0) return null;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

/** Strip ClickUp import metadata comments from a work-package description. */
export function stripClickUpMeta(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(
      /<!--\s*chainsaw-clickup-import-meta\s*-->[\s\S]*?<!--\s*\/chainsaw-clickup-import-meta\s*-->/gi,
      ''
    )
    .replace(/<!--\s*chainsaw[^>]*-->/gi, '')
    .trim();
}

export function formatDueDate(value?: string) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const now = new Date('2026-05-11T00:00:00');
  const days = Math.round((date.getTime() - now.getTime()) / 86_400_000);
  if (days < 0 && days > -14) {
    return `${Math.abs(days)} days ago`;
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
  }).format(date);
}

export function toDateInput(value?: string) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}
