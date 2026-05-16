import { PrismaClient } from '@prisma/client';
import { importClickUpCsv } from '../server/services/clickupImport.js';
import path from 'node:path';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { id: 'local-user' },
    update: {},
    create: { id: 'local-user', email: 'owner@local.app', name: 'Workspace Owner' },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'chainsaw' },
    update: {},
    create: {
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
    },
  });

  await Promise.all([
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'OWNER' } },
      create: {
        workspaceId: workspace.id,
        role: 'OWNER',
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: true,
        manageTasks: true,
        inviteMembers: true,
      },
      update: {
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: true,
        manageTasks: true,
        inviteMembers: true,
      },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'ADMIN' } },
      create: {
        workspaceId: workspace.id,
        role: 'ADMIN',
        manageSpaces: true,
        manageDocs: true,
        manageTasks: true,
        inviteMembers: true,
      },
      update: { manageSpaces: true, manageDocs: true, manageTasks: true, inviteMembers: true },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'LEAD' } },
      create: { workspaceId: workspace.id, role: 'LEAD', manageDocs: true, manageTasks: true },
      update: { manageDocs: true, manageTasks: true },
    }),
  ]);

  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    update: { role: 'OWNER' },
    create: { userId: user.id, workspaceId: workspace.id, role: 'OWNER' },
  });

  const space = await prisma.space.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: 'Programming Department' } },
    update: {},
    create: {
      workspaceId: workspace.id,
      name: 'Programming Department',
      color: '#fa5252',
      initials: 'P',
      locked: true,
      permissions: {
        create: [
          { role: 'OWNER', canView: true, canEdit: true, canManage: true },
          { role: 'ADMIN', canView: true, canEdit: true, canManage: true },
          { role: 'LEAD', canView: true, canEdit: true },
          { role: 'MEMBER', canView: true, canEdit: true },
          { role: 'VIEWER', canView: true },
        ],
      },
    },
  });

  await prisma.spacePermission.upsert({
    where: { spaceId_role: { spaceId: space.id, role: 'LEAD' } },
    create: { spaceId: space.id, role: 'LEAD', canView: true, canEdit: true },
    update: { canView: true, canEdit: true },
  });

  const folder = await prisma.folder.upsert({
    where: { spaceId_name: { spaceId: space.id, name: 'Core Dev Team' } },
    update: {},
    create: { spaceId: space.id, name: 'Core Dev Team', kind: 'TEAM', locked: true },
  });

  await prisma.taskList.upsert({
    where: { folderId_name: { folderId: folder.id, name: 'Dev Task' } },
    update: {},
    create: {
      folderId: folder.id,
      name: 'Dev Task',
      icon: '☣',
      statuses: {
        create: [
          { name: 'backlog', color: '#868e96', position: 0 },
          { name: 'in development', color: '#3b82f6', position: 1 },
          { name: 'in review', color: '#d6336c', position: 2 },
          { name: 'shipped', color: '#4d9f87', position: 3, isDone: true },
        ],
      },
    },
  });

  const summary = await importClickUpCsv(
    path.resolve('prisma/seed-data/clickup-export.csv'),
    workspace.id
  );
  console.log('ClickUp seed summary:', summary);
}

main().finally(async () => {
  await prisma.$disconnect();
});
