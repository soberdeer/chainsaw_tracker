import { Router } from 'express';
import { getOpenProjectRuntimeWorkspace } from '../openproject/localPermissions.js';
import { requireCurrentUser } from '../services/auth.js';

export const importReportsRouter = Router();

importReportsRouter.use(async (req, _res, next) => {
  try {
    await requireCurrentUser(req);
    next();
  } catch (error) {
    next(error);
  }
});

importReportsRouter.get('/', async (_req, res) => {
  const runtimeWorkspace = await getOpenProjectRuntimeWorkspace();
  const items = (runtimeWorkspace.migrationRuns ?? []).map((run) => ({
    id: run.id,
    source: 'openproject',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status: 'SUCCESS' as const,
    stats: { created: 0, updated: 0, skipped: 0, failed: 0 },
  }));
  res.json(items);
});

importReportsRouter.get('/:id', async (req, res) => {
  const runtimeWorkspace = await getOpenProjectRuntimeWorkspace();
  const run = (runtimeWorkspace.migrationRuns ?? []).find((r) => r.id === req.params.id);
  if (!run) {
    res.status(404).json({ error: 'Import report not found' });
    return;
  }
  res.json({
    id: run.id,
    source: 'openproject',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status: 'SUCCESS' as const,
    stats: { created: 0, updated: 0, skipped: 0, failed: 0 },
    items: [],
  });
});
