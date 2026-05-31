export type WorkspaceRole = 'ADMIN' | 'MEMBER' | 'READER';

export type AuthSetupStatus = {
  setupRequired: boolean;
  ownerCount: number;
  userCount: number;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  devDefaultOwnerEnabled: boolean;
};

export type TaskDevelopmentStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BRANCH_CREATED'
  | 'PR_OPEN'
  | 'CODE_REVIEW'
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'MERGED'
  | 'CLOSED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TaskPriorityOrNone = TaskPriority | null | undefined;
export type DocumentKind = 'MARKDOWN' | 'IMAGE' | 'SPREADSHEET' | 'EMBED';

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  source?: string;
  openProjectUserId?: string;
  openProjectLogin?: string;
  lastLoginAt?: string | null;
  opAdmin?: boolean;
  opStatus?: string;
};

export type PermissionSet = {
  role: WorkspaceRole;
  manageWorkspace: boolean;
  manageSpaces: boolean;
  manageDocs: boolean;
  manageTasks: boolean;
  inviteMembers: boolean;
  manageIntegrations?: boolean;
  manageImports?: boolean;
  viewReports?: boolean;
};

export type Task = {
  id: string;
  workspaceId?: string;
  departmentId?: string;
  teamId?: string;
  listId?: string;
  folderId: string;
  taskListId?: string;
  statusId?: string;
  parentId?: string;
  title: string;
  description?: string;
  status: string;
  priority?: TaskPriority | null;
  startDate?: string;
  dueDate?: string;
  typeId?: string;
  type?: string;
  githubUrl?: string;
  estimatedHours?: number | null;
  remainingHours?: number | null;
  spentHours?: number | null;
  externalSource?: 'CLICKUP' | 'OPENPROJECT' | 'LOCAL';
  externalId?: string;
  externalUrl?: string;
  syncedAt?: string;
  taskKey?: string;
  milestoneId?: string;
  milestone?: Milestone;
  developmentStatus?: TaskDevelopmentStatus;
  position: number;
  sourceExternalId?: string;
  sourceUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  folder?: Folder & { space?: Space };
  taskList?: TaskList;
  statusRef?: TaskStatus;
  assignee?: User;
  assignees: User[];
  tags: { tag: Tag }[];
  subtasks?: Task[];
  dependencies?: TaskDependency[];
  dependents?: TaskDependency[];
  githubBranches?: GitHubBranch[];
  githubPullRequests?: GitHubPullRequest[];
  activityLogs?: ActivityLog[];
  checklists?: Checklist[];
  checklistSummary?: {
    completed: number;
    total: number;
  } | null;
};

export type ActivityLog = {
  id: string;
  taskId: string;
  type: string;
  message?: string;
  previousValue?: string;
  nextValue?: string;
  metadata?: unknown;
  createdAt: string;
};

export type Milestone = {
  id: string;
  workspaceId: string;
  folderId?: string;
  title: string;
  dueDate?: string;
};

export type GitHubRepository = {
  id: string;
  workspaceId: string;
  owner: string;
  repo: string;
  defaultBranch: string;
};

export type GitHubPullRequest = {
  id: string;
  repositoryId: string;
  taskId?: string;
  workPackageId?: string;
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
  syncedAt?: string;
  repository?: GitHubRepository;
};

export type GitHubBranch = {
  id: string;
  repositoryId: string;
  taskId?: string;
  workPackageId?: string;
  name: string;
  lastCommitSha?: string;
  url?: string;
  repository?: GitHubRepository;
};

export type TaskDependency = {
  id: string;
  taskId: string;
  dependsOnId: string;
  dependsOn?: Task;
  task?: Task;
};

export type OpenProjectRelationItem = {
  id: string;
  type: string;
  reverseType?: string;
  fromId?: string;
  fromTitle?: string;
  toId?: string;
  toTitle?: string;
  description?: string;
};

export type ChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
  position: number;
  completedAt?: string | null;
  completedByUserId?: string | null;
};

export type Checklist = {
  id: string;
  workPackageId: string;
  title: string;
  position: number;
  items: ChecklistItem[];
  completedItems: number;
  totalItems: number;
};

export type OpenProjectTimeEntryItem = {
  id: string;
  hours: string;
  spentOn?: string;
  comment?: string;
  user?: User;
  activity?: string;
  createdAt?: string;
};

export type OpenProjectTimeEntryActivityOption = {
  id: string;
  name: string;
};

export type OpenProjectAttachmentItem = {
  id: string;
  fileName: string;
  fileSize?: number;
  contentType?: string;
  description?: string;
  downloadUrl?: string;
  createdAt?: string;
};

export type OpenProjectCustomFieldItem = {
  key: string;
  label: string;
  value: string;
  rawValue: string | number | boolean | null;
  kind: 'text' | 'textarea' | 'integer' | 'float' | 'date' | 'boolean' | 'readonly';
  editable: boolean;
};

export type Tag = {
  id: string;
  name: string;
  color: string;
  /** Mantine color name (e.g. "blue", "grape"). Optional. */
  theme?: string;
};

export type OpenProjectTaskTypeOption = {
  id: string;
  name: string;
};

export type Folder = {
  id: string;
  spaceId: string;
  name: string;
  kind?: 'DOCS' | 'TEAM' | 'LIST';
  locked?: boolean;
  folders?: Folder[];
  taskLists?: TaskList[];
  tasks?: Task[];
  _count?: { tasks: number };
};

/** Semantic workflow phase for a status. */
export type TaskStatusType = 'open' | 'prep' | 'progress' | 'test' | 'done' | 'closed';

export type TaskStatus = {
  id: string;
  taskListId: string;
  name: string;
  color: string;
  position: number;
  isDone: boolean;
  statusType?: TaskStatusType;
};

export type TaskList = {
  id: string;
  folderId: string;
  name: string;
  icon?: string;
  statuses: TaskStatus[];
  tasks?: Task[];
  _count?: { tasks: number };
};

export type DocumentItem = {
  id: string;
  spaceId: string;
  title: string;
  kind: DocumentKind;
  markdown?: string;
  fileUrl?: string;
  embedUrl?: string;
  sourceName?: string;
};

export type Space = {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color: string;
  initials?: string;
  locked?: boolean;
  permissions?: SpacePermission[];
  folders: Folder[];
  documents: DocumentItem[];
};

export type SpacePermission = {
  role: WorkspaceRole;
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
};

export type Membership = {
  id: string;
  role: WorkspaceRole;
  user: User;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatarUrl?: string;
  color?: string;
  spaces: Space[];
  memberships: Membership[];
  permissionSets: PermissionSet[];
  openProjectUsers?: User[];
  githubIntegration?: {
    organization?: string;
    repository?: string;
  };
};

export type WorkspaceSettings = {
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

export type WorkspaceMemberItem = {
  id: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt?: string;
  user: User;
};

export type OpenProjectProjectMember = {
  membershipId: string;
  openProjectUserId: string;
  openProjectLogin?: string;
  openProjectName: string;
  openProjectEmail?: string;
  avatarUrl?: string;
  roles: string[];
};

export type OpenProjectConnectionStatus = {
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

export type UserProfile = User & {
  memberships: Array<{
    id: string;
    workspaceId: string;
    workspaceName: string;
    workspaceSlug: string;
    role: WorkspaceRole;
    permissions?: PermissionSet | null;
  }>;
  openProjectMemberships: Array<{
    membershipId: string;
    projectId: string;
    projectName: string;
    projectIdentifier?: string;
    roles: string[];
    projectUrl: string;
  }>;
};

export type MyWorkSummary = {
  assignedCount: number;
  overdueCount: number;
  dueThisWeekCount: number;
  recentlyUpdated: Task[];
};

export type SavedView = {
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

export type NotificationItem = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message?: string | null;
  taskId?: string | null;
  workPackageId?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export type MigrationRun = {
  id: string;
  source: string;
  startedAt: string;
  finishedAt?: string | null;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  summary?: unknown;
  warnings?: unknown;
  errors?: unknown;
};

export type SearchResultType = 'action' | 'task' | 'doc' | 'space' | 'folder' | 'list';

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  url?: string;
  action?:
    | 'create-task'
    | 'create-doc'
    | 'create-space'
    | 'create-folder'
    | 'open-board'
    | 'open-docs'
    | 'open-permissions';
};
