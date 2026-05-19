import type { Request } from 'express';
import { prisma } from '../server/db.js';
import {
  requireOpenProjectProjectWrite,
  requireOpenProjectTaskWrite,
} from '../server/openproject/permissions.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const originalFindFirst = prisma.membership.findFirst;

test.afterEach(() => {
  prisma.membership.findFirst = originalFindFirst;
});

function req(userId = 'local-user') {
  return { header: (name: string) => (name === 'x-user-id' ? userId : undefined) } as Request;
}

test('OpenProject task writes allow workspace members with write roles', async () => {
  prisma.membership.findFirst = (async () => ({ id: 'm1' })) as typeof prisma.membership.findFirst;
  await assert.doesNotReject(() => requireOpenProjectTaskWrite(req()));
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
