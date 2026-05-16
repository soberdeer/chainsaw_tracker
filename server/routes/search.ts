import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { accessibleSpaceIds } from '../services/permissions.js';

export const searchRouter = Router();

const actions = [
  {
    id: 'action:create-task',
    type: 'action',
    title: 'Create New Task',
    subtitle: 'Action',
    action: 'create-task',
  },
  {
    id: 'action:create-doc',
    type: 'action',
    title: 'Create New Doc',
    subtitle: 'Action',
    action: 'create-doc',
  },
  {
    id: 'action:create-space',
    type: 'action',
    title: 'Create New Space',
    subtitle: 'Action',
    action: 'create-space',
  },
  {
    id: 'action:create-folder',
    type: 'action',
    title: 'Create New Folder',
    subtitle: 'Action',
    action: 'create-folder',
  },
  {
    id: 'action:open-board',
    type: 'action',
    title: 'Open Board',
    subtitle: 'View',
    action: 'open-board',
  },
  {
    id: 'action:open-docs',
    type: 'action',
    title: 'Open Docs',
    subtitle: 'View',
    action: 'open-docs',
  },
  {
    id: 'action:open-permissions',
    type: 'action',
    title: 'Open Permissions',
    subtitle: 'View',
    action: 'open-permissions',
  },
] as const;

function matches(query: string, ...values: Array<string | null | undefined>) {
  if (!query) {
    return true;
  }
  const needle = query.toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(needle));
}

searchRouter.get('/', async (req, res) => {
  const query = (z.string().optional().parse(req.query.q) || '').trim();
  const workspaceId = z.string().optional().parse(req.query.workspaceId);
  const contains = query ? { contains: query, mode: 'insensitive' as const } : undefined;

  const visibleSpaceIds = workspaceId ? await accessibleSpaceIds(req, workspaceId) : [];
  if (workspaceId && visibleSpaceIds.length === 0) {
    res.json(
      actions
        .filter((action) => matches(query, action.title, action.subtitle))
        .map((action) => ({ ...action }))
    );
    return;
  }
  const spaceFilter = workspaceId ? { id: { in: visibleSpaceIds } } : {};
  const workspaceFilter = workspaceId ? { workspaceId, id: { in: visibleSpaceIds } } : {};
  const actionResults = actions
    .filter((action) => matches(query, action.title, action.subtitle))
    .map((action) => ({ ...action }));

  const [tasks, documents, spaces, folders, taskLists] = await Promise.all([
    prisma.task.findMany({
      where: {
        folder: { space: workspaceFilter },
        ...(contains
          ? {
              OR: [
                { title: contains },
                { description: contains },
                { tags: { some: { tag: { name: contains } } } },
                { statusRef: { name: contains } },
              ],
            }
          : {}),
      },
      include: { assignee: true, folder: { include: { space: true } }, taskList: true },
      orderBy: { createdAt: 'desc' },
      take: query ? 12 : 6,
    }),
    prisma.document.findMany({
      where: {
        space: workspaceFilter,
        ...(contains
          ? {
              OR: [
                { title: contains },
                { markdown: contains },
                { embedUrl: contains },
                { sourceName: contains },
              ],
            }
          : {}),
      },
      include: { space: true },
      orderBy: { createdAt: 'desc' },
      take: query ? 10 : 4,
    }),
    prisma.space.findMany({
      where: { ...spaceFilter, ...(contains ? { name: contains } : {}) },
      orderBy: { createdAt: 'desc' },
      take: query ? 8 : 3,
    }),
    prisma.folder.findMany({
      where: { space: workspaceFilter, ...(contains ? { name: contains } : {}) },
      include: { space: true },
      orderBy: { createdAt: 'desc' },
      take: query ? 8 : 3,
    }),
    prisma.taskList.findMany({
      where: { folder: { space: workspaceFilter }, ...(contains ? { name: contains } : {}) },
      include: { folder: { include: { space: true } } },
      orderBy: { createdAt: 'desc' },
      take: query ? 8 : 3,
    }),
  ]);

  res.json([
    ...actionResults,
    ...tasks.map((task) => ({
      id: task.id,
      type: 'task',
      title: task.title,
      subtitle: `${task.assignee?.name || 'Unassigned'} • in ${task.taskList?.name || task.folder.name}`,
      url: `/space/${task.folder.spaceId}/folder/${task.folderId}/task/${task.id}`,
    })),
    ...documents.map((document) => ({
      id: document.id,
      type: 'doc',
      title: document.title,
      subtitle: `Doc • in ${document.space.name}`,
      url: `/space/${document.spaceId}/doc/${document.id}`,
    })),
    ...spaces.map((space) => ({
      id: space.id,
      type: 'space',
      title: space.name,
      subtitle: 'Space',
      url: `/space/${space.id}`,
    })),
    ...folders.map((folder) => ({
      id: folder.id,
      type: 'folder',
      title: folder.name,
      subtitle: `Folder • in ${folder.space.name}`,
      url: `/space/${folder.spaceId}/folder/${folder.id}`,
    })),
    ...taskLists.map((list) => ({
      id: list.id,
      type: 'list',
      title: list.name,
      subtitle: `List • in ${list.folder.name}`,
      url: `/space/${list.folder.spaceId}/folder/${list.folderId}`,
    })),
  ]);
});
