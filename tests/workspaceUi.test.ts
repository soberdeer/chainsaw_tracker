import {
  allTasksPath,
  buildWorkspaceBreadcrumbs,
  buildWorkspaceChecklist,
  describeTaskCollectionState,
  getErrorMessage,
  myTasksPath,
  reorderBoardTasks,
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
      openProjectMembershipsCreated: 7,
      openProjectMembershipsReused: 3,
      openProjectMembershipsUpdated: 1,
      assigneesMapped: 6,
      responsibleMapped: 2,
      additionalAssigneesStored: 1,
      assigneeMappingErrors: ['task 1 failed'],
    },
    warnings: ['warn-a', 'warn-b'],
    errors: [],
  });

  assert.equal(summary.projectsImported, 3);
  assert.equal(summary.tasksImported, 12);
  assert.equal(summary.usersImported, 5);
  assert.equal(summary.membershipsImported, 11);
  assert.equal(summary.assigneesMapped, 6);
  assert.equal(summary.warningsCount, 2);
  assert.equal(summary.errorsCount, 1);
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

  const workspaceWide = buildWorkspaceBreadcrumbs({
    workspace: {
      id: 'w1',
      name: 'Workspace',
      slug: 'workspace',
      spaces: [],
      memberships: [],
      permissionSets: [],
    },
    workspaceWideLabel: 'All Tasks',
    currentView: 'tasks',
  });
  assert.deepEqual(
    workspaceWide.map((item) => item.label),
    ['Workspace', 'All Tasks']
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

test('reorderBoardTasks moves tasks within and across columns while preserving status order arrays', () => {
  const statuses = [
    { id: 'todo', taskListId: 'list-1', name: 'To do', color: '#999', position: 0, isDone: false },
    { id: 'doing', taskListId: 'list-1', name: 'Doing', color: '#09f', position: 1, isDone: false },
  ];
  const tasks = [
    {
      id: '1',
      folderId: 'folder-1',
      title: 'One',
      status: 'To do',
      statusId: 'todo',
      priority: 'NORMAL',
      assignees: [],
      tags: [],
      position: 1,
    },
    {
      id: '2',
      folderId: 'folder-1',
      title: 'Two',
      status: 'To do',
      statusId: 'todo',
      priority: 'NORMAL',
      assignees: [],
      tags: [],
      position: 2,
    },
    {
      id: '3',
      folderId: 'folder-1',
      title: 'Three',
      status: 'Doing',
      statusId: 'doing',
      priority: 'NORMAL',
      assignees: [],
      tags: [],
      position: 3,
    },
  ];

  const withinColumn = reorderBoardTasks(tasks as any, statuses as any, {
    taskId: '2',
    toStatusId: 'todo',
    targetTaskId: '1',
  });
  assert.deepEqual(withinColumn?.orders, [{ statusId: 'todo', orderedTaskIds: ['2', '1'] }]);

  const acrossColumns = reorderBoardTasks(tasks as any, statuses as any, {
    taskId: '1',
    toStatusId: 'doing',
    targetTaskId: '3',
  });
  assert.equal(acrossColumns?.updatedTask.statusId, 'doing');
  assert.equal(acrossColumns?.updatedTask.status, 'Doing');
  assert.deepEqual(acrossColumns?.orders, [
    { statusId: 'todo', orderedTaskIds: ['2'] },
    { statusId: 'doing', orderedTaskIds: ['1', '3'] },
  ]);
  assert.equal(allTasksPath(), '/tasks');
  assert.equal(myTasksPath(), '/my-tasks');
});
