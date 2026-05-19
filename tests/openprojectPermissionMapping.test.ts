import {
  clickUpPermissionFromRaw,
  isRoleAtLeast,
  openProjectRoleLevel,
  pickOpenProjectRoleForClickUpPermission,
  type OpenProjectRoleLike,
} from '../scripts/migration/openprojectPermissions.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const roles: OpenProjectRoleLike[] = [
  { id: 1, name: 'Reader', _links: { self: { href: '/api/v3/roles/1' } } },
  { id: 2, name: 'Commenter', _links: { self: { href: '/api/v3/roles/2' } } },
  { id: 3, name: 'Member', _links: { self: { href: '/api/v3/roles/3' } } },
  { id: 4, name: 'Manager', _links: { self: { href: '/api/v3/roles/4' } } },
];

test('maps ClickUp owner/admin-like permissions to OpenProject manager/admin project role', () => {
  assert.equal(clickUpPermissionFromRaw({ role: 'owner' }), 'admin');
  assert.equal(clickUpPermissionFromRaw({ permission: 'admin' }), 'admin');
  assert.equal(pickOpenProjectRoleForClickUpPermission(roles, 'admin')?.name, 'Manager');
});

test('maps ClickUp member-like permissions to OpenProject member role', () => {
  assert.equal(clickUpPermissionFromRaw({ role: 'member' }), 'member');
  assert.equal(pickOpenProjectRoleForClickUpPermission(roles, 'member')?.name, 'Member');
});

test('maps ClickUp guest view/comment permissions to reader/commenter role with fallback', () => {
  assert.equal(clickUpPermissionFromRaw({ guest: true, permission: 'view_only' }), 'reader');
  assert.equal(clickUpPermissionFromRaw({ guest: true, permission: 'comment' }), 'commenter');
  assert.equal(pickOpenProjectRoleForClickUpPermission(roles, 'reader')?.name, 'Reader');
  assert.equal(pickOpenProjectRoleForClickUpPermission(roles, 'commenter')?.name, 'Commenter');
  assert.equal(
    pickOpenProjectRoleForClickUpPermission(
      roles.filter((role) => role.name !== 'Commenter'),
      'commenter'
    )?.name,
    'Member'
  );
});

test('role strength prevents downgrade and allows upgrade', () => {
  assert.equal(openProjectRoleLevel('Manager'), 'admin');
  assert.equal(isRoleAtLeast('Manager', 'member'), true);
  assert.equal(isRoleAtLeast('Member', 'admin'), false);
  assert.equal(isRoleAtLeast('Reader', 'commenter'), false);
});
