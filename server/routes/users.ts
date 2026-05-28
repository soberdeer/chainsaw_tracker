import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import {
  getMyWorkSummary,
  getOpenProjectUserMemberships,
  findOpenProjectUserByEmail,
} from '../openproject/service.js';
import { requireCurrentUser } from '../services/auth.js';
import { ROLE_PERMISSIONS } from '../services/permissions.js';

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
      permissions: ROLE_PERMISSIONS[membership.role] ?? null,
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

usersRouter.post('/me/change-password', async (_req, res) => {
  res.status(400).json({ error: 'Change your password directly in OpenProject.' });
});

usersRouter.get('/me/my-work', async (req, res) => {
  let current = await requireCurrentUser(req);

  // Auto-link to OpenProject user by email if not linked yet
  if (!current.openProjectUserId) {
    const opUser = await findOpenProjectUserByEmail(current.email).catch(() => null);
    if (opUser) {
      current = await prisma.user.update({
        where: { id: current.id },
        data: {
          openProjectUserId: String(opUser.id),
          openProjectLogin: opUser.login || undefined,
        },
      });
    }
  }

  if (!current.openProjectUserId) {
    // User has no matching OpenProject account — return empty summary
    res.json({ assignedCount: 0, overdueCount: 0, dueThisWeekCount: 0, recentlyUpdated: [] });
    return;
  }

  res.json(await getMyWorkSummary(current.openProjectUserId));
});
