import type { PermissionSet, WorkspaceRole } from '@prisma/client';
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

function permissionSet(role: WorkspaceRole, overrides: Partial<PermissionSet> = {}): PermissionSet {
  return {
    id: `${role}-set`,
    workspaceId: 'runtime-workspace',
    role,
    manageWorkspace: role === 'OWNER' || role === 'ADMIN',
    manageSpaces: role === 'OWNER' || role === 'ADMIN',
    manageDocs: false,
    manageTasks: role !== 'VIEWER',
    inviteMembers: role === 'OWNER' || role === 'ADMIN',
    manageIntegrations: role === 'OWNER' || role === 'ADMIN',
    manageImports: role === 'OWNER' || role === 'ADMIN',
    viewReports: role !== 'VIEWER',
    ...overrides,
  };
}

function runtimeMembership(role: WorkspaceRole) {
  return {
    id: `membership-${role}`,
    userId: 'local-user',
    workspaceId: 'runtime-workspace',
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    workspace: {
      id: 'runtime-workspace',
      slug: 'openproject-runtime',
      permissionSets: [
        permissionSet('OWNER'),
        permissionSet('ADMIN'),
        permissionSet('LEAD'),
        permissionSet('MEMBER'),
        permissionSet('VIEWER', { manageTasks: false, viewReports: false }),
      ],
    },
  };
}

test('OpenProject task writes allow roles with manageTasks in runtime workspace', async () => {
  prisma.membership.findFirst = (async () =>
    runtimeMembership('MEMBER')) as unknown as typeof prisma.membership.findFirst;
  await assert.doesNotReject(() => requireOpenProjectTaskWrite(req('member')));
});

test('OpenProject task writes reject viewer roles without manageTasks', async () => {
  prisma.membership.findFirst = (async () =>
    runtimeMembership('VIEWER')) as unknown as typeof prisma.membership.findFirst;
  await assert.rejects(
    () => requireOpenProjectTaskWrite(req('viewer')),
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
  prisma.membership.findFirst = (async () =>
    runtimeMembership('LEAD')) as unknown as typeof prisma.membership.findFirst;
  await assert.rejects(
    () => requireOpenProjectProjectWrite(req()),
    (error: unknown) => error instanceof Error && error.message.includes('OpenProject projects')
  );
});

test('OpenProject project writes allow roles with manageSpaces in runtime workspace', async () => {
  prisma.membership.findFirst = (async () =>
    runtimeMembership('ADMIN')) as unknown as typeof prisma.membership.findFirst;
  await assert.doesNotReject(() => requireOpenProjectProjectWrite(req()));
});
