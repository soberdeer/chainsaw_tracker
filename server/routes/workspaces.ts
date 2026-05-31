import { Router } from 'express';
import { getWorkspaceTree } from '../openproject/service.js';
import { requireCurrentUser } from '../services/auth.js';

export const workspacesRouter = Router();

workspacesRouter.use(async (req, _res, next) => {
  try {
    await requireCurrentUser(req);
    next();
  } catch (error) {
    next(error);
  }
});

workspacesRouter.get('/', async (_req, res) => {
  const workspaces = await getWorkspaceTree();
  res.json(workspaces);
});

workspacesRouter.get('/:id', async (req, res) => {
  const workspaces = await getWorkspaceTree();
  const ws = workspaces.find((w) => w.id === req.params.id) ?? workspaces[0];
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  res.json(ws);
});

workspacesRouter.patch('/:id', async (_req, res) => {
  res.status(405).json({ error: 'Workspace settings are managed in OpenProject' });
});

workspacesRouter.get('/:id/members', async (req, res) => {
  const workspaces = await getWorkspaceTree();
  const ws = workspaces.find((w) => w.id === req.params.id) ?? workspaces[0];
  res.json((ws as any)?.memberships ?? []);
});

workspacesRouter.post('/:id/members', async (_req, res) => {
  res.status(405).json({ error: 'Add members directly in OpenProject' });
});

workspacesRouter.delete('/:id/members/:userId', async (_req, res) => {
  res.status(405).json({ error: 'Remove members directly in OpenProject' });
});

workspacesRouter.patch('/:id/members/:userId', async (_req, res) => {
  res.status(405).json({ error: 'Change roles directly in OpenProject' });
});

workspacesRouter.post('/:id/invites', async (_req, res) => {
  res.status(405).json({ error: 'Invite users directly in OpenProject' });
});

workspacesRouter.get('/invites/:token', async (_req, res) => {
  res.status(404).json({ error: 'Invites are not supported' });
});

workspacesRouter.post('/invites/:token/accept', async (_req, res) => {
  res.status(405).json({ error: 'Invites are not supported' });
});
