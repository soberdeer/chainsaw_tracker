/**
 * Tests for seed-script functions: buildTaskBody (exported) and the import-meta
 * round-trip (meta block embedded in description, read back by importedMeta).
 *
 * importedMeta and its helpers are internal, so they are exercised indirectly
 * through the description.raw output of buildTaskBody.
 */
import { buildTaskBody } from '../scripts/seed-openproject-from-clickup.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const baseType = {
  id: 1,
  name: 'Task',
  _links: { self: { href: '/api/v3/types/1' } },
};

const baseContext = {
  space: { id: 's1', name: 'Alpha Space' },
  folder: { id: 'f1', name: 'Beta Folder' },
  list: { id: 'l1', name: 'Gamma List' },
} as never;

const noFolderContext = {
  space: { id: 's2', name: 'Space Only' },
  folder: null,
  list: { id: 'l2', name: 'My List' },
} as never;

// ── buildTaskBody: subject ───────────────────────────────────────────────────

test('buildTaskBody sets subject from task name', () => {
  const body = buildTaskBody({
    task: { id: 'cu-1', name: 'My Feature', description: '' } as never,
    context: baseContext,
    type: baseType,
    openProjectStatuses: [],
    priorities: [],
  });

  assert.equal(body.subject, 'My Feature');
});

// ── buildTaskBody: type link ─────────────────────────────────────────────────

test('buildTaskBody includes type link when type is provided', () => {
  const body = buildTaskBody({
    task: { id: 'cu-2', name: 'Typed Task', description: '' } as never,
    context: baseContext,
    type: baseType,
    openProjectStatuses: [],
    priorities: [],
  });

  assert.equal((body._links as Record<string, { href?: string }>).type?.href, '/api/v3/types/1');
});

// ── buildTaskBody: assignee link ─────────────────────────────────────────────

test('buildTaskBody includes assignee link when assigneeHref is provided', () => {
  const body = buildTaskBody({
    task: { id: 'cu-3', name: 'Assigned Task', description: '' } as never,
    context: baseContext,
    type: baseType,
    openProjectStatuses: [],
    priorities: [],
    assigneeHref: '/api/v3/users/42',
  });

  assert.deepEqual((body._links as Record<string, { href?: string }>).assignee, {
    href: '/api/v3/users/42',
  });
});

test('buildTaskBody omits assignee link when assigneeHref is absent', () => {
  const body = buildTaskBody({
    task: { id: 'cu-4', name: 'Unassigned Task', description: '' } as never,
    context: baseContext,
    type: baseType,
    openProjectStatuses: [],
    priorities: [],
  });

  const links = body._links as Record<string, { href?: string } | undefined>;
  assert.ok(!links.assignee?.href);
});

// ── buildTaskBody: priority link ─────────────────────────────────────────────

test('buildTaskBody includes priority link when a matching priority exists', () => {
  const priorities = [{ id: 8, name: 'High', _links: { self: { href: '/api/v3/priorities/8' } } }];
  const body = buildTaskBody({
    task: {
      id: 'cu-5',
      name: 'High Priority Task',
      description: '',
      priority: { id: '2', priority: 'high' },
    } as never,
    context: baseContext,
    type: baseType,
    openProjectStatuses: [],
    priorities,
  });

  assert.equal(
    (body._links as Record<string, { href?: string }>).priority?.href,
    '/api/v3/priorities/8'
  );
});

test('buildTaskBody omits priority link when task has no priority', () => {
  const body = buildTaskBody({
    task: { id: 'cu-6', name: 'No Priority Task', description: '' } as never,
    context: baseContext,
    type: baseType,
    openProjectStatuses: [],
    priorities: [],
  });

  const links = body._links as Record<string, { href?: string } | undefined>;
  assert.ok(!links.priority?.href);
});

// ── buildTaskBody: dates ──────────────────────────────────────────────────────

test('buildTaskBody converts ClickUp millisecond timestamps to ISO date strings', () => {
  // 2026-05-01 00:00:00 UTC in ms
  const may1 = new Date('2026-05-01').getTime();
  // 2026-05-31 00:00:00 UTC in ms
  const may31 = new Date('2026-05-31').getTime();

  const body = buildTaskBody({
    task: {
      id: 'cu-7',
      name: 'Dated Task',
      description: '',
      start_date: String(may1),
      due_date: String(may31),
    } as never,
    context: baseContext,
    type: baseType,
    openProjectStatuses: [],
    priorities: [],
  });

  assert.equal(body.startDate, '2026-05-01');
  assert.equal(body.dueDate, '2026-05-31');
});

test('buildTaskBody omits startDate and dueDate when task has no timestamps', () => {
  const body = buildTaskBody({
    task: { id: 'cu-8', name: 'No Dates Task', description: '' } as never,
    context: baseContext,
    type: baseType,
    openProjectStatuses: [],
    priorities: [],
  });

  assert.equal(body.startDate, undefined);
  assert.equal(body.dueDate, undefined);
});

// ── buildTaskBody: description format ─────────────────────────────────────────

test('buildTaskBody sets description format to markdown', () => {
  const body = buildTaskBody({
    task: { id: 'cu-9', name: 'MD Task', description: 'Hello **world**' } as never,
    context: baseContext,
    type: baseType,
    openProjectStatuses: [],
    priorities: [],
  });

  assert.equal((body.description as { format: string }).format, 'markdown');
});

// ── buildTaskBody: import meta block ─────────────────────────────────────────

test('buildTaskBody embeds ClickUp task ID in description meta block', () => {
  const body = buildTaskBody({
    task: { id: 'CU-TASK-123', name: 'Meta Task', description: '' } as never,
    context: baseContext,
    type: baseType,
    openProjectStatuses: [],
    priorities: [],
  });

  const raw = (body.description as { raw: string }).raw;
  assert.match(raw, /ClickUp Task ID: CU-TASK-123/);
});

test('buildTaskBody embeds space and list names in meta block', () => {
  const body = buildTaskBody({
    task: { id: 'cu-meta', name: 'Hierarchy Task', description: '' } as never,
    context: baseContext,
    type: baseType,
    openProjectStatuses: [],
    priorities: [],
  });

  const raw = (body.description as { raw: string }).raw;
  assert.match(raw, /Space: Alpha Space/);
  assert.match(raw, /List: Gamma List/);
  assert.match(raw, /Folder: Beta Folder/);
});

test('buildTaskBody records original ClickUp path in meta block', () => {
  const body = buildTaskBody({
    task: { id: 'cu-path', name: 'Path Task', description: '' } as never,
    context: baseContext,
    type: baseType,
    openProjectStatuses: [],
    priorities: [],
  });

  const raw = (body.description as { raw: string }).raw;
  assert.match(raw, /Original Path:/);
  assert.match(raw, /Alpha Space/);
});

test('buildTaskBody meta block omits folder entries when folder is null', () => {
  const body = buildTaskBody({
    task: { id: 'cu-nofolder', name: 'No Folder Task', description: '' } as never,
    context: noFolderContext,
    type: baseType,
    openProjectStatuses: [],
    priorities: [],
  });

  const raw = (body.description as { raw: string }).raw;
  assert.doesNotMatch(raw, /Folder ID:/);
  assert.doesNotMatch(raw, /^Folder: /m);
});

test('buildTaskBody preserves existing task description before meta block', () => {
  const body = buildTaskBody({
    task: {
      id: 'cu-desc',
      name: 'Described Task',
      description: 'Important context here',
    } as never,
    context: baseContext,
    type: baseType,
    openProjectStatuses: [],
    priorities: [],
  });

  const raw = (body.description as { raw: string }).raw;
  assert.ok(raw.startsWith('Important context here'));
  assert.match(raw, /ClickUp Task ID: cu-desc/);
});

test('buildTaskBody uses markdown_description when available over description', () => {
  const body = buildTaskBody({
    task: {
      id: 'cu-md',
      name: 'MD Task',
      description: 'plain text',
      markdown_description: '**bold markdown**',
    } as never,
    context: baseContext,
    type: baseType,
    openProjectStatuses: [],
    priorities: [],
  });

  const raw = (body.description as { raw: string }).raw;
  assert.ok(raw.includes('**bold markdown**'));
  assert.ok(!raw.includes('plain text'));
});

// ── meta idempotency ──────────────────────────────────────────────────────────
// Re-running buildTaskBody on the same task should not double-append meta blocks.

test('buildTaskBody meta block does not double-append when description already contains meta', () => {
  // First pass
  const first = buildTaskBody({
    task: { id: 'cu-idem', name: 'Idempotent Task', description: '' } as never,
    context: baseContext,
    type: baseType,
    openProjectStatuses: [],
    priorities: [],
  });

  const rawFirst = (first.description as { raw: string }).raw;
  const occurrences = (rawFirst.match(/ClickUp Task ID: cu-idem/g) || []).length;
  assert.equal(occurrences, 1);
});
