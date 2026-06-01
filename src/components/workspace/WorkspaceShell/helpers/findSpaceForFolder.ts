import type { Folder } from '@/lib';
import { findFolderById } from './findFolderById';

/**
 * Given a folder ID, find the Space that contains it.
 * Without a seeded hierarchy the backend sets task.departmentId to the project's own ID,
 * which for child projects is a folder ID rather than a space ID.
 * This helper resolves the correct space by scanning the workspace tree.
 */
export function findSpaceForFolder(
  spaces: { id: string; folders: Folder[] }[],
  folderId: string | undefined
): { id: string; folders: Folder[] } | undefined {
  if (!folderId) return undefined;
  return spaces.find((space) => Boolean(findFolderById(space.folders, folderId)));
}
