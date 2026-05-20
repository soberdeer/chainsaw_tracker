import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { toHttpError } from './errors.js';
import { bootstrapOpenProjectLocalPermissions } from './openproject/localPermissions.js';
import { openProjectRouter } from './openproject/routes.js';
import { authRouter } from './routes/auth.js';
import { documentsRouter } from './routes/documents.js';
import { importReportsRouter } from './routes/importReports.js';
import { integrationsRouter } from './routes/integrations.js';
import { notificationsRouter } from './routes/notifications.js';
import { referencesRouter } from './routes/references.js';
import { savedViewsRouter } from './routes/savedViews.js';
import { workspacesRouter } from './routes/workspaces.js';
import path from 'node:path';

const app = express();
const port = Number(process.env.PORT || 4000);

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
app.use('/api/openproject', openProjectRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/saved-views', savedViewsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/import-reports', importReportsRouter);
app.use('/api', referencesRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/integrations', integrationsRouter);

app.use(
  (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    const httpError = toHttpError(error);
    res.status(httpError.statusCode).json(httpError.body);
  }
);

bootstrapOpenProjectLocalPermissions()
  .catch((error) => {
    console.warn(
      `OpenProject local permission bootstrap skipped: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  })
  .finally(() => {
    app.listen(port, () => {
      console.log(`API listening on http://localhost:${port}`);
    });
  });
