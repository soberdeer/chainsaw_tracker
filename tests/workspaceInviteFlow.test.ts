import { buildTaskBody } from '../scripts/seed-openproject-from-clickup.js';
import {
  assertWorkspaceOwnerMutationAllowed,
  inviteRoleSchema,
  resolveInviteAcceptancePlan,
} from '../server/routes/workspaces.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('invite role schema accepts MEMBER', () => {
  assert.equal(inviteRoleSchema.parse('MEMBER'), 'MEMBER');
});

test('resolveInviteAcceptancePlan creates a new user when no current or existing user exists', () => {
  const plan = resolveInviteAcceptancePlan({
    inviteEmail: 'new@example.com',
    existingUserForInviteEmail: false,
    name: 'New User',
    password: 'password123',
    confirmPassword: 'password123',
  });

  assert.deepEqual(plan, {
    kind: 'create-user',
    name: 'New User',
    password: 'password123',
  });
});

test('resolveInviteAcceptancePlan rejects existing invited users without login', () => {
  assert.throws(
    () =>
      resolveInviteAcceptancePlan({
        inviteEmail: 'existing@example.com',
        existingUserForInviteEmail: true,
      }),
    /Login first/
  );
});

test('resolveInviteAcceptancePlan rejects logged-in users with a different email', () => {
  assert.throws(
    () =>
      resolveInviteAcceptancePlan({
        inviteEmail: 'invite@example.com',
        currentUserEmail: 'other@example.com',
        existingUserForInviteEmail: false,
      }),
    /does not match/
  );
});

test('workspace routes do not fall back to local-user during invite acceptance or workspace creation', () => {
  const source = fs.readFileSync(
    path.resolve('/Users/telsehush/Documents/Codex/2026-05-11/tracker/server/routes/workspaces.ts'),
    'utf8'
  );

  assert.doesNotMatch(source, /currentUserId\(req\)\s*\|\|\s*'local-user'/);
});

test('assertWorkspaceOwnerMutationAllowed protects the last admin', () => {
  assert.throws(
    () =>
      assertWorkspaceOwnerMutationAllowed({
        currentRole: 'ADMIN',
        nextRole: 'MEMBER',
        ownerCount: 1,
        operation: 'update',
      }),
    /last admin/
  );

  assert.throws(
    () =>
      assertWorkspaceOwnerMutationAllowed({
        currentRole: 'ADMIN',
        ownerCount: 1,
        operation: 'remove',
      }),
    /last admin/
  );
});

test('buildTaskBody stores single assignee link in the OpenProject payload', () => {
  const body = buildTaskBody({
    task: {
      id: 'cu-1',
      name: 'Imported Task',
      description: '',
      priority: { priority: 'high' },
    } as never,
    context: {
      space: { id: 's1', name: 'Space' },
      folder: null,
      list: { id: 'l1', name: 'List' },
    } as never,
    type: {
      id: 1,
      name: 'Task',
      _links: { self: { href: '/api/v3/types/1' } },
    },
    openProjectStatuses: [],
    priorities: [
      {
        id: 9,
        name: 'High',
        _links: { self: { href: '/api/v3/priorities/9' } },
      },
    ],
    assigneeHref: '/api/v3/users/101',
  });

  assert.deepEqual((body._links as Record<string, { href?: string }>).assignee, {
    href: '/api/v3/users/101',
  });
});

test('buildTaskBody omits assignee link when no assigneeHref provided', () => {
  const body = buildTaskBody({
    task: {
      id: 'cu-2',
      name: 'No Assignee Task',
      description: '',
    } as never,
    context: {
      space: { id: 's1', name: 'Space' },
      folder: null,
      list: { id: 'l1', name: 'List' },
    } as never,
    type: {
      id: 1,
      name: 'Task',
      _links: { self: { href: '/api/v3/types/1' } },
    },
    openProjectStatuses: [],
    priorities: [],
  });

  const links = body._links as Record<string, { href?: string } | undefined>;
  assert.ok(!links.assignee?.href);
});
