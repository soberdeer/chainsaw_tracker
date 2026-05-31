import {
  buildProjectSpaces,
  mapActivity,
  mapStatus,
  mapUser,
  mapWorkPackage,
  mapWorkspace,
  parseDuration,
  priorityHref,
  priorityToOpenProjectName,
  statusThemeColor,
  statusThemeType,
} from '../server/openproject/mappers.js';
import type { User } from '../src/lib/types.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// ─── priorityToOpenProjectName ─────────────────────────────────────────────

test('maps tracker priority to OpenProject priority names', () => {
  assert.equal(priorityToOpenProjectName('URGENT'), 'Immediate');
  assert.equal(priorityToOpenProjectName('HIGH'), 'High');
  assert.equal(priorityToOpenProjectName('NORMAL'), 'Normal');
  assert.equal(priorityToOpenProjectName('LOW'), 'Low');
});

test('priorityToOpenProjectName returns undefined for null, undefined and unknown values', () => {
  assert.equal(priorityToOpenProjectName(null), undefined);
  assert.equal(priorityToOpenProjectName(undefined), undefined);
  assert.equal(priorityToOpenProjectName(''), undefined);
  assert.equal(priorityToOpenProjectName('MEDIUM'), undefined);
});

// ─── parseDuration ──────────────────────────────────────────────────────────

test('parseDuration converts ISO 8601 duration strings to decimal hours', () => {
  assert.equal(parseDuration('PT2H'), 2);
  assert.equal(parseDuration('PT30M'), 0.5);
  assert.equal(parseDuration('PT1H30M'), 1.5);
  assert.equal(parseDuration('PT0H'), 0);
});

test('parseDuration returns null for invalid or missing input', () => {
  assert.equal(parseDuration(null), null);
  assert.equal(parseDuration(undefined), null);
  assert.equal(parseDuration(''), null);
  assert.equal(parseDuration('P5D'), null); // day-based not supported
  assert.equal(parseDuration('not-a-duration'), null);
});

// ─── mapUser ────────────────────────────────────────────────────────────────

test('mapUser maps OpenProject user fields to tracker User shape', () => {
  const mapped = mapUser({
    id: 7,
    name: 'Dima Kovalenko',
    email: 'dima@example.com',
    login: 'dima',
    admin: false,
    status: 'active',
    _links: {},
  } as never);
  assert.equal(mapped.id, '7');
  assert.equal(mapped.email, 'dima@example.com');
  assert.equal(mapped.name, 'Dima Kovalenko');
  assert.equal(mapped.opAdmin, false);
  assert.equal(mapped.opStatus, 'active');
});

test('mapUser falls back to login when email and name are absent', () => {
  const mapped = mapUser({ id: 8, name: '', login: 'ghost', email: '', _links: {} } as never);
  assert.equal(mapped.email, 'ghost');
  assert.equal(mapped.name, 'ghost');
});

test('mapUser synthesises email from id when login and email are absent', () => {
  const mapped = mapUser({ id: 9, name: '', _links: {} } as never);
  assert.ok(mapped.email.includes('9'));
});

test('mapUser sets opAdmin flag from admin field', () => {
  const admin = mapUser({ id: 1, name: 'A', admin: true, _links: {} } as never);
  assert.equal(admin.opAdmin, true);

  const member = mapUser({ id: 2, name: 'B', admin: false, _links: {} } as never);
  assert.equal(member.opAdmin, false);

  const unset = mapUser({ id: 3, name: 'C', _links: {} } as never);
  assert.equal(unset.opAdmin, false);
});

// ─── statusThemeColor / statusThemeType ─────────────────────────────────────

test('statusThemeColor returns correct hex for known status names', () => {
  assert.equal(statusThemeColor('backlog'), '#adb5bd');
  assert.equal(statusThemeColor('In Progress'), '#cc5de8');
  assert.equal(statusThemeColor('shipped'), '#51cf66');
});

test('statusThemeColor is case-insensitive and returns grey for unknown names', () => {
  assert.equal(statusThemeColor('BACKLOG'), '#adb5bd');
  assert.equal(statusThemeColor('unknown-status'), '#adb5bd');
});

test('statusThemeType returns correct type for known statuses', () => {
  assert.equal(statusThemeType('in progress'), 'progress');
  assert.equal(statusThemeType('shipped'), 'done');
  assert.equal(statusThemeType('closed'), 'closed');
  assert.equal(statusThemeType('Scoping'), 'prep');
  assert.equal(statusThemeType('In Testing'), 'test');
});

test('statusThemeType returns "open" for unknown status names', () => {
  assert.equal(statusThemeType('random'), 'open');
});

// ─── mapStatus ──────────────────────────────────────────────────────────────

test('mapStatus produces a TaskStatus with correct color and type', () => {
  const status = mapStatus(
    { id: 3, name: 'In progress', position: 2, isClosed: false, _links: {} } as never,
    'list-1'
  );
  assert.equal(status.id, '3');
  assert.equal(status.taskListId, 'list-1');
  assert.equal(status.name, 'In progress');
  assert.equal(status.color, '#cc5de8');
  assert.equal(status.statusType, 'progress');
  assert.equal(status.isDone, false);
});

test('mapStatus marks closed statuses as isDone', () => {
  const status = mapStatus(
    { id: 5, name: 'Shipped', isClosed: true, _links: {} } as never,
    'list-2'
  );
  assert.equal(status.isDone, true);
});

test('mapStatus falls back to id for position when position is absent', () => {
  const status = mapStatus({ id: 11, name: 'Backlog', _links: {} } as never, 'list-3');
  assert.equal(status.position, 11);
});

// ─── priorityHref ───────────────────────────────────────────────────────────

test('priorityHref returns the href for the matching priority', () => {
  const priorities = [
    { id: 7, name: 'Immediate', _links: { self: { href: '/api/v3/priorities/7' } } },
    { id: 8, name: 'High', _links: { self: { href: '/api/v3/priorities/8' } } },
    { id: 9, name: 'Normal', _links: { self: { href: '/api/v3/priorities/9' } } },
    { id: 10, name: 'Low', _links: { self: { href: '/api/v3/priorities/10' } } },
  ];
  assert.equal(priorityHref(priorities, 'URGENT'), '/api/v3/priorities/7');
  assert.equal(priorityHref(priorities, 'HIGH'), '/api/v3/priorities/8');
  assert.equal(priorityHref(priorities, 'NORMAL'), '/api/v3/priorities/9');
  assert.equal(priorityHref(priorities, 'LOW'), '/api/v3/priorities/10');
});

test('priorityHref returns undefined for null, undefined, or unknown priority', () => {
  const priorities = [{ id: 8, name: 'High', _links: { self: { href: '/api/v3/priorities/8' } } }];
  assert.equal(priorityHref(priorities, null), undefined);
  assert.equal(priorityHref(priorities, undefined), undefined);
  assert.equal(priorityHref(priorities, 'UNKNOWN'), undefined);
});

test('priorityHref returns undefined when priority list is empty', () => {
  assert.equal(priorityHref([], 'HIGH'), undefined);
});

// ─── mapWorkPackage ─────────────────────────────────────────────────────────

test('maps OpenProject work package fields into tracker task shape', () => {
  const user: User = { id: '4', email: 'admin@example.net', name: 'OpenProject Admin' };
  const mapped = mapWorkPackage(
    {
      id: 277,
      lockVersion: 0,
      subject: 'CL-PROTO-001 Build adapter',
      description: { format: 'markdown', raw: 'Use real API' },
      startDate: '2026-05-18',
      dueDate: '2026-05-20',
      createdAt: '2026-05-18T10:00:00Z',
      updatedAt: '2026-05-18T11:00:00Z',
      _links: {
        self: { href: '/api/v3/work_packages/277' },
        project: { href: '/api/v3/projects/5', title: 'OpenProject Import' },
        status: { href: '/api/v3/statuses/7', title: 'In progress' },
        priority: { href: '/api/v3/priorities/9', title: 'High' },
        assignee: { href: '/api/v3/users/4', title: 'OpenProject Admin' },
      },
    },
    { projectId: '5' },
    new Map([['/api/v3/users/4', user]])
  );

  assert.equal(mapped.id, '277');
  assert.equal(mapped.title, 'CL-PROTO-001 Build adapter');
  assert.equal(mapped.description, 'Use real API');
  assert.equal(mapped.statusId, '7');
  assert.equal(mapped.priority, 'HIGH');
  assert.equal(mapped.assignee?.id, '4');
  assert.equal(mapped.externalSource, 'OPENPROJECT');
  assert.equal(mapped.externalUrl, 'http://localhost:8080/work_packages/277');
  assert.equal(mapped.taskKey, 'CL-PROTO-001');
});

test('mapWorkPackage maps URGENT, HIGH, LOW priorities correctly; Normal becomes undefined', () => {
  const base = {
    id: 100,
    lockVersion: 0,
    subject: 'Test',
    _links: {
      self: { href: '/api/v3/work_packages/100' },
      project: { href: '/api/v3/projects/1' },
      status: { href: '/api/v3/statuses/1', title: 'New' },
    },
  };

  const urgent = mapWorkPackage({
    ...base,
    _links: { ...base._links, priority: { href: '/api/v3/priorities/1', title: 'Immediate' } },
  });
  assert.equal(urgent.priority, 'URGENT');

  const low = mapWorkPackage({
    ...base,
    _links: { ...base._links, priority: { href: '/api/v3/priorities/4', title: 'Low' } },
  });
  assert.equal(low.priority, 'LOW');

  // 'Normal' is OpenProject's default priority — treated as "not explicitly set"
  const normal = mapWorkPackage({
    ...base,
    _links: { ...base._links, priority: { href: '/api/v3/priorities/3', title: 'Normal' } },
  });
  assert.equal(normal.priority, 'NORMAL');
});

test('mapWorkPackage sets priority to undefined when priority link is absent', () => {
  const mapped = mapWorkPackage({
    id: 50,
    lockVersion: 0,
    subject: 'No priority task',
    _links: {
      self: { href: '/api/v3/work_packages/50' },
      project: { href: '/api/v3/projects/2' },
      status: { href: '/api/v3/statuses/1', title: 'New' },
    },
  });
  assert.equal(mapped.priority, undefined);
});

test('mapWorkPackage sets assignees to empty array when assignee link is absent', () => {
  const mapped = mapWorkPackage({
    id: 51,
    lockVersion: 0,
    subject: 'Unassigned task',
    _links: {
      self: { href: '/api/v3/work_packages/51' },
      project: { href: '/api/v3/projects/2' },
      status: { href: '/api/v3/statuses/1', title: 'New' },
    },
  });
  assert.equal(mapped.assignee, undefined);
  assert.deepEqual(mapped.assignees, []);
});

test('mapWorkPackage assignee lookup falls back to undefined when user is not in map', () => {
  const mapped = mapWorkPackage(
    {
      id: 52,
      lockVersion: 0,
      subject: 'Unknown assignee',
      _links: {
        self: { href: '/api/v3/work_packages/52' },
        project: { href: '/api/v3/projects/2' },
        status: { href: '/api/v3/statuses/1', title: 'New' },
        assignee: { href: '/api/v3/users/999', title: 'Ghost' },
      },
    },
    undefined,
    new Map() // empty user map
  );
  assert.equal(mapped.assignee, undefined);
  assert.deepEqual(mapped.assignees, []);
});

test('mapWorkPackage resolves parentId from parent link', () => {
  const mapped = mapWorkPackage({
    id: 53,
    lockVersion: 0,
    subject: 'Child task',
    _links: {
      self: { href: '/api/v3/work_packages/53' },
      project: { href: '/api/v3/projects/2' },
      status: { href: '/api/v3/statuses/1', title: 'New' },
      parent: { href: '/api/v3/work_packages/10' },
    },
  });
  assert.equal(mapped.parentId, '10');
});

test('mapWorkPackage converts estimatedTime ISO duration to hours', () => {
  const mapped = mapWorkPackage({
    id: 54,
    lockVersion: 0,
    subject: 'Estimated task',
    estimatedTime: 'PT4H',
    _links: {
      self: { href: '/api/v3/work_packages/54' },
      project: { href: '/api/v3/projects/2' },
      status: { href: '/api/v3/statuses/1', title: 'New' },
    },
  });
  assert.equal(mapped.estimatedHours, 4);
});

test('mapWorkPackage extracts description from raw field', () => {
  const mapped = mapWorkPackage({
    id: 55,
    lockVersion: 0,
    subject: 'Described task',
    description: { format: 'markdown', raw: 'Task **description**' },
    _links: {
      self: { href: '/api/v3/work_packages/55' },
      project: { href: '/api/v3/projects/2' },
      status: { href: '/api/v3/statuses/1', title: 'New' },
    },
  });
  assert.equal(mapped.description, 'Task **description**');
});

// ─── mapActivity ─────────────────────────────────────────────────────────────

test('mapActivity maps comment to activity log message', () => {
  const activity = mapActivity('42', {
    id: 1,
    comment: { format: 'markdown', raw: 'This is a comment' },
    details: [],
    createdAt: '2026-05-18T10:00:00Z',
    _links: {},
  } as never);

  assert.equal(activity.id, '1');
  assert.equal(activity.taskId, '42');
  assert.equal(activity.type, 'OPENPROJECT_ACTIVITY');
  assert.equal(activity.message, 'This is a comment');
  assert.equal(activity.createdAt, '2026-05-18T10:00:00Z');
});

test('mapActivity joins detail lines when comment is absent', () => {
  const activity = mapActivity('99', {
    id: 2,
    details: [
      { format: 'markdown', raw: 'Status changed to In Progress' },
      { format: 'markdown', raw: 'Priority changed to High' },
    ],
    createdAt: '2026-05-19T09:00:00Z',
    _links: {},
  } as never);

  assert.ok(activity.message?.includes('Status changed'));
  assert.ok(activity.message?.includes('Priority changed'));
});

test('mapActivity returns empty message when both comment and details are absent', () => {
  const activity = mapActivity('10', {
    id: 3,
    details: [],
    createdAt: '2026-05-20T00:00:00Z',
    _links: {},
  } as never);
  assert.equal(activity.message, '');
});

// ─── buildProjectSpaces ──────────────────────────────────────────────────────

test('buildProjectSpaces maps flat project list to a single space with self-folder', () => {
  const spaces = buildProjectSpaces(
    [
      {
        id: 1,
        name: 'Alpha',
        identifier: 'alpha',
        public: true,
        _links: { self: { href: '/api/v3/projects/1' } },
      },
    ],
    []
  );

  assert.equal(spaces.length, 1);
  assert.equal(spaces[0]?.id, '1');
  assert.equal(spaces[0]?.name, 'Alpha');
  assert.equal(spaces[0]?.folders.length, 1);
  assert.equal(spaces[0]?.folders[0]?.id, '1');
});

test('buildProjectSpaces nests child projects as folders inside parent space', () => {
  type P = {
    id: number;
    name: string;
    identifier: string;
    public: boolean;
    _links: Record<string, { href: string }>;
  };
  const projects: P[] = [
    {
      id: 10,
      name: 'Root',
      identifier: 'root',
      public: true,
      _links: { self: { href: '/api/v3/projects/10' } },
    },
    {
      id: 11,
      name: 'Child A',
      identifier: 'child-a',
      public: true,
      _links: { self: { href: '/api/v3/projects/11' }, parent: { href: '/api/v3/projects/10' } },
    },
    {
      id: 12,
      name: 'Child B',
      identifier: 'child-b',
      public: true,
      _links: { self: { href: '/api/v3/projects/12' }, parent: { href: '/api/v3/projects/10' } },
    },
  ];

  const spaces = buildProjectSpaces(projects as never, []);

  assert.equal(spaces.length, 1);
  assert.equal(spaces[0]?.id, '10');
  assert.equal(spaces[0]?.folders.length, 2);
  const folderNames = spaces[0]?.folders.map((f) => f.name).sort();
  assert.deepEqual(folderNames, ['Child A', 'Child B']);
});

test('buildProjectSpaces treats orphaned child projects as roots', () => {
  // Child whose parent doesn't appear in list → treated as root
  const projects = [
    {
      id: 20,
      name: 'Orphan',
      identifier: 'orphan',
      public: false,
      _links: { self: { href: '/api/v3/projects/20' }, parent: { href: '/api/v3/projects/999' } },
    },
  ] as never;

  const spaces = buildProjectSpaces(projects, []);
  assert.equal(spaces.length, 1);
  assert.equal(spaces[0]?.id, '20');
});

// ─── mapWorkspace ────────────────────────────────────────────────────────────

test('maps ChainsawLeg workspace permissions to service-token write model', () => {
  const workspace = mapWorkspace([], [], []);
  const permissionByRole = new Map(workspace.permissionSets.map((set) => [set.role, set]));

  assert.equal(permissionByRole.get('ADMIN')?.manageTasks, true);
  assert.equal(permissionByRole.get('MEMBER')?.manageTasks, true);
  assert.equal(permissionByRole.get('READER')?.manageTasks, false);
  assert.equal(workspace.memberships.length, 0);
});

test('mapWorkspace always sets workspaceId and slug to "openproject"', () => {
  const workspace = mapWorkspace([], [], []);
  assert.equal(workspace.id, 'openproject');
  assert.equal(workspace.slug, 'openproject');
});
