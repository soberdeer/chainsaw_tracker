import { prisma } from '../db.js';
import { ensureDefaultOwner } from '../services/auth.js';

export const openProjectRuntimeWorkspaceSlug = 'openproject-runtime';

export async function getOpenProjectRuntimeWorkspace() {
  return prisma.workspace.findUnique({
    where: { slug: openProjectRuntimeWorkspaceSlug },
    include: {
      memberships: { include: { user: true } },
      permissionSets: true,
      migrationRuns: { orderBy: { startedAt: 'desc' }, take: 5 },
    },
  });
}

export async function bootstrapOpenProjectLocalPermissions() {
  const user = await ensureDefaultOwner();

  const workspace = await prisma.workspace.upsert({
    where: { slug: openProjectRuntimeWorkspaceSlug },
    update: {
      color: '#228be6',
    },
    create: {
      name: 'OpenProject Workspace',
      slug: openProjectRuntimeWorkspaceSlug,
      description: 'Local tracker settings and access for the OpenProject-backed workspace.',
      color: '#228be6',
    },
  });

  await Promise.all([
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'OWNER' } },
      update: {
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: false,
        manageTasks: true,
        inviteMembers: true,
        manageIntegrations: true,
        manageImports: true,
        viewReports: true,
      },
      create: {
        workspaceId: workspace.id,
        role: 'OWNER',
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: false,
        manageTasks: true,
        inviteMembers: true,
        manageIntegrations: true,
        manageImports: true,
        viewReports: true,
      },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'ADMIN' } },
      update: {
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: false,
        manageTasks: true,
        inviteMembers: true,
        manageIntegrations: true,
        manageImports: true,
        viewReports: true,
      },
      create: {
        workspaceId: workspace.id,
        role: 'ADMIN',
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: false,
        manageTasks: true,
        inviteMembers: true,
        manageIntegrations: true,
        manageImports: true,
        viewReports: true,
      },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'LEAD' } },
      update: {
        manageDocs: false,
        manageTasks: false,
        viewReports: true,
      },
      create: {
        workspaceId: workspace.id,
        role: 'LEAD',
        manageDocs: false,
        manageTasks: false,
        viewReports: true,
      },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'MEMBER' } },
      update: {
        manageDocs: false,
        manageTasks: false,
      },
      create: { workspaceId: workspace.id, role: 'MEMBER', manageDocs: false, manageTasks: false },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'VIEWER' } },
      update: { manageTasks: false },
      create: { workspaceId: workspace.id, role: 'VIEWER', manageTasks: false },
    }),
  ]);

  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    update: { role: 'OWNER' },
    create: { userId: user.id, workspaceId: workspace.id, role: 'OWNER' },
  });
}
