import { PrismaClient } from '@prisma/client';

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
          { role: 'LEAD', manageDocs: true, manageTasks: false },
          { role: 'MEMBER', manageDocs: true, manageTasks: false },
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
      create: { workspaceId: workspace.id, role: 'LEAD', manageDocs: true, manageTasks: false },
      update: { manageDocs: true, manageTasks: false },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'MEMBER' } },
      create: { workspaceId: workspace.id, role: 'MEMBER', manageDocs: true, manageTasks: false },
      update: { manageDocs: true, manageTasks: false },
    }),
  ]);

  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    update: { role: 'OWNER' },
    create: { userId: user.id, workspaceId: workspace.id, role: 'OWNER' },
  });

  console.log(
    'Seeded local OpenProject runtime scaffold. Task data is loaded from OpenProject API.'
  );
}

main().finally(async () => {
  await prisma.$disconnect();
});
