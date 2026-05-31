import type { Request, Response } from 'express';
import type { OpenProjectUser } from '../openproject/types.js';
import crypto from 'node:crypto';

const cookieName = 'tracker_session';

function secret() {
  return process.env.SESSION_SECRET || process.env.OPENPROJECT_API_TOKEN || 'dev-session-secret';
}

function sign(value: string) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function parseCookies(header?: string) {
  return Object.fromEntries(
    (header || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

export type VerifyViaOpenProjectResult =
  | OpenProjectUser
  | null
  | 'MUST_CHANGE_PASSWORD'
  | 'OPENPROJECT_UNAVAILABLE';

/** If `input` looks like an email, resolve the actual OP login via the admin API. */
async function resolveOpenProjectLogin(
  input: string,
  baseUrl: string,
  adminToken: string
): Promise<string> {
  if (!input.includes('@')) return input;
  try {
    const authHeader = `Basic ${Buffer.from(`apikey:${adminToken}`).toString('base64')}`;
    const res = await fetch(`${baseUrl}/api/v3/users?pageSize=500&status=any`, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    if (!res.ok) return input;
    const body = (await res.json()) as {
      _embedded?: { elements?: Array<{ login?: string; email?: string }> };
    };
    const users = body._embedded?.elements ?? [];
    const match = users.find((u) => u.email?.toLowerCase() === input.toLowerCase());
    return match?.login || input;
  } catch {
    return input;
  }
}

async function fetchLoginPage(
  baseUrl: string
): Promise<{ sessionCookie: string; csrfToken: string } | null> {
  try {
    const res = await fetch(`${baseUrl}/login`, {
      headers: { Accept: 'text/html', 'User-Agent': 'OpenProjectTracker/1.0' },
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });
    const html = await res.text();
    const match = html.match(/name="authenticity_token"\s+value="([^"]+)"/);
    if (!match) return null;
    return {
      sessionCookie: res.headers.get('set-cookie') ?? '',
      csrfToken: match[1]!,
    };
  } catch {
    return null;
  }
}

let _opReadyRetries = 5;
let _opReadyRetryMs = 3_000;

export function _setOpRetryConfig(retries: number, delayMs: number): void {
  _opReadyRetries = retries;
  _opReadyRetryMs = delayMs;
}

export async function verifyViaOpenProject(
  login: string,
  password: string
): Promise<VerifyViaOpenProjectResult> {
  const baseUrl = (process.env.OPENPROJECT_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
  const adminToken = process.env.OPENPROJECT_API_TOKEN ?? '';

  try {
    const opLogin = await resolveOpenProjectLogin(login, baseUrl, adminToken);

    let loginPageData: { sessionCookie: string; csrfToken: string } | null = null;
    for (let attempt = 0; attempt < _opReadyRetries; attempt++) {
      loginPageData = await fetchLoginPage(baseUrl);
      if (loginPageData) break;
      if (attempt < _opReadyRetries - 1 && _opReadyRetryMs > 0) {
        await new Promise((r) => setTimeout(r, _opReadyRetryMs));
      }
    }
    if (!loginPageData) return 'OPENPROJECT_UNAVAILABLE';

    const { sessionCookie, csrfToken } = loginPageData;
    const sessionValue = sessionCookie.split(';')[0] ?? '';

    const params = new URLSearchParams({
      username: opLogin,
      password,
      authenticity_token: csrfToken,
    });

    const postRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: baseUrl,
        Referer: `${baseUrl}/login`,
        Cookie: sessionValue,
        'User-Agent': 'OpenProjectTracker/1.0',
      },
      body: params.toString(),
      redirect: 'manual',
    });

    if (postRes.status === 302) {
      const location = postRes.headers.get('location') ?? '';
      if (location.includes('change_password') || location.includes('change-password')) {
        return 'MUST_CHANGE_PASSWORD';
      }
    } else {
      return null;
    }

    const filter = encodeURIComponent(
      JSON.stringify([{ login: { operator: '=', values: [opLogin] } }])
    );
    const usersRes = await fetch(`${baseUrl}/api/v3/users?filters=${filter}&pageSize=1`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`apikey:${adminToken}`).toString('base64')}`,
        Accept: 'application/json',
      },
    });

    if (!usersRes.ok) return null;

    const usersBody = (await usersRes.json()) as {
      _embedded?: { elements?: OpenProjectUser[] };
    };
    const user = usersBody._embedded?.elements?.[0];
    if (!user) return null;

    return user;
  } catch {
    return null;
  }
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  login: string;
  admin: boolean;
  avatarUrl?: string;
}

export function setSessionCookie(res: Response, user: SessionUser) {
  const payload = Buffer.from(JSON.stringify(user)).toString('base64url');
  const token = `${payload}.${sign(payload)}`;
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 14,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(cookieName, { path: '/' });
}

export function currentUser(req: Request): SessionUser | null {
  const token = parseCookies(req.header('cookie'))[cookieName];
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionUser;
  } catch {
    return null;
  }
}

export function currentUserId(req: Request): string | null {
  return currentUser(req)?.id ?? null;
}

export async function requireCurrentUser(req: Request): Promise<SessionUser> {
  const user = currentUser(req);
  if (!user) {
    const error = new Error('Authentication required');
    Object.assign(error, { statusCode: 401 });
    throw error;
  }
  return user;
}
