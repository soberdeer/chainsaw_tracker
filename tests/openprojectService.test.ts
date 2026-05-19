import { buildWorkPackageFilters } from '../server/openproject/service.js';
import assert from 'node:assert/strict';
import test from 'node:test';

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
