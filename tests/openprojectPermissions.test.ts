import type { Request } from 'express';
import { prisma } from '../server/db.js';
import {
  requireOpenProjectProjectWrite,
  requireOpenProjectTaskWrite,
} from '../server/openproject/permissions.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

const originalFindFirst = prisma.membership.findFirst;
process.env.SESSION_SECRET = 'test-session-secret';

test.afterEach(() => {
  prisma.membership.findFirst = originalFindFirst;
});

function req(userId = 'local-user') {
  const payload = Buffer.from(JSON.stringify({ userId })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', process.env.SESSION_SECRET || '')
    .update(payload)
    .digest('base64url');
  return {
    header: (name: string) =>
      name.toLowerCase() === 'cookie' ? `tracker_session=${payload}.${signature}` : undefined,
  } as Request;
}

test('OpenProject task writes allow owner/admin in service-token mode', async () => {
  prisma.membership.findFirst = (async () => ({ id: 'm1' })) as typeof prisma.membership.findFirst;
  await assert.doesNotReject(() => requireOpenProjectTaskWrite(req()));
});

test('OpenProject task writes reject non-admin roles in service-token mode', async () => {
  prisma.membership.findFirst = (async (args: unknown) => {
    const roles = (args as { where?: { role?: { in?: string[] } } })?.where?.role?.in || [];
    assert.deepEqual(roles, ['OWNER', 'ADMIN']);
    return null;
  }) as typeof prisma.membership.findFirst;
  await assert.rejects(
    () => requireOpenProjectTaskWrite(req('member')),
    (error: unknown) =>
      error instanceof Error && (error as { statusCode?: number }).statusCode === 403
  );
});

test('OpenProject task writes reject users without an allowed membership', async () => {
  prisma.membership.findFirst = (async () => null) as typeof prisma.membership.findFirst;
  await assert.rejects(
    () => requireOpenProjectTaskWrite(req('stranger')),
    (error: unknown) =>
      error instanceof Error && (error as { statusCode?: number }).statusCode === 403
  );
});

test('OpenProject project writes require admin-level roles', async () => {
  prisma.membership.findFirst = (async (_args: unknown) =>
    null) as typeof prisma.membership.findFirst;
  await assert.rejects(
    () => requireOpenProjectProjectWrite(req()),
    (error: unknown) => error instanceof Error && error.message.includes('OpenProject projects')
  );
});
