import type { Request } from 'express';
import { currentUser } from '../services/auth.js';
import { rolePermissions } from '../services/permissions.js';

function userRole(req: Request): 'ADMIN' | 'MEMBER' {
  const user = currentUser(req);
  if (!user) return 'MEMBER';
  return user.admin ? 'ADMIN' : 'MEMBER';
}

export async function requireOpenProjectTaskWrite(req: Request) {
  const role = userRole(req);
  if (rolePermissions(role).manageTasks) return;
  const error = new Error('You do not have permission to write OpenProject work packages');
  Object.assign(error, { statusCode: 403 });
  throw error;
}

export async function requireOpenProjectProjectWrite(req: Request) {
  const role = userRole(req);
  if (rolePermissions(role).manageSpaces) return;
  const error = new Error('You do not have permission to change OpenProject projects');
  Object.assign(error, { statusCode: 403 });
  throw error;
}
