import { prisma } from '../db.js';

export async function bootstrapOpenProjectLocalPermissions() {
  const user = await prisma.user.upsert({
    where: { id: 'local-user' },
    update: {},
    create: { id: 'local-user', email: 'owner@local.app', name: 'Workspace Owner' },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'openproject-runtime' },
    update: {},
    create: { name: 'OpenProject Runtime Permissions', slug: 'openproject-runtime' },
  });

  await Promise.all([
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'OWNER' } },
      update: {
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: false,
        manageTasks: true,
        inviteMembers: false,
      },
      create: {
        workspaceId: workspace.id,
        role: 'OWNER',
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: false,
        manageTasks: true,
        inviteMembers: false,
      },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'ADMIN' } },
      update: { manageSpaces: true, manageDocs: false, manageTasks: true, inviteMembers: false },
      create: {
        workspaceId: workspace.id,
        role: 'ADMIN',
        manageSpaces: true,
        manageDocs: false,
        manageTasks: true,
        inviteMembers: false,
      },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'LEAD' } },
      update: { manageDocs: false, manageTasks: false },
      create: { workspaceId: workspace.id, role: 'LEAD', manageDocs: false, manageTasks: false },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'MEMBER' } },
      update: { manageDocs: false, manageTasks: false },
      create: { workspaceId: workspace.id, role: 'MEMBER', manageDocs: false, manageTasks: false },
    }),
  ]);

  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    update: { role: 'OWNER' },
    create: { userId: user.id, workspaceId: workspace.id, role: 'OWNER' },
  });
}
