import 'dotenv/config';
import { clickUpRequest } from '../server/clickup/client.js';
import type {
  ClickUpFolder,
  ClickUpList,
  ClickUpSpace,
  ClickUpStatus,
  ClickUpTask,
  ClickUpTeam,
} from '../server/clickup/types.js';
import { openProjectRequest } from '../server/openproject/client.js';
import { seededHierarchyPath, type SeededWorkspace } from '../server/openproject/hierarchyStore.js';
import type {
  HalCollection,
  OpenProjectProject,
  OpenProjectPriority,
  OpenProjectStatus,
  OpenProjectType,
  OpenProjectWorkPackage,
} from '../server/openproject/types.js';
import type { PermissionSet, WorkspaceRole } from '../src/lib/types.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

type Summary = {
  teams: number;
  spaces: number;
  folders: number;
  lists: number;
  statuses: number;
  openProjectProjectsCreated: number;
  openProjectProjectsReused: number;
  openProjectProjectHierarchy: {
    spaces: number;
    folders: number;
    lists: number;
  };
  tasksCreated: number;
  tasksSkipped: number;
  duplicateTasksRemoved: number;
  errors: string[];
};

const permissionSets: PermissionSet[] = [
  {
    role: 'OWNER',
    manageWorkspace: true,
    manageSpaces: true,
    manageDocs: false,
    manageTasks: true,
    inviteMembers: false,
  },
  {
    role: 'ADMIN',
    manageWorkspace: true,
    manageSpaces: true,
    manageDocs: false,
    manageTasks: true,
    inviteMembers: false,
  },
  {
    role: 'LEAD',
    manageWorkspace: false,
    manageSpaces: false,
    manageDocs: false,
    manageTasks: true,
    inviteMembers: false,
  },
  {
    role: 'MEMBER',
    manageWorkspace: false,
    manageSpaces: false,
    manageDocs: false,
    manageTasks: true,
    inviteMembers: false,
  },
  {
    role: 'VIEWER',
    manageWorkspace: false,
    manageSpaces: false,
    manageDocs: false,
    manageTasks: false,
    inviteMembers: false,
  },
];

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'item'
  );
}

function identifierFor(kind: 'space' | 'folder' | 'list', id: string) {
  return `cu-${kind}-${slug(id)}`.slice(0, 100);
}

function statusSlug(value: string) {
  return slug(value).slice(0, 48);
}

async function getClickUpTeams() {
  const payload = await clickUpRequest<{ teams: ClickUpTeam[] }>('/team');
  return payload.teams || [];
}

async function getClickUpSpaces(teamId: string) {
  const payload = await clickUpRequest<{ spaces: ClickUpSpace[] }>(`/team/${teamId}/space`, {
    query: { archived: false },
  });
  return payload.spaces || [];
}

async function getClickUpFolders(spaceId: string) {
  const payload = await clickUpRequest<{ folders: ClickUpFolder[] }>(`/space/${spaceId}/folder`, {
    query: { archived: false },
  });
  return payload.folders || [];
}

async function getClickUpFolderlessLists(spaceId: string) {
  const payload = await clickUpRequest<{ lists: ClickUpList[] }>(`/space/${spaceId}/list`, {
    query: { archived: false },
  });
  return payload.lists || [];
}

async function getClickUpLists(folderId: string) {
  const payload = await clickUpRequest<{ lists: ClickUpList[] }>(`/folder/${folderId}/list`, {
    query: { archived: false },
  });
  return payload.lists || [];
}

async function getClickUpTasks(listId: string) {
  const tasks: ClickUpTask[] = [];
  for (let page = 0; page < 50; page += 1) {
    const payload = await clickUpRequest<{ tasks: ClickUpTask[] }>(`/list/${listId}/task`, {
      query: {
        archived: false,
        include_markdown_description: true,
        subtasks: true,
        page,
        order_by: 'created',
        reverse: false,
      },
    });
    tasks.push(...(payload.tasks || []));
    if ((payload.tasks || []).length < 100) break;
  }
  return tasks;
}

async function getOpenProjectProjects() {
  const page = await openProjectRequest<HalCollection<OpenProjectProject>>('/api/v3/projects', {
    query: { pageSize: 500 },
  });
  return page._embedded?.elements || [];
}

async function getOpenProjectStatuses() {
  const page = await openProjectRequest<HalCollection<OpenProjectStatus>>('/api/v3/statuses', {
    query: { pageSize: 500 },
  });
  return page._embedded?.elements || [];
}

async function firstTaskType(projectId: number) {
  const page = await openProjectRequest<HalCollection<OpenProjectType>>(
    `/api/v3/projects/${projectId}/types`,
    { query: { pageSize: 100 } }
  );
  return (
    (page._embedded?.elements || []).find((type) => type.name.toLowerCase() === 'task') ||
    page._embedded?.elements?.[0]
  );
}

async function getOpenProjectPriorities() {
  const page = await openProjectRequest<HalCollection<OpenProjectPriority>>('/api/v3/priorities', {
    query: { pageSize: 100 },
  });
  return page._embedded?.elements || [];
}

async function getProjectWorkPackages(projectId: number) {
  const page = await openProjectRequest<HalCollection<OpenProjectWorkPackage>>(
    `/api/v3/projects/${projectId}/work_packages`,
    {
      query: {
        pageSize: 500,
        filters: JSON.stringify([{ status: { operator: '*', values: [] } }]),
      },
    }
  );
  return page._embedded?.elements || [];
}

function importedMeta(description?: string) {
  if (!description?.includes('Imported from ClickUp')) return null;
  const spaceName = description.match(/^Space:\s*(.+)$/m)?.[1]?.trim();
  const listName = description.match(/^List:\s*(.+)$/m)?.[1]?.trim();
  if (!spaceName || !listName) return null;
  return { spaceName, listName };
}

function mapStatusToOpenProjectId(status: ClickUpStatus, openProjectStatuses: OpenProjectStatus[]) {
  const name = status.status.toLowerCase();
  const exact = openProjectStatuses.find((item) => item.name.toLowerCase() === name);
  if (exact) return String(exact.id);
  if (status.type === 'closed' || status.type === 'done' || name.includes('ship')) {
    return String(
      openProjectStatuses.find((item) => item.isClosed)?.id ||
        openProjectStatuses.find((item) => item.name.toLowerCase() === 'closed')?.id ||
        openProjectStatuses[0]?.id
    );
  }
  if (name.includes('review') || name.includes('test')) {
    return String(
      openProjectStatuses.find((item) => item.name.toLowerCase().includes('testing'))?.id ||
        openProjectStatuses.find((item) => item.name.toLowerCase().includes('progress'))?.id ||
        openProjectStatuses[0]?.id
    );
  }
  if (name.includes('develop') || name.includes('progress')) {
    return String(
      openProjectStatuses.find((item) => item.name.toLowerCase().includes('progress'))?.id ||
        openProjectStatuses[0]?.id
    );
  }
  return String(openProjectStatuses.find((item) => item.name.toLowerCase() === 'new')?.id || 1);
}

function priorityNameFromClickUp(priority: ClickUpTask['priority']) {
  const id = Number(priority?.id);
  if (id === 1) return 'Immediate';
  if (id === 2) return 'High';
  if (id === 4) return 'Low';
  if (id === 3) return 'Normal';
  return undefined;
}

function priorityHref(priorities: OpenProjectPriority[], priority: ClickUpTask['priority']) {
  const name = priorityNameFromClickUp(priority);
  if (!name) return undefined;
  return priorities.find((item) => item.name.toLowerCase() === name.toLowerCase())?._links.self
    .href;
}

function clickUpMillisToDate(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function clickUpTaskDescription(task: ClickUpTask) {
  return task.markdown_description || task.description || task.text_content || '';
}

async function syncClickUpTasksIntoProject(
  list: ClickUpList,
  project: OpenProjectProject,
  openProjectStatuses: OpenProjectStatus[],
  priorities: OpenProjectPriority[],
  summary: Summary
) {
  const [rawExistingWorkPackages, type, clickUpTasks] = await Promise.all([
    getProjectWorkPackages(project.id).catch(() => []),
    firstTaskType(project.id),
    getClickUpTasks(list.id),
  ]);
  let existingWorkPackages = rawExistingWorkPackages;
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  existingWorkPackages = existingWorkPackages.filter((workPackage) => {
    if (!seen.has(workPackage.subject)) {
      seen.add(workPackage.subject);
      return true;
    }
    duplicateIds.push(String(workPackage.id));
    return false;
  });
  for (const duplicateId of duplicateIds) {
    await openProjectRequest<void>(`/api/v3/work_packages/${duplicateId}`, { method: 'DELETE' });
    summary.duplicateTasksRemoved += 1;
  }
  const existingSubjects = new Set(existingWorkPackages.map((workPackage) => workPackage.subject));
  for (const task of clickUpTasks) {
    if (existingSubjects.has(task.name)) {
      summary.tasksSkipped += 1;
      continue;
    }
    const links: Record<string, { href: string | undefined }> = {
      type: { href: type?._links.self.href },
    };
    if (task.status) {
      links.status = {
        href: `/api/v3/statuses/${mapStatusToOpenProjectId(task.status, openProjectStatuses)}`,
      };
    }
    const priority = priorityHref(priorities, task.priority);
    if (priority) links.priority = { href: priority };
    const body: Record<string, unknown> = {
      subject: task.name,
      description: { format: 'markdown', raw: clickUpTaskDescription(task) },
      _links: links,
    };
    const startDate = clickUpMillisToDate(task.start_date);
    const dueDate = clickUpMillisToDate(task.due_date);
    if (startDate) body.startDate = startDate;
    if (dueDate) body.dueDate = dueDate;
    await openProjectRequest<OpenProjectWorkPackage>(
      `/api/v3/projects/${project.id}/work_packages`,
      { method: 'POST', body }
    );
    existingSubjects.add(task.name);
    summary.tasksCreated += 1;
  }
}

async function ensureOpenProjectProject(
  input: {
    identifier: string;
    name: string;
    parentProjectId?: number;
  },
  projects: OpenProjectProject[],
  summary: Summary,
  hierarchyKind: keyof Summary['openProjectProjectHierarchy']
) {
  const existing = projects.find((project) => project.identifier === input.identifier);
  if (existing) {
    summary.openProjectProjectsReused += 1;
    return existing;
  }

  const project = await openProjectRequest<OpenProjectProject>('/api/v3/projects', {
    method: 'POST',
    body: {
      name: input.name.slice(0, 255),
      identifier: input.identifier,
      public: false,
      description: { format: 'markdown', raw: '' },
      ...(input.parentProjectId
        ? { _links: { parent: { href: `/api/v3/projects/${input.parentProjectId}` } } }
        : {}),
    },
  });
  projects.push(project);
  summary.openProjectProjectsCreated += 1;
  summary.openProjectProjectHierarchy[hierarchyKind] += 1;
  return project;
}

function clickUpStatuses(
  list: ClickUpList,
  folder: ClickUpFolder | null,
  space: ClickUpSpace
): ClickUpStatus[] {
  return list.statuses?.length
    ? list.statuses
    : folder?.statuses?.length
      ? folder.statuses
      : space.statuses || [];
}

async function seedFromOpenProjectImportedDescriptions(
  projects: OpenProjectProject[],
  openProjectStatuses: OpenProjectStatus[]
) {
  const workspace: SeededWorkspace = {
    id: 'openproject',
    name: 'OpenProject',
    slug: 'openproject-clickup-import',
    source: 'CLICKUP_SEEDED_OPENPROJECT',
    seededAt: new Date().toISOString(),
    spaces: [],
    memberships: [],
    permissionSets,
  };
  const spaceMap = new Map<string, SeededWorkspace['spaces'][number]>();
  const listCounts = new Map<string, number>();

  for (const project of projects) {
    const workPackages = await getProjectWorkPackages(project.id).catch(() => []);
    for (const workPackage of workPackages) {
      const meta = importedMeta(workPackage.description?.raw || '');
      if (!meta) continue;
      const spaceKey = slug(meta.spaceName);
      const listKey = `${project.id}:${spaceKey}:${slug(meta.listName)}`;
      listCounts.set(listKey, (listCounts.get(listKey) || 0) + 1);

      let space = spaceMap.get(spaceKey);
      if (!space) {
        space = {
          id: `clickup-space:${spaceKey}`,
          clickupSpaceId: spaceKey,
          workspaceId: workspace.id,
          name: meta.spaceName,
          color: '#4c6ef5',
          initials: meta.spaceName.slice(0, 1).toUpperCase(),
          locked: false,
          permissions: permissionSets.map((set) => ({
            role: set.role as WorkspaceRole,
            canView: true,
            canEdit: set.manageTasks,
            canManage: set.manageSpaces,
          })),
          folders: [
            {
              id: `clickup-folder:${spaceKey}:imported`,
              clickupFolderId: undefined,
              spaceId: `clickup-space:${spaceKey}`,
              name: 'Work packages',
              kind: 'TEAM',
              locked: false,
              taskLists: [],
            },
          ],
          documents: [],
        };
        spaceMap.set(spaceKey, space);
        workspace.spaces.push(space);
      }

      const folder = space.folders[0]!;
      if (folder.taskLists.some((list) => list.clickupListId === listKey)) continue;
      const statuses = openProjectStatuses
        .map((status) => ({
          id: `op-status:${status.id}:clickup-status:${statusSlug(status.name)}`,
          clickupStatusName: status.name,
          openProjectStatusId: String(status.id),
          taskListId: `op-project:${project.id}:clickup-list:${listKey}`,
          name: status.name,
          color: status.isClosed
            ? '#4d9f87'
            : status.name.toLowerCase().includes('progress')
              ? '#228be6'
              : '#868e96',
          position: Number(status.position || status.id),
          isDone: Boolean(status.isClosed),
        }))
        .sort((a, b) => a.position - b.position);

      folder.taskLists.push({
        id: `op-project:${project.id}:clickup-list:${listKey}`,
        clickupListId: listKey,
        openProjectProjectId: String(project.id),
        importFilter: meta,
        folderId: folder.id,
        name: meta.listName,
        icon: '✓',
        statuses,
        _count: { tasks: listCounts.get(listKey) || 0 },
      });
    }
  }

  for (const space of workspace.spaces) {
    for (const folder of space.folders) {
      for (const list of folder.taskLists) {
        list._count = { tasks: listCounts.get(list.clickupListId) || 0 };
      }
    }
  }

  return workspace;
}

async function main() {
  const summary: Summary = {
    teams: 0,
    spaces: 0,
    folders: 0,
    lists: 0,
    statuses: 0,
    openProjectProjectsCreated: 0,
    openProjectProjectsReused: 0,
    openProjectProjectHierarchy: { spaces: 0, folders: 0, lists: 0 },
    tasksCreated: 0,
    tasksSkipped: 0,
    duplicateTasksRemoved: 0,
    errors: [],
  };

  const openProjectStatuses = await getOpenProjectStatuses();
  const openProjectPriorities = await getOpenProjectPriorities();
  const projects = await getOpenProjectProjects();
  if (!process.env.CLICKUP_TOKEN) {
    const workspace = await seedFromOpenProjectImportedDescriptions(projects, openProjectStatuses);
    const path = seededHierarchyPath();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(workspace, null, 2)}\n`);
    console.log(
      JSON.stringify(
        {
          mode: 'openproject-imported-clickup-description-fallback',
          spaces: workspace.spaces.length,
          folders: workspace.spaces.reduce((count, space) => count + space.folders.length, 0),
          lists: workspace.spaces.reduce(
            (count, space) =>
              count +
              space.folders.reduce(
                (folderCount, folder) => folderCount + folder.taskLists.length,
                0
              ),
            0
          ),
          hierarchyPath: path,
          warning:
            'CLICKUP_TOKEN is missing, so this restored spaces/lists from imported OpenProject task descriptions. Native ClickUp folders/access data was not available.',
        },
        null,
        2
      )
    );
    return;
  }

  const teams = await getClickUpTeams();
  summary.teams = teams.length;
  const team = teams[0];
  if (!team) throw new Error('ClickUp returned no teams/workspaces');

  const spaces = await getClickUpSpaces(team.id);
  summary.spaces = spaces.length;

  const workspace: SeededWorkspace = {
    id: 'openproject',
    name: team.name,
    slug: 'openproject-clickup-mirror',
    source: 'CLICKUP_SEEDED_OPENPROJECT',
    seededAt: new Date().toISOString(),
    spaces: [],
    memberships: [],
    permissionSets,
  };

  for (const space of spaces) {
    const spaceProject = await ensureOpenProjectProject(
      {
        identifier: identifierFor('space', space.id),
        name: space.name,
      },
      projects,
      summary,
      'spaces'
    ).catch((error) => {
      summary.errors.push(`space project ${space.name}: ${(error as Error).message}`);
      return null;
    });
    const folders = await getClickUpFolders(space.id).catch((error) => {
      summary.errors.push(`space ${space.name}: ${(error as Error).message}`);
      return [];
    });
    const folderlessLists = await getClickUpFolderlessLists(space.id).catch((error) => {
      summary.errors.push(`folderless ${space.name}: ${(error as Error).message}`);
      return [];
    });
    summary.folders += folders.length + (folderlessLists.length ? 1 : 0);

    const seededSpace: SeededWorkspace['spaces'][number] = {
      id: `clickup-space:${space.id}`,
      clickupSpaceId: space.id,
      workspaceId: workspace.id,
      name: space.name,
      description: undefined,
      color: space.color || '#4c6ef5',
      initials: space.name.slice(0, 1).toUpperCase(),
      locked: Boolean(space.private),
      permissions: permissionSets.map((set) => ({
        role: set.role as WorkspaceRole,
        canView: true,
        canEdit: set.manageTasks,
        canManage: set.manageSpaces,
      })),
      folders: [],
      documents: [],
    };

    const allFolderEntries: Array<{ folder: ClickUpFolder | null; lists: ClickUpList[] }> = [];
    for (const folder of folders) {
      allFolderEntries.push({ folder, lists: await getClickUpLists(folder.id) });
    }
    if (folderlessLists.length) allFolderEntries.push({ folder: null, lists: folderlessLists });

    for (const entry of allFolderEntries) {
      const folderId = entry.folder?.id || `${space.id}:folderless`;
      const folderProject = await ensureOpenProjectProject(
        {
          identifier: identifierFor('folder', folderId),
          name: entry.folder?.name || 'Folderless lists',
          parentProjectId: spaceProject?.id,
        },
        projects,
        summary,
        'folders'
      ).catch((error) => {
        summary.errors.push(
          `folder project ${entry.folder?.name || 'Folderless lists'}: ${(error as Error).message}`
        );
        return null;
      });
      const seededFolder: SeededWorkspace['spaces'][number]['folders'][number] = {
        id: `clickup-folder:${folderId}`,
        clickupFolderId: entry.folder?.id,
        spaceId: seededSpace.id,
        name: entry.folder?.name || 'Folderless lists',
        kind: 'TEAM',
        locked: Boolean(entry.folder?.hidden),
        taskLists: [],
      };

      for (const list of entry.lists) {
        const project = await ensureOpenProjectProject(
          {
            identifier: identifierFor('list', list.id),
            name: list.name,
            parentProjectId: folderProject?.id || spaceProject?.id,
          },
          projects,
          summary,
          'lists'
        ).catch((error) => {
          summary.errors.push(`list project ${list.name}: ${(error as Error).message}`);
          return null;
        });
        if (!project) continue;
        await syncClickUpTasksIntoProject(
          list,
          project,
          openProjectStatuses,
          openProjectPriorities,
          summary
        ).catch((error) => {
          summary.errors.push(`tasks ${list.name}: ${(error as Error).message}`);
        });

        const statuses = clickUpStatuses(list, entry.folder, space)
          .map((status, index) => {
            const openProjectStatusId = mapStatusToOpenProjectId(status, openProjectStatuses);
            return {
              id: `op-status:${openProjectStatusId}:clickup-status:${statusSlug(status.status)}`,
              clickupStatusId: status.id,
              clickupStatusName: status.status,
              openProjectStatusId,
              taskListId: `op-project:${project.id}:clickup-list:${list.id}`,
              name: status.status,
              color: status.color || '#868e96',
              position: Number(status.orderindex ?? index),
              isDone: status.type === 'closed' || status.type === 'done',
            };
          })
          .sort((a, b) => a.position - b.position);
        summary.statuses += statuses.length;

        seededFolder.taskLists.push({
          id: `op-project:${project.id}:clickup-list:${list.id}`,
          clickupListId: list.id,
          openProjectProjectId: String(project.id),
          folderId: seededFolder.id,
          name: list.name,
          icon: '✓',
          statuses,
          _count: { tasks: Number(list.task_count || 0) },
        });
        summary.lists += 1;
      }

      seededSpace.folders.push(seededFolder);
    }

    workspace.spaces.push(seededSpace);
  }

  const path = seededHierarchyPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(workspace, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        ...summary,
        hierarchyPath: path,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
