export const openProjectRuntimeWorkspaceSlug = 'openproject-runtime';

const RUNTIME_WORKSPACE = {
  id: 'openproject',
  name: process.env.OPENPROJECT_WORKSPACE_NAME || 'ChainsawLeg',
  slug: openProjectRuntimeWorkspaceSlug,
  description: 'Local tracker',
  color: '#228be6',
  avatarUrl: null as string | null,
  memberships: [] as Array<{
    id: string;
    role: string;
    user: { id: string; email: string; name: string };
  }>,
  migrationRuns: [] as Array<{ id: string }>,
};

export function getOpenProjectRuntimeWorkspace() {
  return Promise.resolve(RUNTIME_WORKSPACE);
}

export function ensureOpenProjectRuntimeWorkspaceScaffold() {
  return Promise.resolve(RUNTIME_WORKSPACE);
}

export function bootstrapOpenProjectLocalPermissions() {
  return Promise.resolve(RUNTIME_WORKSPACE);
}
