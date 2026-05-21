import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { openProjectRequest } from '../server/openproject/client.js';
import { seededHierarchyPath } from '../server/openproject/hierarchyStore.js';
import type {
  HalCollection,
  HalLink,
  OpenProjectProject,
  OpenProjectWorkPackage,
} from '../server/openproject/types.js';
import { unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const REQUIRED_CONFIRMATION = 'DELETE_ALL_OPENPROJECT_PROJECTS_AND_WORK_PACKAGES';

type ResetArgs = {
  dryRun: boolean;
  yes: boolean;
  confirm?: string;
  allowProduction: boolean;
  clearImportReports: boolean;
};

type DeleteItem = {
  id: string;
  name: string;
  parentId?: string;
  depth?: number;
};

type DeleteFailure = {
  id: string;
  name: string;
  reason: string;
};

type ResetSummary = {
  mode: 'dry-run' | 'delete';
  baseUrl: string;
  nodeEnv: string;
  workPackagesFound: number;
  projectsFound: number;
  workPackagesPreview: Array<Pick<DeleteItem, 'id' | 'name'>>;
  projectsPreview: Array<Pick<DeleteItem, 'id' | 'name' | 'parentId'>>;
  workPackagesDeleted: number;
  projectsDeleted: number;
  workPackageDeleteFailures: DeleteFailure[];
  projectDeleteFailures: DeleteFailure[];
  staleCleanup: {
    notificationsDeleted: number;
    savedViewsProjectCleared: number;
    savedViewsListCleared: number;
    importReportsDeleted: number;
    hierarchyFileDeleted: boolean;
    hierarchyFileMissing: boolean;
  };
};

type CleanupCounts = ResetSummary['staleCleanup'];

type CleanupPrisma = Pick<PrismaClient, 'notification' | 'savedView' | 'migrationRun'>;

function baseUrlForSummary() {
  return (process.env.OPENPROJECT_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
}

export function parseResetArgs(argv: string[]): ResetArgs {
  const args = new Set(argv);
  const dryRun = args.has('--dry-run') || (!args.has('--yes') && !args.has('--confirm'));
  const confirmIndex = argv.findIndex((item) => item === '--confirm');
  const confirm = confirmIndex >= 0 ? argv[confirmIndex + 1] : undefined;

  return {
    dryRun,
    yes: args.has('--yes'),
    confirm,
    allowProduction: args.has('--allow-production'),
    clearImportReports: args.has('--clear-import-reports'),
  };
}

export function isDestructiveResetAllowed(args: ResetArgs, env = process.env) {
  if (args.dryRun) {
    return { allowed: false, reason: 'dry-run mode' };
  }
  if (!args.yes) {
    return { allowed: false, reason: 'missing --yes' };
  }
  if (args.confirm !== REQUIRED_CONFIRMATION) {
    return { allowed: false, reason: 'missing exact --confirm string' };
  }
  if (!env.OPENPROJECT_BASE_URL) {
    return { allowed: false, reason: 'missing OPENPROJECT_BASE_URL' };
  }
  if (!env.OPENPROJECT_API_TOKEN) {
    return { allowed: false, reason: 'missing OPENPROJECT_API_TOKEN' };
  }
  if (env.NODE_ENV === 'production' && !args.allowProduction) {
    return { allowed: false, reason: 'missing --allow-production in production' };
  }
  return { allowed: true };
}

function linkHref(value?: HalLink | HalLink[] | null) {
  return Array.isArray(value) ? value[0]?.href || undefined : value?.href || undefined;
}

function linkId(href?: string | null) {
  return href?.split('/').filter(Boolean).at(-1);
}

async function fetchAllPages<T>(path: string) {
  const items: T[] = [];
  for (let offset = 1; offset < 1000; offset += 1) {
    const page = await openProjectRequest<HalCollection<T>>(path, {
      query: { pageSize: 500, offset },
    });
    const elements = page._embedded?.elements || [];
    items.push(...elements);
    if (elements.length < 500) {
      break;
    }
  }
  return items;
}

export async function listOpenProjectWorkPackages() {
  const workPackages = await fetchAllPages<OpenProjectWorkPackage>('/api/v3/work_packages');
  return workPackages.map((item) => ({
    id: String(item.id),
    name: item.subject,
  }));
}

export async function listOpenProjectProjects() {
  const projects = await fetchAllPages<OpenProjectProject>('/api/v3/projects');
  return projects.map((project) => ({
    id: String(project.id),
    name: project.name,
    parentId: linkId(linkHref(project._links.parent)),
  }));
}

export function sortProjectsForDeletion(projects: DeleteItem[]) {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const depthCache = new Map<string, number>();

  const depthFor = (project: DeleteItem): number => {
    if (depthCache.has(project.id)) {
      return depthCache.get(project.id) || 0;
    }
    const parent = project.parentId ? byId.get(project.parentId) : undefined;
    const depth = parent ? depthFor(parent) + 1 : 0;
    depthCache.set(project.id, depth);
    return depth;
  };

  return [...projects]
    .map((project) => ({ ...project, depth: depthFor(project) }))
    .sort((a, b) => (b.depth || 0) - (a.depth || 0) || a.name.localeCompare(b.name));
}

export async function cleanupLocalOpenProjectState(
  prisma: CleanupPrisma,
  input: {
    deletedProjectIds: string[];
    deletedWorkPackageIds: string[];
    clearImportReports?: boolean;
    hierarchyPath?: string;
  }
): Promise<CleanupCounts> {
  const listProjectPrefixes = input.deletedProjectIds.map((id) => `op-project:${id}:`);
  const [notificationsDeleted, savedViewsProjectCleared, existingSavedViews] = await Promise.all([
    prisma.notification.deleteMany({
      where: {
        OR: [
          { workPackageId: { in: input.deletedWorkPackageIds } },
          { taskId: { in: input.deletedWorkPackageIds } },
        ],
      },
    }),
    prisma.savedView.updateMany({
      where: { projectId: { in: input.deletedProjectIds } },
      data: { projectId: null },
    }),
    prisma.savedView.findMany({
      where: {
        OR: [
          { listId: { in: input.deletedProjectIds } },
          ...listProjectPrefixes.map((prefix) => ({
            listId: { startsWith: prefix },
          })),
        ],
      },
      select: { id: true },
    }),
  ]);

  let savedViewsListCleared = 0;
  if (existingSavedViews.length > 0) {
    const update = await prisma.savedView.updateMany({
      where: { id: { in: existingSavedViews.map((view) => view.id) } },
      data: { listId: null },
    });
    savedViewsListCleared = update.count;
  }

  let importReportsDeleted = 0;
  if (input.clearImportReports) {
    const deleted = await prisma.migrationRun.deleteMany({ where: { source: 'CLICKUP' } });
    importReportsDeleted = deleted.count;
  }

  const hierarchyPath = input.hierarchyPath || seededHierarchyPath();
  let hierarchyFileDeleted = false;
  let hierarchyFileMissing = false;

  try {
    await unlink(hierarchyPath);
    hierarchyFileDeleted = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      hierarchyFileMissing = true;
    } else {
      throw error;
    }
  }

  return {
    notificationsDeleted: notificationsDeleted.count,
    savedViewsProjectCleared: savedViewsProjectCleared.count,
    savedViewsListCleared,
    importReportsDeleted,
    hierarchyFileDeleted,
    hierarchyFileMissing,
  };
}

async function deleteWorkPackages(workPackages: DeleteItem[]) {
  let deleted = 0;
  const deletedIds: string[] = [];
  const failures: DeleteFailure[] = [];

  for (const item of workPackages) {
    try {
      await openProjectRequest<void>(`/api/v3/work_packages/${item.id}`, { method: 'DELETE' });
      deleted += 1;
      deletedIds.push(item.id);
    } catch (error) {
      failures.push({
        id: item.id,
        name: item.name,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { deleted, deletedIds, failures };
}

async function deleteProjects(projects: DeleteItem[]) {
  let deleted = 0;
  const deletedIds: string[] = [];
  const failures: DeleteFailure[] = [];

  for (const item of sortProjectsForDeletion(projects)) {
    try {
      await openProjectRequest<void>(`/api/v3/projects/${item.id}`, { method: 'DELETE' });
      deleted += 1;
      deletedIds.push(item.id);
    } catch (error) {
      failures.push({
        id: item.id,
        name: item.name,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { deleted, deletedIds, failures };
}

export async function runResetOpenProject(
  args: ResetArgs,
  prisma = new PrismaClient()
): Promise<ResetSummary> {
  const baseUrl = baseUrlForSummary();
  const [workPackages, projects] = await Promise.all([
    listOpenProjectWorkPackages(),
    listOpenProjectProjects(),
  ]);

  const summary: ResetSummary = {
    mode: args.dryRun ? 'dry-run' : 'delete',
    baseUrl,
    nodeEnv: process.env.NODE_ENV || 'development',
    workPackagesFound: workPackages.length,
    projectsFound: projects.length,
    workPackagesPreview: workPackages.slice(0, 20).map(({ id, name }) => ({ id, name })),
    projectsPreview: sortProjectsForDeletion(projects)
      .slice(0, 20)
      .map(({ id, name, parentId }) => ({ id, name, parentId })),
    workPackagesDeleted: 0,
    projectsDeleted: 0,
    workPackageDeleteFailures: [],
    projectDeleteFailures: [],
    staleCleanup: {
      notificationsDeleted: 0,
      savedViewsProjectCleared: 0,
      savedViewsListCleared: 0,
      importReportsDeleted: 0,
      hierarchyFileDeleted: false,
      hierarchyFileMissing: false,
    },
  };

  const safety = isDestructiveResetAllowed(args);
  if (!safety.allowed) {
    return summary;
  }

  const workPackageDeletion = await deleteWorkPackages(workPackages);
  summary.workPackagesDeleted = workPackageDeletion.deleted;
  summary.workPackageDeleteFailures = workPackageDeletion.failures;

  const projectDeletion = await deleteProjects(projects);
  summary.projectsDeleted = projectDeletion.deleted;
  summary.projectDeleteFailures = projectDeletion.failures;

  summary.staleCleanup = await cleanupLocalOpenProjectState(prisma, {
    deletedProjectIds: projectDeletion.deletedIds,
    deletedWorkPackageIds: workPackageDeletion.deletedIds,
    clearImportReports: args.clearImportReports,
  });

  return summary;
}

async function main() {
  const args = parseResetArgs(process.argv.slice(2));
  const safety = isDestructiveResetAllowed(args);
  const prisma = new PrismaClient();

  console.log(
    JSON.stringify(
      {
        script: 'reset-openproject',
        baseUrl: baseUrlForSummary(),
        mode: args.dryRun ? 'dry-run' : 'delete',
        nodeEnv: process.env.NODE_ENV || 'development',
        willDelete: args.dryRun ? false : safety.allowed,
        safety,
      },
      null,
      2
    )
  );

  try {
    const summary = await runResetOpenProject(args, prisma);
    console.log(JSON.stringify(summary, null, 2));
    if (!args.dryRun && !safety.allowed) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main();
}

export { REQUIRED_CONFIRMATION };
