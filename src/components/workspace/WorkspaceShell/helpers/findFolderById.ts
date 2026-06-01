import type { Folder } from '@/lib';

export function findFolderById(folders: Folder[], id?: string): Folder | undefined {
  for (const folder of folders) {
    if (folder.id === id) return folder;
    const child = findFolderById(folder.folders || [], id);
    if (child) return child;
  }
  return undefined;
}
