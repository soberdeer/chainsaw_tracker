import { Router } from 'express';
import { z } from 'zod';
import { requireCurrentUser } from '../services/auth.js';

export const checklistsRouter = Router();

checklistsRouter.use(async (req, _res, next) => {
  try {
    await requireCurrentUser(req);
    next();
  } catch (error) {
    next(error);
  }
});

interface ChecklistItem {
  id: string;
  checklistId: string;
  text: string;
  completed: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

interface Checklist {
  id: string;
  taskId: string;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  items: ChecklistItem[];
}

const store = new Map<string, Checklist[]>();
let seq = 1;
const nextId = () => `cl-${seq++}`;

function taskChecklists(taskId: string): Checklist[] {
  if (!store.has(taskId)) store.set(taskId, []);
  return store.get(taskId)!;
}

checklistsRouter.get('/tasks/:taskId/checklists', (req, res) => {
  res.json({ items: taskChecklists(req.params.taskId) });
});

checklistsRouter.post('/tasks/:taskId/checklists', (req, res) => {
  const { title } = z.object({ title: z.string().min(1) }).parse(req.body);
  const list = taskChecklists(req.params.taskId);
  const now = new Date().toISOString();
  const checklist: Checklist = {
    id: nextId(),
    taskId: req.params.taskId,
    title,
    position: list.length,
    createdAt: now,
    updatedAt: now,
    items: [],
  };
  list.push(checklist);
  res.status(201).json(checklist);
});

checklistsRouter.patch('/checklists/:id', (req, res) => {
  const input = z
    .object({ title: z.string().optional(), position: z.number().optional() })
    .parse(req.body);
  for (const [, list] of store) {
    const found = list.find((c) => c.id === req.params.id);
    if (found) {
      if (input.title !== undefined) found.title = input.title;
      if (input.position !== undefined) found.position = input.position;
      found.updatedAt = new Date().toISOString();
      res.json(found);
      return;
    }
  }
  res.status(404).json({ error: 'Checklist not found' });
});

checklistsRouter.delete('/checklists/:id', (req, res) => {
  for (const [taskId, list] of store) {
    const idx = list.findIndex((c) => c.id === req.params.id);
    if (idx !== -1) {
      list.splice(idx, 1);
      store.set(taskId, list);
      res.status(204).send();
      return;
    }
  }
  res.status(404).json({ error: 'Checklist not found' });
});

checklistsRouter.post('/checklists/:id/items', (req, res) => {
  const { text } = z.object({ text: z.string().min(1) }).parse(req.body);
  for (const [, list] of store) {
    const found = list.find((c) => c.id === req.params.id);
    if (found) {
      const now = new Date().toISOString();
      const item: ChecklistItem = {
        id: nextId(),
        checklistId: req.params.id,
        text,
        completed: false,
        position: found.items.length,
        createdAt: now,
        updatedAt: now,
      };
      found.items.push(item);
      found.updatedAt = now;
      res.status(201).json(found);
      return;
    }
  }
  res.status(404).json({ error: 'Checklist not found' });
});

checklistsRouter.patch('/checklist-items/:id', (req, res) => {
  const input = z
    .object({
      text: z.string().optional(),
      completed: z.boolean().optional(),
      position: z.number().optional(),
    })
    .parse(req.body);
  for (const [, list] of store) {
    for (const checklist of list) {
      const item = checklist.items.find((i) => i.id === req.params.id);
      if (item) {
        if (input.text !== undefined) item.text = input.text;
        if (input.completed !== undefined) item.completed = input.completed;
        if (input.position !== undefined) item.position = input.position;
        item.updatedAt = new Date().toISOString();
        checklist.updatedAt = item.updatedAt;
        res.json(checklist);
        return;
      }
    }
  }
  res.status(404).json({ error: 'Checklist item not found' });
});

checklistsRouter.delete('/checklist-items/:id', (req, res) => {
  for (const [, list] of store) {
    for (const checklist of list) {
      const idx = checklist.items.findIndex((i) => i.id === req.params.id);
      if (idx !== -1) {
        checklist.items.splice(idx, 1);
        checklist.updatedAt = new Date().toISOString();
        res.status(204).send();
        return;
      }
    }
  }
  res.status(404).json({ error: 'Checklist item not found' });
});
