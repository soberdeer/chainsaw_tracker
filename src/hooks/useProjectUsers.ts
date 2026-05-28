import { useEffect, useState } from 'react';
import { getOpenProjectProjectMembers, type User } from '@/lib';

/** Extract the OpenProject project numeric ID from a task-list ID.
 *  Task-list IDs can be:
 *   - "op-project:123:clickup-list:456"  → "123"
 *   - plain numeric string like "42"      → "42"
 */
export function listToOpProjectId(listId: string | null | undefined): string | null {
  if (!listId) return null;
  const match = listId.match(/^op-project:(\d+):/);
  if (match) return match[1];
  // plain numeric – treat as direct project id
  if (/^\d+$/.test(listId)) return listId;
  return null;
}

/**
 * Fetches project members from OpenProject for a given project and returns
 * them as `User` objects (using OP user ID as `id` so they match task assigneeIds).
 *
 * @param workspaceId - ChainsawLeg workspace ID
 * @param projectId   - OpenProject project numeric ID (or null to skip fetch)
 */
export function useProjectUsers(
  workspaceId: string | null | undefined,
  projectId: string | null | undefined
): { users: User[]; loading: boolean } {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId || !projectId) {
      setUsers([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getOpenProjectProjectMembers(workspaceId, projectId)
      .then(({ items }) => {
        if (cancelled) return;
        const mapped: User[] = items.map((member) => ({
          id: member.openProjectUserId,
          email: member.openProjectEmail || '',
          name: member.openProjectName,
          avatarUrl: member.avatarUrl,
          openProjectUserId: member.openProjectUserId,
          openProjectLogin: member.openProjectLogin,
        }));
        // deduplicate by id
        const seen = new Set<string>();
        setUsers(
          mapped.filter((u) => {
            if (seen.has(u.id)) return false;
            seen.add(u.id);
            return true;
          })
        );
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId]);

  return { users, loading };
}
