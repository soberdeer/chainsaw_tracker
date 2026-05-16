import { mapTask, priorityToClickUp } from '../server/clickup/mappers.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('maps ClickUp task fields into tracker task shape', () => {
  const mapped = mapTask({
    id: '86abc',
    custom_id: 'CL-PROTO-001',
    name: 'CL-PROTO-001 Build adapter',
    markdown_description: 'Use real API',
    status: { status: 'in progress', color: '#228be6', orderindex: 1 },
    priority: { id: '2', priority: 'high' },
    assignees: [
      { id: 123, username: 'Ada' },
      { id: 456, username: 'Grace Hopper' },
    ],
    tags: [{ name: 'api', tag_bg: '#1864ab' }],
    url: 'https://app.clickup.com/t/86abc',
    list: { id: '111', name: 'Dev' },
    folder: { id: '222', name: 'Core' },
    space: { id: '333', name: 'Engineering' },
    date_updated: '1710000000000',
  });

  assert.equal(mapped.id, '86abc');
  assert.equal(mapped.title, 'CL-PROTO-001 Build adapter');
  assert.equal(mapped.description, 'Use real API');
  assert.equal(mapped.statusId, 'in progress');
  assert.equal(mapped.priority, 'HIGH');
  assert.equal(mapped.assignee?.id, '123');
  assert.deepEqual(
    mapped.assignees.map((user) => user.id),
    ['123', '456']
  );
  assert.equal(mapped.externalSource, 'CLICKUP');
  assert.equal(mapped.externalUrl, 'https://app.clickup.com/t/86abc');
  assert.equal(mapped.taskKey, 'CL-PROTO-001');
});

test('maps tracker priority to ClickUp priority ids', () => {
  assert.equal(priorityToClickUp('URGENT'), 1);
  assert.equal(priorityToClickUp('HIGH'), 2);
  assert.equal(priorityToClickUp('NORMAL'), 3);
  assert.equal(priorityToClickUp('LOW'), 4);
});
