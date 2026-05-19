import { mapWorkPackage, priorityToOpenProjectName } from '../server/openproject/mappers.js';
import type { User } from '../src/lib/types.js';
import assert from 'node:assert/strict';
import test from 'node:test';

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
        project: { href: '/api/v3/projects/5', title: 'ClickUp Import' },
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

test('maps tracker priority to OpenProject priority names', () => {
  assert.equal(priorityToOpenProjectName('URGENT'), 'Immediate');
  assert.equal(priorityToOpenProjectName('HIGH'), 'High');
  assert.equal(priorityToOpenProjectName('NORMAL'), 'Normal');
  assert.equal(priorityToOpenProjectName('LOW'), 'Low');
});
