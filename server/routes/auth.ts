import { Router } from 'express';
import { z } from 'zod';
import {
  clearSessionCookie,
  currentUser,
  requireCurrentUser,
  setSessionCookie,
  verifyViaOpenProject,
} from '../services/auth.js';

export const authRouter = Router();

authRouter.get('/setup-status', async (_req, res) => {
  res.json({
    setupRequired: false,
    ownerCount: 1,
    userCount: 1,
    workspace: { id: 'openproject', name: 'OpenProject', slug: 'openproject-runtime' },
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

  if (result === 'OPENPROJECT_UNAVAILABLE') {
    res.status(503).json({ error: 'OPENPROJECT_UNAVAILABLE' });
    return;
  }

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
  const email = opUser.email || opUser.login || body.login;
  const name = (opUser as any).name || opUser.login || email;

  const user = {
    id: String(opUser.id),
    email,
    name,
    login: opUser.login || body.login,
    admin: Boolean((opUser as any).admin),
    avatarUrl: (opUser as any).avatar || undefined,
  };

  setSessionCookie(res, user);
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    openProjectUserId: user.id,
    openProjectLogin: user.login,
    admin: user.admin,
  });
});

authRouter.get('/me', async (req, res) => {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    openProjectUserId: user.id,
    openProjectLogin: user.login,
    admin: user.admin,
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

  // Name/avatar changes go directly to OP; session reflects OP data on next login
  res.json({
    id: user.id,
    email: user.email,
    name: body.name ?? user.name,
    avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : user.avatarUrl,
    openProjectUserId: user.id,
    openProjectLogin: user.login,
    admin: user.admin,
  });
});
