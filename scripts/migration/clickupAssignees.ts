export type ClickUpAssigneeLike = {
  id: number | string;
  username?: string | null;
  email?: string | null;
};

export function clickUpAssigneeDisplayName(user: ClickUpAssigneeLike) {
  return user.username?.trim() || user.email?.trim().toLowerCase() || `ClickUp User ${user.id}`;
}

/**
 * Returns the first unique assignee from the ClickUp assignees list.
 * Additional assignees are intentionally ignored — only one assignee per task
 * is supported.
 */
export function splitClickUpAssignees(assignees: ClickUpAssigneeLike[] = []) {
  const unique = new Map<string, ClickUpAssigneeLike>();

  for (const assignee of assignees) {
    const key = String(assignee.id || assignee.email || assignee.username || '').trim();
    if (!key || unique.has(key)) {
      continue;
    }
    unique.set(key, assignee);
  }

  return {
    assignee: [...unique.values()][0],
  };
}
