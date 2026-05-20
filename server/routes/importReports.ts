import { Router } from 'express';
import { prisma } from '../db.js';
import { requireOpenProjectProjectWrite } from '../openproject/permissions.js';
import { requireCurrentUser } from '../services/auth.js';

export const importReportsRouter = Router();

importReportsRouter.use(async (req, _res, next) => {
  try {
    await requireCurrentUser(req);
    await requireOpenProjectProjectWrite(req);
    next();
  } catch (error) {
    next(error);
  }
});

importReportsRouter.get('/', async (_req, res) => {
  const runs = await prisma.migrationRun.findMany({ orderBy: { startedAt: 'desc' }, take: 20 });
  res.json(runs);
});

importReportsRouter.get('/:id', async (req, res) => {
  const run = await prisma.migrationRun.findUniqueOrThrow({ where: { id: req.params.id } });
  res.json(run);
});

importReportsRouter.get('/:id/json', async (req, res) => {
  const run = await prisma.migrationRun.findUniqueOrThrow({ where: { id: req.params.id } });
  res.setHeader('Content-Disposition', `attachment; filename="migration-${run.id}.json"`);
  res.json(run);
});
