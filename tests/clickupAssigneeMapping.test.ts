import { splitClickUpAssignees } from '../scripts/migration/clickupAssignees.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('splitClickUpAssignees returns the first user as assignee', () => {
  const result = splitClickUpAssignees([
    { id: 1, username: 'Alice', email: 'alice@example.test' },
    { id: 2, username: 'Bob', email: 'bob@example.test' },
    { id: 3, username: 'Carol', email: 'carol@example.test' },
  ]);

  assert.equal(result.assignee?.id, 1);
});

test('splitClickUpAssignees de-duplicates repeated assignees', () => {
  const result = splitClickUpAssignees([
    { id: 1, username: 'Alice' },
    { id: 1, username: 'Alice' },
    { id: 2, username: 'Bob' },
  ]);

  assert.equal(result.assignee?.id, 1);
});

test('splitClickUpAssignees returns undefined assignee for empty list', () => {
  const result = splitClickUpAssignees([]);
  assert.equal(result.assignee, undefined);
});

test('splitClickUpAssignees handles undefined input', () => {
  const result = splitClickUpAssignees(undefined);
  assert.equal(result.assignee, undefined);
});
