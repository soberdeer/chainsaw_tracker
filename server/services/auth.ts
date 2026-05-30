import type { Request, Response } from 'express';
import { prisma } from '../db.js';
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

export type VerifyViaOpenProjectResult = OpenProjectUser | null | 'MUST_CHANGE_PASSWORD';

/**
 * Verify a user's OpenProject credentials via the web login form.
 *
 * OpenProject's REST API does NOT support login:password Basic Auth —
 * only `apikey:<token>` format is accepted. To verify regular credentials
 * we simulate a browser login:
 *   1. GET /login  → extract CSRF token + session cookie
 *   2. POST /login → check redirect target
 *      - 302 to change_password → MUST_CHANGE_PASSWORD
 *      - 302 to anything else   → credentials valid, fetch user via admin token
 *      - 422 / no redirect      → invalid credentials
 *   3. Look up the authenticated user via the admin API token.
 *
 * Returns:
 *   - OpenProjectUser        — credentials are valid
 *   - 'MUST_CHANGE_PASSWORD' — valid but OP requires a password change first
 *   - null                   — invalid credentials or network error
 */
export async function verifyViaOpenProject(
  login: string,
  password: string
): Promise<VerifyViaOpenProjectResult> {
  const baseUrl = (process.env.OPENPROJECT_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
  const adminToken = process.env.OPENPROJECT_API_TOKEN ?? '';

  try {
    // ── Step 1: GET /login to obtain CSRF token + session cookie ──────────────
    const loginPage = await fetch(`${baseUrl}/login`, {
      headers: { Accept: 'text/html', 'User-Agent': 'OpenProjectTracker/1.0' },
      redirect: 'manual',
    });

    const sessionCookie = loginPage.headers.get('set-cookie') ?? '';
    const html = await loginPage.text();

    // Extract the authenticity_token from the HTML form
    const csrfMatch = html.match(/name="authenticity_token"\s+value="([^"]+)"/);
    if (!csrfMatch) return null; // OP unavailable or unexpected HTML
    const csrfToken = csrfMatch[1]!;

    // Extract just the cookie value (may be multiple; take the session one)
    const sessionValue = sessionCookie.split(';')[0] ?? '';

    // ── Step 2: POST /login with credentials ──────────────────────────────────
    const params = new URLSearchParams({
      username: login,
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
      // Any other 302 = credentials accepted (dashboard, 2FA setup prompt, etc.)
    } else {
      // 422 = bad credentials; anything else = error
      return null;
    }

    // ── Step 3: Look up the user via admin API token ───────────────────────────
    // Encode login for the filter JSON
    const filter = encodeURIComponent(
      JSON.stringify([{ login: { operator: '=', values: [login] } }])
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

export function setSessionCookie(res: Response, userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId })).toString('base64url');
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

export function currentUserId(req: Request) {
  const token = parseCookies(req.header('cookie'))[cookieName];
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      userId?: string;
    };
    return parsed.userId || null;
  } catch {
    return null;
  }
}

export async function currentUser(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function requireCurrentUser(req: Request) {
  const user = await currentUser(req);
  if (!user) {
    const error = new Error('Authentication required');
    Object.assign(error, { statusCode: 401 });
    throw error;
  }
  return user;
}
