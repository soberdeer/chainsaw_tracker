import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { workspacesRouter } from './routes/workspaces.js';
import { spacesRouter } from './routes/spaces.js';
import { tasksRouter } from './routes/tasks.js';
import { documentsRouter } from './routes/documents.js';
import { foldersRouter } from './routes/folders.js';
import { importsRouter } from './routes/imports.js';
import { searchRouter } from './routes/search.js';
import { integrationsRouter } from './routes/integrations.js';
import { referencesRouter } from './routes/references.js';
import { toHttpError } from './errors.js';
import { bootstrapDefaultWorkspace } from './services/bootstrap.js';

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buf) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
  }
}));
app.use('/uploads', express.static(path.resolve('uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'compact-tracker-api' });
});

app.use('/api/workspaces', workspacesRouter);
app.use('/api/spaces', spacesRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/imports', importsRouter);
app.use('/api/search', searchRouter);
app.use('/api', referencesRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/integrations', integrationsRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  const httpError = toHttpError(error);
  res.status(httpError.statusCode).json(httpError.body);
});

bootstrapDefaultWorkspace().finally(() => {
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
});
