export type ClickUpAssigneeLike = {
  id: number | string;
  username?: string | null;
  email?: string | null;
};

const ADDITIONAL_ASSIGNEES_START = '<!-- chainsaw-clickup-additional-assignees -->';
const ADDITIONAL_ASSIGNEES_END = '<!-- /chainsaw-clickup-additional-assignees -->';

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return undefined;
  }
  return email;
}

export function clickUpAssigneeDisplayName(user: ClickUpAssigneeLike) {
  return user.username?.trim() || normalizeEmail(user.email) || `ClickUp User ${user.id}`;
}

export function splitClickUpAssignees(assignees: ClickUpAssigneeLike[] = []) {
  const unique = new Map<string, ClickUpAssigneeLike>();

  for (const assignee of assignees) {
    const key = String(assignee.id || assignee.email || assignee.username || '').trim();
    if (!key || unique.has(key)) {
      continue;
    }
    unique.set(key, assignee);
  }

  const ordered = [...unique.values()];

  return {
    assignee: ordered[0],
    responsible: ordered[1],
    additional: ordered.slice(2),
  };
}

function stripAdditionalAssigneeBlock(description: string) {
  return description
    .replace(
      new RegExp(`${ADDITIONAL_ASSIGNEES_START}[\\s\\S]*?${ADDITIONAL_ASSIGNEES_END}\\n?`, 'g'),
      ''
    )
    .trimEnd();
}

export function appendAdditionalAssigneesMeta(
  description: string,
  additionalAssignees: ClickUpAssigneeLike[]
) {
  const clean = stripAdditionalAssigneeBlock(description || '');

  if (!additionalAssignees.length) {
    return clean;
  }

  const lines = additionalAssignees.map((user) => {
    const email = normalizeEmail(user.email);
    const name = clickUpAssigneeDisplayName(user);
    return email ? `- ${name} <${email}>` : `- ${name}`;
  });

  const block = [
    ADDITIONAL_ASSIGNEES_START,
    'Additional assignees:',
    ...lines,
    ADDITIONAL_ASSIGNEES_END,
  ].join('\n');

  return clean ? `${clean}\n\n${block}` : block;
}
