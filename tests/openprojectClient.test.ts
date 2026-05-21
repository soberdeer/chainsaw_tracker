import { openProjectRequest } from '../server/openproject/client.js';
import { OpenProjectConfigError } from '../server/openproject/errors.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const originalToken = process.env.OPENPROJECT_API_TOKEN;
const originalBaseUrl = process.env.OPENPROJECT_BASE_URL;
const originalAuthMode = process.env.OPENPROJECT_AUTH_MODE;
const originalFetch = globalThis.fetch;

test.afterEach(() => {
  if (originalToken === undefined) delete process.env.OPENPROJECT_API_TOKEN;
  else process.env.OPENPROJECT_API_TOKEN = originalToken;
  if (originalBaseUrl === undefined) delete process.env.OPENPROJECT_BASE_URL;
  else process.env.OPENPROJECT_BASE_URL = originalBaseUrl;
  if (originalAuthMode === undefined) delete process.env.OPENPROJECT_AUTH_MODE;
  else process.env.OPENPROJECT_AUTH_MODE = originalAuthMode;
  globalThis.fetch = originalFetch;
});

test('OpenProject client requires OPENPROJECT_API_TOKEN', async () => {
  delete process.env.OPENPROJECT_API_TOKEN;
  await assert.rejects(() => openProjectRequest('/api/v3/projects'), OpenProjectConfigError);
});

test('OpenProject client sends API token through Basic auth', async () => {
  process.env.OPENPROJECT_API_TOKEN = 'op_test_token';
  process.env.OPENPROJECT_BASE_URL = 'http://openproject.test';
  let authorization = '';
  globalThis.fetch = (async (_url, init) => {
    authorization = new Headers(init?.headers).get('Authorization') || '';
    return new Response(JSON.stringify({ _embedded: { elements: [] } }), { status: 200 });
  }) as typeof fetch;

  await openProjectRequest('/api/v3/projects');
  assert.equal(authorization, `Basic ${Buffer.from('apikey:op_test_token').toString('base64')}`);
});

test('OpenProject client can send API token through Bearer auth', async () => {
  process.env.OPENPROJECT_API_TOKEN = 'op_test_token';
  process.env.OPENPROJECT_AUTH_MODE = 'bearer';
  let authorization = '';
  globalThis.fetch = (async (_url, init) => {
    authorization = new Headers(init?.headers).get('Authorization') || '';
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  await openProjectRequest('/api/v3/projects');
  assert.equal(authorization, 'Bearer op_test_token');
});

test('OpenProject client normalizes non-OK responses', async () => {
  process.env.OPENPROJECT_API_TOKEN = 'op_test_token';
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ message: 'No auth' }), { status: 401 })) as typeof fetch;

  await assert.rejects(
    () => openProjectRequest('/api/v3/projects'),
    (error: unknown) =>
      error instanceof Error &&
      error.message === 'No auth' &&
      (error as { statusCode?: number }).statusCode === 401
  );
});

test('OpenProject client handles non-JSON API errors', async () => {
  process.env.OPENPROJECT_API_TOKEN = 'op_test_token';
  globalThis.fetch = (async () =>
    new Response('<html>bad gateway</html>', {
      status: 502,
      statusText: 'Bad Gateway',
    })) as typeof fetch;

  await assert.rejects(
    () => openProjectRequest('/api/v3/projects'),
    (error: unknown) =>
      error instanceof Error &&
      error.message === 'Bad Gateway' &&
      (error as { statusCode?: number }).statusCode === 502
  );
});

test('OpenProject client normalizes timeout', async () => {
  process.env.OPENPROJECT_API_TOKEN = 'op_test_token';
  globalThis.fetch = (async () => {
    const error = new Error('timeout');
    error.name = 'AbortError';
    throw error;
  }) as typeof fetch;

  await assert.rejects(
    () => openProjectRequest('/api/v3/projects'),
    (error: unknown) =>
      error instanceof Error &&
      error.message === 'OpenProject API request timed out' &&
      (error as { statusCode?: number }).statusCode === 504
  );
});
