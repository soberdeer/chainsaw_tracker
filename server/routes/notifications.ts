import { Router } from 'express';
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

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  taskId: string | null;
  workPackageId: string | null;
  readAt: string | null;
  createdAt: string;
}

const notifications: Notification[] = [];

notificationsRouter.get('/', async (req, res) => {
  const current = await requireCurrentUser(req);
  const items = notifications.filter((n) => n.userId === current.id);
  const unread = items.filter((n) => !n.readAt).length;
  res.json({ items, unread });
});

notificationsRouter.post('/:id/read', async (req, res) => {
  const current = await requireCurrentUser(req);
  const notification = notifications.find((n) => n.id === req.params.id && n.userId === current.id);
  if (!notification) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  notification.readAt = new Date().toISOString();
  res.json(notification);
});

notificationsRouter.post('/read-all', async (req, res) => {
  const current = await requireCurrentUser(req);
  const now = new Date().toISOString();
  notifications
    .filter((n) => n.userId === current.id)
    .forEach((n) => {
      n.readAt = n.readAt ?? now;
    });
  res.json({ ok: true });
});
