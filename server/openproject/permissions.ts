import type { Request } from 'express';
import { prisma } from '../db.js';
import { currentUserId } from '../services/auth.js';

const writeRoles = new Set(['OWNER', 'ADMIN']);
const projectRoles = new Set(['OWNER', 'ADMIN']);

function userId(req: Request) {
  return currentUserId(req) || '';
}

async function hasMembership(req: Request, allowedRoles: Set<string>) {
  const membership = await prisma.membership.findFirst({
    where: {
      userId: userId(req),
      role: {
        in: Array.from(allowedRoles) as Array<'OWNER' | 'ADMIN' | 'LEAD' | 'MEMBER' | 'VIEWER'>,
      },
    },
  });
  return Boolean(membership);
}

export async function requireOpenProjectTaskWrite(req: Request) {
  if (await hasMembership(req, writeRoles)) return;
  const error = new Error('You do not have permission to write OpenProject work packages');
  Object.assign(error, { statusCode: 403 });
  throw error;
}

export async function requireOpenProjectProjectWrite(req: Request) {
  if (await hasMembership(req, projectRoles)) return;
  const error = new Error('You do not have permission to change OpenProject projects');
  Object.assign(error, { statusCode: 403 });
  throw error;
}
