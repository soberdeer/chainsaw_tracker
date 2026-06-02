import { Router } from 'express';
import {
  getOpenProjectRuntimeWorkspace,
  updateOpenProjectRuntimeWorkspace,
} from '../openproject/localPermissions.js';
import {
  getOpenProjectConnectionStatus,
  getUserTeams,
  getWorkspaceTree,
  updateOpenProjectUserAdmin,
} from '../openproject/service.js';
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

// ── Settings ──────────────────────────────────────────────────────────────────

function workspaceToSettings(ws: {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatarUrl?: string;
  color?: string;
}) {
  const now = new Date().toISOString();
  return {
    id: ws.id,
    persistedId: ws.id,
    name: ws.name,
    slug: ws.slug,
    description: ws.description ?? null,
    avatarUrl: ws.avatarUrl ?? null,
    color: ws.color ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

workspacesRouter.get('/:id/settings', async (req, res) => {
  const workspaces = await getWorkspaceTree();
  const ws = workspaces.find((w) => w.id === req.params.id) ?? workspaces[0];
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  res.json(workspaceToSettings(ws));
});

workspacesRouter.patch('/:id/settings', async (req, res) => {
  const { name, slug, description, avatarUrl, color } = req.body as {
    name?: string;
    slug?: string;
    description?: string | null;
    avatarUrl?: string | null;
    color?: string | null;
  };
  updateOpenProjectRuntimeWorkspace({ name, slug, description, avatarUrl, color });
  const workspaces = await getWorkspaceTree();
  const ws = workspaces.find((w) => w.id === req.params.id) ?? workspaces[0];
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  res.json(workspaceToSettings(ws));
});

// ── Members ───────────────────────────────────────────────────────────────────

workspacesRouter.get('/:id/members', async (req, res) => {
  const [workspaces, userTeams] = await Promise.all([getWorkspaceTree(), getUserTeams()]);
  const ws = workspaces.find((w) => w.id === req.params.id) ?? workspaces[0];
  const now = new Date().toISOString();
  const items = (ws?.memberships ?? []).map((m) => ({
    ...m,
    createdAt: now,
    teams: userTeams.get(m.user.id) ?? [],
  }));
  res.json({ items });
});

workspacesRouter.post('/:id/members/invite', async (_req, res) => {
  res.status(405).json({ error: 'Invite members directly in OpenProject' });
});

workspacesRouter.post('/:id/members', async (_req, res) => {
  res.status(405).json({ error: 'Add members directly in OpenProject' });
});

workspacesRouter.delete('/:id/members/:userId', async (_req, res) => {
  res.status(405).json({ error: 'Remove members directly in OpenProject' });
});

workspacesRouter.patch('/:id/members/:userId', async (req, res) => {
  const { role } = req.body as { role: string };
  const admin = role === 'ADMIN';
  const opUser = await updateOpenProjectUserAdmin(req.params.userId, admin);
  const [workspaces, userTeams] = await Promise.all([getWorkspaceTree(), getUserTeams()]);
  const ws = workspaces.find((w) => w.id === req.params.id) ?? workspaces[0];
  const now = new Date().toISOString();
  const membership = (ws?.memberships ?? [])
    .map((m) => ({ ...m, createdAt: now, teams: userTeams.get(m.user.id) ?? [] }))
    .find((m) => m.user.id === req.params.userId);
  if (!membership) {
    res.json({
      id: String(opUser.id),
      role: admin ? 'ADMIN' : 'MEMBER',
      createdAt: now,
      user: {
        id: String(opUser.id),
        email: opUser.email || opUser.login || `${opUser.id}@openproject.local`,
        name: opUser.name,
        avatarUrl: opUser.avatar,
      },
      teams: [],
    });
    return;
  }
  res.json({ ...membership, role: admin ? 'ADMIN' : 'MEMBER' });
});

// ── Permissions ───────────────────────────────────────────────────────────────

workspacesRouter.get('/:id/permissions', async (req, res) => {
  const workspaces = await getWorkspaceTree();
  const ws = workspaces.find((w) => w.id === req.params.id) ?? workspaces[0];
  res.json({ items: ws?.permissionSets ?? [] });
});

// ── OpenProject connection status ─────────────────────────────────────────────

workspacesRouter.get('/:id/openproject', async (_req, res) => {
  const status = await getOpenProjectConnectionStatus();
  res.json(status);
});

// ── Import reports ────────────────────────────────────────────────────────────

workspacesRouter.get('/:id/imports', async (_req, res) => {
  const runtimeWorkspace = await getOpenProjectRuntimeWorkspace();
  const items = (runtimeWorkspace.migrationRuns ?? []).map((run) => ({
    id: run.id,
    source: 'openproject',
    startedAt: new Date().toISOString(),
    status: 'SUCCESS' as const,
  }));
  res.json({ items });
});

// ── Legacy invite/token routes ────────────────────────────────────────────────

workspacesRouter.post('/:id/invites', async (_req, res) => {
  res.status(405).json({ error: 'Invite users directly in OpenProject' });
});

workspacesRouter.get('/invites/:token', async (_req, res) => {
  res.status(404).json({ error: 'Invites are not supported' });
});

workspacesRouter.post('/invites/:token/accept', async (_req, res) => {
  res.status(405).json({ error: 'Invites are not supported' });
});
