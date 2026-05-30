import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ensureOpenProjectRuntimeWorkspaceScaffold } from '../openproject/localPermissions.js';
import {
  clearSessionCookie,
  currentUser,
  requireCurrentUser,
  setSessionCookie,
  verifyViaOpenProject,
} from '../services/auth.js';

export const authRouter = Router();

async function ensureWorkspace() {
  return ensureOpenProjectRuntimeWorkspaceScaffold();
}

authRouter.get('/setup-status', async (_req, res) => {
  const workspace = await ensureWorkspace();
  res.json({
    setupRequired: false,
    ownerCount: 1,
    userCount: await prisma.user.count(),
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
    devDefaultOwnerEnabled: false,
  });
});

authRouter.get('/openproject-url', (_req, res) => {
  res.json({
    url: (process.env.OPENPROJECT_BASE_URL || 'http://localhost:8080').replace(/\/$/, ''),
  });
});

authRouter.post('/login', async (req, res) => {
  const body = z.object({ login: z.string().min(1), password: z.string().min(1) }).parse(req.body);

  const result = await verifyViaOpenProject(body.login, body.password);

  if (result === 'MUST_CHANGE_PASSWORD') {
    res.status(403).json({
      error: 'MUST_CHANGE_PASSWORD',
      openProjectUrl: (process.env.OPENPROJECT_BASE_URL || 'http://localhost:8080').replace(
        /\/$/,
        ''
      ),
    });
    return;
  }

  if (!result) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const opUser = result;

  const workspace = await ensureWorkspace();

  // Find or create local user record — no password stored
  const email = opUser.email || opUser.login || body.login;
  const name = (opUser as any).name || opUser.login || email;

  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        openProjectUserId: String(opUser.id),
        openProjectLogin: opUser.login || undefined,
        name: user.name || name,
        // Clear any stale local password
        passwordHash: null,
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        email,
        name,
        openProjectUserId: String(opUser.id),
        openProjectLogin: opUser.login || undefined,
        lastLoginAt: new Date(),
        source: 'LOCAL',
      },
    });
  }

  // Ensure workspace membership
  const existing = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
  });
  if (!existing) {
    // First OpenProject admin to log in becomes workspace OWNER
    const adminCount = await prisma.membership.count({
      where: { workspaceId: workspace.id, role: 'ADMIN' },
    });
    const role = adminCount === 0 || (opUser as any).admin === true ? 'ADMIN' : 'MEMBER';
    await prisma.membership.create({
      data: { userId: user.id, workspaceId: workspace.id, role },
    });
  }

  setSessionCookie(res, user.id);
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    source: user.source,
    openProjectUserId: user.openProjectUserId,
    openProjectLogin: user.openProjectLogin,
    lastLoginAt: user.lastLoginAt,
  });
});

authRouter.get('/me', async (req, res) => {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    source: user.source,
    openProjectUserId: user.openProjectUserId,
    openProjectLogin: user.openProjectLogin,
    lastLoginAt: user.lastLoginAt,
  });
});

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.patch('/me', async (req, res) => {
  const user = await requireCurrentUser(req);
  const body = z
    .object({
      name: z.string().max(120).optional(),
      avatarUrl: z.string().url().nullable().optional(),
    })
    .parse(req.body);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: body,
  });
  res.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    avatarUrl: updated.avatarUrl,
    source: updated.source,
    openProjectUserId: updated.openProjectUserId,
    openProjectLogin: updated.openProjectLogin,
    lastLoginAt: updated.lastLoginAt,
  });
});
