import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { importClickUpCsv } from '../services/clickupImport.js';
import { requirePermission } from '../services/permissions.js';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const importDir = path.resolve('uploads', 'imports');
mkdirSync(importDir, { recursive: true });

const upload = multer({
  dest: importDir,
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const importsRouter = Router();

importsRouter.post('/clickup-csv', upload.single('file'), async (req, res) => {
  const body = z
    .object({
      workspaceId: z.string(),
    })
    .parse(req.body);

  await requirePermission(req, body.workspaceId, 'manageTasks');

  if (!req.file) {
    res.status(400).json({ error: 'file is required' });
    return;
  }

  const summary = await importClickUpCsv(req.file.path, body.workspaceId);
  res.status(201).json(summary);
});
