import {
  buildWorkPackageFilters,
  getProjects,
  getTasks,
  inferCustomFieldKind,
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
