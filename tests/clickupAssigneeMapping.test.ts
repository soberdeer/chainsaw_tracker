import {
  appendAdditionalAssigneesMeta,
  splitClickUpAssignees,
} from '../scripts/migration/clickupAssignees.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('splitClickUpAssignees maps first user to assignee, second to responsible, rest to additional', () => {
  const result = splitClickUpAssignees([
    { id: 1, username: 'Alice', email: 'alice@example.test' },
    { id: 2, username: 'Bob', email: 'bob@example.test' },
    { id: 3, username: 'Carol', email: 'carol@example.test' },
  ]);

  assert.equal(result.assignee?.id, 1);
  assert.equal(result.responsible?.id, 2);
  assert.deepEqual(
    result.additional.map((user) => user.id),
    [3]
  );
});

test('splitClickUpAssignees de-duplicates repeated assignees', () => {
  const result = splitClickUpAssignees([
    { id: 1, username: 'Alice' },
    { id: 1, username: 'Alice' },
    { id: 2, username: 'Bob' },
  ]);

  assert.equal(result.assignee?.id, 1);
  assert.equal(result.responsible?.id, 2);
  assert.equal(result.additional.length, 0);
});

test('appendAdditionalAssigneesMeta stores additional assignees idempotently', () => {
  const description = 'Task description';
  const once = appendAdditionalAssigneesMeta(description, [
    { id: 3, username: 'Carol', email: 'carol@example.test' },
  ]);
  const twice = appendAdditionalAssigneesMeta(once, [
    { id: 3, username: 'Carol', email: 'carol@example.test' },
  ]);

  assert.match(once, /Additional assignees:/);
  assert.match(once, /Carol <carol@example\.test> \[ClickUp ID: 3\]/);
  assert.equal(once, twice);
});
