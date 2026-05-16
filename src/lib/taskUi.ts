import type { Folder, Space, TaskList, TaskPriority, TaskStatus, Workspace } from './types';

export const statusMeta: Record<string, { label: string; color: string; tone: string }> = {
  complete: { label: 'Complete', color: '#5cc4a7', tone: 'mint' },
  shipped: { label: 'Shipped', color: '#5cc4a7', tone: 'mint' },
  review: { label: 'In Review', color: '#e64980', tone: 'pink' },
  'in review': { label: 'In Review', color: '#e64980', tone: 'pink' },
  backlog: { label: 'Backlog', color: '#868e96', tone: 'gray' },
  todo: { label: 'To do', color: '#868e96', tone: 'gray' },
  'to do': { label: 'To do', color: '#868e96', tone: 'gray' },
  in_progress: { label: 'In progress', color: '#4dabf7', tone: 'blue' },
  'in progress': { label: 'In progress', color: '#4dabf7', tone: 'blue' },
  'in development': { label: 'In Development', color: '#4dabf7', tone: 'blue' },
  scoping: { label: 'Scoping', color: '#7048e8', tone: 'blue' },
  open: { label: 'Open', color: '#868e96', tone: 'gray' },
  closed: { label: 'Closed', color: '#5cc4a7', tone: 'mint' },
  done: { label: 'Done', color: '#5cc4a7', tone: 'mint' },
};

export const priorityColor: Record<TaskPriority, string> = {
  LOW: 'gray',
  NORMAL: 'blue',
  HIGH: 'orange',
  URGENT: 'red',
};

export function firstTaskFolder(space?: Space) {
  return (
    space?.folders.find(
      (folder) =>
        folder.taskLists?.length || (folder.tasks?.length || folder._count?.tasks || 0) > 0
    ) || space?.folders[0]
  );
}

export function firstTaskList(folder?: Folder) {
  return folder?.taskLists?.[0];
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
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function folderPath(spaceId: string, folderId: string) {
  return `/space/${spaceId}/folder/${folderId}`;
}

export function taskPath(spaceId: string, folderId: string, taskId: string) {
  return `${folderPath(spaceId, folderId)}/task/${taskId}`;
}

export function docPath(spaceId: string, docId: string) {
  return `/space/${spaceId}/doc/${docId}`;
}

export function parseAppPath(pathname: string) {
  const taskMatch = pathname.match(/^\/space\/([^/]+)\/folder\/([^/]+)\/task\/([^/]+)/);
  if (taskMatch) return { spaceId: taskMatch[1], folderId: taskMatch[2], taskId: taskMatch[3] };
  const docMatch = pathname.match(/^\/space\/([^/]+)\/doc\/([^/]+)/);
  if (docMatch) return { spaceId: docMatch[1], docId: docMatch[2] };
  const folderMatch = pathname.match(/^\/space\/([^/]+)\/folder\/([^/]+)/);
  if (folderMatch) return { spaceId: folderMatch[1], folderId: folderMatch[2] };
  const spaceMatch = pathname.match(/^\/space\/([^/]+)/);
  if (spaceMatch) return { spaceId: spaceMatch[1] };
  return {};
}

export function workspaceHasWork(workspace: Workspace) {
  return workspace.spaces.some((space) =>
    space.folders.some(
      (folder) =>
        (folder.taskLists?.length || 0) > 0 ||
        (folder.tasks?.length || folder._count?.tasks || 0) > 0
    )
  );
}

export function formatDueDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date('2026-05-11T00:00:00');
  const days = Math.round((date.getTime() - now.getTime()) / 86_400_000);
  if (days < 0 && days > -14) return `${Math.abs(days)} days ago`;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
  }).format(date);
}

export function toDateInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}
