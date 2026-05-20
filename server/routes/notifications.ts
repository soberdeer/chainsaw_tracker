import { Router } from 'express';
import { prisma } from '../db.js';
import { requireCurrentUser } from '../services/auth.js';

export const notificationsRouter = Router();

notificationsRouter.use(async (req, _res, next) => {
  try {
    await requireCurrentUser(req);
    next();
  } catch (error) {
    next(error);
  }
});

notificationsRouter.get('/', async (req, res) => {
  const user = await requireCurrentUser(req);
  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ items, unread: items.filter((item) => !item.readAt).length });
});

notificationsRouter.post('/:id/read', async (req, res) => {
  const user = await requireCurrentUser(req);
  const notification = await prisma.notification.findFirstOrThrow({
    where: { id: req.params.id, userId: user.id },
  });
  res.json(
    await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
    })
  );
});

notificationsRouter.post('/read-all', async (req, res) => {
  const user = await requireCurrentUser(req);
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});
