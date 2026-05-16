import type { Request } from 'express';
import { prisma } from '../db.js';

const writeRoles = new Set(['OWNER', 'ADMIN', 'LEAD', 'MEMBER']);
const spaceRoles = new Set(['OWNER', 'ADMIN']);

function userId(req: Request) {
  return req.header('x-user-id') || 'local-user';
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

export async function requireClickUpTaskWrite(req: Request) {
  if (await hasMembership(req, writeRoles)) {
    return;
  }
  const error = new Error('You do not have permission to write ClickUp tasks');
  Object.assign(error, { statusCode: 403 });
  throw error;
}

export async function requireClickUpSpaceWrite(req: Request) {
  if (await hasMembership(req, spaceRoles)) {
    return;
  }
  const error = new Error('You do not have permission to change ClickUp spaces, folders, or lists');
  Object.assign(error, { statusCode: 403 });
  throw error;
}
