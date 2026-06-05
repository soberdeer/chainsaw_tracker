import type { Folder } from '@/lib';

export function findFolderForList(folders: Folder[], listId: string): Folder | undefined {
  for (const folder of folders) {
    if (folder.taskLists?.some((l) => l.id === listId)) return folder;
    const found = findFolderForList(folder.folders ?? [], listId);
    if (found) return found;
  }
  return undefined;
}
