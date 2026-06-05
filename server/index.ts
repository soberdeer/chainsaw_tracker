import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { toHttpError } from './errors.js';
import { openProjectRouter } from './openproject/routes.js';
import { authRouter } from './routes/auth.js';
import { checklistsRouter } from './routes/checklists.js';
import { githubRouter } from './routes/github.js';
import { importReportsRouter } from './routes/importReports.js';
import { notificationsRouter } from './routes/notifications.js';
import { savedViewsRouter } from './routes/savedViews.js';
import { usersRouter } from './routes/users.js';
import { workspacesRouter } from './routes/workspaces.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      },
    })
  );
  app.use('/uploads', express.static(path.resolve('uploads')));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'compact-tracker-api' });
  });

  app.use('/api/workspaces', workspacesRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/openproject', openProjectRouter);
  app.use('/api', checklistsRouter);
  app.use('/api/saved-views', savedViewsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/import-reports', importReportsRouter);
  app.use('/api/integrations/github', githubRouter);

  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const httpError = toHttpError(error);
      if (httpError.statusCode >= 500) {
        console.error(error);
      }
      res.status(httpError.statusCode).json(httpError.body);
    }
  );

  return app;
}

export const app = createApp();
const port = Number(process.env.PORT || 4000);
const isMainModule =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}
