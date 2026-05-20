export type OpenProjectRoleLike = {
  id: number | string;
  name: string;
  _links?: { self?: { href?: string | null } };
};

export type ImportedPermissionLevel = 'admin' | 'member' | 'commenter' | 'reader';

export type ClickUpPermissionGrantLike = {
  user: unknown;
  level: ImportedPermissionLevel;
};

export const permissionStrength: Record<ImportedPermissionLevel, number> = {
  reader: 1,
  commenter: 2,
  member: 3,
  admin: 4,
};

const roleNamePreferences: Record<ImportedPermissionLevel, string[]> = {
  admin: ['manager', 'project admin', 'admin', 'maintainer'],
  member: ['member', 'developer', 'contributor'],
  commenter: ['commenter', 'member', 'developer', 'contributor'],
  reader: ['reader', 'viewer', 'read only', 'member', 'developer', 'contributor'],
};

export function openProjectRoleLevel(roleName?: string | null): ImportedPermissionLevel {
  const name = (roleName || '').toLowerCase();

  if (['manager', 'project admin', 'admin', 'maintainer'].some((part) => name.includes(part))) {
    return 'admin';
  }

  if (['member', 'developer', 'contributor'].some((part) => name.includes(part))) {
    return 'member';
  }

  if (name.includes('comment')) {
    return 'commenter';
  }

  return 'reader';
}

export function isRoleAtLeast(
  currentRoleName: string | undefined | null,
  required: ImportedPermissionLevel
) {
  return permissionStrength[openProjectRoleLevel(currentRoleName)] >= permissionStrength[required];
}

export function pickOpenProjectRoleForClickUpPermission(
  roles: OpenProjectRoleLike[],
  permission: ImportedPermissionLevel
) {
  const preferences = roleNamePreferences[permission];

  for (const preferredName of preferences) {
    const exact = roles.find((role) => role.name.toLowerCase() === preferredName);

    if (exact) {
      return exact;
    }
  }

  for (const preferredName of preferences) {
    const partial = roles.find((role) => role.name.toLowerCase().includes(preferredName));

    if (partial) {
      return partial;
    }
  }

  return roles[0];
}

export function clickUpPermissionFromRaw(value: unknown): ImportedPermissionLevel {
  if (!value || typeof value !== 'object') {
    return 'member';
  }

  const raw = JSON.stringify(value).toLowerCase();

  if (raw.includes('owner') || raw.includes('admin') || raw.includes('manage')) {
    return 'admin';
  }

  if (raw.includes('comment')) {
    return 'commenter';
  }

  if (raw.includes('view') || raw.includes('read')) {
    return 'reader';
  }

  return 'member';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function arrayFromPath(value: unknown, path: string[]) {
  let current = value;

  for (const key of path) {
    if (!isObject(current)) {
      return [];
    }

    current = current[key];
  }

  return Array.isArray(current) ? current : [];
}

function permissionGrantCandidates(value: unknown) {
  return [
    ...arrayFromPath(value, ['members']),
    ...arrayFromPath(value, ['users']),
    ...arrayFromPath(value, ['permissions']),
    ...arrayFromPath(value, ['access']),
    ...arrayFromPath(value, ['sharing']),
    ...arrayFromPath(value, ['shared']),
    ...arrayFromPath(value, ['shared', 'members']),
    ...arrayFromPath(value, ['shared', 'users']),
    ...arrayFromPath(value, ['sharing', 'members']),
    ...arrayFromPath(value, ['sharing', 'users']),
    ...arrayFromPath(value, ['access', 'members']),
    ...arrayFromPath(value, ['access', 'users']),
  ];
}

function userFromCandidate(value: unknown) {
  if (!isObject(value)) {
    return null;
  }

  if (value.user !== undefined) {
    return value.user;
  }

  if (value.member !== undefined) {
    return value.member;
  }

  if (value.id !== undefined || value.email !== undefined || value.username !== undefined) {
    return value;
  }

  return null;
}

export function extractClickUpHierarchyPermissionGrants(value: unknown) {
  return permissionGrantCandidates(value).flatMap((candidate): ClickUpPermissionGrantLike[] => {
    const user = userFromCandidate(candidate);

    if (!user) {
      return [];
    }

    return [{ user, level: clickUpPermissionFromRaw(candidate) }];
  });
}

export function extractSpacePermissionGrants(space: unknown) {
  return extractClickUpHierarchyPermissionGrants(space);
}

export function extractFolderPermissionGrants(folder: unknown) {
  return extractClickUpHierarchyPermissionGrants(folder);
}
