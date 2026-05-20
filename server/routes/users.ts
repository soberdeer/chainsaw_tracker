import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { getMyWorkSummary, getOpenProjectUserMemberships } from '../openproject/service.js';
import { hashPassword, requireCurrentUser, verifyPassword } from '../services/auth.js';

export const usersRouter = Router();

function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  source?: string | null;
  openProjectUserId?: string | null;
  openProjectLogin?: string | null;
  lastLoginAt?: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    source: user.source,
    openProjectUserId: user.openProjectUserId,
    openProjectLogin: user.openProjectLogin,
    lastLoginAt: user.lastLoginAt?.toISOString() || null,
  };
}

usersRouter.use(async (req, _res, next) => {
  try {
    await requireCurrentUser(req);
    next();
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/me', async (req, res) => {
  const current = await requireCurrentUser(req);
  const memberships = await prisma.membership.findMany({
    where: { userId: current.id },
    include: {
      workspace: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  const permissionSets = await prisma.permissionSet.findMany({
    where: { workspaceId: { in: memberships.map((membership) => membership.workspaceId) } },
  });
  const openProjectMemberships = current.openProjectUserId
    ? await getOpenProjectUserMemberships(current.openProjectUserId).catch(() => [])
    : [];

  res.json({
    ...serializeUser(current),
    memberships: memberships.map((membership) => ({
      id: membership.id,
      workspaceId: membership.workspaceId,
      workspaceName: membership.workspace.name,
      workspaceSlug: membership.workspace.slug,
      role: membership.role,
      permissions:
        permissionSets.find(
          (set) => set.workspaceId === membership.workspaceId && set.role === membership.role
        ) || null,
    })),
    openProjectMemberships,
  });
});

usersRouter.patch('/me', async (req, res) => {
  const current = await requireCurrentUser(req);
  const body = z
    .object({
      name: z.string().max(120).optional(),
      avatarUrl: z.string().url().nullable().optional(),
    })
    .parse(req.body);

  const updated = await prisma.user.update({
    where: { id: current.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
    },
  });

  res.json(serializeUser(updated));
});

usersRouter.post('/me/change-password', async (req, res) => {
  const current = await requireCurrentUser(req);
  const body = z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
      confirmPassword: z.string().min(8),
    })
    .parse(req.body);

  if (body.newPassword !== body.confirmPassword) {
    res.status(400).json({ error: 'New password confirmation does not match' });
    return;
  }

  if (!verifyPassword(body.currentPassword, current.passwordHash)) {
    res.status(400).json({ error: 'Current password is incorrect' });
    return;
  }

  await prisma.user.update({
    where: { id: current.id },
    data: { passwordHash: hashPassword(body.newPassword) },
  });

  res.json({ ok: true });
});

usersRouter.get('/me/my-work', async (req, res) => {
  const current = await requireCurrentUser(req);
  if (!current.openProjectUserId) {
    res.status(409).json({
      error: 'This local account is not linked to an OpenProject user yet',
    });
    return;
  }

  res.json(await getMyWorkSummary(current.openProjectUserId));
});
