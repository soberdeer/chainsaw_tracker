import {
  addTaskTimeEntry,
  buildWorkPackageFilters,
  getProjects,
  getTasks,
  inferCustomFieldKind,
  matchesLocalTaskFilters,
} from '../server/openproject/service.js';
import assert from 'node:assert/strict';
import test from 'node:test';

type FetchInput = Parameters<typeof fetch>[0];

const originalFetch = globalThis.fetch;
const originalToken = process.env.OPENPROJECT_API_TOKEN;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.OPENPROJECT_API_TOKEN;
  else process.env.OPENPROJECT_API_TOKEN = originalToken;
});

test('buildWorkPackageFilters maps OpenProject filters', async () => {
  process.env.OPENPROJECT_API_TOKEN = 'op_test_token';
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        _embedded: {
          elements: [
            { id: 7, name: 'Normal', _links: { self: { href: '/api/v3/priorities/7' } } },
            { id: 9, name: 'High', _links: { self: { href: '/api/v3/priorities/9' } } },
          ],
        },
      }),
      { status: 200 }
    )) as typeof fetch;

  const filters = await buildWorkPackageFilters({
    status: 'op-status:12:clickup-status:complete',
    assignees: ['4'],
    priority: 'HIGH',
    search: 'prototype',
  });

  assert.deepEqual(filters, [
    { status: { operator: '=', values: ['12'] } },
    { assignee: { operator: '=', values: ['4'] } },
    { priority: { operator: '=', values: ['9'] } },
    { subject: { operator: '~', values: ['prototype'] } },
  ]);
});

test('buildWorkPackageFilters includes responsible and type filters', async () => {
  const filters = await buildWorkPackageFilters({
    responsibles: ['12'],
    typeIds: ['7'],
  });

  assert.deepEqual(filters, [
    { status: { operator: '*', values: [] } },
    { responsible: { operator: '=', values: ['12'] } },
    { type: { operator: '=', values: ['7'] } },
  ]);
});

test('buildWorkPackageFilters includes all statuses by default', async () => {
  const filters = await buildWorkPackageFilters({});
  assert.deepEqual(filters, [{ status: { operator: '*', values: [] } }]);
});

test('getTasks sends OpenProject filters to the work package request', async () => {
  process.env.OPENPROJECT_API_TOKEN = 'op_test_token';
  const requests: URL[] = [];
  globalThis.fetch = (async (input: FetchInput) => {
    const url = new URL(String(input));
    requests.push(url);

    if (url.pathname === '/api/v3/users') {
      return new Response(JSON.stringify({ _embedded: { elements: [] } }), { status: 200 });
    }

    if (url.pathname === '/api/v3/priorities') {
      return new Response(
        JSON.stringify({
          _embedded: {
            elements: [{ id: 9, name: 'High', _links: { self: { href: '/api/v3/priorities/9' } } }],
          },
        }),
        { status: 200 }
      );
    }

    if (url.pathname === '/api/v3/projects/42/work_packages') {
      return new Response(JSON.stringify({ total: 0, _embedded: { elements: [] } }), {
        status: 200,
      });
    }

    return new Response(JSON.stringify({ message: `Unexpected ${url.pathname}` }), {
      status: 404,
    });
  }) as typeof fetch;

  await getTasks('42', {
    status: 'op-status:12:status',
    assignees: ['4'],
    priority: 'HIGH',
    search: 'prototype',
    limit: 25,
  });

  const workPackagesRequest = requests.find(
    (request) => request.pathname === '/api/v3/projects/42/work_packages'
  );
  assert.ok(workPackagesRequest);
  assert.equal(workPackagesRequest.searchParams.get('pageSize'), '25');
  assert.deepEqual(JSON.parse(workPackagesRequest.searchParams.get('filters') || '[]'), [
    { status: { operator: '=', values: ['12'] } },
    { assignee: { operator: '=', values: ['4'] } },
    { priority: { operator: '=', values: ['9'] } },
    { subject: { operator: '~', values: ['prototype'] } },
  ]);
});

test('getProjects hides migration and demo OpenProject projects from runtime', async () => {
  process.env.OPENPROJECT_API_TOKEN = 'op_test_token';
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        _embedded: {
          elements: [
            { id: 1, identifier: 'clickupimport', name: 'ClickUpImport', _links: {} },
            { id: 2, identifier: 'scrumproject', name: 'ScrumProject', _links: {} },
            { id: 3, identifier: 'demo-project', name: 'Demo Project', _links: {} },
            { id: 4, identifier: 'real-space', name: 'Real Space', _links: {} },
          ],
        },
      }),
      { status: 200 }
    )) as typeof fetch;

  const projects = await getProjects();

  assert.deepEqual(
    projects.map((project) => project.name),
    ['Real Space']
  );
});

test('inferCustomFieldKind recognises editable scalar field types', () => {
  assert.equal(inferCustomFieldKind('plain text'), 'text');
  assert.equal(inferCustomFieldKind('2026-05-20'), 'date');
  assert.equal(inferCustomFieldKind('Line 1\nLine 2'), 'textarea');
  assert.equal(inferCustomFieldKind(7), 'integer');
  assert.equal(inferCustomFieldKind(7.5), 'float');
  assert.equal(inferCustomFieldKind(true), 'boolean');
  assert.equal(inferCustomFieldKind({ title: 'Option' }), 'readonly');
});

test('matchesLocalTaskFilters handles overdue, updated, tags, GitHub PR, and due-by filters', () => {
  const task = {
    id: '42',
    title: 'Prototype combat pass',
    status: 'In progress',
    priority: 'HIGH',
    tags: [{ tag: { id: 'tag-a', name: 'bug', color: '#e03131' } }],
    githubPullRequests: [
      {
        id: 'pr-1',
        number: 12,
        title: 'PR',
        url: 'https://github.com/demo/game/pull/12',
        state: 'OPEN',
        reviewStatus: 'IN_REVIEW',
      },
    ],
    dueDate: '2026-05-10',
    updatedAt: '2026-05-21T12:00:00.000Z',
  } as any;

  assert.equal(matchesLocalTaskFilters(task, { overdue: true }), true);
  assert.equal(matchesLocalTaskFilters(task, { dueBefore: '2026-05-11' }), true);
  assert.equal(matchesLocalTaskFilters(task, { updatedSince: '2026-05-20' }), true);
  assert.equal(matchesLocalTaskFilters(task, { tagIds: ['tag-a'] }), true);
  assert.equal(matchesLocalTaskFilters(task, { hasGitHubPr: true }), true);
  assert.equal(matchesLocalTaskFilters(task, { tagIds: ['tag-missing'] }), false);
  assert.equal(matchesLocalTaskFilters(task, { dueBefore: '2026-05-09' }), false);
  assert.equal(matchesLocalTaskFilters(task, { updatedSince: '2026-05-22' }), false);
});

test('addTaskTimeEntry sends the selected OpenProject activity id', async () => {
  process.env.OPENPROJECT_API_TOKEN = 'op_test_token';
  const requests: Array<{ url: URL; body?: any }> = [];

  globalThis.fetch = (async (input: FetchInput, init?: RequestInit) => {
    const url = new URL(String(input));
    const body =
      typeof init?.body === 'string'
        ? JSON.parse(init.body)
        : init?.body
          ? String(init.body)
          : null;
    requests.push({ url, body });

    if (url.pathname === '/api/v3/time_entries' && init?.method === 'POST') {
      return new Response(
        JSON.stringify({
          id: 17,
          hours: 'PT1H',
          spentOn: '2026-05-22',
          comment: { raw: 'Prototype pass' },
          createdAt: '2026-05-22T10:00:00.000Z',
          _links: {
            user: { href: '/api/v3/users/1' },
            activity: { href: '/api/v3/time_entries/activities/7', title: 'Development' },
          },
        }),
        { status: 201 }
      );
    }

    if (url.pathname === '/api/v3/users') {
      return new Response(JSON.stringify({ _embedded: { elements: [] } }), { status: 200 });
    }

    return new Response(JSON.stringify({ message: `Unexpected ${url.pathname}` }), { status: 404 });
  }) as typeof fetch;

  await addTaskTimeEntry('42', {
    hours: 1,
    spentOn: '2026-05-22',
    comment: 'Prototype pass',
    activityId: '7',
  });

  const request = requests.find(({ url }) => url.pathname === '/api/v3/time_entries');
  assert.ok(request);
  assert.equal(request?.body?._links?.activity?.href, '/api/v3/time_entries/activities/7');
});
