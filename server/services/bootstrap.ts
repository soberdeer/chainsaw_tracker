import { prisma } from '../db.js';
import { importClickUpCsv } from './clickupImport.js';
import path from 'node:path';

export async function bootstrapDefaultWorkspace() {
  try {
    const existingChainsaw = await prisma.workspace.findUnique({ where: { slug: 'chainsaw' } });
    const existingTasks = await prisma.task.count();
    if (existingTasks > 0) {
      return;
    }
    if (existingChainsaw) {
      await importClickUpCsv(
        path.resolve('prisma/seed-data/clickup-export.csv'),
        existingChainsaw.id
      );
      console.log('Bootstrapped existing Chainsaw workspace from ClickUp CSV');
      return;
    }

    const user = await prisma.user.upsert({
      where: { id: 'local-user' },
      create: { id: 'local-user', email: 'owner@local.app', name: 'Workspace Owner' },
      update: {},
    });

    const workspace = await prisma.workspace.create({
      data: {
        name: 'Chainsaw',
        slug: 'chainsaw',
        permissionSets: {
          create: [
            {
              role: 'OWNER',
              manageWorkspace: true,
              manageSpaces: true,
              manageDocs: true,
              manageTasks: true,
              inviteMembers: true,
            },
            {
              role: 'ADMIN',
              manageSpaces: true,
              manageDocs: true,
              manageTasks: true,
              inviteMembers: true,
            },
            { role: 'LEAD', manageDocs: true, manageTasks: true },
            { role: 'MEMBER', manageDocs: true, manageTasks: true },
            { role: 'VIEWER', manageTasks: false },
          ],
        },
        memberships: {
          create: { userId: user.id, role: 'OWNER' },
        },
      },
    });

    await importClickUpCsv(path.resolve('prisma/seed-data/clickup-export.csv'), workspace.id);
    console.log('Bootstrapped Chainsaw workspace from ClickUp CSV');
  } catch (error) {
    console.warn('Skipped workspace bootstrap:', error instanceof Error ? error.message : error);
  }
}
