import type {
  Folder,
  Membership,
  PermissionSet,
  Space,
  TaskList,
  TaskStatus,
  Workspace,
} from '../../src/lib/types.js';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const storePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'seed-data',
  'clickup-hierarchy.json'
);

export type SeededStatus = TaskStatus & {
  clickupStatusId?: string;
  clickupStatusName?: string;
  openProjectStatusId: string;
};

export type SeededTaskList = Omit<TaskList, 'statuses'> & {
  clickupListId: string;
  openProjectProjectId: string;
  importFilter?: {
    spaceName?: string;
    listName?: string;
  };
  statuses: SeededStatus[];
};

export type SeededFolder = Omit<Folder, 'taskLists'> & {
  clickupFolderId?: string;
  taskLists: SeededTaskList[];
};

export type SeededSpace = Omit<Space, 'folders'> & {
  clickupSpaceId: string;
  folders: SeededFolder[];
};

export type SeededWorkspace = Omit<Workspace, 'spaces'> & {
  source: 'CLICKUP_SEEDED_OPENPROJECT';
  seededAt: string;
  spaces: SeededSpace[];
  memberships: Membership[];
  permissionSets: PermissionSet[];
};

let cachedHierarchy: SeededWorkspace | null | undefined;

export async function loadSeededHierarchy() {
  if (cachedHierarchy !== undefined) return cachedHierarchy;
  try {
    cachedHierarchy = JSON.parse(await readFile(storePath, 'utf8')) as SeededWorkspace;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(
        `Unable to read OpenProject ClickUp hierarchy seed: ${(error as Error).message}`
      );
    }
    cachedHierarchy = null;
  }
  return cachedHierarchy;
}

export function resetSeededHierarchyCache() {
  cachedHierarchy = undefined;
}

export function seededHierarchyPath() {
  return storePath;
}

export function seededLists(workspace: SeededWorkspace) {
  return workspace.spaces.flatMap((space) => space.folders.flatMap((folder) => folder.taskLists));
}

export function listOpenProjectProjectId(listId: string) {
  const match = listId.match(/^op-project:(\d+):clickup-list:/);
  return match?.[1] || listId;
}

export function openProjectStatusId(statusId?: string) {
  if (!statusId) return undefined;
  const match = statusId.match(/^op-status:(\d+):clickup-status:/);
  return match?.[1] || statusId;
}

export function findSeededListById(workspace: SeededWorkspace | null, listId: string) {
  if (!workspace) return undefined;
  return seededLists(workspace).find((list) => list.id === listId);
}

export function findSeededListByProjectId(workspace: SeededWorkspace | null, projectId: string) {
  if (!workspace) return undefined;
  return seededLists(workspace).find((list) => list.openProjectProjectId === projectId);
}

export function statusIdForOpenProjectStatus(list: SeededTaskList | undefined, statusId: string) {
  return list?.statuses.find((status) => status.openProjectStatusId === statusId)?.id || statusId;
}

export function findSeededListByImportedDescription(
  workspace: SeededWorkspace | null,
  description?: string
) {
  if (!workspace || !description) return undefined;
  const spaceName = description.match(/^Space:\s*(.+)$/m)?.[1]?.trim();
  const listName = description.match(/^List:\s*(.+)$/m)?.[1]?.trim();
  if (!spaceName && !listName) return undefined;
  return seededLists(workspace).find(
    (list) =>
      (!list.importFilter?.spaceName || list.importFilter.spaceName === spaceName) &&
      (!list.importFilter?.listName || list.importFilter.listName === listName)
  );
}
