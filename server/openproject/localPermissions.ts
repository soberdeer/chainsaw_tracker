export const openProjectRuntimeWorkspaceSlug = 'openproject-runtime';

const RUNTIME_WORKSPACE = {
  id: 'openproject',
  name: process.env.OPENPROJECT_WORKSPACE_NAME || 'ChainsawLeg',
  slug: openProjectRuntimeWorkspaceSlug,
  description: 'Local tracker' as string | null,
  color: '#228be6' as string | null,
  avatarUrl: null as string | null,
  memberships: [] as Array<{
    id: string;
    role: string;
    user: { id: string; email: string; name: string };
  }>,
  migrationRuns: [] as Array<{ id: string }>,
};

export function updateOpenProjectRuntimeWorkspace(updates: {
  name?: string;
  slug?: string;
  description?: string | null;
  avatarUrl?: string | null;
  color?: string | null;
}) {
  if (updates.name !== undefined) RUNTIME_WORKSPACE.name = updates.name;
  if (updates.slug !== undefined) RUNTIME_WORKSPACE.slug = updates.slug;
  if ('description' in updates) RUNTIME_WORKSPACE.description = updates.description ?? null;
  if ('avatarUrl' in updates) RUNTIME_WORKSPACE.avatarUrl = updates.avatarUrl ?? null;
  if ('color' in updates) RUNTIME_WORKSPACE.color = updates.color ?? null;
}

export function getOpenProjectRuntimeWorkspace() {
  return Promise.resolve(RUNTIME_WORKSPACE);
}

export function ensureOpenProjectRuntimeWorkspaceScaffold() {
  return Promise.resolve(RUNTIME_WORKSPACE);
}

export function bootstrapOpenProjectLocalPermissions() {
  return Promise.resolve(RUNTIME_WORKSPACE);
}
