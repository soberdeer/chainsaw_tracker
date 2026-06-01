import { LAST_FOLDER_KEY } from './consts';

export function readLastFolder(): { spaceId: string; folderId: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_FOLDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.spaceId === 'string' && typeof parsed.folderId === 'string')
      return parsed as { spaceId: string; folderId: string };
  } catch {
    /* ignore */
  }
  return null;
}
