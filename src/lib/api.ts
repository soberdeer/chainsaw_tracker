import type {
  ActivityLog,
  DocumentItem,
  GitHubPullRequest,
  GitHubRepository,
  MigrationRun,
  Membership,
  MyWorkSummary,
  NotificationItem,
  OpenProjectAttachmentItem,
  OpenProjectConnectionStatus,
  OpenProjectProjectMember,
  OpenProjectCustomFieldItem,
  OpenProjectRelationItem,
  OpenProjectTimeEntryItem,
  PermissionSet,
  SearchResult,
  SavedView,
  Task,
  TaskList,
  UserProfile,
  WorkspaceMemberItem,
  WorkspaceSettings,
  Workspace,
  WorkspaceRole,
} from './types.js';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers, credentials: 'include' });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: response.statusText }))) as {
      error?: string;
      detail?: string;
    };
    const detail = payload.detail ? `: ${payload.detail}` : '';
    throw new Error(`${payload.error || response.statusText}${detail}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    return text ? (text as T) : (undefined as T);
  }
  return (await response.json()) as T;
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  source?: string | null;
  openProjectUserId?: string | null;
  openProjectLogin?: string | null;
  lastLoginAt?: string | null;
};

export function getCurrentUser() {
  return request<CurrentUser>('/api/auth/me');
}

export function login(input: { email: string; password: string }) {
  return request<CurrentUser>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logout() {
  return request<{ ok: true }>('/api/auth/logout', { method: 'POST' });
}

export function updateCurrentUser(input: { name?: string; avatarUrl?: string | null }) {
  return request<CurrentUser>('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getUserProfile() {
  return request<UserProfile>('/api/users/me');
}

export function updateUserProfile(input: { name?: string; avatarUrl?: string | null }) {
  return request<CurrentUser>('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return request<{ ok: true }>('/api/users/me/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getMyWorkSummary() {
  return request<MyWorkSummary>('/api/users/me/my-work');
}

export async function getWorkspaces(): Promise<Workspace[]> {
  return request<Workspace[]>('/api/openproject/workspaces');
}

export function createSpace(input: {
  workspaceId: string;
  name: string;
  color?: string;
  initials?: string;
  locked?: boolean;
  identifier?: string;
  description?: string;
  parentId?: string;
  public?: boolean;
}) {
  return request('/api/openproject/spaces', { method: 'POST', body: JSON.stringify(input) });
}

export function createTask(input: {
  workspaceId?: string;
  departmentId?: string;
  teamId?: string;
  listId?: string;
  taskListId?: string;
  title: string;
  statusId?: string;
  parentId?: string;
  milestoneId?: string | null;
  description?: string;
  priority?: string;
  assigneeId?: string;
  assigneeIds?: string[];
  taskKey?: string | null;
  startDate?: string;
  dueDate?: string;
  githubUrl?: string;
}) {
  return request<Task>('/api/openproject/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getTask(taskId: string) {
  return request<Task>(`/api/openproject/tasks/${taskId}`);
}

export function getTasks(params: {
  workspaceId: string;
  departmentId?: string;
  teamId?: string;
  listId?: string;
  statusId?: string;
  assigneeId?: string;
  assigneeIds?: string[];
  milestoneId?: string;
  search?: string;
  source?: 'CLICKUP' | 'OPENPROJECT' | 'LOCAL';
  priority?: string;
  limit?: number;
  cursor?: string;
}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  return request<{ items: Task[]; nextCursor?: string | null }>(
    `/api/openproject/tasks?${search.toString()}`
  );
}

export function getTaskActivity(taskId: string) {
  return request<{ items: ActivityLog[]; nextCursor?: string | null }>(
    `/api/openproject/tasks/${taskId}/activity`
  );
}

export function addTaskComment(taskId: string, comment: string) {
  return request<ActivityLog>(`/api/openproject/tasks/${taskId}/activity`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export function getTaskRelations(taskId: string) {
  return request<{ items: OpenProjectRelationItem[] }>(
    `/api/openproject/tasks/${taskId}/relations`
  );
}

export function addTaskRelation(
  taskId: string,
  input: { targetTaskId: string; type: string; description?: string }
) {
  return request<OpenProjectRelationItem>(`/api/openproject/tasks/${taskId}/relations`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteTaskRelation(taskId: string, relationId: string) {
  return request<void>(`/api/openproject/tasks/${taskId}/relations/${relationId}`, {
    method: 'DELETE',
  });
}

export function getTaskTimeEntries(taskId: string) {
  return request<{ items: OpenProjectTimeEntryItem[]; totalHours: number }>(
    `/api/openproject/tasks/${taskId}/time-entries`
  );
}

export function addTaskTimeEntry(
  taskId: string,
  input: { hours: number; spentOn: string; comment?: string }
) {
  return request<OpenProjectTimeEntryItem>(`/api/openproject/tasks/${taskId}/time-entries`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getTaskAttachments(taskId: string) {
  return request<{ items: OpenProjectAttachmentItem[] }>(
    `/api/openproject/tasks/${taskId}/attachments`
  );
}

export function uploadTaskAttachment(taskId: string, file: File, description?: string) {
  const form = new FormData();
  form.set('file', file);
  if (description) {
    form.set('description', description);
  }
  return request<OpenProjectAttachmentItem>(`/api/openproject/tasks/${taskId}/attachments`, {
    method: 'POST',
    body: form,
  });
}

export function getTaskCustomFields(taskId: string) {
  return request<{ items: OpenProjectCustomFieldItem[] }>(
    `/api/openproject/tasks/${taskId}/custom-fields`
  );
}

export function updateTaskCustomField(taskId: string, fieldKey: string, value: unknown) {
  return request<{ items: OpenProjectCustomFieldItem[] }>(
    `/api/openproject/tasks/${taskId}/custom-fields/${fieldKey}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    }
  );
}

export function updateTask(
  taskId: string,
  input: Partial<Pick<Task, 'title' | 'description' | 'statusId' | 'priority'>> & {
    assigneeId?: string | null;
    assigneeIds?: string[];
    milestoneId?: string | null;
    listId?: string | null;
    teamId?: string | null;
    departmentId?: string | null;
    taskKey?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
    githubUrl?: string | null;
    tagNames?: string[];
  }
) {
  return request<Task>(`/api/openproject/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function bulkUpdateTasks(input: {
  taskIds: string[];
  statusId?: string;
  priority?: string;
  assigneeIds?: string[];
}) {
  return request<{
    updated: number;
    skipped: number;
    failed: number;
    results: Array<{ taskId: string; status: string; reason?: string }>;
  }>('/api/openproject/tasks/bulk-update', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getSavedViews(workspaceId: string) {
  return request<SavedView[]>(`/api/saved-views?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export function createSavedView(input: {
  workspaceId: string;
  projectId?: string | null;
  listId?: string | null;
  name: string;
  filters: Record<string, unknown>;
  sort?: Record<string, unknown>;
  visibility?: 'PRIVATE' | 'WORKSPACE';
}) {
  return request<SavedView>('/api/saved-views', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSavedView(
  id: string,
  input: {
    name?: string;
    filters?: Record<string, unknown>;
    sort?: Record<string, unknown>;
    visibility?: 'PRIVATE' | 'WORKSPACE';
  }
) {
  return request<SavedView>(`/api/saved-views/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteSavedView(id: string) {
  return request<void>(`/api/saved-views/${id}`, { method: 'DELETE' });
}

export function getNotifications() {
  return request<{ items: NotificationItem[]; unread: number }>('/api/notifications');
}

export function markNotificationRead(id: string) {
  return request<NotificationItem>(`/api/notifications/${id}/read`, { method: 'POST' });
}

export function markAllNotificationsRead() {
  return request<{ ok: true }>('/api/notifications/read-all', { method: 'POST' });
}

export function getImportReports() {
  return request<MigrationRun[]>('/api/import-reports');
}

export function getImportReport(id: string) {
  return request<MigrationRun>(`/api/import-reports/${id}`);
}

export function getTaskLists(workspaceId: string, teamId?: string) {
  const params = new URLSearchParams({ workspaceId });
  if (teamId) {
    params.set('teamId', teamId);
  }
  return request<TaskList[]>(`/api/openproject/task-lists?${params.toString()}`);
}

export function getGitHubRepositories(workspaceId: string) {
  return request<GitHubRepository[]>(
    `/api/integrations/github/repositories?workspaceId=${encodeURIComponent(workspaceId)}`
  );
}

export function createGitHubRepository(input: {
  workspaceId: string;
  owner: string;
  repo: string;
  defaultBranch?: string;
}) {
  return request<GitHubRepository>('/api/integrations/github/repositories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function syncGitHubPullRequests(repositoryId: string) {
  return request<{
    created: number;
    updated: number;
    linked: number;
    skipped: number;
    errors: number;
  }>(`/api/integrations/github/repositories/${repositoryId}/sync-pull-requests`, {
    method: 'POST',
  });
}

export function linkTaskPullRequest(
  taskId: string,
  input: { repositoryId: string; number?: number; url?: string }
) {
  return request<GitHubPullRequest>(`/api/integrations/github/tasks/${taskId}/link-pr`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function unlinkTaskPullRequest(taskId: string, pullRequestId: string) {
  return request<void>(`/api/integrations/github/tasks/${taskId}/pull-requests/${pullRequestId}`, {
    method: 'DELETE',
  });
}

export function refreshTaskGitHub(taskId: string) {
  return request<GitHubPullRequest | { ok: true; skipped: string }>(
    `/api/integrations/github/tasks/${taskId}/refresh`,
    { method: 'POST' }
  );
}

export function duplicateTask(taskId: string) {
  return request<Task>(`/api/openproject/tasks/${taskId}/duplicate`, { method: 'POST' });
}

export function deleteTask(taskId: string) {
  return request<void>(`/api/openproject/tasks/${taskId}`, { method: 'DELETE' });
}

export function createMarkdownDoc(input: { spaceId: string; title: string; markdown: string }) {
  return request<DocumentItem>('/api/documents/markdown', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function createEmbedDoc(input: { spaceId: string; title: string; embedUrl: string }) {
  return request<DocumentItem>('/api/documents/embed', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function uploadDocument(spaceId: string, file: File, title?: string) {
  const form = new FormData();
  form.set('spaceId', spaceId);
  if (title) {
    form.set('title', title);
  }
  form.set('file', file);
  return request<DocumentItem>('/api/documents/upload', { method: 'POST', body: form });
}

export function updateDocument(
  documentId: string,
  input: Partial<Pick<DocumentItem, 'title' | 'markdown' | 'embedUrl'>>
) {
  return request<DocumentItem>(`/api/documents/${documentId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function duplicateDocument(documentId: string) {
  return request<DocumentItem>(`/api/documents/${documentId}/duplicate`, { method: 'POST' });
}

export function deleteDocument(documentId: string) {
  return request<void>(`/api/documents/${documentId}`, { method: 'DELETE' });
}

export function inviteMember(workspaceId: string, input: { email: string; role?: string }) {
  return request<{ inviteUrl: string; delivery: { sent: boolean; provider: string } }>(
    `/api/workspaces/${workspaceId}/invites`,
    { method: 'POST', body: JSON.stringify(input) }
  );
}

export function acceptInvite(
  token: string,
  input?: { name?: string; password?: string; confirmPassword?: string }
) {
  return request<{
    workspaceId: string;
    workspaceName: string;
    membership: Membership;
    user: CurrentUser;
  }>(`/api/workspaces/invites/${token}/accept`, {
    method: 'POST',
    body: JSON.stringify(input || {}),
  });
}

export function updateMembership(workspaceId: string, membershipId: string, role: WorkspaceRole) {
  return request<Membership>(`/api/workspaces/${workspaceId}/memberships/${membershipId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function getWorkspaceSettings(workspaceId: string) {
  return request<WorkspaceSettings>(`/api/workspaces/${workspaceId}/settings`);
}

export function updateWorkspaceSettings(
  workspaceId: string,
  input: Partial<Pick<WorkspaceSettings, 'name' | 'slug' | 'description' | 'avatarUrl' | 'color'>>
) {
  return request<WorkspaceSettings>(`/api/workspaces/${workspaceId}/settings`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getWorkspaceMembers(workspaceId: string) {
  return request<{ items: WorkspaceMemberItem[] }>(`/api/workspaces/${workspaceId}/members`);
}

export function inviteWorkspaceMember(
  workspaceId: string,
  input: {
    email: string;
    name?: string;
    role: WorkspaceRole;
    createOpenProjectUser?: boolean;
  }
) {
  return request<{
    membership: WorkspaceMemberItem;
    temporaryPassword?: string | null;
    openProjectTemporaryPassword?: string | null;
  }>(`/api/workspaces/${workspaceId}/members/invite`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole
) {
  return request<WorkspaceMemberItem>(`/api/workspaces/${workspaceId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function removeWorkspaceMember(workspaceId: string, userId: string) {
  return request<void>(`/api/workspaces/${workspaceId}/members/${userId}`, {
    method: 'DELETE',
  });
}

export function getWorkspacePermissionSets(workspaceId: string) {
  return request<{ items: PermissionSet[] }>(`/api/workspaces/${workspaceId}/permissions`);
}

export function getWorkspaceOpenProjectStatus(workspaceId: string) {
  return request<OpenProjectConnectionStatus>(`/api/workspaces/${workspaceId}/openproject`);
}

export function getWorkspaceImportReports(workspaceId: string) {
  return request<{ items: MigrationRun[] }>(`/api/workspaces/${workspaceId}/imports`);
}

export function getOpenProjectProjectMembers(workspaceId: string, projectId: string) {
  return request<{ items: OpenProjectProjectMember[]; settingsUrl: string }>(
    `/api/workspaces/${workspaceId}/projects/${projectId}/members`
  );
}

export function updateWorkspacePermissions(
  workspaceId: string,
  role: WorkspaceRole,
  input: Omit<PermissionSet, 'role'>
) {
  return request<PermissionSet>(`/api/workspaces/${workspaceId}/permissions/${role}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function searchAll(query: string, workspaceId?: string) {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  if (workspaceId) {
    params.set('workspaceId', workspaceId);
  }
  return request<SearchResult[]>(`/api/openproject/search?${params.toString()}`);
}
