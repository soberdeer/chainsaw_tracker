import type { ActivityLog, DocumentItem, GitHubPullRequest, GitHubRepository, Membership, Milestone, PermissionSet, SearchResult, Space, Task, TaskList, TaskStatus, Workspace, WorkspaceRole } from './types';

const currentUserId = 'local-user';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('x-user-id', currentUserId);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    const detail = payload.detail ? `: ${payload.detail}` : '';
    throw new Error(`${payload.error || response.statusText}${detail}`);
  }
  return response.json();
}

export async function getWorkspaces(): Promise<Workspace[]> {
  try {
    return await request<Workspace[]>('/api/workspaces');
  } catch {
    return [];
  }
}

export function createWorkspace(input: { name: string; slug: string }) {
  return request<Workspace>('/api/workspaces', { method: 'POST', body: JSON.stringify(input) });
}

export function createSpace(input: { workspaceId: string; name: string; color: string; initials?: string; locked?: boolean }) {
  return request('/api/spaces', { method: 'POST', body: JSON.stringify(input) });
}

export function createFolder(spaceId: string, input: { name: string; kind: 'DOCS' | 'TEAM' | 'GENERAL'; locked?: boolean }) {
  return request(`/api/spaces/${spaceId}/folders`, { method: 'POST', body: JSON.stringify(input) });
}

export function createTaskList(folderId: string, input: { name: string; icon?: string }) {
  return request(`/api/folders/${folderId}/task-lists`, { method: 'POST', body: JSON.stringify(input) });
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
  taskKey?: string | null;
  startDate?: string;
  dueDate?: string;
  githubUrl?: string;
}) {
  return request('/api/tasks', { method: 'POST', body: JSON.stringify(input) });
}

export function getTask(taskId: string) {
  return request<Task>(`/api/tasks/${taskId}`);
}

export function getTasks(params: {
  workspaceId: string;
  departmentId?: string;
  teamId?: string;
  listId?: string;
  statusId?: string;
  assigneeId?: string;
  milestoneId?: string;
  search?: string;
  source?: 'CLICKUP' | 'LOCAL';
  priority?: string;
  limit?: number;
  cursor?: string;
}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  return request<{ items: Task[]; nextCursor?: string | null }>(`/api/tasks?${search.toString()}`);
}

export function getTaskActivity(taskId: string) {
  return request<{ items: ActivityLog[]; nextCursor?: string | null }>(`/api/tasks/${taskId}/activity`);
}

export function updateTask(taskId: string, input: Partial<Pick<Task, 'title' | 'description' | 'statusId' | 'priority'>> & {
  assigneeId?: string | null;
  milestoneId?: string | null;
  listId?: string | null;
  teamId?: string | null;
  departmentId?: string | null;
  taskKey?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  githubUrl?: string | null;
  tagNames?: string[];
}) {
  return request<Task>(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function getDepartments(workspaceId: string) {
  return request<Space[]>(`/api/departments?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export function getTeams(workspaceId: string, departmentId?: string) {
  const params = new URLSearchParams({ workspaceId });
  if (departmentId) params.set('departmentId', departmentId);
  return request(`/api/teams?${params.toString()}`);
}

export function getTaskLists(workspaceId: string, teamId?: string) {
  const params = new URLSearchParams({ workspaceId });
  if (teamId) params.set('teamId', teamId);
  return request<TaskList[]>(`/api/task-lists?${params.toString()}`);
}

export function getMilestones(workspaceId: string, teamId?: string) {
  const params = new URLSearchParams({ workspaceId });
  if (teamId) params.set('teamId', teamId);
  return request<Milestone[]>(`/api/milestones?${params.toString()}`);
}

export function getTaskStatuses(workspaceId: string) {
  return request<TaskStatus[]>(`/api/task-statuses?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export function getGitHubRepositories(workspaceId: string) {
  return request<GitHubRepository[]>(`/api/integrations/github/repositories?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export function createGitHubRepository(input: { workspaceId: string; owner: string; repo: string; defaultBranch?: string }) {
  return request<GitHubRepository>('/api/integrations/github/repositories', { method: 'POST', body: JSON.stringify(input) });
}

export function syncGitHubPullRequests(repositoryId: string) {
  return request<{ created: number; updated: number; linked: number; skipped: number; errors: number }>(`/api/integrations/github/repositories/${repositoryId}/sync-pull-requests`, { method: 'POST' });
}

export function linkTaskPullRequest(taskId: string, input: { repositoryId: string; number?: number; url?: string }) {
  return request<GitHubPullRequest>(`/api/integrations/github/tasks/${taskId}/link-pr`, { method: 'POST', body: JSON.stringify(input) });
}

export function unlinkTaskPullRequest(taskId: string, pullRequestId: string) {
  return request<void>(`/api/integrations/github/tasks/${taskId}/pull-requests/${pullRequestId}`, { method: 'DELETE' });
}

export function refreshTaskGitHub(taskId: string) {
  return request<GitHubPullRequest | { ok: true; skipped: string }>(`/api/integrations/github/tasks/${taskId}/refresh`, { method: 'POST' });
}

export function reorderTasks(input: { taskId: string; statusId: string; orderedTaskIds: string[] }) {
  return request<Task[]>('/api/tasks/reorder', { method: 'POST', body: JSON.stringify(input) });
}

export function duplicateTask(taskId: string) {
  return request<Task>(`/api/tasks/${taskId}/duplicate`, { method: 'POST' });
}

export function deleteTask(taskId: string) {
  return request<void>(`/api/tasks/${taskId}`, { method: 'DELETE' });
}

export function addTaskDependency(taskId: string, dependsOnId: string) {
  return request(`/api/tasks/${taskId}/dependencies`, { method: 'POST', body: JSON.stringify({ dependsOnId }) });
}

export function removeTaskDependency(taskId: string, dependsOnId: string) {
  return request<void>(`/api/tasks/${taskId}/dependencies/${dependsOnId}`, { method: 'DELETE' });
}

export function importClickUpCsv(workspaceId: string, file: File) {
  const form = new FormData();
  form.set('workspaceId', workspaceId);
  form.set('file', file);
  return request('/api/imports/clickup-csv', { method: 'POST', body: form });
}

export function createMarkdownDoc(input: { spaceId: string; title: string; markdown: string }) {
  return request<DocumentItem>('/api/documents/markdown', { method: 'POST', body: JSON.stringify(input) });
}

export function createEmbedDoc(input: { spaceId: string; title: string; embedUrl: string }) {
  return request<DocumentItem>('/api/documents/embed', { method: 'POST', body: JSON.stringify(input) });
}

export function uploadDocument(spaceId: string, file: File, title?: string) {
  const form = new FormData();
  form.set('spaceId', spaceId);
  if (title) form.set('title', title);
  form.set('file', file);
  return request<DocumentItem>('/api/documents/upload', { method: 'POST', body: form });
}

export function updateDocument(documentId: string, input: Partial<Pick<DocumentItem, 'title' | 'markdown' | 'embedUrl'>>) {
  return request<DocumentItem>(`/api/documents/${documentId}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function duplicateDocument(documentId: string) {
  return request<DocumentItem>(`/api/documents/${documentId}/duplicate`, { method: 'POST' });
}

export function deleteDocument(documentId: string) {
  return request<void>(`/api/documents/${documentId}`, { method: 'DELETE' });
}

export function updateSpace(spaceId: string, input: { name?: string; description?: string | null; color?: string; initials?: string | null; locked?: boolean }) {
  return request(`/api/spaces/${spaceId}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function inviteMember(workspaceId: string, input: { email: string; role?: string }) {
  return request<{ inviteUrl: string; delivery: { sent: boolean; provider: string } }>(`/api/workspaces/${workspaceId}/invites`, { method: 'POST', body: JSON.stringify(input) });
}

export function acceptInvite(token: string) {
  return request<{ workspaceId: string; workspaceName: string; membership: Membership }>(`/api/workspaces/invites/${token}/accept`, { method: 'POST' });
}

export function updateMembership(workspaceId: string, membershipId: string, role: WorkspaceRole) {
  return request<Membership>(`/api/workspaces/${workspaceId}/memberships/${membershipId}`, { method: 'PATCH', body: JSON.stringify({ role }) });
}

export function updateWorkspacePermissions(workspaceId: string, role: WorkspaceRole, input: Omit<PermissionSet, 'role'>) {
  return request<PermissionSet>(`/api/workspaces/${workspaceId}/permissions/${role}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function searchAll(query: string, workspaceId?: string) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (workspaceId) params.set('workspaceId', workspaceId);
  return request<SearchResult[]>(`/api/search?${params.toString()}`);
}
