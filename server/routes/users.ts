import { Router } from 'express';
import { z } from 'zod';
import { getMyWorkSummary, getOpenProjectUserMemberships } from '../openproject/service.js';
import { requireCurrentUser } from '../services/auth.js';
import { ROLE_PERMISSIONS } from '../services/permissions.js';

export const usersRouter = Router();

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
  const openProjectMemberships = await getOpenProjectUserMemberships(current.id).catch(() => []);
  const role = current.admin ? 'ADMIN' : ('MEMBER' as const);

  res.json({
    id: current.id,
    email: current.email,
    name: current.name,
    avatarUrl: current.avatarUrl,
    openProjectUserId: current.id,
    openProjectLogin: current.login,
    admin: current.admin,
    memberships: [
      {
        id: `membership-${current.id}`,
        workspaceId: 'openproject',
        workspaceName: process.env.OPENPROJECT_WORKSPACE_NAME || 'ChainsawLeg',
        workspaceSlug: 'openproject-runtime',
        role,
        permissions: ROLE_PERMISSIONS[role] ?? null,
      },
    ],
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

  res.json({
    id: current.id,
    email: current.email,
    name: body.name ?? current.name,
    avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : current.avatarUrl,
    openProjectUserId: current.id,
    openProjectLogin: current.login,
    admin: current.admin,
  });
});

usersRouter.post('/me/change-password', async (_req, res) => {
  res.status(400).json({ error: 'Change your password directly in OpenProject.' });
});

usersRouter.get('/me/my-work', async (req, res) => {
  const current = await requireCurrentUser(req);
  res.json(await getMyWorkSummary(current.id));
});
