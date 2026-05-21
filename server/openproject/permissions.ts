import type { Request } from 'express';
import { prisma } from '../db.js';
import { currentUserId } from '../services/auth.js';
import { openProjectRuntimeWorkspaceSlug } from './localPermissions.js';

type RuntimePermission = 'manageTasks' | 'manageSpaces';

function userId(req: Request) {
  return currentUserId(req) || '';
}

async function runtimeMembership(req: Request) {
  const id = userId(req);
  if (!id) {
    return null;
  }

  return prisma.membership.findFirst({
    where: {
      userId: id,
      workspace: { slug: openProjectRuntimeWorkspaceSlug },
    },
    include: {
      workspace: {
        include: {
          permissionSets: true,
        },
      },
    },
  });
}

function hasRuntimePermission(
  membership: Awaited<ReturnType<typeof runtimeMembership>> | null,
  permission: RuntimePermission
) {
  if (!membership) {
    return false;
  }

  if (membership.role === 'OWNER') {
    return true;
  }

  const set = membership.workspace.permissionSets.find((item) => item.role === membership.role);
  return Boolean(set?.[permission]);
}

export async function requireOpenProjectTaskWrite(req: Request) {
  const membership = await runtimeMembership(req);
  if (hasRuntimePermission(membership, 'manageTasks')) {
    return;
  }
  const error = new Error('You do not have permission to write OpenProject work packages');
  Object.assign(error, { statusCode: 403 });
  throw error;
}

export async function requireOpenProjectProjectWrite(req: Request) {
  const membership = await runtimeMembership(req);
  if (hasRuntimePermission(membership, 'manageSpaces')) {
    return;
  }
  const error = new Error('You do not have permission to change OpenProject projects');
  Object.assign(error, { statusCode: 403 });
  throw error;
}
