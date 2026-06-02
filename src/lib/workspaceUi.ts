import { docsPath, folderPath } from './taskUi.js';
import type {
  Folder,
  MigrationRun,
  OpenProjectConnectionStatus,
  Space,
  TaskList,
  Workspace,
} from './types.js';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function numericValue(summary: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = summary[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

function countCollection(value: unknown) {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as JsonRecord).length;
  }
  return 0;
}

export function summarizeImportRun(run?: MigrationRun | null) {
  const summary = asRecord(run?.summary);
  return {
    status: run?.status || 'UNKNOWN',
    projectsImported:
      numericValue(summary, ['projectsCreated']) +
      numericValue(summary, ['projectsReused', 'projectsUpdated']),
    tasksImported:
      numericValue(summary, ['tasksCreated']) +
      numericValue(summary, ['tasksUpdated', 'tasksReused']),
    usersImported:
      numericValue(summary, ['openProjectUsersCreated']) +
      numericValue(summary, ['openProjectUsersReused', 'localUsersCreated', 'localUsersReused']),
    membershipsImported:
      numericValue(summary, ['openProjectMembershipsCreated']) +
      numericValue(summary, ['openProjectMembershipsReused']) +
      numericValue(summary, ['openProjectMembershipsUpdated']),
    assigneesMapped: numericValue(summary, ['assigneesMapped']),
    responsibleMapped: numericValue(summary, ['responsibleMapped']),
    additionalAssigneesStored: numericValue(summary, ['additionalAssigneesStored']),
    warningsCount:
      numericValue(summary, ['warningCount']) +
      countCollection(run?.warnings) +
      countCollection(summary.permissionWarnings),
    errorsCount:
      numericValue(summary, ['errorCount']) +
      countCollection(run?.errors) +
      countCollection(summary.assigneeMappingErrors) +
      countCollection(summary.openProjectMembershipErrors) +
      countCollection(summary.openProjectUserErrors),
  };
}

export function buildWorkspaceChecklist(input: {
  connectionStatus?: OpenProjectConnectionStatus | null;
  latestImport?: MigrationRun | null;
  workspaceMemberCount: number;
  githubEnabled: boolean;
}) {
  const metrics = summarizeImportRun(input.latestImport);
  return [
    {
      label: 'OpenProject connected',
      done: Boolean(input.connectionStatus?.ok),
    },
    {
      label: 'ClickUp import completed',
      done: input.latestImport?.status === 'SUCCESS',
    },
    {
      label: 'Users imported',
      done: metrics.usersImported > 0,
    },
    {
      label: 'Assignees mapped',
      done: metrics.assigneesMapped > 0,
    },
    {
      label: 'Workspace members configured',
      done: input.workspaceMemberCount > 1,
    },
    {
      label: `GitHub integration ${input.githubEnabled ? 'enabled' : 'disabled'}`,
      done: true,
    },
  ];
}

export function buildWorkspaceBreadcrumbs(input: {
  workspace?: Workspace;
  activeSpace?: Space;
  activeFolder?: Folder;
  activeTaskList?: TaskList;
  selectedTaskTitle?: string | null;
  selectedDocTitle?: string | null;
  currentView?: 'tasks' | 'board' | 'docs';
  workspaceWideLabel?: string | null;
  workspaceWideScope?: 'mine' | 'all' | null;
}) {
  const spaceId = input.activeSpace?.id;
  const folderId = input.activeFolder?.id;
  const folderHref =
    spaceId && folderId
      ? input.activeFolder?.kind === 'DOCS'
        ? docsPath(spaceId)
        : folderPath(spaceId, folderId)
      : undefined;

  const items: BreadcrumbItem[] = [];

  if (input.workspace) {
    items.push({ label: input.workspace.name });
  }

  if (input.workspaceWideLabel) {
    items.push({ label: input.workspaceWideLabel });
    return items;
  }

  if (input.activeSpace) {
    items.push({ label: input.activeSpace.name });
  }
  if (input.activeFolder) {
    items.push({ label: input.activeFolder.name, href: folderHref });
  }

  // Helper: only add task list label when it differs from the folder name
  // (they're often the same in seeded projects — no point repeating)
  const addListIfDifferent = () => {
    if (input.activeTaskList && input.activeTaskList.name !== input.activeFolder?.name) {
      items.push({ label: input.activeTaskList.name, href: folderHref });
    }
  };

  if (input.selectedDocTitle) {
    // No "Local Docs" intermediary — folder name (DOC) already contextualises it
    items.push({ label: input.selectedDocTitle });
    return items;
  }

  // Docs panel — folder name alone is enough (it's the last item, strip href)
  if (input.currentView === 'docs') {
    if (items.length > 0) {
      const last = items[items.length - 1];
      items[items.length - 1] = { label: last.label };
    }
    return items;
  }

  addListIfDifferent();

  if (input.currentView === 'board') {
    items.push({ label: 'Board' });
  } else if (items.length > 0) {
    // tasks view: last item is the task list or folder — strip its href
    const last = items[items.length - 1];
    items[items.length - 1] = { label: last.label };
  }

  return items;
}

export function describeTaskCollectionState(input: {
  hasLinkedOpenProjectUser: boolean;
  assignedToMeActive: boolean;
  filtersActive: boolean;
  isWorkspaceWide: boolean;
}) {
  if (input.assignedToMeActive && !input.hasLinkedOpenProjectUser) {
    return {
      title: 'Assigned work is not linked yet',
      message:
        'Your local account is not linked to an OpenProject user, so the assignee filter cannot load your tasks.',
      actionLabel: undefined,
    };
  }

  if (input.filtersActive) {
    return {
      title: 'No tasks match these filters',
      message: 'Try clearing one or more filters to widen the OpenProject task query.',
      actionLabel: 'Clear filters',
    };
  }

  if (input.isWorkspaceWide) {
    return {
      title: 'No tasks in this workspace yet',
      message: 'Run an import or create the first task in one of the OpenProject projects.',
      actionLabel: undefined,
    };
  }

  return {
    title: 'No tasks in this list yet',
    message: 'This OpenProject list does not contain any work packages yet.',
    actionLabel: undefined,
  };
}
