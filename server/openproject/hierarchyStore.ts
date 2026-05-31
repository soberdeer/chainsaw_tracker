import type {
  Folder,
  Membership,
  PermissionSet,
  Space,
  TaskList,
  TaskStatus,
  TaskStatusType,
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
  statusType?: TaskStatusType;
};

export type SeededTaskList = Omit<TaskList, 'statuses'> & {
  clickupListId: string;
  openProjectProjectId: string;
  importFilter?: {
    spaceName?: string;
    folderName?: string;
    listName?: string;

    clickUpSpaceId?: string;
    clickUpFolderId?: string;
    clickUpListId?: string;

    originalClickUpPath?: string;
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

/**
 * Extract the OpenProject project numeric ID from a task-list ID.
 *
 * Formats supported (in priority order):
 *   "{projectId}:{listId}"              e.g. "42:789"            → "42"   (current)
 *   "list:{projectId}:{listId}"         e.g. "list:42:789"       → "42"   (old, kept for compat)
 *   "op-project:{id}:clickup-list:{id}" e.g. "op-project:42:..." → "42"   (legacy)
 *   plain numeric string                e.g. "42"                → "42"
 */
export function listOpenProjectProjectId(listId: string) {
  // Current format: {projectId}:{anything}  (digits before first colon)
  const bareMatch = listId.match(/^(\d+):/);
  if (bareMatch) return bareMatch[1];
  // Legacy format: op-project:{id}:clickup-list:{id}
  const legacyMatch = listId.match(/^op-project:(\d+):/);
  if (legacyMatch) return legacyMatch[1];
  // Plain numeric project ID
  return listId;
}

export function openProjectStatusId(statusId?: string) {
  if (!statusId) return undefined;
  const match = statusId.match(/^op-status:(\d+):/);
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

/**
 * Find a seeded list that matches the given imported work package description.
 * Matching strategy (in order of reliability):
 *   1. ClickUp IDs ("Space ID:" + "List ID:" lines in the meta block)
 *   2. Names ("Space:" + "List:" lines) — fallback for older imports
 */
export function findSeededListByImportedDescription(
  workspace: SeededWorkspace | null,
  description?: string
) {
  if (!workspace || !description) return undefined;

  // Extract IDs and names from description meta block
  const spaceId = description.match(/^Space ID:\s*(.+)$/m)?.[1]?.trim();
  const listId = description.match(/^List ID:\s*(.+)$/m)?.[1]?.trim();
  const spaceName = description.match(/^Space:\s*(.+)$/m)?.[1]?.trim();
  const listName = description.match(/^List:\s*(.+)$/m)?.[1]?.trim();

  const lists = seededLists(workspace);

  // 1. ID-based match (most reliable)
  if (spaceId || listId) {
    const byId = lists.find((list) => {
      const f = list.importFilter;
      if (!f) return false;
      const spaceMatch = !spaceId || !f.clickUpSpaceId || f.clickUpSpaceId === spaceId;
      const listMatch = !listId || !f.clickUpListId || f.clickUpListId === listId;
      return spaceMatch && listMatch;
    });
    if (byId) return byId;
  }

  // 2. Name-based match (fallback)
  if (!spaceName && !listName) return undefined;
  return lists.find(
    (list) =>
      (!list.importFilter?.spaceName || list.importFilter.spaceName === spaceName) &&
      (!list.importFilter?.listName || list.importFilter.listName === listName)
  );
}
