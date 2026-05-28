import { prisma } from '../db.js';

export const openProjectRuntimeWorkspaceSlug = 'openproject-runtime';

export async function getOpenProjectRuntimeWorkspace() {
  return prisma.workspace.findUnique({
    where: { slug: openProjectRuntimeWorkspaceSlug },
    include: {
      memberships: { include: { user: true } },
      migrationRuns: { orderBy: { startedAt: 'desc' }, take: 5 },
    },
  });
}

export async function ensureOpenProjectRuntimeWorkspaceScaffold() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: openProjectRuntimeWorkspaceSlug },
    update: {
      color: '#228be6',
    },
    create: {
      name: 'ChainsawLeg',
      slug: openProjectRuntimeWorkspaceSlug,
      description: 'Local tracker',
      color: '#228be6',
    },
  });

  return workspace;
}

export async function bootstrapOpenProjectLocalPermissions() {
  return ensureOpenProjectRuntimeWorkspaceScaffold();
}
