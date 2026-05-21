import {
  buildWorkspaceBreadcrumbs,
  buildWorkspaceChecklist,
  describeTaskCollectionState,
  getErrorMessage,
  summarizeImportRun,
} from '../src/lib/index.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('summarizeImportRun extracts key import counters', () => {
  const summary = summarizeImportRun({
    id: 'run_1',
    source: 'CLICKUP',
    startedAt: new Date().toISOString(),
    status: 'SUCCESS',
    summary: {
      projectsCreated: 3,
      tasksCreated: 10,
      tasksUpdated: 2,
      openProjectUsersCreated: 4,
      openProjectUsersReused: 1,
      assigneesMapped: 6,
      responsibleMapped: 2,
      additionalAssigneesStored: 1,
    },
    warnings: ['warn-a', 'warn-b'],
    errors: [],
  });

  assert.equal(summary.projectsImported, 3);
  assert.equal(summary.tasksImported, 12);
  assert.equal(summary.usersImported, 5);
  assert.equal(summary.assigneesMapped, 6);
  assert.equal(summary.warningsCount, 2);
  assert.equal(summary.errorsCount, 0);
});

test('buildWorkspaceChecklist reflects connection and import status', () => {
  const items = buildWorkspaceChecklist({
    connectionStatus: {
      ok: true,
      baseUrl: 'http://localhost:8080',
      authMode: 'basic',
      apiUser: null,
    },
    latestImport: {
      id: 'run_2',
      source: 'CLICKUP',
      startedAt: new Date().toISOString(),
      status: 'SUCCESS',
      summary: { openProjectUsersCreated: 3, assigneesMapped: 2 },
      warnings: [],
      errors: [],
    },
    workspaceMemberCount: 2,
    githubEnabled: false,
  });

  assert.deepEqual(
    items.map((item) => item.done),
    [true, true, true, true, true, true]
  );
});

test('buildWorkspaceBreadcrumbs keeps docs and task paths distinct', () => {
  const docBreadcrumbs = buildWorkspaceBreadcrumbs({
    workspace: {
      id: 'w1',
      name: 'Workspace',
      slug: 'workspace',
      spaces: [],
      memberships: [],
      permissionSets: [],
    },
    activeSpace: {
      id: 's1',
      workspaceId: 'w1',
      name: 'Product',
      color: '#228be6',
      folders: [],
      documents: [],
    },
    selectedDocTitle: 'Brief',
    currentView: 'docs',
  });
  assert.deepEqual(
    docBreadcrumbs.map((item) => item.label),
    ['Workspace', 'Product', 'Local Docs', 'Brief']
  );

  const taskBreadcrumbs = buildWorkspaceBreadcrumbs({
    workspace: {
      id: 'w1',
      name: 'Workspace',
      slug: 'workspace',
      spaces: [],
      memberships: [],
      permissionSets: [],
    },
    activeSpace: {
      id: 's1',
      workspaceId: 'w1',
      name: 'Product',
      color: '#228be6',
      folders: [],
      documents: [],
    },
    activeFolder: { id: 'f1', spaceId: 's1', name: 'Core Dev' },
    activeTaskList: { id: 'l1', folderId: 'f1', name: 'Work packages', statuses: [] },
    selectedTaskTitle: 'Fix tracker shell',
    currentView: 'tasks',
  });
  assert.deepEqual(
    taskBreadcrumbs.map((item) => item.label),
    ['Workspace', 'Product', 'Core Dev', 'Work packages', 'Fix tracker shell']
  );
});

test('describeTaskCollectionState explains linked-user and filter empties', () => {
  const linkedState = describeTaskCollectionState({
    hasLinkedOpenProjectUser: false,
    assignedToMeActive: true,
    filtersActive: true,
    isWorkspaceWide: false,
  });
  assert.match(linkedState.message, /not linked to an OpenProject user/i);

  const filteredState = describeTaskCollectionState({
    hasLinkedOpenProjectUser: true,
    assignedToMeActive: false,
    filtersActive: true,
    isWorkspaceWide: false,
  });
  assert.equal(filteredState.actionLabel, 'Clear filters');
});

test('getErrorMessage maps common OpenProject errors to user-facing copy', () => {
  assert.equal(
    getErrorMessage(new Error('Workflow transition not allowed')),
    'OpenProject does not allow moving this task to that status in the current workflow.'
  );
  assert.equal(
    getErrorMessage(new Error('Assignee user has no project membership access')),
    'OpenProject rejected the assignee because that user does not have access to this project.'
  );
  assert.equal(
    getErrorMessage(new Error('LockVersion conflict detected')),
    'This task was changed by someone else in OpenProject. Refresh the task and try again.'
  );
});
