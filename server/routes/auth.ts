import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import {
  clearSessionCookie,
  currentUser,
  ensureDefaultOwner,
  requireCurrentUser,
  setSessionCookie,
  verifyPassword,
} from '../services/auth.js';

export const authRouter = Router();

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
  });
});

authRouter.post('/login', async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  await ensureDefaultOwner();
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  setSessionCookie(res, user.id);
  res.json({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl });
});

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.patch('/me', async (req, res) => {
  const user = await requireCurrentUser(req);
  const body = z
    .object({
      name: z.string().min(1).optional(),
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
  });
});
