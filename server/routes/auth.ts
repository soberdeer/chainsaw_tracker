import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ensureOpenProjectRuntimeWorkspaceScaffold } from '../openproject/localPermissions.js';
import {
  clearSessionCookie,
  currentUser,
  devDefaultOwnerEnabled,
  requireCurrentUser,
  setSessionCookie,
  hashPassword,
  verifyPassword,
} from '../services/auth.js';

export const authRouter = Router();

async function setupStatus() {
  const workspace = await ensureOpenProjectRuntimeWorkspaceScaffold();
  const [userCount, ownerCount] = await Promise.all([
    prisma.user.count(),
    prisma.membership.count({
      where: {
        workspaceId: workspace.id,
        role: 'OWNER',
      },
    }),
  ]);

  return {
    setupRequired: ownerCount === 0,
    ownerCount,
    userCount,
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    },
    devDefaultOwnerEnabled: devDefaultOwnerEnabled(),
  };
}

authRouter.get('/setup-status', async (_req, res) => {
  res.json(await setupStatus());
});

authRouter.post('/setup-owner', async (req, res) => {
  const body = z
    .object({
      workspaceName: z.string().trim().min(2).max(120).optional(),
      name: z.string().trim().min(1).max(120),
      email: z.string().email(),
      password: z.string().min(8),
      confirmPassword: z.string().min(8),
    })
    .parse(req.body);

  if (body.password !== body.confirmPassword) {
    res.status(400).json({ error: 'Password confirmation does not match' });
    return;
  }

  const status = await setupStatus();
  if (!status.setupRequired) {
    res.status(409).json({ error: 'First-run setup is already complete' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    res.status(409).json({ error: 'A user with this email already exists' });
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: body.email,
      name: body.name,
      passwordHash: hashPassword(body.password),
      source: 'LOCAL',
    },
  });

  await prisma.$transaction(async (tx) => {
    if (body.workspaceName && body.workspaceName !== status.workspace.name) {
      await tx.workspace.update({
        where: { id: status.workspace.id },
        data: { name: body.workspaceName },
      });
    }

    await tx.membership.create({
      data: {
        userId: user.id,
        workspaceId: status.workspace.id,
        role: 'OWNER',
      },
    });
  });

  setSessionCookie(res, user.id);
  res.status(201).json({
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

authRouter.post('/login', async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (!existing || !verifyPassword(body.password, existing.passwordHash)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { lastLoginAt: new Date() },
  });
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
