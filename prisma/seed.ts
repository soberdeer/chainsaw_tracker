import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { id: 'local-user' },
    update: {},
    create: { id: 'local-user', email: 'admin@local.app', name: 'Workspace Admin' },
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
            role: 'ADMIN',
            manageWorkspace: true,
            manageSpaces: true,
            manageDocs: true,
            manageTasks: true,
            inviteMembers: true,
            manageIntegrations: true,
            manageImports: true,
            viewReports: true,
          },
          {
            role: 'MEMBER',
            manageDocs: true,
            manageTasks: true,
            viewReports: true,
          },
          { role: 'READER' },
        ],
      },
    },
  });

  await Promise.all([
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'ADMIN' } },
      create: {
        workspaceId: workspace.id,
        role: 'ADMIN',
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: true,
        manageTasks: true,
        inviteMembers: true,
        manageIntegrations: true,
        manageImports: true,
        viewReports: true,
      },
      update: {
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: true,
        manageTasks: true,
        inviteMembers: true,
        manageIntegrations: true,
        manageImports: true,
        viewReports: true,
      },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'MEMBER' } },
      create: {
        workspaceId: workspace.id,
        role: 'MEMBER',
        manageDocs: true,
        manageTasks: true,
        viewReports: true,
      },
      update: { manageDocs: true, manageTasks: true, viewReports: true },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'READER' } },
      create: { workspaceId: workspace.id, role: 'READER' },
      update: {},
    }),
  ]);

  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    update: { role: 'ADMIN' },
    create: { userId: user.id, workspaceId: workspace.id, role: 'ADMIN' },
  });

  console.log(
    'Seeded local OpenProject runtime scaffold. Task data is loaded from OpenProject API.'
  );
}

main().finally(async () => {
  await prisma.$disconnect();
});
