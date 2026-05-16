import type { Request } from 'express';
import { prisma } from '../db.js';

type Permission =
  | 'manageWorkspace'
  | 'manageSpaces'
  | 'manageDocs'
  | 'manageTasks'
  | 'inviteMembers';
type SpacePermissionKind = 'view' | 'edit' | 'manage';

export async function can(req: Request, workspaceId: string, permission: Permission) {
  const userId = req.header('x-user-id');

  if (!userId) {
    return false;
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: { include: { permissionSets: true } } },
  });

  if (!membership) {
    return false;
  }

  if (membership.role === 'OWNER') {
    return true;
  }

  const set = membership.workspace.permissionSets.find((item) => item.role === membership.role);
  return Boolean(set?.[permission]);
}

export async function requirePermission(req: Request, workspaceId: string, permission: Permission) {
  if (!(await can(req, workspaceId, permission))) {
    const error = new Error(`Missing permission: ${permission}`);
    Object.assign(error, { statusCode: 403 });
    throw error;
  }
}

export function currentUserId(req: Request) {
  return req.header('x-user-id') || null;
}

export async function workspaceMembership(req: Request, workspaceId: string) {
  const userId = currentUserId(req);
  if (!userId) {
    return null;
  }
  return prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: { include: { permissionSets: true } } },
  });
}

export async function canAccessSpace(
  req: Request,
  spaceId: string,
  permission: SpacePermissionKind
) {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    include: { permissions: true },
  });
  if (!space) {
    return false;
  }

  const membership = await workspaceMembership(req, space.workspaceId);
  if (!membership) {
    return false;
  }
  if (membership.role === 'OWNER') {
    return true;
  }

  const spaceSet = space.permissions.find((item) => item.role === membership.role);
  const workspaceSet = membership.workspace.permissionSets.find(
    (item) => item.role === membership.role
  );
  if (!spaceSet && workspaceSet) {
    if (permission === 'view') {
      return true;
    }
    if (permission === 'edit') {
      return workspaceSet.manageTasks || workspaceSet.manageDocs || workspaceSet.manageSpaces;
    }
    return workspaceSet.manageSpaces;
  }
  if (permission === 'view') {
    return Boolean(spaceSet?.canView);
  }
  if (permission === 'edit') {
    return Boolean(spaceSet?.canEdit || spaceSet?.canManage);
  }
  return Boolean(spaceSet?.canManage);
}

export async function requireSpacePermission(
  req: Request,
  spaceId: string,
  permission: SpacePermissionKind
) {
  if (!(await canAccessSpace(req, spaceId, permission))) {
    const error = new Error(`Missing space permission: ${permission}`);
    Object.assign(error, { statusCode: 403 });
    throw error;
  }
}

export async function accessibleSpaceIds(req: Request, workspaceId: string) {
  const membership = await workspaceMembership(req, workspaceId);
  if (!membership) {
    return [];
  }

  const spaces = await prisma.space.findMany({
    where: { workspaceId },
    include: { permissions: true },
  });
  if (membership.role === 'OWNER') {
    return spaces.map((space) => space.id);
  }

  return spaces
    .filter((space) => {
      const spaceSet = space.permissions.find((permission) => permission.role === membership.role);
      if (spaceSet) {
        return spaceSet.canView;
      }
      return Boolean(
        membership.workspace.permissionSets.find(
          (permission) => permission.role === membership.role
        )
      );
    })
    .map((space) => space.id);
}

export async function canEditTask(
  req: Request,
  task: {
    workspaceId?: string | null;
    assigneeId?: string | null;
    createdById?: string | null;
    folder: { spaceId: string; space: { workspaceId: string } };
  }
) {
  const workspaceId = task.workspaceId || task.folder.space.workspaceId;
  const membership = await workspaceMembership(req, workspaceId);
  if (!membership) {
    return false;
  }
  if (membership.role === 'OWNER' || membership.role === 'ADMIN') {
    return true;
  }
  if (membership.role === 'LEAD') {
    return canAccessSpace(req, task.folder.spaceId, 'edit');
  }
  if (membership.role === 'MEMBER') {
    const userId = currentUserId(req);
    return Boolean(
      userId &&
      (task.assigneeId === userId || task.createdById === userId) &&
      (await canAccessSpace(req, task.folder.spaceId, 'view'))
    );
  }
  return false;
}

export async function requireTaskEditPermission(
  req: Request,
  task: {
    workspaceId?: string | null;
    assigneeId?: string | null;
    createdById?: string | null;
    folder: { spaceId: string; space: { workspaceId: string } };
  }
) {
  if (!(await canEditTask(req, task))) {
    const error = new Error('Missing task edit permission');
    Object.assign(error, { statusCode: 403 });
    throw error;
  }
}
