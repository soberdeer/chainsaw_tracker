import type { Request, Response } from 'express';
import { prisma } from '../db.js';
import crypto from 'node:crypto';

const cookieName = 'tracker_session';
const defaultPassword = process.env.DEV_ADMIN_PASSWORD || 'admin123';

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

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = crypto.scryptSync(password, salt, 64).toString('base64url');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored?: string | null) {
  if (!stored) return false;
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('base64url');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
}

export async function ensureDefaultOwner() {
  const passwordHash = hashPassword(defaultPassword);
  const existing = await prisma.user.findUnique({ where: { email: 'owner@local.app' } });
  if (existing) {
    if (!existing.passwordHash) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          source: existing.source || 'OWNER_SEED',
        },
      });
    }
    return existing;
  }
  return prisma.user.create({
    data: {
      id: 'local-user',
      email: 'owner@local.app',
      name: 'Workspace Owner',
      passwordHash,
      source: 'OWNER_SEED',
    },
  });
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
