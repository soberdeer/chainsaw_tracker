import {
  clickUpAssigneeDisplayName,
  splitClickUpAssignees,
} from '../scripts/migration/clickupAssignees.js';
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

// ─── clickUpAssigneeDisplayName ──────────────────────────────────────────────

test('clickUpAssigneeDisplayName returns username when present', () => {
  assert.equal(
    clickUpAssigneeDisplayName({ id: 1, username: 'alice', email: 'alice@example.com' }),
    'alice'
  );
});

test('clickUpAssigneeDisplayName falls back to lowercase email when username is absent', () => {
  assert.equal(clickUpAssigneeDisplayName({ id: 2, email: 'Bob@Example.COM' }), 'bob@example.com');
});

test('clickUpAssigneeDisplayName falls back to ClickUp User <id> when both are absent', () => {
  assert.equal(clickUpAssigneeDisplayName({ id: 42 }), 'ClickUp User 42');
});

test('clickUpAssigneeDisplayName trims whitespace from username', () => {
  assert.equal(clickUpAssigneeDisplayName({ id: 3, username: '  carol  ' }), 'carol');
});

test('clickUpAssigneeDisplayName uses email when username is an empty string', () => {
  assert.equal(
    clickUpAssigneeDisplayName({ id: 4, username: '', email: 'dave@example.com' }),
    'dave@example.com'
  );
});
