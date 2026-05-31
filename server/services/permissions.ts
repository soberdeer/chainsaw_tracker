import type { Request } from 'express';
import { currentUser, currentUserId as authCurrentUserId } from './auth.js';

export { authCurrentUserId as currentUserId };

type Permission =
  | 'manageWorkspace'
  | 'manageSpaces'
  | 'manageDocs'
  | 'manageTasks'
  | 'inviteMembers'
  | 'manageIntegrations'
  | 'manageImports'
  | 'viewReports';

export const ROLE_PERMISSIONS: Record<string, Partial<Record<Permission, boolean>>> = {
  ADMIN: {
    manageWorkspace: true,
    manageSpaces: true,
    manageDocs: true,
    manageTasks: true,
    inviteMembers: true,
    manageIntegrations: true,
    manageImports: true,
    viewReports: true,
  },
  MEMBER: {
    manageTasks: true,
    manageDocs: true,
    viewReports: true,
  },
  READER: {},
};

export function rolePermissions(role: string): Partial<Record<Permission, boolean>> {
  return ROLE_PERMISSIONS[role] ?? {};
}

function userRole(req: Request) {
  const user = currentUser(req);
  return user?.admin ? 'ADMIN' : 'MEMBER';
}

export async function can(_req: Request, _workspaceId: string, permission: Permission) {
  const role = userRole(_req);
  return Boolean(rolePermissions(role)[permission]);
}

export async function requirePermission(
  req: Request,
  _workspaceId: string,
  permission: Permission
) {
  if (!(await can(req, _workspaceId, permission))) {
    const error = new Error(`Missing permission: ${permission}`);
    Object.assign(error, { statusCode: 403 });
    throw error;
  }
}

export async function accessibleSpaceIds(_req: Request, _workspaceId: string): Promise<string[]> {
  return [];
}
