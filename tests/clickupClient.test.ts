import { clickUpRequest } from '../server/clickup/client.js';
import { ClickUpConfigError } from '../server/clickup/errors.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const originalToken = process.env.CLICKUP_TOKEN;
const originalFetch = globalThis.fetch;

test.afterEach(() => {
  process.env.CLICKUP_TOKEN = originalToken;
  globalThis.fetch = originalFetch;
});

test('ClickUp client requires CLICKUP_TOKEN', async () => {
  delete process.env.CLICKUP_TOKEN;
  await assert.rejects(() => clickUpRequest('/team'), ClickUpConfigError);
});

test('ClickUp client sends personal token in Authorization header', async () => {
  process.env.CLICKUP_TOKEN = 'pk_test_token';
  let authorization = '';
  globalThis.fetch = (async (_url, init) => {
    authorization = new Headers(init?.headers).get('Authorization') || '';
    return new Response(JSON.stringify({ teams: [] }), { status: 200 });
  }) as typeof fetch;

  await clickUpRequest('/team');
  assert.equal(authorization, 'pk_test_token');
});

test('ClickUp client normalizes non-OK responses', async () => {
  process.env.CLICKUP_TOKEN = 'pk_test_token';
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ err: 'No auth' }), { status: 401 })) as typeof fetch;

  await assert.rejects(
    () => clickUpRequest('/team'),
    (error: unknown) =>
      error instanceof Error &&
      error.message === 'No auth' &&
      (error as { statusCode?: number }).statusCode === 401
  );
});
