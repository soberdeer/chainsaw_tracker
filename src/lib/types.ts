export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'LEAD' | 'MEMBER' | 'VIEWER';
export type TaskDevelopmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BRANCH_CREATED' | 'PR_OPEN' | 'CODE_REVIEW' | 'APPROVED' | 'CHANGES_REQUESTED' | 'MERGED' | 'CLOSED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type DocumentKind = 'MARKDOWN' | 'IMAGE' | 'SPREADSHEET' | 'EMBED';

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
};

export type PermissionSet = {
  role: WorkspaceRole;
  manageWorkspace: boolean;
  manageSpaces: boolean;
  manageDocs: boolean;
  manageTasks: boolean;
  inviteMembers: boolean;
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
  priority: TaskPriority;
  startDate?: string;
  dueDate?: string;
  githubUrl?: string;
  externalSource?: 'CLICKUP' | 'LOCAL';
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
  tags: { tag: Tag }[];
  subtasks?: Task[];
  dependencies?: TaskDependency[];
  dependents?: TaskDependency[];
  githubBranches?: GitHubBranch[];
  githubPullRequests?: GitHubPullRequest[];
  activityLogs?: ActivityLog[];
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

export type Tag = {
  id: string;
  name: string;
  color: string;
};

export type Folder = {
  id: string;
  spaceId: string;
  name: string;
  kind?: 'DOCS' | 'TEAM' | 'LIST';
  locked?: boolean;
  taskLists?: TaskList[];
  tasks?: Task[];
  _count?: { tasks: number };
};

export type TaskStatus = {
  id: string;
  taskListId: string;
  name: string;
  color: string;
  position: number;
  isDone: boolean;
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
  spaces: Space[];
  memberships: Membership[];
  permissionSets: PermissionSet[];
  githubIntegration?: {
    organization?: string;
    repository?: string;
  };
};

export type SearchResultType = 'action' | 'task' | 'doc' | 'space' | 'folder' | 'list';

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  url?: string;
  action?: 'create-task' | 'create-doc' | 'create-space' | 'create-folder' | 'open-board' | 'open-docs' | 'open-permissions';
};
