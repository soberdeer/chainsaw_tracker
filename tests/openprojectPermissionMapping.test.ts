import {
  clickUpPermissionFromRaw,
  extractClickUpHierarchyPermissionGrants,
  extractFolderPermissionGrants,
  extractSpacePermissionGrants,
  isRoleAtLeast,
  openProjectRoleLevel,
  permissionStrength,
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

test('extracts ClickUp space permission grants from known access fields', () => {
  const grants = extractSpacePermissionGrants({
    private: true,
    sharing: {
      users: [{ user: { id: 10, email: 'viewer@example.test' }, permission: 'view_only' }],
    },
    permissions: [{ user: { id: 11, email: 'admin@example.test' }, role: 'admin' }],
  });

  assert.deepEqual(
    grants.map((grant) => grant.level),
    ['admin', 'reader']
  );
});

test('extracts ClickUp folder permission grants from shared members', () => {
  const grants = extractFolderPermissionGrants({
    hidden: true,
    shared: {
      members: [{ user: { id: 12, email: 'commenter@example.test' }, permission: 'comment' }],
    },
  });

  assert.equal(grants.length, 1);
  assert.equal(grants[0]?.level, 'commenter');
});

// ─── clickUpPermissionFromRaw: integer role field ────────────────────────────

test('clickUpPermissionFromRaw maps ClickUp integer roles to permission levels', () => {
  assert.equal(clickUpPermissionFromRaw({ role: 1 }), 'admin'); // owner
  assert.equal(clickUpPermissionFromRaw({ role: 2 }), 'admin'); // admin
  assert.equal(clickUpPermissionFromRaw({ role: 3 }), 'member'); // member
  assert.equal(clickUpPermissionFromRaw({ role: 4 }), 'reader'); // guest
});

test('clickUpPermissionFromRaw defaults to member for null or unrecognised values', () => {
  assert.equal(clickUpPermissionFromRaw(null), 'member');
  assert.equal(clickUpPermissionFromRaw(undefined), 'member');
  assert.equal(clickUpPermissionFromRaw({}), 'member');
  assert.equal(clickUpPermissionFromRaw({ role: 99 }), 'member');
});

// ─── openProjectRoleLevel ───────────────────────────────────────────────────

test('openProjectRoleLevel correctly classifies common OpenProject role names', () => {
  assert.equal(openProjectRoleLevel('Manager'), 'admin');
  assert.equal(openProjectRoleLevel('Project Admin'), 'admin');
  assert.equal(openProjectRoleLevel('Developer'), 'member');
  assert.equal(openProjectRoleLevel('Member'), 'member');
  assert.equal(openProjectRoleLevel('Contributor'), 'member');
  assert.equal(openProjectRoleLevel('Commenter'), 'commenter');
  assert.equal(openProjectRoleLevel('Reader'), 'reader');
  assert.equal(openProjectRoleLevel('Viewer'), 'reader');
  assert.equal(openProjectRoleLevel(null), 'reader');
  assert.equal(openProjectRoleLevel(undefined), 'reader');
});

// ─── permissionStrength ordering ────────────────────────────────────────────

test('permissionStrength is strictly ordered: reader < commenter < member < admin', () => {
  assert.ok(permissionStrength.reader < permissionStrength.commenter);
  assert.ok(permissionStrength.commenter < permissionStrength.member);
  assert.ok(permissionStrength.member < permissionStrength.admin);
});

// ─── extractClickUpHierarchyPermissionGrants ────────────────────────────────

test('extractClickUpHierarchyPermissionGrants handles members array path', () => {
  const grants = extractClickUpHierarchyPermissionGrants({
    members: [
      { user: { id: 1, email: 'owner@example.com' }, role: 1 },
      { user: { id: 2, email: 'guest@example.com' }, role: 4 },
    ],
  });

  assert.equal(grants.length, 2);
  const levels = grants.map((g) => g.level).sort();
  assert.deepEqual(levels, ['admin', 'reader']);
});

test('extractClickUpHierarchyPermissionGrants handles users array path', () => {
  const grants = extractClickUpHierarchyPermissionGrants({
    users: [{ id: 5, email: 'someone@example.com', role: 3 }],
  });

  assert.equal(grants.length, 1);
  assert.equal(grants[0]?.level, 'member');
});

test('extractClickUpHierarchyPermissionGrants returns empty array for empty object', () => {
  assert.deepEqual(extractClickUpHierarchyPermissionGrants({}), []);
  assert.deepEqual(extractClickUpHierarchyPermissionGrants(null), []);
});

test('extractClickUpHierarchyPermissionGrants handles nested sharing.users path', () => {
  const grants = extractClickUpHierarchyPermissionGrants({
    sharing: {
      users: [{ user: { id: 10, email: 'sharer@example.com' }, role: 'owner' }],
    },
  });

  assert.equal(grants.length, 1);
  assert.equal(grants[0]?.level, 'admin');
});

// ─── pickOpenProjectRoleForClickUpPermission: fallback ───────────────────────

test('pickOpenProjectRoleForClickUpPermission falls back to first role when no match', () => {
  const customRoles: OpenProjectRoleLike[] = [
    { id: 1, name: 'Custom Role A' },
    { id: 2, name: 'Custom Role B' },
  ];
  // Neither name matches any preferred name for 'admin'
  const picked = pickOpenProjectRoleForClickUpPermission(customRoles, 'admin');
  assert.equal(picked?.id, 1);
});
