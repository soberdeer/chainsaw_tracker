import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../db.js';
import { convertUploadToMarkdown, isImage } from '../services/documentConversion.js';
import { requireSpacePermission } from '../services/permissions.js';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const uploadDir = path.resolve('uploads');
mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const documentsRouter = Router();

documentsRouter.get('/', async (req, res) => {
  const spaceId = z.string().optional().parse(req.query.spaceId);
  if (spaceId) await requireSpacePermission(req, spaceId, 'view');
  const documents = await prisma.document.findMany({
    where: spaceId ? { spaceId } : undefined,
    orderBy: { updatedAt: 'desc' },
  });
  res.json(documents);
});

documentsRouter.post('/markdown', async (req, res) => {
  const body = z
    .object({
      spaceId: z.string(),
      title: z.string().min(2),
      markdown: z.string(),
    })
    .parse(req.body);
  const space = await prisma.space.findUniqueOrThrow({ where: { id: body.spaceId } });
  await requireSpacePermission(req, space.id, 'edit');

  const document = await prisma.document.create({
    data: { ...body, kind: 'MARKDOWN' },
  });
  res.status(201).json(document);
});

documentsRouter.post('/embed', async (req, res) => {
  const body = z
    .object({
      spaceId: z.string(),
      title: z.string().min(2),
      embedUrl: z.string().url(),
    })
    .parse(req.body);
  const space = await prisma.space.findUniqueOrThrow({ where: { id: body.spaceId } });
  await requireSpacePermission(req, space.id, 'edit');

  const document = await prisma.document.create({
    data: { ...body, kind: 'EMBED' },
  });
  res.status(201).json(document);
});

documentsRouter.post('/upload', upload.single('file'), async (req, res) => {
  const body = z
    .object({
      spaceId: z.string(),
      title: z.string().optional(),
    })
    .parse(req.body);

  if (!req.file) {
    res.status(400).json({ error: 'file is required' });
    return;
  }
  const space = await prisma.space.findUniqueOrThrow({ where: { id: body.spaceId } });
  await requireSpacePermission(req, space.id, 'edit');

  const title = body.title || req.file.originalname.replace(/\.[^.]+$/, '');

  if (isImage(req.file.mimetype)) {
    const document = await prisma.document.create({
      data: {
        spaceId: body.spaceId,
        title,
        kind: 'IMAGE',
        mimeType: req.file.mimetype,
        sourceName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`,
      },
    });
    res.status(201).json(document);
    return;
  }

  const markdown = await convertUploadToMarkdown(
    req.file.path,
    req.file.originalname,
    req.file.mimetype
  );
  if (!markdown) {
    res.status(415).json({
      error: 'Unsupported file type. Upload images, md, docx, text-like files, or spreadsheets.',
    });
    return;
  }

  const document = await prisma.document.create({
    data: {
      spaceId: body.spaceId,
      title,
      kind: req.file.mimetype.includes('spreadsheet') ? 'SPREADSHEET' : 'MARKDOWN',
      mimeType: req.file.mimetype,
      sourceName: req.file.originalname,
      markdown,
    },
  });
  res.status(201).json(document);
});

documentsRouter.patch('/:documentId', async (req, res) => {
  const body = z
    .object({
      title: z.string().min(2).optional(),
      markdown: z.string().optional(),
      embedUrl: z.string().url().optional(),
    })
    .parse(req.body);
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: req.params.documentId },
    include: { space: true },
  });
  await requireSpacePermission(req, document.spaceId, 'edit');
  res.json(await prisma.document.update({ where: { id: document.id }, data: body }));
});

documentsRouter.post('/:documentId/duplicate', async (req, res) => {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: req.params.documentId },
    include: { space: true },
  });
  await requireSpacePermission(req, document.spaceId, 'edit');
  const copy = await prisma.document.create({
    data: {
      spaceId: document.spaceId,
      title: `${document.title} copy`,
      kind: document.kind,
      mimeType: document.mimeType,
      markdown: document.markdown,
      fileUrl: document.fileUrl,
      embedUrl: document.embedUrl,
      sourceName: document.sourceName,
    },
  });
  res.status(201).json(copy);
});

documentsRouter.delete('/:documentId', async (req, res) => {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: req.params.documentId },
    include: { space: true },
  });
  await requireSpacePermission(req, document.spaceId, 'edit');
  await prisma.document.delete({ where: { id: document.id } });
  res.status(204).send();
});
