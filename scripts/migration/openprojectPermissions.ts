export type OpenProjectRoleLike = {
  id: number | string;
  name: string;
  _links?: { self?: { href?: string | null } };
};

export type ImportedPermissionLevel = 'admin' | 'member' | 'commenter' | 'reader';

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
