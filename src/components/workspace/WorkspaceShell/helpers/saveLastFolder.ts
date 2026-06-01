import { LAST_FOLDER_KEY } from './consts';

export function saveLastFolder(spaceId: string, folderId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_FOLDER_KEY, JSON.stringify({ spaceId, folderId }));
  } catch {
    /* ignore */
  }
}
