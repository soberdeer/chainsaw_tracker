import { buildTaskBody } from '../scripts/seed-openproject-from-clickup.js';
import {
  assertWorkspaceOwnerMutationAllowed,
  inviteRoleSchema,
  resolveInviteAcceptancePlan,
} from '../server/routes/workspaces.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('invite role schema accepts LEAD', () => {
  assert.equal(inviteRoleSchema.parse('LEAD'), 'LEAD');
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

test('assertWorkspaceOwnerMutationAllowed protects the last owner', () => {
  assert.throws(
    () =>
      assertWorkspaceOwnerMutationAllowed({
        currentRole: 'OWNER',
        nextRole: 'ADMIN',
        ownerCount: 1,
        operation: 'update',
      }),
    /last owner/
  );

  assert.throws(
    () =>
      assertWorkspaceOwnerMutationAllowed({
        currentRole: 'OWNER',
        ownerCount: 1,
        operation: 'remove',
      }),
    /last owner/
  );
});

test('buildTaskBody stores assignee and responsible links in the OpenProject payload', () => {
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
    responsibleHref: '/api/v3/users/202',
    additionalAssignees: [{ id: 303, username: 'Extra Person', email: 'extra@example.com' }],
  });

  assert.deepEqual((body._links as Record<string, { href?: string }>).assignee, {
    href: '/api/v3/users/101',
  });
  assert.deepEqual((body._links as Record<string, { href?: string }>).responsible, {
    href: '/api/v3/users/202',
  });
  assert.match(
    (body.description as { raw: string }).raw,
    /Additional assignees:\n- Extra Person <extra@example\.com>/
  );
});
