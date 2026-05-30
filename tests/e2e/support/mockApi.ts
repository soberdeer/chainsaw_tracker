import type { Page, Route } from '@playwright/test';

export type MockRole = 'OWNER' | 'ADMIN' | 'LEAD' | 'MEMBER' | 'VIEWER';

type FailureKey =
  | 'taskCreate'
  | 'taskUpdate'
  | 'boardOrder'
  | 'commentCreate'
  | 'attachmentUpload'
  | 'relationCreate'
  | 'relationDelete'
  | 'timeEntryCreate'
  | 'tagSave'
  | 'tagCreate'
  | 'githubLink'
  | 'githubUnlink'
  | 'getTasks'
  | 'getTask';

type MockUser = {
  id: string;
  email: string;
  name: string;
  password: string;
  role: MockRole;
  avatarUrl?: string | null;
  source?: string | null;
  openProjectUserId?: string | null;
  openProjectLogin?: string | null;
  lastLoginAt?: string | null;
};

type MockTask = {
  id: string;
  workspaceId: string;
  spaceId: string;
  folderId: string;
  taskListId: string;
  taskKey: string;
  title: string;
  description: string;
  statusId: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | null;
  assigneeIds: string[];
  typeId: string;
  startDate?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  position: number;
  externalSource: 'OPENPROJECT';
  externalUrl: string;
  tagIds: string[];
  githubPullRequestIds: string[];
  githubBranchIds: string[];
  parentId?: string | null;
  lockedForBulk?: boolean;
  customFields?: Record<string, string | number | boolean | null>;
};

type MockActivity = {
  id: string;
  taskId: string;
  type: string;
  message?: string;
  previousValue?: string;
  nextValue?: string;
  createdAt: string;
};

type MockRelation = {
  id: string;
  taskId: string;
  type: string;
  fromId: string;
  fromTitle: string;
  toId: string;
  toTitle: string;
};

type MockTimeEntry = {
  id: string;
  taskId: string;
  hours: string;
  spentOn: string;
  comment?: string;
  activityId: string;
  userId: string;
  createdAt: string;
};

type MockAttachment = {
  id: string;
  taskId: string;
  fileName: string;
  fileSize?: number;
  contentType?: string;
  description?: string;
  downloadUrl: string;
  createdAt: string;
};

type MockTag = {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  normalizedName: string;
  createdAt: string;
  updatedAt: string;
};

type MockPullRequest = {
  id: string;
  repositoryId: string;
  workPackageId: string;
  githubPrId: string;
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED';
  draft: boolean;
  isMerged: boolean;
  baseBranch: string;
  headBranch: string;
  headSha: string;
  authorLogin?: string;
  reviewStatus: string;
  syncedAt: string;
};

type MockBranch = {
  id: string;
  repositoryId: string;
  workPackageId: string;
  name: string;
  lastCommitSha?: string;
  url?: string;
};

type MockNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message?: string | null;
  workPackageId?: string | null;
  readAt?: string | null;
  createdAt: string;
};

type MockSavedView = {
  id: string;
  workspaceId: string;
  ownerUserId?: string | null;
  projectId?: string | null;
  listId?: string | null;
  name: string;
  filters: Record<string, unknown>;
  sort?: Record<string, unknown> | null;
  visibility: 'PRIVATE' | 'WORKSPACE';
  createdAt: string;
  updatedAt: string;
};

type MockDocument = {
  id: string;
  spaceId: string;
  title: string;
  kind: 'MARKDOWN' | 'IMAGE' | 'SPREADSHEET' | 'EMBED';
  markdown?: string;
  fileUrl?: string;
  embedUrl?: string;
  sourceName?: string;
};

type MockImportRun = {
  id: string;
  source: string;
  startedAt: string;
  finishedAt?: string | null;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  summary?: Record<string, unknown>;
  warnings?: unknown;
  errors?: unknown;
};

type MockState = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  currentUserId: string | null;
  setupRequired: boolean;
  devDefaultOwnerEnabled: boolean;
  users: MockUser[];
  spaces: Array<{
    id: string;
    name: string;
    color: string;
    initials: string;
    locked?: boolean;
    folders: Array<{
      id: string;
      name: string;
      taskLists: Array<{
        id: string;
        name: string;
      }>;
    }>;
  }>;
  statuses: Array<{
    id: string;
    taskListId: string;
    name: string;
    color: string;
    position: number;
    isDone: boolean;
  }>;
  taskTypes: Array<{ id: string; name: string }>;
  tasks: MockTask[];
  activities: MockActivity[];
  relations: MockRelation[];
  timeEntries: MockTimeEntry[];
  timeEntryActivities: Array<{ id: string; name: string }>;
  attachments: MockAttachment[];
  tags: MockTag[];
  repositories: Array<{
    id: string;
    workspaceId: string;
    owner: string;
    repo: string;
    defaultBranch: string;
  }>;
  pullRequests: MockPullRequest[];
  branches: MockBranch[];
  notifications: MockNotification[];
  savedViews: MockSavedView[];
  documents: MockDocument[];
  importRuns: MockImportRun[];
  taskRequests: Array<{ cursor: string | null; tagIds: string[]; hasGitHubPr: boolean }>;
  workspaceSettings: {
    id: string;
    persistedId: string;
    name: string;
    slug: string;
    description?: string | null;
    avatarUrl?: string | null;
    color?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  openProjectStatus: {
    ok: boolean;
    baseUrl: string;
    authMode: 'basic' | 'bearer';
    apiUser: null;
    projectsVisible?: number;
    usersVisible?: number;
    runtimeWorkspaceId?: string | null;
    lastImportReportId?: string | null;
    error?: string;
  };
  failures: Partial<Record<FailureKey, number>>;
  sequence: number;
};

export interface MockApiController {
  state: MockState;
  setCurrentUser: (role: MockRole | null) => void;
  setSetupRequired: (value: boolean) => void;
  setFailure: (key: FailureKey, count?: number) => void;
  setTimeActivities: (items: Array<{ id: string; name: string }>) => void;
  attachTagToTask: (taskId: string, tagName: string) => string;
  attachPullRequestToTask: (taskId: string, number: number) => string;
}

const NOW = '2026-05-22T12:00:00.000Z';
const LOCAL_FILTER_PAGE_SCAN_SIZE = 100;
const LOCAL_FILTER_MAX_SCAN = 1000;

function toIsoDate(dayOffset: number) {
  const date = new Date(NOW);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

function nextId(state: MockState, prefix: string) {
  state.sequence += 1;
  return `${prefix}-${state.sequence}`;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function currentUser(state: MockState) {
  return state.users.find((user) => user.id === state.currentUserId) || null;
}

function rolePermissions(role: MockRole) {
  return {
    role,
    manageWorkspace: role === 'OWNER' || role === 'ADMIN',
    manageSpaces: role === 'OWNER' || role === 'ADMIN',
    manageDocs: role !== 'VIEWER',
    manageTasks: role !== 'VIEWER',
    inviteMembers: role === 'OWNER' || role === 'ADMIN',
    manageIntegrations: role === 'OWNER' || role === 'ADMIN',
    manageImports: role === 'OWNER' || role === 'ADMIN',
    viewReports: true,
  };
}

function createDefaultTags(state: MockState) {
  return [
    ['bug', '#e03131'],
    ['feature', '#1c7ed6'],
    ['art', '#ae3ec9'],
    ['audio', '#0c8599'],
    ['level', '#5f3dc4'],
    ['ui', '#4263eb'],
    ['build', '#f08c00'],
    ['playtest', '#2b8a3e'],
    ['blocker', '#c92a2a'],
    ['polish', '#12b886'],
  ].map(([name, color]) => ({
    id: `tag-${name}`,
    workspaceId: state.workspaceId,
    name,
    color,
    normalizedName: normalizeName(name),
    createdAt: NOW,
    updatedAt: NOW,
  }));
}

function createDefaultState(): MockState {
  const state: MockState = {
    workspaceId: 'ws-1',
    workspaceName: 'Bootstrap Tracker',
    workspaceSlug: 'bootstrap-tracker',
    currentUserId: null,
    setupRequired: false,
    devDefaultOwnerEnabled: false,
    users: [
      {
        id: 'user-owner',
        email: 'owner@example.com',
        name: 'Owner One',
        password: 'ownerpass123',
        role: 'OWNER',
        avatarUrl: null,
        source: 'LOCAL',
        openProjectUserId: 'user-owner',
        openProjectLogin: 'owner.one',
      },
      {
        id: 'user-admin',
        email: 'admin@example.com',
        name: 'Admin One',
        password: 'adminpass123',
        role: 'ADMIN',
        avatarUrl: null,
        source: 'LOCAL',
        openProjectUserId: 'user-admin',
        openProjectLogin: 'admin.one',
      },
      {
        id: 'user-lead',
        email: 'lead@example.com',
        name: 'Lead One',
        password: 'leadpass123',
        role: 'LEAD',
        avatarUrl: null,
        source: 'LOCAL',
        openProjectUserId: 'user-lead',
        openProjectLogin: 'lead.one',
      },
      {
        id: 'user-member',
        email: 'member@example.com',
        name: 'Member One',
        password: 'memberpass123',
        avatarUrl: null,
        role: 'MEMBER',
        source: 'LOCAL',
        openProjectUserId: 'user-member',
        openProjectLogin: 'member.one',
      },
      {
        id: 'user-viewer',
        email: 'viewer@example.com',
        name: 'Viewer One',
        password: 'viewerpass123',
        avatarUrl: null,
        role: 'VIEWER',
        source: 'LOCAL',
        openProjectUserId: 'user-viewer',
        openProjectLogin: 'viewer.one',
      },
    ],
    spaces: [
      {
        id: 'space-alpha',
        name: 'Project Alpha',
        color: '#1c7ed6',
        initials: 'A',
        folders: [
          {
            id: 'folder-alpha',
            name: 'Gameplay',
            taskLists: [{ id: 'list-alpha', name: 'Work packages' }],
          },
        ],
      },
      {
        id: 'space-beta',
        name: 'Project Beta',
        color: '#2b8a3e',
        initials: 'B',
        folders: [
          {
            id: 'folder-beta',
            name: 'Content',
            taskLists: [{ id: 'list-beta', name: 'Work packages' }],
          },
        ],
      },
    ],
    statuses: [
      {
        id: 'status-todo',
        taskListId: 'list-alpha',
        name: 'Todo',
        color: '#5c7cfa',
        position: 1,
        isDone: false,
      },
      {
        id: 'status-progress',
        taskListId: 'list-alpha',
        name: 'In Progress',
        color: '#fd7e14',
        position: 2,
        isDone: false,
      },
      {
        id: 'status-review',
        taskListId: 'list-alpha',
        name: 'In Review',
        color: '#9775fa',
        position: 3,
        isDone: false,
      },
      {
        id: 'status-done',
        taskListId: 'list-alpha',
        name: 'Done',
        color: '#2f9e44',
        position: 4,
        isDone: true,
      },
    ],
    taskTypes: [
      { id: 'type-feature', name: 'Feature' },
      { id: 'type-bug', name: 'Bug' },
      { id: 'type-ui', name: 'UI' },
      { id: 'type-audio', name: 'Audio' },
      { id: 'type-build', name: 'Build/release' },
    ],
    tasks: [],
    activities: [],
    relations: [],
    timeEntries: [],
    timeEntryActivities: [
      { id: 'activity-dev', name: 'Development' },
      { id: 'activity-qa', name: 'QA' },
    ],
    attachments: [],
    tags: [],
    repositories: [
      {
        id: 'repo-1',
        workspaceId: 'ws-1',
        owner: 'team',
        repo: 'bootstrap-game',
        defaultBranch: 'main',
      },
    ],
    pullRequests: [],
    branches: [],
    notifications: [],
    savedViews: [],
    documents: [
      {
        id: 'doc-1',
        spaceId: 'space-alpha',
        title: 'Project Bible',
        kind: 'MARKDOWN',
        markdown: '# Project Bible\n\nInitial gameplay pillars.',
      },
    ],
    importRuns: [
      {
        id: 'import-1',
        source: 'CLICKUP',
        startedAt: NOW,
        finishedAt: NOW,
        status: 'SUCCESS',
        summary: {
          projectsCreated: 2,
          tasksCreated: 12,
          tasksUpdated: 4,
          openProjectUsersCreated: 5,
          localUsersCreated: 5,
          openProjectMembershipsCreated: 7,
          assigneesMapped: 6,
          responsibleMapped: 2,
          additionalAssigneesStored: 1,
          warningCount: 1,
          errorCount: 0,
          assigneeMappingErrors: [],
        },
        warnings: ['One ClickUp custom field was skipped.'],
        errors: [],
      },
    ],
    taskRequests: [],
    workspaceSettings: {
      id: 'workspace-settings-1',
      persistedId: 'workspace-settings-1',
      name: 'Bootstrap Tracker',
      slug: 'bootstrap-tracker',
      description: 'OpenProject-backed tracker workspace',
      avatarUrl: null,
      color: '#1c7ed6',
      createdAt: NOW,
      updatedAt: NOW,
    },
    openProjectStatus: {
      ok: true,
      baseUrl: 'https://openproject.example.test',
      authMode: 'bearer',
      apiUser: null,
      projectsVisible: 2,
      usersVisible: 5,
      runtimeWorkspaceId: 'ws-1',
      lastImportReportId: 'import-1',
    },
    failures: {},
    sequence: 1000,
  };

  state.tags = createDefaultTags(state);

  const baseTasks: MockTask[] = [
    {
      id: 'wp-101',
      workspaceId: state.workspaceId,
      spaceId: 'space-alpha',
      folderId: 'folder-alpha',
      taskListId: 'list-alpha',
      taskKey: 'WP-101',
      title: 'Hero controller',
      description: 'Implement the player controller.',
      statusId: 'status-todo',
      priority: 'HIGH',
      assigneeIds: ['user-lead'],
      typeId: 'type-feature',
      startDate: toIsoDate(-1),
      dueDate: toIsoDate(5),
      createdAt: NOW,
      updatedAt: NOW,
      position: 1,
      externalSource: 'OPENPROJECT',
      externalUrl: 'https://openproject.example.test/wp/101',
      tagIds: ['tag-feature'],
      githubPullRequestIds: ['pr-hero'],
      githubBranchIds: [],
      customFields: {
        severity: 'Major',
        platform: 'PC',
      },
    },
    {
      id: 'wp-102',
      workspaceId: state.workspaceId,
      spaceId: 'space-alpha',
      folderId: 'folder-alpha',
      taskListId: 'list-alpha',
      taskKey: 'WP-102',
      title: 'Fix jump bug',
      description: 'Player can double jump after landing on moving platforms.',
      statusId: 'status-progress',
      priority: 'URGENT',
      assigneeIds: ['user-member', 'user-lead'],
      typeId: 'type-bug',
      startDate: toIsoDate(-2),
      dueDate: toIsoDate(-1),
      createdAt: NOW,
      updatedAt: NOW,
      position: 2,
      externalSource: 'OPENPROJECT',
      externalUrl: 'https://openproject.example.test/wp/102',
      tagIds: ['tag-bug', 'tag-blocker'],
      githubPullRequestIds: [],
      githubBranchIds: [],
      customFields: {
        severity: 'Critical',
        reproducibility: 'Always',
      },
    },
    {
      id: 'wp-103',
      workspaceId: state.workspaceId,
      spaceId: 'space-alpha',
      folderId: 'folder-alpha',
      taskListId: 'list-alpha',
      taskKey: 'WP-103',
      title: 'Menu polish',
      description: 'Polish the pause menu interactions.',
      statusId: 'status-review',
      priority: 'NORMAL',
      assigneeIds: ['user-owner'],
      typeId: 'type-ui',
      startDate: toIsoDate(-3),
      dueDate: toIsoDate(3),
      createdAt: NOW,
      updatedAt: NOW,
      position: 3,
      externalSource: 'OPENPROJECT',
      externalUrl: 'https://openproject.example.test/wp/103',
      tagIds: ['tag-ui', 'tag-polish'],
      githubPullRequestIds: [],
      githubBranchIds: [],
      customFields: {
        component: 'Pause menu',
      },
    },
    {
      id: 'wp-104',
      workspaceId: state.workspaceId,
      spaceId: 'space-alpha',
      folderId: 'folder-alpha',
      taskListId: 'list-alpha',
      taskKey: 'WP-104',
      title: 'Unmergeable test task',
      description: 'Used to simulate a partial bulk failure.',
      statusId: 'status-todo',
      priority: 'LOW',
      assigneeIds: ['user-member'],
      typeId: 'type-feature',
      createdAt: NOW,
      updatedAt: NOW,
      position: 4,
      externalSource: 'OPENPROJECT',
      externalUrl: 'https://openproject.example.test/wp/104',
      tagIds: [],
      githubPullRequestIds: [],
      githubBranchIds: [],
      lockedForBulk: true,
      customFields: {},
    },
    {
      id: 'wp-201',
      workspaceId: state.workspaceId,
      spaceId: 'space-beta',
      folderId: 'folder-beta',
      taskListId: 'list-beta',
      taskKey: 'WP-201',
      title: 'Audio balancing',
      description: 'Normalize the battle mix.',
      statusId: 'status-todo',
      priority: 'NORMAL',
      assigneeIds: ['user-member'],
      typeId: 'type-audio',
      startDate: toIsoDate(0),
      dueDate: toIsoDate(7),
      createdAt: NOW,
      updatedAt: NOW,
      position: 1,
      externalSource: 'OPENPROJECT',
      externalUrl: 'https://openproject.example.test/wp/201',
      tagIds: ['tag-audio'],
      githubPullRequestIds: [],
      githubBranchIds: [],
      customFields: {
        component: 'Audio',
      },
    },
    {
      id: 'wp-202',
      workspaceId: state.workspaceId,
      spaceId: 'space-beta',
      folderId: 'folder-beta',
      taskListId: 'list-beta',
      taskKey: 'WP-202',
      title: 'Release checklist',
      description: 'Prepare the next hobby build.',
      statusId: 'status-done',
      priority: 'HIGH',
      assigneeIds: ['user-admin'],
      typeId: 'type-build',
      startDate: toIsoDate(-5),
      dueDate: toIsoDate(1),
      createdAt: NOW,
      updatedAt: NOW,
      position: 2,
      externalSource: 'OPENPROJECT',
      externalUrl: 'https://openproject.example.test/wp/202',
      tagIds: ['tag-build'],
      githubPullRequestIds: [],
      githubBranchIds: [],
      customFields: {
        buildVersion: '0.9.0',
      },
    },
  ];

  for (let index = 1; index <= 240; index += 1) {
    baseTasks.push({
      id: `wp-${300 + index}`,
      workspaceId: state.workspaceId,
      spaceId: 'space-beta',
      folderId: 'folder-beta',
      taskListId: 'list-beta',
      taskKey: `WP-${300 + index}`,
      title: `Backlog task ${index}`,
      description: `Paginated filler task ${index}.`,
      statusId:
        index % 4 === 0
          ? 'status-done'
          : index % 3 === 0
            ? 'status-review'
            : index % 2 === 0
              ? 'status-progress'
              : 'status-todo',
      priority: index % 5 === 0 ? 'HIGH' : 'NORMAL',
      assigneeIds: index % 8 === 0 ? ['user-member'] : ['user-owner'],
      typeId: index % 6 === 0 ? 'type-bug' : 'type-feature',
      startDate: toIsoDate(-3),
      dueDate: toIsoDate((index % 10) - 5),
      createdAt: NOW,
      updatedAt: NOW,
      position: 10 + index,
      externalSource: 'OPENPROJECT',
      externalUrl: `https://openproject.example.test/wp/${300 + index}`,
      tagIds: [],
      githubPullRequestIds: [],
      githubBranchIds: [],
      customFields: {},
    });
  }

  baseTasks.push({
    id: 'wp-777',
    workspaceId: state.workspaceId,
    spaceId: 'space-beta',
    folderId: 'folder-beta',
    taskListId: 'list-beta',
    taskKey: 'WP-777',
    title: 'Late-page tagged task',
    description: 'This task should only appear after scanning several OpenProject pages.',
    statusId: 'status-progress',
    priority: 'HIGH',
    assigneeIds: ['user-member'],
    typeId: 'type-bug',
    startDate: toIsoDate(-1),
    dueDate: toIsoDate(4),
    createdAt: NOW,
    updatedAt: NOW,
    position: 999,
    externalSource: 'OPENPROJECT',
    externalUrl: 'https://openproject.example.test/wp/777',
    tagIds: ['tag-polish'],
    githubPullRequestIds: [],
    githubBranchIds: [],
    customFields: {
      severity: 'High',
    },
  });

  baseTasks.push({
    id: 'wp-778',
    workspaceId: state.workspaceId,
    spaceId: 'space-beta',
    folderId: 'folder-beta',
    taskListId: 'list-beta',
    taskKey: 'WP-778',
    title: 'Late-page PR task',
    description: 'This task should be found by Has GitHub PR even outside the first page.',
    statusId: 'status-review',
    priority: 'HIGH',
    assigneeIds: ['user-member'],
    typeId: 'type-feature',
    startDate: toIsoDate(-1),
    dueDate: toIsoDate(6),
    createdAt: NOW,
    updatedAt: NOW,
    position: 1000,
    externalSource: 'OPENPROJECT',
    externalUrl: 'https://openproject.example.test/wp/778',
    tagIds: [],
    githubPullRequestIds: ['pr-late'],
    githubBranchIds: ['branch-late'],
    customFields: {},
  });

  // Subtask of wp-101 (Hero controller) — used to test subtask expand/collapse in list & board
  baseTasks.push({
    id: 'wp-101-sub',
    workspaceId: state.workspaceId,
    spaceId: 'space-alpha',
    folderId: 'folder-alpha',
    taskListId: 'list-alpha',
    taskKey: 'WP-101-SUB',
    title: 'Setup input bindings',
    description: 'Configure input action map for the hero controller.',
    statusId: 'status-todo',
    priority: 'NORMAL',
    assigneeIds: ['user-lead'],
    typeId: 'type-feature',
    startDate: null,
    dueDate: toIsoDate(3),
    createdAt: NOW,
    updatedAt: NOW,
    position: 100,
    externalSource: 'OPENPROJECT',
    externalUrl: 'https://openproject.example.test/wp/101sub',
    tagIds: [],
    githubPullRequestIds: [],
    githubBranchIds: [],
    parentId: 'wp-101',
    customFields: {},
  });

  state.tasks = baseTasks;
  state.activities = [
    {
      id: 'activity-1',
      taskId: 'wp-101',
      type: 'status-change',
      message: 'Moved to Todo',
      createdAt: NOW,
    },
  ];
  state.relations = [
    {
      id: 'rel-1',
      taskId: 'wp-102',
      type: 'blockedBy',
      fromId: 'wp-102',
      fromTitle: 'Fix jump bug',
      toId: 'wp-101',
      toTitle: 'Hero controller',
    },
  ];
  state.timeEntries = [
    {
      id: 'time-1',
      taskId: 'wp-101',
      hours: '1.50',
      spentOn: toIsoDate(-1),
      comment: 'Prototype pass',
      activityId: 'activity-dev',
      userId: 'user-lead',
      createdAt: NOW,
    },
  ];
  state.attachments = [
    {
      id: 'attachment-1',
      taskId: 'wp-101',
      fileName: 'movement-notes.txt',
      fileSize: 512,
      contentType: 'text/plain',
      downloadUrl: '/mock-download/attachment-1',
      createdAt: NOW,
    },
  ];
  state.pullRequests = [
    {
      id: 'pr-hero',
      repositoryId: 'repo-1',
      workPackageId: 'wp-101',
      githubPrId: 'gh-pr-hero',
      number: 42,
      title: 'WP-101 hero controller PR',
      url: 'https://github.com/team/bootstrap-game/pull/42',
      state: 'OPEN',
      draft: false,
      isMerged: false,
      baseBranch: 'main',
      headBranch: 'feature/wp-101-hero',
      headSha: 'abc101',
      authorLogin: 'lead.dev',
      reviewStatus: 'APPROVED',
      syncedAt: NOW,
    },
    {
      id: 'pr-late',
      repositoryId: 'repo-1',
      workPackageId: 'wp-778',
      githubPrId: 'gh-pr-late',
      number: 78,
      title: 'WP-778 late-page PR',
      url: 'https://github.com/team/bootstrap-game/pull/78',
      state: 'OPEN',
      draft: false,
      isMerged: false,
      baseBranch: 'main',
      headBranch: 'feature/wp-778-late-page-pr',
      headSha: 'abc778',
      authorLogin: 'member.one',
      reviewStatus: 'REVIEW_REQUIRED',
      syncedAt: NOW,
    },
  ];
  state.branches = [
    {
      id: 'branch-late',
      repositoryId: 'repo-1',
      workPackageId: 'wp-778',
      name: 'feature/wp-778-late-page-pr',
      lastCommitSha: 'abc778',
      url: 'https://github.com/team/bootstrap-game/tree/feature/wp-778-late-page-pr',
    },
  ];
  state.notifications = [
    {
      id: 'notification-1',
      userId: 'user-member',
      type: 'assignment',
      title: 'Assigned to Fix jump bug',
      message: 'You are assigned to Fix jump bug.',
      workPackageId: 'wp-102',
      createdAt: NOW,
      readAt: null,
    },
  ];
  state.savedViews = [
    {
      id: 'view-1',
      workspaceId: state.workspaceId,
      ownerUserId: 'user-owner',
      listId: 'list-alpha',
      name: 'Open bugs',
      filters: { typeIds: ['type-bug'], scope: 'list', viewType: 'tasks' },
      sort: null,
      visibility: 'WORKSPACE',
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];

  return state;
}

function fulfillJson(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function withFailure(state: MockState, key: FailureKey) {
  const remaining = state.failures[key] || 0;
  if (!remaining) {
    return false;
  }
  state.failures[key] = remaining - 1;
  return true;
}

function requireUser(route: Route, state: MockState) {
  const user = currentUser(state);
  if (!user) {
    void fulfillJson(route, 401, { error: 'Unauthorized' });
    return null;
  }
  return user;
}

function requireTasksWrite(route: Route, state: MockState) {
  const user = requireUser(route, state);
  if (!user) {
    return null;
  }
  if (!rolePermissions(user.role).manageTasks) {
    void fulfillJson(route, 403, { error: 'Forbidden' });
    return null;
  }
  return user;
}

function requireDocsWrite(route: Route, state: MockState) {
  const user = requireUser(route, state);
  if (!user) {
    return null;
  }
  if (!rolePermissions(user.role).manageDocs) {
    void fulfillJson(route, 403, { error: 'Forbidden' });
    return null;
  }
  return user;
}

function requireWorkspaceManage(route: Route, state: MockState) {
  const user = requireUser(route, state);
  if (!user) {
    return null;
  }
  if (!rolePermissions(user.role).manageWorkspace) {
    void fulfillJson(route, 403, { error: 'Forbidden' });
    return null;
  }
  return user;
}

function statusRecord(state: MockState, statusId: string) {
  return state.statuses.find((status) => status.id === statusId) || state.statuses[0];
}

function taskTypeName(state: MockState, typeId: string) {
  return state.taskTypes.find((item) => item.id === typeId)?.name || typeId;
}

function userView(state: MockState, id: string) {
  const user = state.users.find((item) => item.id === id);
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl || undefined,
    source: user.source || 'LOCAL',
    openProjectUserId: user.openProjectUserId || null,
    openProjectLogin: user.openProjectLogin || null,
    lastLoginAt: user.lastLoginAt || null,
  };
}

function taskFolderRecord(state: MockState, folderId: string) {
  for (const space of state.spaces) {
    const folder = space.folders.find((item) => item.id === folderId);
    if (folder) {
      return { folder, space };
    }
  }
  return null;
}

function serializeTask(state: MockState, task: MockTask): any {
  const taskStatus = statusRecord(state, task.statusId);
  const assignees = task.assigneeIds.map((id) => userView(state, id)).filter(Boolean);
  const folderMeta = taskFolderRecord(state, task.folderId);
  const taskList = folderMeta?.folder.taskLists.find((item) => item.id === task.taskListId);
  const pullRequests = state.pullRequests
    .filter((pr) => pr.workPackageId === task.id)
    .map((pr) => ({
      id: pr.id,
      repositoryId: pr.repositoryId,
      workPackageId: pr.workPackageId,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      state: pr.state,
      draft: pr.draft,
      isMerged: pr.isMerged,
      baseBranch: pr.baseBranch,
      headBranch: pr.headBranch,
      headSha: pr.headSha,
      authorLogin: pr.authorLogin,
      reviewStatus: pr.reviewStatus,
      syncedAt: pr.syncedAt,
      repository: state.repositories.find((repo) => repo.id === pr.repositoryId),
    }));
  const branches = state.branches
    .filter((branch) => branch.workPackageId === task.id)
    .map((branch) => ({
      id: branch.id,
      repositoryId: branch.repositoryId,
      workPackageId: branch.workPackageId,
      name: branch.name,
      lastCommitSha: branch.lastCommitSha,
      url: branch.url,
      repository: state.repositories.find((repo) => repo.id === branch.repositoryId),
    }));

  return {
    id: task.id,
    workspaceId: task.workspaceId,
    departmentId: task.spaceId,
    folderId: task.folderId,
    taskListId: task.taskListId,
    statusId: task.statusId,
    title: task.title,
    description: task.description,
    status: taskStatus?.name || 'Todo',
    priority: task.priority,
    startDate: task.startDate || undefined,
    dueDate: task.dueDate || undefined,
    typeId: task.typeId,
    type: taskTypeName(state, task.typeId),
    externalSource: task.externalSource,
    externalId: task.id,
    externalUrl: task.externalUrl,
    syncedAt: task.updatedAt,
    taskKey: task.taskKey,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    folder: folderMeta
      ? {
          id: folderMeta.folder.id,
          spaceId: folderMeta.space.id,
          name: folderMeta.folder.name,
          folders: [],
          taskLists: folderMeta.folder.taskLists.map((list) => ({
            id: list.id,
            folderId: folderMeta.folder.id,
            name: list.name,
            statuses: state.statuses,
          })),
          space: {
            id: folderMeta.space.id,
            workspaceId: state.workspaceId,
            name: folderMeta.space.name,
            color: folderMeta.space.color,
            initials: folderMeta.space.initials,
            folders: [],
            documents: [],
          },
        }
      : undefined,
    taskList: taskList
      ? {
          id: taskList.id,
          folderId: task.folderId,
          name: taskList.name,
          statuses: state.statuses,
        }
      : undefined,
    assignee: assignees[0] || undefined,
    responsible: assignees[1] || undefined,
    assignees,
    tags: task.tagIds
      .map((tagId) => state.tags.find((tag) => tag.id === tagId))
      .filter(Boolean)
      .map((tag) => ({ tag })),
    subtasks: state.tasks
      .filter((candidate) => candidate.parentId === task.id)
      .sort((left, right) => left.position - right.position)
      .map((candidate) => serializeTask(state, candidate)),
    githubBranches: branches,
    githubPullRequests: pullRequests,
    developmentStatus: pullRequests[0]?.isMerged
      ? 'MERGED'
      : pullRequests[0]?.reviewStatus === 'APPROVED'
        ? 'APPROVED'
        : pullRequests[0]?.reviewStatus === 'CHANGES_REQUESTED'
          ? 'CHANGES_REQUESTED'
          : pullRequests[0]
            ? 'PR_OPEN'
            : 'NOT_STARTED',
    position: task.position,
  };
}

function buildWorkspaceResponse(state: MockState): any[] {
  return [
    {
      id: state.workspaceId,
      name: state.workspaceName,
      slug: state.workspaceSlug,
      description: state.workspaceSettings.description || undefined,
      avatarUrl: state.workspaceSettings.avatarUrl || undefined,
      color: state.workspaceSettings.color || undefined,
      spaces: state.spaces.map((space) => ({
        id: space.id,
        workspaceId: state.workspaceId,
        name: space.name,
        color: space.color,
        initials: space.initials,
        locked: false,
        folders: space.folders.map((folder) => ({
          id: folder.id,
          spaceId: space.id,
          name: folder.name,
          locked: false,
          folders: [],
          taskLists: folder.taskLists.map((taskList) => ({
            id: taskList.id,
            folderId: folder.id,
            name: taskList.name,
            statuses: state.statuses.map((status) => ({ ...status, taskListId: taskList.id })),
            _count: {
              tasks: state.tasks.filter((task) => task.taskListId === taskList.id).length,
            },
          })),
          _count: {
            tasks: state.tasks.filter((task) => task.folderId === folder.id).length,
          },
        })),
        documents: state.documents.filter((document) => document.spaceId === space.id),
      })),
      memberships: state.users.map((user) => ({
        id: `membership-${user.id}`,
        role: user.role,
        user: userView(state, user.id),
      })),
      permissionSets: (['OWNER', 'ADMIN', 'LEAD', 'MEMBER', 'VIEWER'] as MockRole[]).map((role) =>
        rolePermissions(role)
      ),
      openProjectUsers: state.users.map((user) => userView(state, user.id)),
      githubIntegration: {
        organization: state.repositories[0]?.owner,
        repository: state.repositories[0]?.repo,
      },
    },
  ];
}

function localTagMatch(task: MockTask, tagIds: string[]) {
  if (!tagIds.length) {
    return true;
  }
  return tagIds.some((tagId) => task.tagIds.includes(tagId));
}

function localGitHubMatch(task: MockTask, hasGitHubPr: boolean) {
  if (!hasGitHubPr) {
    return true;
  }
  return task.githubPullRequestIds.length > 0;
}

function filterTasks(tasks: MockTask[], params: URLSearchParams) {
  const listId = params.get('listId');
  const statusId = params.get('statusId');
  const assigneeIds = params.get('assigneeIds')?.split(',').filter(Boolean) || [];
  const responsibleIds = params.get('responsibleIds')?.split(',').filter(Boolean) || [];
  const typeIds = params.get('typeIds')?.split(',').filter(Boolean) || [];
  const search = params.get('search')?.trim().toLowerCase() || '';
  const priority = params.get('priority');
  const dueBefore = params.get('dueBefore');
  const overdue = params.get('overdue') === 'true';
  const updatedSince = params.get('updatedSince');

  return tasks.filter((task) => {
    if (listId && task.taskListId !== listId) {
      return false;
    }
    if (statusId && task.statusId !== statusId) {
      return false;
    }
    if (priority && task.priority !== priority) {
      return false;
    }
    if (assigneeIds.length && !assigneeIds.some((id) => task.assigneeIds.includes(id))) {
      return false;
    }
    if (responsibleIds.length) {
      const responsibleId = task.assigneeIds[1];
      if (!responsibleId || !responsibleIds.includes(responsibleId)) {
        return false;
      }
    }
    if (typeIds.length && !typeIds.includes(task.typeId)) {
      return false;
    }
    if (search) {
      const haystack = `${task.title} ${task.taskKey}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }
    if (dueBefore && task.dueDate && task.dueDate > dueBefore) {
      return false;
    }
    if (overdue && (!task.dueDate || task.dueDate >= toIsoDate(0))) {
      return false;
    }
    if (updatedSince && task.updatedAt.slice(0, 10) < updatedSince) {
      return false;
    }
    return true;
  });
}

function createNotification(
  state: MockState,
  userId: string,
  input: {
    type: string;
    title: string;
    message?: string | null;
    workPackageId?: string | null;
  }
) {
  state.notifications.unshift({
    id: nextId(state, 'notification'),
    userId,
    type: input.type,
    title: input.title,
    message: input.message || null,
    workPackageId: input.workPackageId || null,
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}

function recordActivity(
  state: MockState,
  taskId: string,
  input: { type: string; message?: string; previousValue?: string; nextValue?: string }
) {
  state.activities.unshift({
    id: nextId(state, 'activity'),
    taskId,
    type: input.type,
    message: input.message,
    previousValue: input.previousValue,
    nextValue: input.nextValue,
    createdAt: new Date().toISOString(),
  });
}

function parseJsonBody(route: Route) {
  const body = route.request().postData();
  return body ? (JSON.parse(body) as Record<string, any>) : {};
}

function ensureTask(state: MockState, taskId: string) {
  return state.tasks.find((task) => task.id === taskId) || null;
}

function updateTaskRecord(state: MockState, task: MockTask, input: Record<string, any>) {
  if (typeof input.title === 'string') {
    task.title = input.title;
  }
  if (typeof input.description === 'string') {
    task.description = input.description;
  }
  if (typeof input.statusId === 'string') {
    recordActivity(state, task.id, {
      type: 'status-change',
      message: `Moved to ${statusRecord(state, input.statusId)?.name || input.statusId}`,
      previousValue: statusRecord(state, task.statusId)?.name,
      nextValue: statusRecord(state, input.statusId)?.name,
    });
    task.statusId = input.statusId;
  }
  if (typeof input.priority === 'string') {
    task.priority = input.priority as MockTask['priority'];
  }
  if (Array.isArray(input.assigneeIds)) {
    task.assigneeIds = input.assigneeIds;
  }
  if (typeof input.startDate === 'string' || input.startDate === null) {
    task.startDate = input.startDate;
  }
  if (typeof input.dueDate === 'string' || input.dueDate === null) {
    task.dueDate = input.dueDate;
  }
  task.updatedAt = new Date().toISOString();
}

function taskCollectionForScope(state: MockState, listId?: string | null) {
  return listId ? state.tasks.filter((task) => task.taskListId === listId) : [...state.tasks];
}

function parsePullRequestNumber(value?: string) {
  if (!value) {
    return null;
  }
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function pullRequestForTask(state: MockState, taskId: string, number?: number | null) {
  return state.pullRequests.find(
    (item) => item.workPackageId === taskId && (number ? item.number === number : true)
  );
}

function ensurePullRequest(state: MockState, taskId: string, number: number) {
  const existing = pullRequestForTask(state, taskId, number);
  if (existing) {
    if (!ensureTask(state, taskId)?.githubPullRequestIds.includes(existing.id)) {
      ensureTask(state, taskId)?.githubPullRequestIds.push(existing.id);
    }
    return existing;
  }
  const pr: MockPullRequest = {
    id: nextId(state, 'pr'),
    repositoryId: 'repo-1',
    workPackageId: taskId,
    githubPrId: nextId(state, 'gh-pr'),
    number,
    title: `${ensureTask(state, taskId)?.taskKey || taskId} linked pull request`,
    url: `https://github.com/team/bootstrap-game/pull/${number}`,
    state: 'OPEN',
    draft: false,
    isMerged: false,
    baseBranch: 'main',
    headBranch: `feature/${ensureTask(state, taskId)?.taskKey.toLowerCase() || taskId}`,
    headSha: `sha-${number}`,
    authorLogin: 'octocat',
    reviewStatus: 'REVIEW_REQUIRED',
    syncedAt: new Date().toISOString(),
  };
  const branch: MockBranch = {
    id: nextId(state, 'branch'),
    repositoryId: 'repo-1',
    workPackageId: taskId,
    name: pr.headBranch,
    lastCommitSha: pr.headSha,
    url: `https://github.com/team/bootstrap-game/tree/${pr.headBranch}`,
  };
  state.pullRequests.unshift(pr);
  state.branches.unshift(branch);
  const task = ensureTask(state, taskId);
  if (task) {
    task.githubPullRequestIds = [...task.githubPullRequestIds, pr.id];
    task.githubBranchIds = [...task.githubBranchIds, branch.id];
  }
  return pr;
}

function updatePullRequestFromAction(pr: MockPullRequest, action: string) {
  if (action === 'opened') {
    pr.state = 'OPEN';
    pr.draft = false;
    pr.isMerged = false;
    pr.reviewStatus = 'REVIEW_REQUIRED';
  } else if (action === 'ready_for_review') {
    pr.draft = false;
    pr.reviewStatus = 'REVIEW_REQUIRED';
  } else if (action === 'review_requested') {
    pr.reviewStatus = 'REVIEW_REQUIRED';
  } else if (action === 'changes_requested') {
    pr.reviewStatus = 'CHANGES_REQUESTED';
  } else if (action === 'approved') {
    pr.reviewStatus = 'APPROVED';
  } else if (action === 'merged') {
    pr.state = 'CLOSED';
    pr.isMerged = true;
    pr.reviewStatus = 'APPROVED';
  } else if (action === 'closed') {
    pr.state = 'CLOSED';
  }
  pr.syncedAt = new Date().toISOString();
}

async function handleApiRoute(route: Route, state: MockState) {
  const url = new URL(route.request().url());
  const { pathname, searchParams } = url;
  const method = route.request().method();

  if (pathname.startsWith('/mock-download/')) {
    return route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: `download:${pathname.split('/').pop() || 'file'}`,
    });
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = currentUser(state);
    return user
      ? fulfillJson(route, 200, userView(state, user.id))
      : fulfillJson(route, 401, { error: 'Unauthorized' });
  }

  if (pathname === '/api/auth/setup-status' && method === 'GET') {
    const ownerCount = state.users.filter((user) => user.role === 'OWNER').length;
    return fulfillJson(route, 200, {
      setupRequired: state.setupRequired,
      ownerCount,
      userCount: state.users.length,
      workspace: {
        id: state.workspaceId,
        name: state.workspaceName,
        slug: state.workspaceSlug,
      },
      devDefaultOwnerEnabled: state.devDefaultOwnerEnabled,
    });
  }

  if (pathname === '/api/auth/setup-owner' && method === 'POST') {
    if (!state.setupRequired) {
      return fulfillJson(route, 409, { error: 'Setup already completed' });
    }
    const body = parseJsonBody(route);
    const owner: MockUser = {
      id: nextId(state, 'user'),
      email: String(body.email),
      name: String(body.name),
      password: String(body.password),
      role: 'OWNER',
      avatarUrl: null,
      source: 'LOCAL',
      openProjectUserId: nextId(state, 'op-user'),
      openProjectLogin: String(body.email).split('@')[0],
    };
    state.workspaceName = String(body.workspaceName || state.workspaceName);
    state.workspaceSlug = state.workspaceName.toLowerCase().replace(/\s+/g, '-');
    state.workspaceSettings.name = state.workspaceName;
    state.workspaceSettings.slug = state.workspaceSlug;
    state.workspaceSettings.updatedAt = new Date().toISOString();
    state.users = [owner];
    state.currentUserId = owner.id;
    state.setupRequired = false;
    return fulfillJson(route, 200, userView(state, owner.id));
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = parseJsonBody(route);
    const user = state.users.find(
      (item) => item.email === body.email && item.password === body.password
    );
    if (!user) {
      return fulfillJson(route, 401, { error: 'Invalid email or password' });
    }
    state.currentUserId = user.id;
    user.lastLoginAt = new Date().toISOString();
    return fulfillJson(route, 200, userView(state, user.id));
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    state.currentUserId = null;
    return fulfillJson(route, 200, { ok: true });
  }

  if (pathname === '/api/openproject/workspaces' && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    return fulfillJson(route, 200, buildWorkspaceResponse(state));
  }

  if (pathname === '/api/openproject/task-types' && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    return fulfillJson(route, 200, state.taskTypes);
  }

  if (pathname === '/api/openproject/tags' && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    return fulfillJson(
      route,
      200,
      state.tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color }))
    );
  }

  if (pathname === '/api/openproject/tags' && method === 'POST') {
    if (!requireTasksWrite(route, state)) {
      return;
    }
    if (withFailure(state, 'tagCreate')) {
      return fulfillJson(route, 422, { error: 'Tag create failed' });
    }
    const body = parseJsonBody(route);
    const normalizedName = normalizeName(String(body.name || ''));
    const existing = state.tags.find((tag) => tag.normalizedName === normalizedName);
    if (existing) {
      return fulfillJson(route, 200, {
        id: existing.id,
        name: existing.name,
        color: existing.color,
      });
    }
    const tag: MockTag = {
      id: nextId(state, 'tag'),
      workspaceId: state.workspaceId,
      name: String(body.name).trim(),
      color: String(body.color || '#228be6'),
      normalizedName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.tags.unshift(tag);
    return fulfillJson(route, 200, { id: tag.id, name: tag.name, color: tag.color });
  }

  if (pathname.match(/^\/api\/openproject\/tags\/[^/]+$/) && method === 'PATCH') {
    if (!requireTasksWrite(route, state)) {
      return;
    }
    const tagId = pathname.split('/').pop() || '';
    const tag = state.tags.find((item) => item.id === tagId);
    if (!tag) {
      return fulfillJson(route, 404, { error: 'Tag not found' });
    }
    const body = parseJsonBody(route);
    if (typeof body.name === 'string') {
      tag.name = body.name.trim();
      tag.normalizedName = normalizeName(tag.name);
    }
    if (typeof body.color === 'string') {
      tag.color = body.color;
    }
    tag.updatedAt = new Date().toISOString();
    return fulfillJson(route, 200, { id: tag.id, name: tag.name, color: tag.color });
  }

  if (pathname.match(/^\/api\/openproject\/tags\/[^/]+$/) && method === 'DELETE') {
    if (!requireTasksWrite(route, state)) {
      return;
    }
    const tagId = pathname.split('/').pop() || '';
    state.tags = state.tags.filter((tag) => tag.id !== tagId);
    state.tasks.forEach((task) => {
      task.tagIds = task.tagIds.filter((item) => item !== tagId);
    });
    return fulfillJson(route, 204, undefined);
  }

  if (pathname === '/api/openproject/tasks' && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    if (withFailure(state, 'getTasks')) {
      return fulfillJson(route, 503, { error: 'OpenProject is currently unavailable' });
    }
    const limit = Number(searchParams.get('limit') || '50');
    const cursor = Math.max(1, Number(searchParams.get('cursor') || '1'));
    const tagIds = searchParams.get('tagIds')?.split(',').filter(Boolean) || [];
    const hasGitHubPr = searchParams.get('hasGitHubPr') === 'true';
    state.taskRequests.push({
      cursor: searchParams.get('cursor'),
      tagIds,
      hasGitHubPr,
    });
    const applyLocalFilters = tagIds.length > 0 || hasGitHubPr;
    const baseTasks = filterTasks(
      taskCollectionForScope(state, searchParams.get('listId')),
      searchParams
    );

    if (!applyLocalFilters) {
      // Mirror server-side nestSubtasks: remove children whose parent is in the
      // same page and rely on serializeTask's subtasks array for nesting.
      const pageRaw = baseTasks.slice(cursor - 1, cursor - 1 + limit);
      const pageIds = new Set(pageRaw.map((t) => t.id));
      const topLevel = pageRaw.filter((t) => !t.parentId || !pageIds.has(t.parentId));
      const pageItems = topLevel.map((task) => serializeTask(state, task));
      const nextCursor = cursor - 1 + limit < baseTasks.length ? String(cursor + limit) : null;
      return fulfillJson(route, 200, { items: pageItems, nextCursor });
    }

    let scanOffset = cursor;
    let scanned = 0;
    const matches: MockTask[] = [];
    while (
      matches.length < limit &&
      scanned < LOCAL_FILTER_MAX_SCAN &&
      scanOffset <= baseTasks.length
    ) {
      const pageItems = baseTasks.slice(
        scanOffset - 1,
        scanOffset - 1 + LOCAL_FILTER_PAGE_SCAN_SIZE
      );
      scanned += pageItems.length;
      matches.push(
        ...pageItems.filter(
          (task) => localTagMatch(task, tagIds) && localGitHubMatch(task, hasGitHubPr)
        )
      );
      scanOffset += pageItems.length;
      if (pageItems.length < LOCAL_FILTER_PAGE_SCAN_SIZE) {
        break;
      }
    }

    return fulfillJson(route, 200, {
      items: matches.slice(0, limit).map((task) => serializeTask(state, task)),
      nextCursor: scanOffset <= baseTasks.length ? String(scanOffset) : null,
    });
  }

  if (pathname === '/api/openproject/tasks' && method === 'POST') {
    const user = requireTasksWrite(route, state);
    if (!user) {
      return;
    }
    if (withFailure(state, 'taskCreate')) {
      return fulfillJson(route, 422, { error: 'OpenProject rejected the task payload' });
    }
    const body = parseJsonBody(route);
    if (!String(body.title || '').trim()) {
      return fulfillJson(route, 422, { error: 'Task title is required' });
    }
    const task: MockTask = {
      id: nextId(state, 'wp'),
      workspaceId: state.workspaceId,
      spaceId: body.departmentId || 'space-alpha',
      folderId: body.teamId || body.folderId || 'folder-alpha',
      taskListId: body.taskListId || 'list-alpha',
      taskKey: `WP-${state.sequence}`,
      title: String(body.title),
      description: String(body.description || ''),
      statusId: String(body.statusId || 'status-todo'),
      priority: (body.priority || 'NORMAL') as MockTask['priority'],
      assigneeIds: Array.isArray(body.assigneeIds)
        ? body.assigneeIds
        : body.assigneeId
          ? [body.assigneeId]
          : [],
      typeId: String(body.typeId || 'type-feature'),
      startDate: body.startDate || null,
      dueDate: body.dueDate || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      position:
        state.tasks.filter((item) => item.taskListId === (body.taskListId || 'list-alpha')).length +
        1,
      externalSource: 'OPENPROJECT',
      externalUrl: `https://openproject.example.test/wp/${state.sequence}`,
      tagIds: [],
      githubPullRequestIds: [],
      githubBranchIds: [],
      parentId: body.parentId || null,
      customFields: {},
    };
    state.tasks.unshift(task);
    if (task.parentId) {
      recordActivity(state, task.parentId, {
        type: 'subtask-created',
        message: `${task.title} created as a subtask.`,
      });
    }
    return fulfillJson(route, 200, serializeTask(state, task));
  }

  if (pathname.match(/^\/api\/openproject\/tasks\/[^/]+$/) && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    if (withFailure(state, 'getTask')) {
      return fulfillJson(route, 404, { error: 'Work package not found' });
    }
    const taskId = pathname.split('/').pop() || '';
    const task = ensureTask(state, taskId);
    return task
      ? fulfillJson(route, 200, serializeTask(state, task))
      : fulfillJson(route, 404, { error: 'Work package not found' });
  }

  if (pathname.match(/^\/api\/openproject\/tasks\/[^/]+$/) && method === 'PATCH') {
    if (!requireTasksWrite(route, state)) {
      return;
    }
    if (withFailure(state, 'taskUpdate')) {
      return fulfillJson(route, 409, { error: 'LockVersion conflict' });
    }
    const taskId = pathname.split('/').pop() || '';
    const task = ensureTask(state, taskId);
    if (!task) {
      return fulfillJson(route, 404, { error: 'Work package not found' });
    }
    updateTaskRecord(state, task, parseJsonBody(route));
    return fulfillJson(route, 200, serializeTask(state, task));
  }

  if (pathname.match(/^\/api\/openproject\/tasks\/[^/]+\/tags$/) && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    const taskId = pathname.split('/')[4] || '';
    const task = ensureTask(state, taskId);
    if (!task) {
      return fulfillJson(route, 404, { error: 'Work package not found' });
    }
    return fulfillJson(route, 200, {
      items: task.tagIds
        .map((tagId) => state.tags.find((tag) => tag.id === tagId))
        .filter((tag): tag is MockTag => Boolean(tag))
        .map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
    });
  }

  if (pathname.match(/^\/api\/openproject\/tasks\/[^/]+\/tags$/) && method === 'PUT') {
    if (!requireTasksWrite(route, state)) {
      return;
    }
    if (withFailure(state, 'tagSave')) {
      return fulfillJson(route, 422, { error: 'Could not save tags' });
    }
    const taskId = pathname.split('/')[4] || '';
    const task = ensureTask(state, taskId);
    if (!task) {
      return fulfillJson(route, 404, { error: 'Work package not found' });
    }
    const body = parseJsonBody(route);
    task.tagIds = Array.isArray(body.tagIds) ? body.tagIds : [];
    task.updatedAt = new Date().toISOString();
    return fulfillJson(route, 200, {
      items: task.tagIds
        .map((tagId) => state.tags.find((tag) => tag.id === tagId))
        .filter((tag): tag is MockTag => Boolean(tag))
        .map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
    });
  }

  if (pathname.match(/^\/api\/openproject\/tasks\/[^/]+\/activity$/) && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    const taskId = pathname.split('/')[4] || '';
    return fulfillJson(route, 200, {
      items: state.activities.filter((item) => item.taskId === taskId),
      nextCursor: null,
    });
  }

  if (pathname.match(/^\/api\/openproject\/tasks\/[^/]+\/activity$/) && method === 'POST') {
    const user = requireTasksWrite(route, state);
    if (!user) {
      return;
    }
    if (withFailure(state, 'commentCreate')) {
      return fulfillJson(route, 422, { error: 'Could not save comment' });
    }
    const taskId = pathname.split('/')[4] || '';
    const body = parseJsonBody(route);
    const comment = String(body.comment || '').trim();
    if (!comment) {
      return fulfillJson(route, 422, { error: 'Comment is required' });
    }
    recordActivity(state, taskId, {
      type: 'comment',
      message: comment,
    });
    const task = ensureTask(state, taskId);
    task?.assigneeIds
      .filter((assigneeId) => assigneeId !== user.id)
      .forEach((assigneeId) =>
        createNotification(state, assigneeId, {
          type: 'comment',
          title: `New comment on ${task?.title || taskId}`,
          message: comment,
          workPackageId: taskId,
        })
      );
    const latest = state.activities.find((item) => item.taskId === taskId) || null;
    return fulfillJson(route, 200, latest);
  }

  if (pathname.match(/^\/api\/openproject\/tasks\/[^/]+\/relations$/) && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    const taskId = pathname.split('/')[4] || '';
    return fulfillJson(route, 200, {
      items: state.relations.filter((item) => item.taskId === taskId),
    });
  }

  if (pathname.match(/^\/api\/openproject\/tasks\/[^/]+\/relations$/) && method === 'POST') {
    if (!requireTasksWrite(route, state)) {
      return;
    }
    if (withFailure(state, 'relationCreate')) {
      return fulfillJson(route, 422, { error: 'Could not create relation' });
    }
    const taskId = pathname.split('/')[4] || '';
    const body = parseJsonBody(route);
    const target = ensureTask(state, String(body.targetTaskId));
    const source = ensureTask(state, taskId);
    if (!target || !source) {
      return fulfillJson(route, 404, { error: 'Work package not found' });
    }
    const relation: MockRelation = {
      id: nextId(state, 'relation'),
      taskId,
      type: String(body.type || 'relates'),
      fromId: source.id,
      fromTitle: source.title,
      toId: target.id,
      toTitle: target.title,
    };
    state.relations.unshift(relation);
    return fulfillJson(route, 200, relation);
  }

  if (
    pathname.match(/^\/api\/openproject\/tasks\/[^/]+\/relations\/[^/]+$/) &&
    method === 'DELETE'
  ) {
    if (!requireTasksWrite(route, state)) {
      return;
    }
    if (withFailure(state, 'relationDelete')) {
      return fulfillJson(route, 422, { error: 'Could not delete relation' });
    }
    const relationId = pathname.split('/').pop() || '';
    state.relations = state.relations.filter((item) => item.id !== relationId);
    return fulfillJson(route, 204, undefined);
  }

  if (pathname === '/api/openproject/time-entry-activities' && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    return fulfillJson(route, 200, { items: state.timeEntryActivities });
  }

  if (pathname.match(/^\/api\/openproject\/tasks\/[^/]+\/time-entries$/) && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    const taskId = pathname.split('/')[4] || '';
    const items = state.timeEntries
      .filter((entry) => entry.taskId === taskId)
      .map((entry) => ({
        id: entry.id,
        hours: entry.hours,
        spentOn: entry.spentOn,
        comment: entry.comment,
        user: userView(state, entry.userId),
        activity:
          state.timeEntryActivities.find((activity) => activity.id === entry.activityId)?.name ||
          entry.activityId,
        createdAt: entry.createdAt,
      }));
    const totalHours = items.reduce((sum, entry) => sum + Number(entry.hours), 0);
    return fulfillJson(route, 200, { items, totalHours });
  }

  if (pathname.match(/^\/api\/openproject\/tasks\/[^/]+\/time-entries$/) && method === 'POST') {
    const user = requireTasksWrite(route, state);
    if (!user) {
      return;
    }
    if (withFailure(state, 'timeEntryCreate')) {
      return fulfillJson(route, 422, { error: 'Could not create time entry' });
    }
    const body = parseJsonBody(route);
    if (!body.activityId) {
      return fulfillJson(route, 422, { error: 'Activity is required' });
    }
    const taskId = pathname.split('/')[4] || '';
    const entry: MockTimeEntry = {
      id: nextId(state, 'time'),
      taskId,
      hours: Number(body.hours).toFixed(2),
      spentOn: String(body.spentOn),
      comment: body.comment || '',
      activityId: String(body.activityId),
      userId: user.id,
      createdAt: new Date().toISOString(),
    };
    state.timeEntries.unshift(entry);
    return fulfillJson(route, 200, {
      id: entry.id,
      hours: entry.hours,
      spentOn: entry.spentOn,
      comment: entry.comment,
      user: userView(state, user.id),
      activity:
        state.timeEntryActivities.find((activity) => activity.id === entry.activityId)?.name ||
        entry.activityId,
      createdAt: entry.createdAt,
    });
  }

  if (pathname.match(/^\/api\/openproject\/tasks\/[^/]+\/attachments$/) && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    const taskId = pathname.split('/')[4] || '';
    return fulfillJson(route, 200, {
      items: state.attachments.filter((attachment) => attachment.taskId === taskId),
    });
  }

  if (pathname.match(/^\/api\/openproject\/tasks\/[^/]+\/attachments$/) && method === 'POST') {
    if (!requireTasksWrite(route, state)) {
      return;
    }
    if (withFailure(state, 'attachmentUpload')) {
      return fulfillJson(route, 422, { error: 'Upload failed' });
    }
    const taskId = pathname.split('/')[4] || '';
    const attachment: MockAttachment = {
      id: nextId(state, 'attachment'),
      taskId,
      fileName: 'uploaded-file.txt',
      fileSize: 1024,
      contentType: 'text/plain',
      downloadUrl: `/mock-download/${taskId}-${state.sequence}`,
      createdAt: new Date().toISOString(),
    };
    state.attachments.unshift(attachment);
    return fulfillJson(route, 200, attachment);
  }

  if (pathname.match(/^\/api\/openproject\/tasks\/[^/]+\/custom-fields$/) && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    const taskId = pathname.split('/')[4] || '';
    const task = ensureTask(state, taskId);
    if (!task) {
      return fulfillJson(route, 404, { error: 'Work package not found' });
    }
    const items = Object.entries(task.customFields || {}).map(([key, value]) => ({
      key,
      label: key[0].toUpperCase() + key.slice(1),
      value: value == null ? '' : String(value),
      rawValue: value,
      kind: typeof value === 'number' ? 'integer' : 'text',
      editable: true,
    }));
    return fulfillJson(route, 200, { items });
  }

  if (
    pathname.match(/^\/api\/openproject\/tasks\/[^/]+\/custom-fields\/[^/]+$/) &&
    method === 'PATCH'
  ) {
    if (!requireTasksWrite(route, state)) {
      return;
    }
    const [, , , , taskId, , fieldKey] = pathname.split('/');
    const task = ensureTask(state, taskId || '');
    if (!task) {
      return fulfillJson(route, 404, { error: 'Work package not found' });
    }
    task.customFields = {
      ...(task.customFields || {}),
      [fieldKey || 'field']: parseJsonBody(route).value ?? null,
    };
    return fulfillJson(route, 200, {
      items: Object.entries(task.customFields).map(([key, value]) => ({
        key,
        label: key[0].toUpperCase() + key.slice(1),
        value: value == null ? '' : String(value),
        rawValue: value,
        kind: typeof value === 'number' ? 'integer' : 'text',
        editable: true,
      })),
    });
  }

  if (pathname === '/api/openproject/tasks/bulk-update' && method === 'POST') {
    if (!requireTasksWrite(route, state)) {
      return;
    }
    const body = parseJsonBody(route);
    const results: Array<{ taskId: string; status: string; reason?: string }> = [];
    let updated = 0;
    let failed = 0;
    const taskIds = Array.isArray(body.taskIds) ? body.taskIds : [];
    taskIds.forEach((taskId: string) => {
      const task = ensureTask(state, taskId);
      if (!task) {
        failed += 1;
        results.push({ taskId, status: 'failed', reason: 'Task not found' });
        return;
      }
      if (task.lockedForBulk) {
        failed += 1;
        results.push({ taskId, status: 'failed', reason: 'OpenProject rejected the update' });
        return;
      }
      updateTaskRecord(state, task, body);
      updated += 1;
      results.push({ taskId, status: 'updated' });
    });
    return fulfillJson(route, 200, {
      updated,
      skipped: 0,
      failed,
      results,
    });
  }

  if (pathname === '/api/openproject/board-order' && method === 'POST') {
    if (!requireTasksWrite(route, state)) {
      return;
    }
    if (withFailure(state, 'boardOrder')) {
      return fulfillJson(route, 422, { error: 'Could not save board order' });
    }
    const body = parseJsonBody(route);
    const listId = String(body.listId || '');
    const orders = Array.isArray(body.orders) ? body.orders : [];
    orders.forEach((orderGroup: any) => {
      const orderedTaskIds = Array.isArray(orderGroup.orderedTaskIds)
        ? orderGroup.orderedTaskIds
        : [];
      orderedTaskIds.forEach((taskId: string, index: number) => {
        const task = state.tasks.find((item) => item.id === taskId && item.taskListId === listId);
        if (task) {
          task.position = index + 1;
          task.statusId = String(orderGroup.statusId || task.statusId);
        }
      });
    });
    return fulfillJson(route, 200, { ok: true });
  }

  if (pathname === '/api/saved-views' && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    return fulfillJson(route, 200, state.savedViews);
  }

  if (pathname === '/api/saved-views' && method === 'POST') {
    const user = requireTasksWrite(route, state);
    if (!user) {
      return;
    }
    const body = parseJsonBody(route);
    const view: MockSavedView = {
      id: nextId(state, 'view'),
      workspaceId: state.workspaceId,
      ownerUserId: user.id,
      projectId: body.projectId || null,
      listId: body.listId || null,
      name: String(body.name),
      filters: (body.filters || {}) as Record<string, unknown>,
      sort: (body.sort || null) as Record<string, unknown> | null,
      visibility: (body.visibility || 'PRIVATE') as 'PRIVATE' | 'WORKSPACE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.savedViews.unshift(view);
    return fulfillJson(route, 200, view);
  }

  if (pathname.match(/^\/api\/saved-views\/[^/]+$/) && method === 'PATCH') {
    const user = requireTasksWrite(route, state);
    if (!user) {
      return;
    }
    const viewId = pathname.split('/').pop() || '';
    const view = state.savedViews.find((item) => item.id === viewId);
    if (!view) {
      return fulfillJson(route, 404, { error: 'Saved view not found' });
    }
    const body = parseJsonBody(route);
    if (view.visibility === 'WORKSPACE' && user.role === 'VIEWER') {
      return fulfillJson(route, 403, { error: 'Forbidden' });
    }
    if (typeof body.name === 'string') {
      view.name = body.name;
    }
    if (body.filters && typeof body.filters === 'object') {
      view.filters = body.filters;
    }
    if (body.visibility) {
      view.visibility = body.visibility;
    }
    view.updatedAt = new Date().toISOString();
    return fulfillJson(route, 200, view);
  }

  if (pathname.match(/^\/api\/saved-views\/[^/]+$/) && method === 'DELETE') {
    if (!requireTasksWrite(route, state)) {
      return;
    }
    const viewId = pathname.split('/').pop() || '';
    state.savedViews = state.savedViews.filter((item) => item.id !== viewId);
    return fulfillJson(route, 204, undefined);
  }

  if (pathname === '/api/notifications' && method === 'GET') {
    const user = requireUser(route, state);
    if (!user) {
      return;
    }
    const items = state.notifications.filter((notification) => notification.userId === user.id);
    return fulfillJson(route, 200, {
      items,
      unread: items.filter((item) => !item.readAt).length,
    });
  }

  if (pathname.match(/^\/api\/notifications\/[^/]+\/read$/) && method === 'POST') {
    const user = requireUser(route, state);
    if (!user) {
      return;
    }
    const notificationId = pathname.split('/')[3] || '';
    const notification = state.notifications.find(
      (item) => item.id === notificationId && item.userId === user.id
    );
    if (!notification) {
      return fulfillJson(route, 404, { error: 'Notification not found' });
    }
    notification.readAt = new Date().toISOString();
    return fulfillJson(route, 200, notification);
  }

  if (pathname === '/api/notifications/read-all' && method === 'POST') {
    const user = requireUser(route, state);
    if (!user) {
      return;
    }
    state.notifications.forEach((notification) => {
      if (notification.userId === user.id) {
        notification.readAt = new Date().toISOString();
      }
    });
    return fulfillJson(route, 200, { ok: true });
  }

  if (pathname === '/api/import-reports' && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    return fulfillJson(route, 200, state.importRuns);
  }

  if (pathname.match(/^\/api\/import-reports\/[^/]+$/) && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    const reportId = pathname.split('/').pop() || '';
    const report = state.importRuns.find((item) => item.id === reportId);
    return report
      ? fulfillJson(route, 200, report)
      : fulfillJson(route, 404, { error: 'Import report not found' });
  }

  if (pathname.match(/^\/api\/workspaces\/[^/]+\/settings$/) && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    return fulfillJson(route, 200, state.workspaceSettings);
  }

  if (pathname.match(/^\/api\/workspaces\/[^/]+\/settings$/) && method === 'PATCH') {
    if (!requireWorkspaceManage(route, state)) {
      return;
    }
    const body = parseJsonBody(route);
    state.workspaceSettings = {
      ...state.workspaceSettings,
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.slug !== undefined ? { slug: body.slug } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
      updatedAt: new Date().toISOString(),
    };
    state.workspaceName = state.workspaceSettings.name;
    state.workspaceSlug = state.workspaceSettings.slug;
    return fulfillJson(route, 200, state.workspaceSettings);
  }

  if (pathname.match(/^\/api\/workspaces\/[^/]+\/members$/) && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    return fulfillJson(route, 200, {
      items: state.users.map((user) => ({
        id: `membership-${user.id}`,
        role: user.role,
        createdAt: NOW,
        updatedAt: user.lastLoginAt || NOW,
        user: userView(state, user.id),
      })),
    });
  }

  if (pathname.match(/^\/api\/workspaces\/[^/]+\/members\/invite$/) && method === 'POST') {
    if (!requireWorkspaceManage(route, state)) {
      return;
    }
    const body = parseJsonBody(route);
    let user = state.users.find((item) => item.email === body.email);
    const temporaryPassword = user ? null : 'TempPass!234';
    if (!user) {
      user = {
        id: nextId(state, 'user'),
        email: String(body.email),
        name: String(body.name || body.email),
        password: temporaryPassword || 'TempPass!234',
        role: body.role as MockRole,
        avatarUrl: null,
        source: body.createOpenProjectUser ? 'CLICKUP' : 'LOCAL',
        openProjectUserId: body.createOpenProjectUser ? nextId(state, 'op-user') : null,
        openProjectLogin: body.createOpenProjectUser ? String(body.email).split('@')[0] : null,
      };
      state.users.push(user);
    } else {
      user.role = body.role as MockRole;
    }
    return fulfillJson(route, 200, {
      membership: {
        id: `membership-${user.id}`,
        role: user.role,
        createdAt: NOW,
        updatedAt: NOW,
        user: userView(state, user.id),
      },
      temporaryPassword,
      openProjectTemporaryPassword: body.createOpenProjectUser ? 'OpTemp!234' : null,
    });
  }

  if (pathname.match(/^\/api\/workspaces\/[^/]+\/members\/[^/]+$/) && method === 'PATCH') {
    if (!requireWorkspaceManage(route, state)) {
      return;
    }
    const userId = pathname.split('/').pop() || '';
    const body = parseJsonBody(route);
    const user = state.users.find((item) => item.id === userId);
    if (!user) {
      return fulfillJson(route, 404, { error: 'Workspace member not found' });
    }
    user.role = body.role as MockRole;
    return fulfillJson(route, 200, {
      id: `membership-${user.id}`,
      role: user.role,
      createdAt: NOW,
      updatedAt: NOW,
      user: userView(state, user.id),
    });
  }

  if (pathname.match(/^\/api\/workspaces\/[^/]+\/members\/[^/]+$/) && method === 'DELETE') {
    if (!requireWorkspaceManage(route, state)) {
      return;
    }
    const userId = pathname.split('/').pop() || '';
    state.users = state.users.filter((item) => item.id !== userId);
    return fulfillJson(route, 204, undefined);
  }

  if (pathname.match(/^\/api\/workspaces\/[^/]+\/permissions$/) && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    return fulfillJson(route, 200, {
      items: (['OWNER', 'ADMIN', 'LEAD', 'MEMBER', 'VIEWER'] as MockRole[]).map((role) =>
        rolePermissions(role)
      ),
    });
  }

  if (pathname.match(/^\/api\/workspaces\/[^/]+\/openproject$/) && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    return fulfillJson(route, 200, state.openProjectStatus);
  }

  if (pathname.match(/^\/api\/workspaces\/[^/]+\/imports$/) && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    return fulfillJson(route, 200, { items: state.importRuns });
  }

  if (pathname === '/api/integrations/github/repositories' && method === 'GET') {
    if (!requireUser(route, state)) {
      return;
    }
    return fulfillJson(route, 200, state.repositories);
  }

  if (pathname.match(/^\/api\/integrations\/github\/tasks\/[^/]+\/link-pr$/) && method === 'POST') {
    if (!requireTasksWrite(route, state)) {
      return;
    }
    if (withFailure(state, 'githubLink')) {
      return fulfillJson(route, 422, { error: 'Could not link pull request' });
    }
    const taskId = pathname.split('/')[5] || '';
    const body = parseJsonBody(route);
    const number = body.number || parsePullRequestNumber(body.url) || 99;
    ensurePullRequest(state, taskId, Number(number));
    return fulfillJson(
      route,
      200,
      serializeTask(state, ensureTask(state, taskId)!).githubPullRequests[0]
    );
  }

  if (
    pathname.match(/^\/api\/integrations\/github\/tasks\/[^/]+\/pull-requests\/[^/]+$/) &&
    method === 'DELETE'
  ) {
    if (!requireTasksWrite(route, state)) {
      return;
    }
    if (withFailure(state, 'githubUnlink')) {
      return fulfillJson(route, 422, { error: 'Could not unlink pull request' });
    }
    const segments = pathname.split('/');
    const taskId = segments[5] || '';
    const prId = segments[7] || '';
    state.pullRequests = state.pullRequests.filter((pr) => pr.id !== prId);
    const task = ensureTask(state, taskId);
    if (task) {
      task.githubPullRequestIds = task.githubPullRequestIds.filter((id) => id !== prId);
    }
    return fulfillJson(route, 204, undefined);
  }

  if (pathname.match(/^\/api\/integrations\/github\/tasks\/[^/]+\/refresh$/) && method === 'POST') {
    if (!requireUser(route, state)) {
      return;
    }
    const taskId = pathname.split('/')[5] || '';
    const pr = pullRequestForTask(state, taskId);
    return fulfillJson(route, 200, pr ? pr : { ok: true, skipped: 'No linked pull requests' });
  }

  if (pathname === '/api/integrations/github/webhook' && method === 'POST') {
    const body = parseJsonBody(route);
    const action = String(body.action || 'opened');
    const prPayload = body.pull_request || body.pullRequest || {};
    const taskKey = String(prPayload.title || prPayload.body || prPayload.head?.ref || '').match(
      /WP-\d+/i
    )?.[0];
    const taskId =
      state.tasks.find((task) => task.taskKey === taskKey)?.id ||
      String(body.workPackageId || body.taskId || '');
    if (!taskId) {
      return fulfillJson(route, 200, { ok: true, linked: false });
    }
    const number = Number(prPayload.number || body.number || 99);
    const pr = ensurePullRequest(state, taskId, number);
    updatePullRequestFromAction(pr, action);
    const task = ensureTask(state, taskId);
    const recipients = new Set(task?.assigneeIds || []);
    recipients.forEach((userId) =>
      createNotification(state, userId, {
        type: 'github-pr',
        title: `GitHub PR ${action.replace(/_/g, ' ')} for ${task?.title || taskId}`,
        message: `PR #${pr.number} is now ${action.replace(/_/g, ' ')}.`,
        workPackageId: taskId,
      })
    );
    return fulfillJson(route, 200, { ok: true, linked: true });
  }

  if (pathname === '/api/documents/markdown' && method === 'POST') {
    if (!requireDocsWrite(route, state)) {
      return;
    }
    const body = parseJsonBody(route);
    const document: MockDocument = {
      id: nextId(state, 'doc'),
      spaceId: String(body.spaceId),
      title: String(body.title),
      kind: 'MARKDOWN',
      markdown: String(body.markdown || ''),
    };
    state.documents.unshift(document);
    return fulfillJson(route, 200, document);
  }

  if (pathname === '/api/documents/embed' && method === 'POST') {
    if (!requireDocsWrite(route, state)) {
      return;
    }
    const body = parseJsonBody(route);
    const document: MockDocument = {
      id: nextId(state, 'doc'),
      spaceId: String(body.spaceId),
      title: String(body.title),
      kind: 'EMBED',
      embedUrl: String(body.embedUrl),
    };
    state.documents.unshift(document);
    return fulfillJson(route, 200, document);
  }

  if (pathname === '/api/documents/upload' && method === 'POST') {
    if (!requireDocsWrite(route, state)) {
      return;
    }
    const document: MockDocument = {
      id: nextId(state, 'doc'),
      spaceId: 'space-alpha',
      title: 'Uploaded document',
      kind: 'MARKDOWN',
      markdown: 'Uploaded content',
      sourceName: 'uploaded-file.txt',
    };
    state.documents.unshift(document);
    return fulfillJson(route, 200, document);
  }

  if (pathname.match(/^\/api\/documents\/[^/]+$/) && method === 'PATCH') {
    if (!requireDocsWrite(route, state)) {
      return;
    }
    const documentId = pathname.split('/').pop() || '';
    const document = state.documents.find((item) => item.id === documentId);
    if (!document) {
      return fulfillJson(route, 404, { error: 'Document not found' });
    }
    Object.assign(document, parseJsonBody(route));
    return fulfillJson(route, 200, document);
  }

  if (pathname.match(/^\/api\/documents\/[^/]+\/duplicate$/) && method === 'POST') {
    if (!requireDocsWrite(route, state)) {
      return;
    }
    const documentId = pathname.split('/')[3] || '';
    const document = state.documents.find((item) => item.id === documentId);
    if (!document) {
      return fulfillJson(route, 404, { error: 'Document not found' });
    }
    const copy = {
      ...document,
      id: nextId(state, 'doc'),
      title: `${document.title} Copy`,
    };
    state.documents.unshift(copy);
    return fulfillJson(route, 200, copy);
  }

  if (pathname.match(/^\/api\/documents\/[^/]+$/) && method === 'DELETE') {
    if (!requireDocsWrite(route, state)) {
      return;
    }
    const documentId = pathname.split('/').pop() || '';
    state.documents = state.documents.filter((item) => item.id !== documentId);
    return fulfillJson(route, 204, undefined);
  }

  return fulfillJson(route, 404, { error: `Unhandled mock route: ${method} ${pathname}` });
}

export async function installMockApi(page: Page): Promise<MockApiController> {
  const state = createDefaultState();
  await page.route('**/api/**', async (route) => handleApiRoute(route, state));
  await page.route('**/mock-download/**', async (route) => handleApiRoute(route, state));

  return {
    state,
    setCurrentUser(role) {
      state.currentUserId = role
        ? state.users.find((user) => user.role === role)?.id || null
        : null;
    },
    setSetupRequired(value) {
      state.setupRequired = value;
      state.currentUserId = null;
      if (value) {
        state.users = [];
      }
    },
    setFailure(key, count = 1) {
      state.failures[key] = count;
    },
    setTimeActivities(items) {
      state.timeEntryActivities = items;
    },
    attachTagToTask(taskId, tagName) {
      const normalizedName = normalizeName(tagName);
      let tag = state.tags.find((item) => item.normalizedName === normalizedName);
      if (!tag) {
        tag = {
          id: nextId(state, 'tag'),
          workspaceId: state.workspaceId,
          name: tagName,
          color: '#12b886',
          normalizedName,
          createdAt: NOW,
          updatedAt: NOW,
        };
        state.tags.unshift(tag);
      }
      const task = ensureTask(state, taskId);
      if (task && !task.tagIds.includes(tag.id)) {
        task.tagIds.push(tag.id);
      }
      return tag.id;
    },
    attachPullRequestToTask(taskId, number) {
      return ensurePullRequest(state, taskId, number).id;
    },
  };
}
