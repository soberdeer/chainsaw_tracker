import type {
  ActivityLog,
  DocumentItem,
  GitHubPullRequest,
  GitHubRepository,
  Membership,
  PermissionSet,
  SearchResult,
  Task,
  TaskList,
  Workspace,
  WorkspaceRole,
} from './types';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers, credentials: 'include' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    const detail = payload.detail ? `: ${payload.detail}` : '';
    throw new Error(`${payload.error || response.statusText}${detail}`);
  }
  return response.json();
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
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
  return request('/api/openproject/tasks', { method: 'POST', body: JSON.stringify(input) });
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

export function acceptInvite(token: string) {
  return request<{ workspaceId: string; workspaceName: string; membership: Membership }>(
    `/api/workspaces/invites/${token}/accept`,
    { method: 'POST' }
  );
}

export function updateMembership(workspaceId: string, membershipId: string, role: WorkspaceRole) {
  return request<Membership>(`/api/workspaces/${workspaceId}/memberships/${membershipId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
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
