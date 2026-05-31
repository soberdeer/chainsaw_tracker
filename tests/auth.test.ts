import type { Request, Response } from 'express';
import {
  _setOpRetryConfig,
  clearSessionCookie,
  currentUserId,
  setSessionCookie,
  verifyViaOpenProject,
} from '../server/services/auth.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

// Use a deterministic secret so cookie construction in tests is reproducible.
process.env.SESSION_SECRET = 'auth-test-secret-key';

const COOKIE_NAME = 'tracker_session';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSessionUser(id: string) {
  return { id, email: `${id}@test.com`, name: id, login: id, admin: false };
}

function makeSignedCookie(id: string, secret = 'auth-test-secret-key') {
  const payload = Buffer.from(JSON.stringify(makeSessionUser(id))).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${COOKIE_NAME}=${payload}.${signature}`;
}

function makeReq(cookieHeader?: string): Request {
  return {
    header: (name: string) => (name.toLowerCase() === 'cookie' ? (cookieHeader ?? '') : undefined),
  } as unknown as Request;
}

// ── currentUserId ──────────────────────────────────────────────────────────

test('currentUserId extracts userId from a valid signed cookie', () => {
  const req = makeReq(makeSignedCookie('user-abc'));
  assert.equal(currentUserId(req), 'user-abc');
});

test('currentUserId returns null when no cookie is present', () => {
  assert.equal(currentUserId(makeReq()), null);
  assert.equal(currentUserId(makeReq('')), null);
});

test('currentUserId returns null when signature is tampered', () => {
  const payload = Buffer.from(JSON.stringify(makeSessionUser('hacker'))).toString('base64url');
  const badToken = `${payload}.invalidsignature`;
  const req = makeReq(`${COOKIE_NAME}=${badToken}`);
  assert.equal(currentUserId(req), null);
});

test('currentUserId returns null when payload is not valid base64url JSON', () => {
  // Good signature but garbage payload
  const payload = 'notbase64!!';
  const secret = process.env.SESSION_SECRET!;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const req = makeReq(`${COOKIE_NAME}=${payload}.${signature}`);
  assert.equal(currentUserId(req), null);
});

test('currentUserId returns null when id field is missing from payload', () => {
  const payload = Buffer.from(JSON.stringify({ email: 'test@example.com' })).toString('base64url');
  const secret = process.env.SESSION_SECRET!;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const req = makeReq(`${COOKIE_NAME}=${payload}.${signature}`);
  assert.equal(currentUserId(req), null);
});

test('currentUserId returns null when cookie was signed with a different secret', () => {
  const req = makeReq(makeSignedCookie('user-xyz', 'wrong-secret'));
  assert.equal(currentUserId(req), null);
});

test('currentUserId ignores other cookies and reads tracker_session specifically', () => {
  const validCookie = makeSignedCookie('user-1');
  const combined = `other_cookie=somevalue; ${validCookie}; third=value`;
  assert.equal(currentUserId(makeReq(combined)), 'user-1');
});

test('currentUserId handles cookie header with encoded characters', () => {
  // values are decoded with decodeURIComponent during parseCookies
  const req = makeReq(makeSignedCookie('user-special'));
  assert.equal(currentUserId(req), 'user-special');
});

// ── setSessionCookie ────────────────────────────────────────────────────────

test('setSessionCookie sets a signed httpOnly cookie on the response', () => {
  const cookies: Array<[string, string, object]> = [];
  const res = {
    cookie: (name: string, value: string, options: object) => {
      cookies.push([name, value, options]);
    },
  } as unknown as Response;

  setSessionCookie(res, makeSessionUser('user-99'));

  assert.equal(cookies.length, 1);
  const [name, value, options] = cookies[0]!;
  assert.equal(name, COOKIE_NAME);
  assert.ok(
    typeof value === 'string' && value.includes('.'),
    'cookie value should contain a dot separator'
  );

  const req = makeReq(`${name}=${value}`);
  assert.equal(currentUserId(req), 'user-99');

  assert.equal((options as Record<string, unknown>).httpOnly, true);
});

test('setSessionCookie produces a different token for each userId', () => {
  const cookies: string[] = [];
  const res = {
    cookie: (_n: string, value: string) => cookies.push(value),
  } as unknown as Response;

  setSessionCookie(res, makeSessionUser('user-a'));
  setSessionCookie(res, makeSessionUser('user-b'));

  assert.notEqual(cookies[0], cookies[1]);
});

// ── clearSessionCookie ──────────────────────────────────────────────────────

test('clearSessionCookie clears the tracker_session cookie', () => {
  const cleared: Array<[string, object]> = [];
  const res = {
    clearCookie: (name: string, options: object) => cleared.push([name, options]),
  } as unknown as Response;

  clearSessionCookie(res);

  assert.equal(cleared.length, 1);
  assert.equal(cleared[0]![0], COOKIE_NAME);
});

// ── verifyViaOpenProject ────────────────────────────────────────────────────
//
// The new flow makes 3 sequential fetch calls:
//   1. GET  /login              — retrieve CSRF token + session cookie
//   2. POST /login              — submit credentials, inspect redirect
//   3. GET  /api/v3/users?...   — look up user via admin token (on success)
//
// mockFetchSequence() lets each call return a different fake response.

const LOGIN_PAGE_HTML = `
<html lang="en"><body>
<input name="authenticity_token" value="test-csrf-token">
</body></html>
`;

interface FakeFetchResponse {
  status: number;
  ok: boolean;
  headers: Headers;
  text?: () => Promise<string>;
  json?: () => Promise<unknown>;
}

function mockFetchSequence(responses: FakeFetchResponse[]) {
  const original = globalThis.fetch;
  let idx = 0;
  globalThis.fetch = (() => {
    const r = responses[idx] ?? responses[responses.length - 1]!;
    idx++;
    return Promise.resolve({
      ...r,
      text: r.text ?? (() => Promise.resolve('')),
      json: r.json ?? (() => Promise.resolve(null)),
    });
  }) as unknown as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

// Helper: builds the standard 3-response sequence for a successful login
function successSequence(user: unknown) {
  return [
    // Step 1 — GET /login page with CSRF token
    {
      status: 200,
      ok: true,
      headers: new Headers({ 'set-cookie': '_open_project_session=abc123; Path=/' }),
      text: () => Promise.resolve(LOGIN_PAGE_HTML),
    },
    // Step 2 — POST /login: credentials accepted, redirect to dashboard/2FA
    {
      status: 302,
      ok: false,
      headers: new Headers({ location: 'http://localhost:8080/two_factor_authentication/request' }),
    },
    // Step 3 — GET /api/v3/users (admin token lookup)
    {
      status: 200,
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ _embedded: { elements: [user] } }),
    },
  ] satisfies FakeFetchResponse[];
}

test('verifyViaOpenProject returns user when credentials are valid', async () => {
  const user = { id: 1, name: 'Admin', login: 'admin', email: 'admin@example.com', _links: {} };
  const restore = mockFetchSequence(successSequence(user));
  try {
    const result = await verifyViaOpenProject('admin', 'correct-password');
    assert.deepEqual(result, user);
  } finally {
    restore();
  }
});

test('verifyViaOpenProject returns OPENPROJECT_UNAVAILABLE when GET /login fails', async () => {
  _setOpRetryConfig(1, 0); // 1 attempt, no delay — keeps test fast
  const original = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch;
  try {
    const result = await verifyViaOpenProject('admin', 'pass');
    assert.equal(result, 'OPENPROJECT_UNAVAILABLE');
  } finally {
    globalThis.fetch = original;
    _setOpRetryConfig(5, 3_000); // restore production defaults
  }
});

test('verifyViaOpenProject returns OPENPROJECT_UNAVAILABLE when login page has no CSRF token', async () => {
  _setOpRetryConfig(1, 0); // 1 attempt, no delay — keeps test fast
  const restore = mockFetchSequence([
    {
      status: 200,
      ok: true,
      headers: new Headers(),
      text: () => Promise.resolve('<html lang="en">no form here</html>'),
    },
  ]);
  try {
    const result = await verifyViaOpenProject('admin', 'pass');
    assert.equal(result, 'OPENPROJECT_UNAVAILABLE');
  } finally {
    restore();
    _setOpRetryConfig(5, 3_000); // restore production defaults
  }
});

test('verifyViaOpenProject returns null for invalid credentials (422)', async () => {
  const restore = mockFetchSequence([
    {
      status: 200,
      ok: true,
      headers: new Headers({ 'set-cookie': '_open_project_session=abc; Path=/' }),
      text: () => Promise.resolve(LOGIN_PAGE_HTML),
    },
    // POST returns 422 — bad credentials
    {
      status: 422,
      ok: false,
      headers: new Headers(),
    },
  ]);
  try {
    const result = await verifyViaOpenProject('admin', 'wrong-password');
    assert.equal(result, null);
  } finally {
    restore();
  }
});

test('verifyViaOpenProject returns MUST_CHANGE_PASSWORD when POST redirects to change_password', async () => {
  const restore = mockFetchSequence([
    {
      status: 200,
      ok: true,
      headers: new Headers({ 'set-cookie': '_open_project_session=abc; Path=/' }),
      text: () => Promise.resolve(LOGIN_PAGE_HTML),
    },
    {
      status: 302,
      ok: false,
      headers: new Headers({ location: 'http://localhost:8080/account/change_password' }),
    },
  ]);
  try {
    const result = await verifyViaOpenProject('admin', 'default-password');
    assert.equal(result, 'MUST_CHANGE_PASSWORD');
  } finally {
    restore();
  }
});

test('verifyViaOpenProject returns null when admin user lookup returns empty list', async () => {
  const restore = mockFetchSequence([
    {
      status: 200,
      ok: true,
      headers: new Headers({ 'set-cookie': '_open_project_session=abc; Path=/' }),
      text: () => Promise.resolve(LOGIN_PAGE_HTML),
    },
    {
      status: 302,
      ok: false,
      headers: new Headers({ location: 'http://localhost:8080/two_factor_authentication/request' }),
    },
    {
      status: 200,
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ _embedded: { elements: [] } }),
    },
  ]);
  try {
    const result = await verifyViaOpenProject('ghost', 'pass');
    assert.equal(result, null);
  } finally {
    restore();
  }
});

test('verifyViaOpenProject returns OPENPROJECT_UNAVAILABLE when fetch throws a network error', async () => {
  _setOpRetryConfig(1, 0);
  const original = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch;
  try {
    const result = await verifyViaOpenProject('admin', 'pass');
    assert.equal(result, 'OPENPROJECT_UNAVAILABLE');
  } finally {
    globalThis.fetch = original;
    _setOpRetryConfig(5, 3_000);
  }
});
