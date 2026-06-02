import 'dotenv/config';
import { openProjectRequest } from '../server/openproject/client.js';
import { seededHierarchyPath, type SeededWorkspace } from '../server/openproject/hierarchyStore.js';
import { statusThemeColor, statusThemeType } from '../server/openproject/mappers.js';
import type {
  HalCollection,
  HalLink,
  OpenProjectGroup,
  OpenProjectMembership,
  OpenProjectPriority,
  OpenProjectProject,
  OpenProjectRole,
  OpenProjectStatus,
  OpenProjectType,
  OpenProjectUser,
  OpenProjectWorkPackage,
} from '../server/openproject/types.js';

type OpenProjectCategory = {
  id: number;
  name: string;
  _links: { self: { href: string } };
};

// `${projectId}:${normalizedTagName}` → category href
type CategoryCache = Map<string, string>;
import type { PermissionSet, WorkspaceRole } from '../src/lib/types.js';
import { clickUpRequest } from './migration/clickup/client.js';
import type {
  ClickUpDoc,
  ClickUpDocPage,
  ClickUpFolder,
  ClickUpGroup,
  ClickUpList,
  ClickUpSpace,
  ClickUpStatus,
  ClickUpTag,
  ClickUpTask,
  ClickUpTeam,
} from './migration/clickup/types.js';
import { splitClickUpAssignees, type ClickUpAssigneeLike } from './migration/clickupAssignees.js';
import {
  clickUpPermissionFromRaw,
  extractFolderPermissionGrants,
  extractSpacePermissionGrants,
  isRoleAtLeast,
  pickOpenProjectRoleForClickUpPermission,
  type OpenProjectRoleLike,
  type ImportedPermissionLevel,
} from './migration/openprojectPermissions.js';
import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

type ImportedMeta = {
  clickUpTaskId?: string;
  clickUpTaskUrl?: string;
  clickUpSpaceId?: string;
  clickUpSpaceName?: string;
  clickUpFolderId?: string;
  clickUpFolderName?: string;
  clickUpListId?: string;
  clickUpListName?: string;
  originalClickUpPath?: string;
};

type ClickUpTaskContext = {
  space: ClickUpSpace;
  folder: ClickUpFolder | null;
  list: ClickUpList;
};

type ClickUpUserLike = {
  id: number | string;
  username?: string | null;
  email?: string | null;
  profilePicture?: string | null;
  profile_picture?: string | null;
};

type UserSyncContext = {
  workspaceId: string;
  seenClickUpUserKeys: Set<string>;
  summary: Summary;
};

type OpenProjectUserSyncContext = {
  users: OpenProjectUser[];
  roles: OpenProjectRole[];
  memberships: OpenProjectMembership[];
  clickUpUserToOpenProjectUser: Map<string, OpenProjectUser>;
  failedClickUpUserKeys: Set<string>;
  /** Lowercase emails that should receive admin=true in OpenProject */
  adminEmails: Set<string>;
  summary: Summary;
};

type PermissionGrant = {
  user: ClickUpUserLike;
  level: ImportedPermissionLevel;
  source: 'teamMembers' | 'spaceMembers' | 'folderMembers' | 'listMembers' | 'taskAssignees';
};

type Summary = {
  teams: number;
  spaces: number;
  folders: number;
  lists: number;
  statuses: number;
  clickUpUsersSeen: number;
  clickUpWorkspaceMembersSeen: number;
  clickUpSpaceMembersSeen: number;
  clickUpFolderMembersSeen: number;
  clickUpListMembersSeen: number;
  clickUpTaskAssigneesSeen: number;
  localUsersCreated: number;
  localUsersReused: number;
  localUsersUpdated: number;
  localMembershipsCreated: number;
  openProjectUsersCreated: number;
  openProjectUsersReused: number;
  openProjectUsersUpdated: number;
  openProjectUserErrors: string[];
  openProjectMembershipsCreated: number;
  openProjectMembershipsReused: number;
  openProjectMembershipsUpdated: number;
  openProjectMembershipErrors: string[];
  permissionSourcesUsed: {
    teamMembers: boolean;
    spaceMembers: boolean;
    folderMembers: boolean;
    listMembers: boolean;
    taskAssignees: boolean;
  };
  permissionWarnings: string[];
  openProjectProjectsCreated: number;
  openProjectProjectsReused: number;
  openProjectProjectHierarchy: {
    spaces: number;
    folders: number;
    lists: number;
  };
  tasksCreated: number;
  tasksUpdated: number;
  tasksSkipped: number;
  statusTransitionsSkipped: number;
  clickUpCustomFieldsSeen: number;
  clickUpDependenciesSeen: number;
  clickUpTagsSeen: number;
  clickUpAttachmentsSeen: number;
  clickUpCommentsSeen: number;
  clickUpTimeEntriesSeen: number;
  assigneesMapped: number;
  assigneeMappingErrors: string[];
  assigneeRejectedByOpenProject: number;
  fallbackRecoveredTasks: number;
  fallbackSkippedTasks: number;
  openProjectGroupsCreated: number;
  openProjectGroupsReused: number;
  openProjectGroupErrors: string[];
  categoriesCreated: number;
  categoriesReused: number;
  docsImported: number;
  docsSkipped: number;
  errors: string[];
  warnings: string[];
};

const META_START = '<!-- chainsaw-clickup-import-meta -->';
const META_END = '<!-- /chainsaw-clickup-import-meta -->';

const openProjectImportedUserPassword =
  process.env.OPENPROJECT_IMPORTED_USER_PASSWORD || 'Clickup!2026';

const importedAdminEmails = new Set(
  (process.env.OP_IMPORTED_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

const permissionSets: PermissionSet[] = [
  {
    role: 'ADMIN',
    manageWorkspace: true,
    manageSpaces: true,
    manageDocs: true,
    manageTasks: true,
    inviteMembers: true,
  },

  {
    role: 'MEMBER',
    manageWorkspace: false,
    manageSpaces: false,
    manageDocs: true,
    manageTasks: true,
    inviteMembers: false,
  },
  {
    role: 'READER',
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

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return undefined;
  }

  return email;
}

function clickUpUserKey(user: ClickUpUserLike) {
  return String(user.id || user.email || user.username || '').trim();
}

function clickUpUserEmail(user: ClickUpUserLike) {
  return normalizeEmail(user.email) || `clickup-${slug(String(user.id))}@local.clickup.invalid`;
}

function clickUpUserName(user: ClickUpUserLike) {
  return user.username?.trim() || normalizeEmail(user.email) || `ClickUp User ${user.id}`;
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const firstName = (parts[0] || value || 'ClickUp').slice(0, 30);
  const lastName = (parts.slice(1).join(' ') || 'ㅤ').slice(0, 30);

  return { firstName, lastName };
}

function normalizeLogin(value: string) {
  return value.trim().toLowerCase().slice(0, 255);
}

function linkValue(value?: HalLink | HalLink[] | null) {
  return Array.isArray(value) ? value[0]?.href : value?.href;
}

function roleLinks(membership: OpenProjectMembership) {
  const roles = membership._links.roles;
  return (Array.isArray(roles) ? roles : roles ? [roles] : []) as HalLink[];
}

function roleHref(role: OpenProjectRole | OpenProjectRoleLike) {
  return role._links?.self?.href || `/api/v3/roles/${role.id}`;
}

function projectHref(projectId: number | string) {
  return `/api/v3/projects/${projectId}`;
}

function userHref(userId: number | string) {
  return `/api/v3/users/${userId}`;
}

function isClickUpUserLike(value: unknown): value is ClickUpUserLike {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ClickUpUserLike>;

  return candidate.id !== undefined && candidate.id !== null;
}

function clickUpUserFromTeamMember(member: unknown): ClickUpUserLike | null {
  if (isClickUpUserLike(member)) {
    return member;
  }

  if (!member || typeof member !== 'object') {
    return null;
  }

  const maybeWrapped = member as { user?: unknown };

  if (isClickUpUserLike(maybeWrapped.user)) {
    return maybeWrapped.user;
  }

  return null;
}

function cleanOptional(value: unknown) {
  if (value === undefined || value === null) return undefined;

  const text = String(value).trim();

  return text.length ? text : undefined;
}

function openProjectUserHref(user?: OpenProjectUser | null) {
  return user?._links.self.href || (user?.id ? `/api/v3/users/${user.id}` : undefined);
}

function clickUpUrlForTask(task: ClickUpTask) {
  return cleanOptional((task as { url?: string }).url);
}

async function openProjectUserForClickUpUser(
  clickUpUser: ClickUpUserLike,
  openProjectUserSync: OpenProjectUserSyncContext
) {
  return ensureOpenProjectUserFromClickUp(clickUpUser, openProjectUserSync);
}

async function clickUpAssigneeLinks(
  task: ClickUpTask,
  openProjectUserSync: OpenProjectUserSyncContext
) {
  const { assignee } = splitClickUpAssignees(
    ((task as unknown as { assignees?: ClickUpAssigneeLike[] }).assignees ||
      []) as ClickUpAssigneeLike[]
  );

  const assigneeUser = assignee
    ? await openProjectUserForClickUpUser(assignee, openProjectUserSync)
    : null;

  return {
    assignee,
    assigneeHref: openProjectUserHref(assigneeUser),
  };
}

function originalClickUpPath(context: ClickUpTaskContext) {
  return [context.space.name, context.folder?.name, context.list.name].filter(Boolean).join(' / ');
}

function metaFromContext(task: ClickUpTask, context: ClickUpTaskContext): ImportedMeta {
  return {
    clickUpTaskId: task.id,
    clickUpTaskUrl: clickUpUrlForTask(task),
    clickUpSpaceId: context.space.id,
    clickUpSpaceName: context.space.name,
    clickUpFolderId: context.folder?.id,
    clickUpFolderName: context.folder?.name,
    clickUpListId: context.list.id,
    clickUpListName: context.list.name,
    originalClickUpPath: originalClickUpPath(context),
  };
}

function stripImportedMeta(description: string) {
  const start = description.indexOf(META_START);
  const end = description.indexOf(META_END);

  if (start >= 0 && end >= start) {
    return `${description.slice(0, start)}${description.slice(end + META_END.length)}`.trim();
  }

  return description.trim();
}

function buildMetaBlock(meta: ImportedMeta) {
  const lines = [
    META_START,
    'Imported from ClickUp',
    meta.clickUpTaskId ? `ClickUp Task ID: ${meta.clickUpTaskId}` : undefined,
    meta.clickUpTaskUrl ? `ClickUp Task URL: ${meta.clickUpTaskUrl}` : undefined,
    meta.clickUpSpaceId ? `Space ID: ${meta.clickUpSpaceId}` : undefined,
    meta.clickUpSpaceName ? `Space: ${meta.clickUpSpaceName}` : undefined,
    meta.clickUpFolderId ? `Folder ID: ${meta.clickUpFolderId}` : undefined,
    meta.clickUpFolderName ? `Folder: ${meta.clickUpFolderName}` : undefined,
    meta.clickUpListId ? `List ID: ${meta.clickUpListId}` : undefined,
    meta.clickUpListName ? `List: ${meta.clickUpListName}` : undefined,
    meta.originalClickUpPath ? `Original Path: ${meta.originalClickUpPath}` : undefined,
    META_END,
  ].filter(Boolean);

  return lines.join('\n');
}

function appendImportedMeta(description: string, meta: ImportedMeta) {
  const cleanDescription = stripImportedMeta(description);
  const metaBlock = buildMetaBlock(meta);

  if (!cleanDescription) {
    return metaBlock;
  }

  return `${cleanDescription}\n\n---\n\n${metaBlock}`;
}

function parseLine(description: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return description.match(new RegExp(`^${escaped}:\\s*(.+)$`, 'm'))?.[1]?.trim();
}

function importedMeta(description?: string): ImportedMeta | null {
  if (!description) return null;

  const hasNewMeta = description.includes(META_START) && description.includes(META_END);
  const hasLegacyMeta = description.includes('Imported from ClickUp');

  if (!hasNewMeta && !hasLegacyMeta) {
    return null;
  }

  const meta: ImportedMeta = {
    clickUpTaskId: cleanOptional(parseLine(description, 'ClickUp Task ID')),
    clickUpTaskUrl: cleanOptional(parseLine(description, 'ClickUp Task URL')),
    clickUpSpaceId: cleanOptional(parseLine(description, 'Space ID')),
    clickUpSpaceName: cleanOptional(parseLine(description, 'Space')),
    clickUpFolderId: cleanOptional(parseLine(description, 'Folder ID')),
    clickUpFolderName: cleanOptional(parseLine(description, 'Folder')),
    clickUpListId: cleanOptional(parseLine(description, 'List ID')),
    clickUpListName: cleanOptional(parseLine(description, 'List')),
    originalClickUpPath: cleanOptional(parseLine(description, 'Original Path')),
  };

  if (!meta.originalClickUpPath && meta.clickUpSpaceName && meta.clickUpListName) {
    meta.originalClickUpPath = [meta.clickUpSpaceName, meta.clickUpFolderName, meta.clickUpListName]
      .filter(Boolean)
      .join(' / ');
  }

  if (!meta.clickUpTaskId && !meta.clickUpSpaceName && !meta.clickUpListName) {
    return null;
  }

  return meta;
}

function clickUpTaskDescription(task: ClickUpTask) {
  return task.markdown_description || task.description || task.text_content || '';
}

function clickUpMillisToDate(value?: string | null) {
  if (!value) return undefined;

  const date = new Date(Number(value));

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString().slice(0, 10);
}

function priorityNameFromClickUp(priority: ClickUpTask['priority']) {
  const id = Number(priority?.id);

  if (id === 1) return 'Immediate';
  if (id === 2) return 'High';
  if (id === 3) return 'Normal';
  if (id === 4) return 'Low';

  return 'No';
}

function priorityHref(priorities: OpenProjectPriority[], priority: ClickUpTask['priority']) {
  const name = priorityNameFromClickUp(priority);

  if (!name) {
    return undefined;
  }

  return priorities.find((item) => item.name.toLowerCase() === name.toLowerCase())?._links.self
    .href;
}

function mapStatusToOpenProjectId(
  status: ClickUpStatus,
  openProjectStatuses: OpenProjectStatus[]
): string {
  const name = status.status.toLowerCase();
  const find = (n: string) => openProjectStatuses.find((item) => item.name.toLowerCase() === n)?.id;

  // Exact name match first (e.g. "Backlog" → Backlog, "Shipped" → Shipped)
  const exact = openProjectStatuses.find((item) => item.name.toLowerCase() === name);
  if (exact) return String(exact.id);

  // --- Type-first routing ---

  // on hold / blocked / waiting → always On Hold regardless of ClickUp type
  if (name.includes('hold') || name.includes('block') || name.includes('wait')) {
    return String(find('on hold') ?? find('backlog') ?? openProjectStatuses[0]?.id);
  }

  // open type → Backlog (to do, open, new, backlog, etc.)
  if (status.type === 'open') {
    return String(find('backlog') ?? openProjectStatuses[0]?.id);
  }

  // done type → Shipped (the task was finished and delivered)
  if (status.type === 'done') {
    return String(find('shipped') ?? openProjectStatuses[0]?.id);
  }

  // closed type → Closed (cancelled, archived, rejected, won't fix, etc.)
  if (status.type === 'closed') {
    return String(find('closed') ?? openProjectStatuses[0]?.id);
  }

  // --- Custom type: route by name ---

  // review / testing / qa / verified → In Testing
  if (
    name.includes('review') ||
    name.includes('test') ||
    name.includes(' qa') ||
    name === 'qa' ||
    name.includes('verif')
  ) {
    return String(find('in testing') ?? find('in progress') ?? openProjectStatuses[0]?.id);
  }

  // active development / in progress / in dev
  if (name.includes('develop') || name.includes('progress') || name.includes(' dev')) {
    return String(find('in progress') ?? openProjectStatuses[0]?.id);
  }

  // scoping / design / planning / spec / research / ready
  if (
    name.includes('scop') ||
    name.includes('design') ||
    name.includes('plan') ||
    name.includes('spec') ||
    name.includes('research') ||
    name.includes('ready')
  ) {
    return String(find('scoping') ?? find('backlog') ?? openProjectStatuses[0]?.id);
  }

  // shipped / released / deployed (custom type)
  if (name.includes('ship') || name.includes('releas') || name.includes('deploy')) {
    return String(find('shipped') ?? openProjectStatuses[0]?.id);
  }

  // default for remaining custom → In Progress
  return String(find('in progress') ?? find('backlog') ?? openProjectStatuses[0]?.id);
}

/**
 * Derive the semantic workflow phase for a ClickUp status.
 * - ClickUp type open/done/closed maps directly.
 * - custom type is categorised by name: prep | progress | test.
 * - "on hold"-like names always stay 'open'.
 */

function seededPermissions() {
  return permissionSets.map((set) => ({
    role: set.role as WorkspaceRole,
    canView: true,
    canEdit: set.manageTasks,
    canManage: set.manageSpaces,
  }));
}

function seededStatusesFromOpenProject(params: {
  openProjectStatuses: OpenProjectStatus[];
  taskListId: string;
}) {
  return params.openProjectStatuses
    .map((status) => ({
      id: `op-status:${status.id}:clickup-status:${statusSlug(status.name)}`,
      clickupStatusName: status.name,
      openProjectStatusId: String(status.id),
      taskListId: params.taskListId,
      name: status.name,
      color: statusThemeColor(status.name),
      position: Number(status.position || status.id),
      isDone: Boolean(status.isClosed),
      statusType: statusThemeType(status.name),
    }))
    .sort((a, b) => a.position - b.position);
}

function containsStatusTransitionText(text: string) {
  const lower = text.toLowerCase();
  // English OP locale
  if (lower.includes('status is invalid') && lower.includes('no valid transition')) return true;
  // Russian OP locale: "Статус недопустимо, так как … нет правильного перехода …"
  return lower.includes('статус') && lower.includes('перехода');
}

/**
 * Returns true if an error object's OP payload indicates a status-attribute
 * constraint violation (locale-independent check via _embedded.details.attribute).
 */
function isStatusAttributePayload(p: Record<string, unknown>): boolean {
  const embedded = p._embedded;
  if (!embedded || typeof embedded !== 'object') return false;
  const details = (embedded as Record<string, unknown>).details;
  if (details && typeof details === 'object') {
    if ((details as Record<string, unknown>).attribute === 'status') return true;
  }
  return false;
}

function isInvalidStatusTransitionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (containsStatusTransitionText(message)) return true;

  // OpenProject sometimes wraps multiple constraint violations under a top-level
  // "Multiple field constraints have been violated." message. In that case the
  // individual errors live in payload._embedded.errors[].message.
  // Additionally, OP error payloads carry _embedded.details.attribute = "status"
  // regardless of locale — check that as the authoritative locale-independent signal.
  const payload =
    error instanceof Error && 'payload' in error
      ? (error as { payload?: unknown }).payload
      : undefined;
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;

    // Single-error payload: check details.attribute === 'status'
    if (isStatusAttributePayload(p)) return true;

    const embedded = p._embedded;
    if (embedded && typeof embedded === 'object') {
      const errors = (embedded as Record<string, unknown>).errors;
      if (Array.isArray(errors)) {
        return errors.some((e) => {
          if (typeof e !== 'object' || e === null) return false;
          const rec = e as Record<string, unknown>;
          // locale-independent: check details.attribute
          if (isStatusAttributePayload(rec)) return true;
          // fallback: check message text (covers all locales we know)
          return (
            typeof rec.message === 'string' && containsStatusTransitionText(rec.message as string)
          );
        });
      }
    }
  }

  return false;
}

async function ensureLocalRuntimeWorkspace() {
  return { id: 'openproject' };
}

async function syncClickUpUserIntoLocalWorkspace(user: ClickUpUserLike, context: UserSyncContext) {
  const key = clickUpUserKey(user);

  if (!key) {
    return;
  }

  if (context.seenClickUpUserKeys.has(key)) {
    return;
  }

  context.seenClickUpUserKeys.add(key);
  context.summary.clickUpUsersSeen += 1;

  // User tracking removed - users managed in OpenProject
  context.summary.localUsersReused += 1;
  return null;
}

async function syncClickUpTeamUsersIntoLocalWorkspace(
  team: ClickUpTeam,
  context: UserSyncContext,
  openProjectUserSync: OpenProjectUserSyncContext
) {
  const members = (team as unknown as { members?: unknown[] }).members || [];

  for (const member of members) {
    const clickUpUser = clickUpUserFromTeamMember(member);

    if (!clickUpUser) {
      continue;
    }

    await syncClickUpUserIntoLocalWorkspace(clickUpUser, context);
    await ensureOpenProjectUserFromClickUp(clickUpUser, openProjectUserSync);
  }
}

async function syncPermissionGrantUsersIntoLocalWorkspace(
  grants: PermissionGrant[],
  context: UserSyncContext,
  openProjectUserSync: OpenProjectUserSyncContext
) {
  for (const grant of grants) {
    await syncClickUpUserIntoLocalWorkspace(grant.user, context);
    await ensureOpenProjectUserFromClickUp(grant.user, openProjectUserSync);
  }
}

function permissionGrantsFromMembers(
  members: unknown[],
  source: PermissionGrant['source'],
  fallbackLevel: ImportedPermissionLevel
): PermissionGrant[] {
  return members.flatMap((member) => {
    const user = clickUpUserFromTeamMember(member);

    if (!user) {
      return [];
    }

    return [
      {
        user,
        level: clickUpPermissionFromRaw(member) || fallbackLevel,
        source,
      },
    ];
  });
}

function teamPermissionGrants(team: ClickUpTeam, summary: Summary): PermissionGrant[] {
  const members = (team as unknown as { members?: unknown[] }).members || [];
  summary.clickUpWorkspaceMembersSeen += members.length;
  summary.permissionSourcesUsed.teamMembers = members.length > 0;

  return permissionGrantsFromMembers(members, 'teamMembers', 'member');
}

function extractSpaceGrants(space: ClickUpSpace, summary: Summary): PermissionGrant[] {
  const grants = extractSpacePermissionGrants(space).flatMap((grant): PermissionGrant[] => {
    const user = clickUpUserFromTeamMember(grant.user);

    if (!user) {
      return [];
    }

    return [{ user, level: grant.level, source: 'spaceMembers' }];
  });

  summary.clickUpSpaceMembersSeen += grants.length;
  summary.permissionSourcesUsed.spaceMembers ||= grants.length > 0;

  return grants;
}

function extractFolderGrants(folder: ClickUpFolder, summary: Summary): PermissionGrant[] {
  const grants = extractFolderPermissionGrants(folder).flatMap((grant): PermissionGrant[] => {
    const user = clickUpUserFromTeamMember(grant.user);

    if (!user) {
      return [];
    }

    return [{ user, level: grant.level, source: 'folderMembers' }];
  });

  summary.clickUpFolderMembersSeen += grants.length;
  summary.permissionSourcesUsed.folderMembers ||= grants.length > 0;

  return grants;
}

function taskAssigneePermissionGrants(task: ClickUpTask, summary: Summary): PermissionGrant[] {
  const assignees = (task as unknown as { assignees?: ClickUpUserLike[] }).assignees || [];
  summary.clickUpTaskAssigneesSeen += assignees.length;
  summary.permissionSourcesUsed.taskAssignees ||= assignees.length > 0;

  return assignees.map((user) => ({ user, level: 'member', source: 'taskAssignees' }));
}

function countArrayField(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function recordUnsupportedClickUpTaskData(task: ClickUpTask, summary: Summary) {
  const taskData = task as ClickUpTask & {
    custom_fields?: unknown[];
    attachments?: unknown[];
    comments?: unknown[];
    time_entries?: unknown[];
    time_estimate?: unknown;
    time_spent?: unknown;
  };
  summary.clickUpCustomFieldsSeen += countArrayField(taskData.custom_fields);
  summary.clickUpDependenciesSeen +=
    countArrayField(task.dependencies) + countArrayField(task.linked_tasks);
  summary.clickUpAttachmentsSeen += countArrayField(taskData.attachments);
  summary.clickUpCommentsSeen += countArrayField(taskData.comments);
  summary.clickUpTimeEntriesSeen +=
    countArrayField(taskData.time_entries) +
    (taskData.time_estimate || taskData.time_spent ? 1 : 0);
}

async function getClickUpListMembers(listId: string, summary: Summary): Promise<PermissionGrant[]> {
  const payload = await clickUpRequest<{ members?: unknown[]; users?: unknown[] }>(
    `/list/${listId}/member`
  ).catch((error) => {
    summary.permissionWarnings.push(
      `list ${listId}: cannot read explicit ClickUp list members: ${(error as Error).message}`
    );
    return null;
  });

  const members = payload?.members || payload?.users || [];
  summary.clickUpListMembersSeen += members.length;
  summary.permissionSourcesUsed.listMembers ||= members.length > 0;

  return permissionGrantsFromMembers(members, 'listMembers', 'member');
}

async function getOpenProjectUsers() {
  const page = await openProjectRequest<HalCollection<OpenProjectUser>>('/api/v3/users', {
    query: { pageSize: 500 },
  });

  return page._embedded?.elements || [];
}

async function getOpenProjectRoles() {
  const page = await openProjectRequest<HalCollection<OpenProjectRole>>('/api/v3/roles', {
    query: { pageSize: 200 },
  });

  return page._embedded?.elements || [];
}

async function getOpenProjectMemberships() {
  const page = await openProjectRequest<HalCollection<OpenProjectMembership>>(
    '/api/v3/memberships',
    { query: { pageSize: 1000 } }
  );

  return page._embedded?.elements || [];
}

function findOpenProjectUserByEmailOrLogin(users: OpenProjectUser[], email: string, login: string) {
  return users.find(
    (user) =>
      user.email?.toLowerCase() === email.toLowerCase() ||
      user.login?.toLowerCase() === login.toLowerCase()
  );
}

async function ensureOpenProjectUserFromClickUp(
  clickUpUser: ClickUpUserLike,
  context: OpenProjectUserSyncContext
) {
  const key = clickUpUserKey(clickUpUser);

  if (key && context.clickUpUserToOpenProjectUser.has(key)) {
    return context.clickUpUserToOpenProjectUser.get(key);
  }

  if (key && context.failedClickUpUserKeys.has(key)) {
    return null;
  }

  const email = clickUpUserEmail(clickUpUser).slice(0, 255);
  const login = normalizeLogin(email);
  const existing = findOpenProjectUserByEmailOrLogin(context.users, email, login);

  if (existing) {
    context.summary.openProjectUsersReused += 1;
    if (key) context.clickUpUserToOpenProjectUser.set(key, existing);
    return existing;
  }

  const { firstName, lastName } = splitName(clickUpUserName(clickUpUser));

  try {
    const created = await openProjectRequest<OpenProjectUser>('/api/v3/users', {
      method: 'POST',
      body: {
        login,
        firstName,
        lastName,
        email,
        status: 'active',
        password: openProjectImportedUserPassword,
        admin: context.adminEmails.has(email.toLowerCase()),
      },
    });

    context.users.push(created);
    context.summary.openProjectUsersCreated += 1;
    if (key) context.clickUpUserToOpenProjectUser.set(key, created);
    return created;
  } catch (error) {
    if (key) {
      context.failedClickUpUserKeys.add(key);
    }

    const message = `OpenProject user ${email}: ${openProjectErrorMessage(error)}`;
    context.summary.openProjectUserErrors.push(message);
    context.summary.permissionWarnings.push(
      `${message}. The OpenProject token may need manage_user/global admin permissions.`
    );
    return null;
  }
}

function openProjectErrorMessage(error: unknown) {
  const base = (error as Error).message || 'OpenProject request failed';
  const payload = (error as { payload?: unknown }).payload;
  const details = openProjectPayloadDetails(payload);

  return details ? `${base}: ${details}` : base;
}

function openProjectPayloadDetails(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const body = payload as {
    message?: unknown;
    _embedded?: {
      errors?: Array<{
        message?: unknown;
        // OpenProject puts the attribute name under _embedded.details.attribute on
        // each individual error item (locale-independent, always English).
        _embedded?: { details?: { attribute?: unknown } };
        // Older / flat format kept for compatibility
        details?: { attribute?: unknown };
      }>;
    };
  };

  const errors = body._embedded?.errors || [];
  const errorMessages = errors
    .map((item) => {
      // Prefer _embedded.details.attribute (current OP format); fall back to flat details
      const attribute = item._embedded?.details?.attribute ?? item.details?.attribute;
      const prefix = typeof attribute === 'string' ? `${attribute}: ` : '';
      return typeof item.message === 'string' ? `${prefix}${item.message}` : null;
    })
    .filter((item): item is string => Boolean(item));

  if (errorMessages.length > 0) {
    return errorMessages.join('; ');
  }

  return typeof body.message === 'string' ? body.message : null;
}

function findOpenProjectMembership(
  memberships: OpenProjectMembership[],
  projectId: number | string,
  userId: number | string
) {
  return memberships.find(
    (membership) =>
      linkValue(membership._links.project) === projectHref(projectId) &&
      linkValue(membership._links.principal) === userHref(userId)
  );
}

function strongestMembershipRoleName(membership: OpenProjectMembership, roles: OpenProjectRole[]) {
  const roleHrefs = new Set(roleLinks(membership).map((role) => role.href));
  return roles.find((role) => roleHrefs.has(roleHref(role)))?.name;
}

async function ensureOpenProjectProjectMembership(
  projectId: number | string,
  clickUpUser: ClickUpUserLike,
  permission: ImportedPermissionLevel,
  context: OpenProjectUserSyncContext
) {
  const user = await ensureOpenProjectUserFromClickUp(clickUpUser, context);

  if (!user) {
    return;
  }

  const role = pickOpenProjectRoleForClickUpPermission(context.roles, permission);

  if (!role) {
    context.summary.openProjectMembershipErrors.push(
      `project ${projectId}, user ${user.id}: no OpenProject roles available`
    );
    return;
  }

  const existing = findOpenProjectMembership(context.memberships, projectId, user.id);

  if (existing) {
    const currentRoleName = strongestMembershipRoleName(existing, context.roles);

    if (isRoleAtLeast(currentRoleName, permission)) {
      context.summary.openProjectMembershipsReused += 1;
      return;
    }

    try {
      const updated = await openProjectRequest<OpenProjectMembership>(
        `/api/v3/memberships/${existing.id}`,
        {
          method: 'PATCH',
          body: {
            _links: {
              roles: [{ href: roleHref(role) }],
            },
          },
        }
      );

      const index = context.memberships.findIndex((membership) => membership.id === existing.id);
      context.memberships[index] = updated;
      context.summary.openProjectMembershipsUpdated += 1;
      return;
    } catch (error) {
      context.summary.openProjectMembershipErrors.push(
        `project ${projectId}, user ${user.id}: cannot update membership: ${(error as Error).message}`
      );
      return;
    }
  }

  try {
    const created = await openProjectRequest<OpenProjectMembership>('/api/v3/memberships', {
      method: 'POST',
      body: {
        _links: {
          project: { href: projectHref(projectId) },
          principal: { href: userHref(user.id) },
          roles: [{ href: roleHref(role) }],
        },
      },
    });

    context.memberships.push(created);
    context.summary.openProjectMembershipsCreated += 1;
  } catch (error) {
    context.summary.openProjectMembershipErrors.push(
      `project ${projectId}, user ${user.id}: cannot create membership: ${(error as Error).message}`
    );
  }
}

async function applyOpenProjectMemberships(
  project: OpenProjectProject | null,
  grants: PermissionGrant[],
  context: OpenProjectUserSyncContext,
  options: { sharedRoadmap?: boolean } = {}
) {
  if (!project) {
    return;
  }

  const strongest = new Map<string, PermissionGrant>();

  for (const grant of grants) {
    const key = clickUpUserKey(grant.user);

    if (!key) {
      continue;
    }

    // For non-roadmap projects only add admins; everyone else must be added manually
    if (!options.sharedRoadmap && grant.level !== 'admin') {
      continue;
    }

    const existing = strongest.get(key);

    if (
      !existing ||
      (grant.level === 'admin' && existing.level !== 'admin') ||
      (grant.level === 'member' &&
        (existing.level === 'commenter' || existing.level === 'reader')) ||
      (grant.level === 'commenter' && existing.level === 'reader')
    ) {
      strongest.set(key, grant);
    }
  }

  for (const grant of strongest.values()) {
    await ensureOpenProjectProjectMembership(project.id, grant.user, grant.level, context);
  }
}

async function getClickUpTeams() {
  const payload = await clickUpRequest<{ teams: ClickUpTeam[] }>('/team');
  return payload.teams || [];
}

async function getClickUpGroups(teamId: string): Promise<ClickUpGroup[]> {
  const payload = await clickUpRequest<{ groups: ClickUpGroup[] }>('/group', {
    query: { team_id: teamId },
  }).catch(() => ({ groups: [] as ClickUpGroup[] }));
  return payload.groups || [];
}

/**
 * Returns a Set of lowercase emails that are admins (role 1 or 2) in the ClickUp team.
 * Merged with importedAdminEmails so the env-var override always wins.
 */
function buildAdminEmailsFromTeam(team: ClickUpTeam): Set<string> {
  const emails = new Set<string>();
  for (const member of team.members || []) {
    if (member.role === 1 || member.role === 2) {
      const email = normalizeEmail(member.user?.email);
      if (email) emails.add(email);
    }
  }
  return emails;
}

async function getOpenProjectGroups(): Promise<OpenProjectGroup[]> {
  const page = await openProjectRequest<HalCollection<OpenProjectGroup>>('/api/v3/groups', {
    query: { pageSize: 500 },
  }).catch(() => ({ _embedded: { elements: [] as OpenProjectGroup[] } }));
  return page._embedded?.elements || [];
}

async function upsertOpenProjectGroup(
  name: string,
  memberHrefs: string[],
  existingGroups: OpenProjectGroup[],
  summary: Summary
): Promise<OpenProjectGroup | null> {
  const links = memberHrefs.map((href) => ({ href }));
  const existing = existingGroups.find((g) => g.name.toLowerCase() === name.toLowerCase());

  if (existing) {
    await openProjectRequest(`/api/v3/groups/${existing.id}`, {
      method: 'PATCH',
      body: { _links: { members: links } },
    }).catch((err: unknown) => {
      summary.openProjectGroupErrors.push(`Group "${name}": ${(err as Error).message}`);
    });
    summary.openProjectGroupsReused += 1;
    return existing;
  }

  const created = await openProjectRequest<OpenProjectGroup>('/api/v3/groups', {
    method: 'POST',
    body: { name, _links: { members: links } },
  }).catch((err: unknown) => {
    summary.openProjectGroupErrors.push(`Group "${name}": ${(err as Error).message}`);
    return null;
  });

  if (created) {
    existingGroups.push(created);
    summary.openProjectGroupsCreated += 1;
  }

  return created;
}

async function syncGroupsToOpenProject(
  clickUpGroups: ClickUpGroup[],
  adminEmails: Set<string>,
  allOpenProjectUsers: OpenProjectUser[],
  clickUpUserToOpenProjectUser: Map<string, OpenProjectUser>,
  summary: Summary
) {
  const existingGroups = await getOpenProjectGroups();

  /** Resolve ClickUp user → OP user href, trying click-up key then email fallback */
  function opHref(user: ClickUpUserLike): string | null {
    const key = clickUpUserKey(user);
    const byKey = key ? clickUpUserToOpenProjectUser.get(key) : undefined;
    if (byKey) return `/api/v3/users/${byKey.id}`;
    const email = normalizeEmail(user.email);
    if (!email) return null;
    const byEmail = allOpenProjectUsers.find((u) => (u.email || '').toLowerCase() === email);
    return byEmail ? `/api/v3/users/${byEmail.id}` : null;
  }

  // Sync each ClickUp group
  for (const group of clickUpGroups) {
    const hrefs = (group.members || [])
      .map((m) => opHref(m))
      .filter((h): h is string => Boolean(h));
    await upsertOpenProjectGroup(group.name, hrefs, existingGroups, summary);
  }

  // Always create/update "Leads" group = all admins
  const leadHrefs = allOpenProjectUsers
    .filter((u) => adminEmails.has((u.email || '').toLowerCase()))
    .map((u) => `/api/v3/users/${u.id}`);

  if (leadHrefs.length > 0) {
    await upsertOpenProjectGroup('Leads', leadHrefs, existingGroups, summary);
  }
}

/**
 * Adds every OP group as a member of every active OP project (Reader role).
 * This makes groups available in the work-package assignee dropdown for all projects.
 * Groups with Reader role can still be set as assignees — OP only restricts individual users.
 */
async function syncGroupProjectMemberships(
  memberships: OpenProjectMembership[],
  roles: OpenProjectRole[],
  summary: Summary
): Promise<void> {
  const [groups, projectsPage] = await Promise.all([
    getOpenProjectGroups(),
    openProjectRequest<HalCollection<OpenProjectProject>>('/api/v3/projects', {
      query: { pageSize: 500 },
    }).catch(() => null),
  ]);

  const allProjects = (projectsPage?._embedded?.elements || []).filter((p) => p.active !== false);
  if (groups.length === 0 || allProjects.length === 0) return;

  const readerRole = pickOpenProjectRoleForClickUpPermission(roles, 'reader') || roles[0];
  if (!readerRole) return;

  for (const group of groups) {
    const groupHref = `/api/v3/groups/${group.id}`;
    for (const project of allProjects) {
      const alreadyMember = memberships.some(
        (m) =>
          linkValue(m._links.project) === projectHref(project.id) &&
          linkValue(m._links.principal) === groupHref
      );
      if (alreadyMember) continue;

      try {
        const created = await openProjectRequest<OpenProjectMembership>('/api/v3/memberships', {
          method: 'POST',
          body: {
            _links: {
              project: { href: projectHref(project.id) },
              principal: { href: groupHref },
              roles: [{ href: roleHref(readerRole) }],
            },
          },
        });
        memberships.push(created);
        summary.openProjectMembershipsCreated += 1;
      } catch (error) {
        summary.openProjectMembershipErrors.push(
          `group "${group.name}" → project "${project.name}": ${(error as Error).message}`
        );
      }
    }
  }
}

async function getClickUpSpaces(teamId: string) {
  const payload = await clickUpRequest<{ spaces: ClickUpSpace[] }>(`/team/${teamId}/space`, {
    query: { archived: false },
  });

  return payload.spaces || [];
}

async function getClickUpSpaceDetails(spaceId: string, summary: Summary) {
  return clickUpRequest<ClickUpSpace>(`/space/${spaceId}`).catch((error) => {
    summary.permissionWarnings.push(
      `space ${spaceId}: cannot read detailed ClickUp space access fields: ${(error as Error).message}`
    );
    return null;
  });
}

async function getClickUpFolders(spaceId: string) {
  const payload = await clickUpRequest<{ folders: ClickUpFolder[] }>(`/space/${spaceId}/folder`, {
    query: { archived: false },
  });

  return payload.folders || [];
}

async function getClickUpFolderDetails(folderId: string, summary: Summary) {
  return clickUpRequest<ClickUpFolder>(`/folder/${folderId}`).catch((error) => {
    summary.permissionWarnings.push(
      `folder ${folderId}: cannot read detailed ClickUp folder access fields: ${(error as Error).message}`
    );
    return null;
  });
}

/**
 * Fetch the full details for a single ClickUp list.
 * The collection endpoints (/folder/{id}/list, /space/{id}/list) return list
 * objects WITHOUT the `statuses` array populated.  Only GET /list/{id} returns
 * the complete list payload including custom statuses.
 */
async function getClickUpListDetails(listId: string): Promise<ClickUpList> {
  return clickUpRequest<ClickUpList>(`/list/${listId}`);
}

/**
 * Enrich a set of lists by fetching each list's full details so that
 * `list.statuses` is populated.  Failures for individual lists are logged
 * and the original shallow object is kept as a fallback.
 */
async function enrichListsWithStatuses(lists: ClickUpList[]): Promise<ClickUpList[]> {
  return Promise.all(
    lists.map((list) =>
      getClickUpListDetails(list.id).catch((err: Error) => {
        console.warn(`Could not fetch details for list ${list.id} (${list.name}): ${err.message}`);
        return list;
      })
    )
  );
}

async function getClickUpFolderlessLists(spaceId: string) {
  const payload = await clickUpRequest<{ lists: ClickUpList[] }>(`/space/${spaceId}/list`, {
    query: { archived: false },
  });

  const lists = payload.lists || [];
  return enrichListsWithStatuses(lists);
}

async function getClickUpLists(folderId: string) {
  const payload = await clickUpRequest<{ lists: ClickUpList[] }>(`/folder/${folderId}/list`, {
    query: { archived: false },
  });

  const lists = payload.lists || [];
  return enrichListsWithStatuses(lists);
}

async function getClickUpTasks(listId: string) {
  const tasks: ClickUpTask[] = [];

  for (let page = 0; page < 50; page += 1) {
    const payload = await clickUpRequest<{ tasks: ClickUpTask[] }>(`/list/${listId}/task`, {
      query: {
        archived: false,
        include_closed: true, // include shipped/done/closed tasks
        include_markdown_description: true,
        subtasks: true,
        page,
        order_by: 'created',
        reverse: false,
      },
    });

    const pageTasks = payload.tasks || [];
    tasks.push(...pageTasks);

    if (pageTasks.length < 100) {
      break;
    }
  }

  return tasks;
}

async function getOpenProjectProjects() {
  const page = await openProjectRequest<HalCollection<OpenProjectProject>>('/api/v3/projects', {
    query: { pageSize: 500 },
  });

  return page._embedded?.elements || [];
}

const SEED_DEMO_PROJECT_IDENTIFIERS = new Set([
  'demo-project',
  'scrum-project',
  'demo-scrum-project',
]);
const SEED_DEMO_PROJECT_NAMES = [/^demo\s+project$/i, /^scrum\s+project$/i, /^demo[-\s]scrum/i];

async function cleanupDefaultDemoProjects(summary: Summary): Promise<void> {
  const page = await openProjectRequest<HalCollection<OpenProjectProject>>('/api/v3/projects', {
    query: { pageSize: 500 },
  });
  const all = page._embedded?.elements || [];

  const demos = all.filter((p) => {
    const id = (p as any).identifier as string | undefined;
    if (id && SEED_DEMO_PROJECT_IDENTIFIERS.has(id)) return true;
    return SEED_DEMO_PROJECT_NAMES.some((re) => re.test(p.name));
  });

  if (demos.length === 0) return;

  // Sort deepest children first so their parents can be deleted after
  const sorted = [...demos].sort((a, b) => {
    const aChild = Boolean((a._links as any)?.parent?.href);
    const bChild = Boolean((b._links as any)?.parent?.href);
    if (aChild && !bChild) return -1;
    if (!aChild && bChild) return 1;
    return 0;
  });

  for (const project of sorted) {
    await openProjectRequest<void>(`/api/v3/projects/${project.id}`, { method: 'DELETE' }).catch(
      (err) => {
        summary.warnings.push(
          `Could not delete demo project "${project.name}": ${(err as Error).message}`
        );
      }
    );
  }
}

const SEED_BOOTSTRAP_PLACEHOLDER_IDENTIFIER = 'seed-status-bootstrap';

/** Returns the id of a newly-created placeholder project, or null if activation of an existing
 *  project was sufficient (in which case no cleanup is needed). */
async function activateArchivedProjectForBootstrap(): Promise<number | null> {
  // OpenProject requires view_work_packages in at least one active project
  // before the global /api/v3/statuses endpoint is accessible.
  // Activate all root-level archived projects (subprojects must be activated via their ancestors).
  const page = await openProjectRequest<HalCollection<OpenProjectProject>>('/api/v3/projects', {
    query: { pageSize: 500 },
  });
  const all = page._embedded?.elements || [];

  // Already have active projects — no bootstrap needed
  if (all.some((p) => p.active !== false)) return null;

  const archived = all.filter((p) => p.active === false);
  const roots = archived.filter((p) => {
    const parent = (p._links as any).parent;
    return !parent?.href;
  });
  for (const root of roots) {
    await openProjectRequest<OpenProjectProject>(`/api/v3/projects/${root.id}`, {
      method: 'PATCH',
      body: { active: true },
    }).catch(() => {});
    root.active = true;
    console.info(
      `Bootstrap: activated project ${root.id} (${root.name}) to unlock /api/v3/statuses`
    );
    return null; // activated an existing project — no placeholder created
  }

  // No projects at all — create a temporary placeholder so the status endpoint is accessible.
  // It will be deleted immediately after statuses are fetched.
  console.info(
    `Bootstrap: no projects found — creating temporary placeholder for /api/v3/statuses`
  );
  try {
    const created = await openProjectRequest<OpenProjectProject>('/api/v3/projects', {
      method: 'POST',
      body: {
        name: '__Seed Status Bootstrap',
        identifier: SEED_BOOTSTRAP_PLACEHOLDER_IDENTIFIER,
      },
    });
    return created.id;
  } catch (e: any) {
    // Already exists from a previous interrupted run — find and return its id
    const existing = all.find(
      (p) =>
        (p as any).identifier === SEED_BOOTSTRAP_PLACEHOLDER_IDENTIFIER ||
        p.name === '__Seed Status Bootstrap'
    );
    if (existing) return existing.id;
    console.warn(`Bootstrap: could not create placeholder: ${(e?.message || '').slice(0, 200)}`);
    return null;
  }
}

async function deleteSeedBootstrapPlaceholder(projectId: number): Promise<void> {
  // The API delete is async (just archives the project), but that's fine —
  // the seed will create real projects right after and the placeholder won't interfere.
  // We attempt deletion anyway for hygiene; failures are silently ignored.
  await openProjectRequest(`/api/v3/projects/${projectId}`, {
    method: 'DELETE',
  }).catch(() => {});
}

async function getOpenProjectStatuses() {
  try {
    const page = await openProjectRequest<HalCollection<OpenProjectStatus>>('/api/v3/statuses', {
      query: { pageSize: 500 },
    });
    return page._embedded?.elements || [];
  } catch (error) {
    if ((error as any).statusCode !== 403) throw error;
    // 403 means no active project exists yet — bootstrap by activating/creating one
    const placeholderId = await activateArchivedProjectForBootstrap();
    const page = await openProjectRequest<HalCollection<OpenProjectStatus>>('/api/v3/statuses', {
      query: { pageSize: 500 },
    });
    const statuses = page._embedded?.elements || [];
    // Clean up placeholder if we created one (fire-and-forget, don't block seeding)
    if (placeholderId != null) {
      void deleteSeedBootstrapPlaceholder(placeholderId);
    }
    return statuses;
  }
}

/**
 * Required workflow statuses that must exist in OpenProject before the import.
 * Ordered by workflow position (Backlog → … → Closed).
 */
const REQUIRED_OP_STATUSES: Array<{
  name: string;
  color: string;
  isClosed: boolean;
  position: number;
}> = [
  { name: 'Backlog', color: '#adb5bd', isClosed: false, position: 1 },
  { name: 'Scoping', color: '#339af0', isClosed: false, position: 2 },
  { name: 'In Progress', color: '#cc5de8', isClosed: false, position: 3 },
  { name: 'In Testing', color: '#22b8cf', isClosed: false, position: 4 },
  { name: 'Shipped', color: '#51cf66', isClosed: true, position: 5 },
  { name: 'On Hold', color: '#fcc419', isClosed: false, position: 6 },
  { name: 'Closed', color: '#868e96', isClosed: true, position: 7 },
];

/**
 * Ensures every status in REQUIRED_OP_STATUSES exists in OpenProject.
 * Creates any that are missing and returns the full updated list of statuses.
 */
async function ensureRequiredStatuses(existing: OpenProjectStatus[]): Promise<OpenProjectStatus[]> {
  const existingNames = new Set(existing.map((s) => s.name.toLowerCase()));
  const missing = REQUIRED_OP_STATUSES.filter((s) => !existingNames.has(s.name.toLowerCase()));

  if (missing.length === 0) return existing;

  console.info(
    `Creating ${missing.length} missing OpenProject status(es): ${missing.map((s) => s.name).join(', ')}`
  );

  const created: OpenProjectStatus[] = [];
  for (const status of missing) {
    try {
      const result = await openProjectRequest<OpenProjectStatus>('/api/v3/statuses', {
        method: 'POST',
        body: {
          name: status.name,
          color: status.color,
          isClosed: status.isClosed,
          position: status.position,
        },
      });
      created.push(result);
      console.info(`  ✓ Created status "${status.name}" (id=${result.id})`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // 422 likely means it already exists under a slightly different case — re-fetch to reconcile
      if ((error as any).statusCode === 422 || msg.toLowerCase().includes('already')) {
        console.info(`  ~ Status "${status.name}" already exists (skipped)`);
      } else {
        console.warn(`  ✗ Could not create status "${status.name}": ${msg}`);
      }
    }
  }

  if (created.length === 0) return existing;

  // Re-fetch so IDs are accurate
  const page = await openProjectRequest<HalCollection<OpenProjectStatus>>('/api/v3/statuses', {
    query: { pageSize: 500 },
  });
  return page._embedded?.elements || [...existing, ...created];
}

async function getOpenProjectPriorities() {
  const page = await openProjectRequest<HalCollection<OpenProjectPriority>>('/api/v3/priorities', {
    query: { pageSize: 100 },
  });

  return page._embedded?.elements || [];
}

/**
 * Returns true if the given CSRF HTML matches the OP authenticity_token pattern.
 */
function extractCsrfToken(html: string): string {
  const m =
    html.match(/name=["']authenticity_token["'][^>]*value=["']([^"']+)["']/i) ??
    html.match(/value=["']([^"']+)["'][^>]*name=["']authenticity_token["']/i);
  return m?.[1] ?? '';
}

/**
 * Configures OpenProject to allow all status transitions for every
 * type × role combination.  This is required after adding new statuses via
 * `ensureRequiredStatuses` because OP never adds newly-created statuses to
 * any workflow automatically, causing work-package creation with those
 * statuses to fail with a "no valid transition" 422.
 *
 * Uses the OP admin HTML controller (session-based auth) which is the only
 * OP interface for workflow management.  Requires OPENPROJECT_API_PASSWORD;
 * falls back to a warning if the env var is absent or the endpoint fails.
 */
async function ensureOpenProjectWorkflowTransitions(
  statuses: OpenProjectStatus[],
  summary: Summary
): Promise<void> {
  if (process.env.OPENPROJECT_SKIP_WORKFLOW_CONFIG === 'true') return;

  const baseUrl = (process.env.OPENPROJECT_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

  // Build Basic auth header using the API token (same credential the REST client uses).
  // OP accepts "apikey:{token}" as Basic auth for admin HTML pages for admin users.
  const rawToken = process.env.OPENPROJECT_API_TOKEN;
  const rawPassword = process.env.OPENPROJECT_API_PASSWORD;
  const rawUser = process.env.OPENPROJECT_API_USER || 'admin';

  let adminAuthHeader: string;
  if (rawPassword) {
    adminAuthHeader = `Basic ${Buffer.from(`${rawUser}:${rawPassword}`).toString('base64')}`;
  } else if (rawToken) {
    adminAuthHeader = `Basic ${Buffer.from(`apikey:${rawToken}`).toString('base64')}`;
  } else {
    summary.warnings.push(
      `Workflow auto-configuration skipped (no OPENPROJECT_API_TOKEN/PASSWORD). ` +
        `Visit ${baseUrl}/workflows and enable all transitions for every type and role.`
    );
    return;
  }

  // --- 1. Fetch all types and roles via the REST API ---
  let allTypes: OpenProjectType[] = [];
  let allRoles: OpenProjectRole[] = [];
  try {
    const [typesRes, rolesRes] = await Promise.all([
      openProjectRequest<HalCollection<OpenProjectType>>('/api/v3/types', {
        query: { pageSize: 200 },
      }),
      openProjectRequest<HalCollection<OpenProjectRole>>('/api/v3/roles', {
        query: { pageSize: 200 },
      }),
    ]);
    allTypes = typesRes._embedded?.elements ?? [];
    allRoles = rolesRes._embedded?.elements ?? [];
  } catch {
    summary.warnings.push(`Workflow auto-configuration: could not fetch OP types/roles — skipped`);
    return;
  }

  if (allTypes.length === 0 || allRoles.length === 0) {
    summary.warnings.push(`Workflow auto-configuration: no types or roles found in OP — skipped`);
    return;
  }

  const statusIds = statuses.map((s) => s.id);

  // --- 2. For each type × role: POST all-transitions workflow via admin HTML endpoint ---
  // OP's /workflows controller accepts API-token Basic auth for admin users and
  // skips CSRF verification when the Authorization header is present (Rails API mode).
  // If that doesn't work we fall back gracefully.
  let configured = 0;
  let skippedCount = 0;
  let csrfToken = '';
  let sessionCookie = '';

  // Attempt to get a CSRF token from the admin edit page using our auth.
  try {
    const firstType = allTypes[0];
    const firstRole = allRoles[0];
    const editRes = await fetch(
      `${baseUrl}/workflows/edit?type_id=${firstType.id}&role_id=${firstRole.id}`,
      { headers: { Authorization: adminAuthHeader } }
    );
    if (editRes.ok) {
      const html = await editRes.text();
      csrfToken = extractCsrfToken(html);
      sessionCookie = (editRes.headers.get('set-cookie') ?? '').split(';')[0];
    }
  } catch {
    // proceed without CSRF token — OP may skip it for API-key auth
  }

  for (const type of allTypes) {
    // Refresh CSRF token per type when we have a session cookie.
    if (sessionCookie) {
      try {
        const editRes = await fetch(
          `${baseUrl}/workflows/edit?type_id=${type.id}&role_id=${allRoles[0].id}`,
          { headers: { Authorization: adminAuthHeader, Cookie: sessionCookie } }
        );
        if (editRes.ok) {
          const html = await editRes.text();
          const fresh = extractCsrfToken(html);
          if (fresh) csrfToken = fresh;
          const c = (editRes.headers.get('set-cookie') ?? '').split(';')[0];
          if (c) sessionCookie = c;
        }
      } catch {
        // keep existing token
      }
    }

    for (const role of allRoles) {
      const body = new URLSearchParams();
      if (csrfToken) body.append('authenticity_token', csrfToken);
      body.append('type_id', String(type.id));
      body.append('role_id', String(role.id));
      body.append('_method', 'put');

      // old_status_id=0 → "create" workflow (initial status on new WP).
      for (const fromId of [0, ...statusIds]) {
        for (const toId of statusIds) {
          body.append(`workflows[${fromId}][${toId}]`, '1');
        }
      }

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: adminAuthHeader,
          Accept: 'text/html,application/xhtml+xml',
        };
        if (sessionCookie) headers['Cookie'] = sessionCookie;

        const res = await fetch(`${baseUrl}/workflows`, {
          method: 'POST',
          headers,
          body: body.toString(),
          redirect: 'manual',
        });

        if (res.ok || res.status === 302 || res.status === 301) {
          configured += 1;
        } else {
          skippedCount += 1;
        }
      } catch {
        skippedCount += 1;
      }
    }
  }

  if (configured > 0) {
    console.info(
      `  ✓ Workflow transitions configured: ${configured} type×role pair(s) ` +
        `(${allTypes.length} types × ${allRoles.length} roles)`
    );
  }
  if (skippedCount > 0) {
    summary.warnings.push(
      `Workflow auto-configuration: ${skippedCount} type×role pair(s) could not be updated — ` +
        `visit ${baseUrl}/workflows to configure manually if status import still fails`
    );
  }
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
    if (existing.active === false) {
      await openProjectRequest<OpenProjectProject>(`/api/v3/projects/${existing.id}`, {
        method: 'PATCH',
        body: { active: true },
      }).catch(() => {});
      existing.active = true;
    }
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

export function buildTaskBody(params: {
  task: ClickUpTask;
  context: ClickUpTaskContext;
  type?: OpenProjectType;
  openProjectStatuses: OpenProjectStatus[];
  priorities: OpenProjectPriority[];
  includeStatus?: boolean;
  assigneeHref?: string;
  categoryHref?: string;
}) {
  const links: Record<string, { href: string | undefined }> = {
    type: { href: params.type?._links.self.href || undefined },
  };

  if (params.includeStatus !== false && params.task.status) {
    links.status = {
      href: `/api/v3/statuses/${mapStatusToOpenProjectId(
        params.task.status,
        params.openProjectStatuses
      )}`,
    };
  }

  const priority = priorityHref(params.priorities, params.task.priority);

  if (priority) {
    links.priority = { href: priority };
  }

  if (params.assigneeHref) {
    links.assignee = { href: params.assigneeHref };
  }

  if (params.categoryHref) {
    links.category = { href: params.categoryHref };
  }

  const meta = metaFromContext(params.task, params.context);
  const description = clickUpTaskDescription(params.task);

  const body: Record<string, unknown> = {
    subject: params.task.name,
    description: {
      format: 'markdown',
      raw: appendImportedMeta(description, meta),
    },
    _links: links,
  };

  const startDate = clickUpMillisToDate(params.task.start_date);
  const dueDate = clickUpMillisToDate(params.task.due_date);

  if (startDate) {
    body.startDate = startDate;
  }

  if (dueDate) {
    body.dueDate = dueDate;
  }

  return body;
}

/**
 * Returns true if an error object's OP payload indicates an assignee/responsible
 * attribute constraint violation (locale-independent, same pattern as isStatusAttributePayload).
 */
function isAssigneeAttributePayload(p: Record<string, unknown>): boolean {
  const embedded = p._embedded;
  if (!embedded || typeof embedded !== 'object') return false;
  const details = (embedded as Record<string, unknown>).details;
  if (details && typeof details === 'object') {
    const attr = (details as Record<string, unknown>).attribute;
    return attr === 'assignee' || attr === 'responsible';
  }
  return false;
}

function isAssigneeMappingError(error: unknown) {
  // Fast path: English text in the formatted message (covers cases where the attribute
  // prefix was successfully extracted by openProjectPayloadDetails)
  if (/assignee|responsible/i.test(openProjectErrorMessage(error))) return true;

  // Locale-independent path: inspect the raw OP payload for the attribute name.
  // OpenProject stores the attribute in _embedded.details.attribute regardless of
  // the UI locale — this catches Russian, German, etc. instances.
  const payload =
    error instanceof Error && 'payload' in error
      ? (error as { payload?: unknown }).payload
      : undefined;
  if (!payload || typeof payload !== 'object') return false;

  const p = payload as Record<string, unknown>;

  // Single-error payload
  if (isAssigneeAttributePayload(p)) return true;

  // Multi-error payload: check each error item in _embedded.errors[]
  const embedded = p._embedded;
  if (embedded && typeof embedded === 'object') {
    const errors = (embedded as Record<string, unknown>).errors;
    if (Array.isArray(errors)) {
      return errors.some((e) => {
        if (typeof e !== 'object' || e === null) return false;
        return isAssigneeAttributePayload(e as Record<string, unknown>);
      });
    }
  }

  return false;
}

function indexExistingWorkPackages(workPackages: OpenProjectWorkPackage[]) {
  const byClickUpTaskId = new Map<string, OpenProjectWorkPackage>();

  for (const workPackage of workPackages) {
    const meta = importedMeta(workPackage.description?.raw || '');

    if (meta?.clickUpTaskId) {
      byClickUpTaskId.set(meta.clickUpTaskId, workPackage);
    }
  }

  return { byClickUpTaskId };
}

async function createOpenProjectWorkPackage(params: {
  project: OpenProjectProject;
  task: ClickUpTask;
  context: ClickUpTaskContext;
  type?: OpenProjectType;
  openProjectStatuses: OpenProjectStatus[];
  priorities: OpenProjectPriority[];
  summary: Summary;
  openProjectUserSync: OpenProjectUserSyncContext;
  categoryHref?: string;
}) {
  const { assigneeHref } = await clickUpAssigneeLinks(params.task, params.openProjectUserSync);
  let includeStatus = true;
  let includeAssignee = Boolean(assigneeHref);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const created = await openProjectRequest<OpenProjectWorkPackage>(
        `/api/v3/projects/${params.project.id}/work_packages`,
        {
          method: 'POST',
          body: buildTaskBody({
            task: params.task,
            context: params.context,
            type: params.type,
            openProjectStatuses: params.openProjectStatuses,
            priorities: params.priorities,
            includeStatus,
            assigneeHref: includeAssignee ? assigneeHref : undefined,
            categoryHref: params.categoryHref,
          }),
        }
      );

      if (includeAssignee && assigneeHref) {
        params.summary.assigneesMapped += 1;
      }

      return created;
    } catch (error) {
      if (includeStatus && isInvalidStatusTransitionError(error)) {
        includeStatus = false;
        params.summary.statusTransitionsSkipped += 1;
        params.summary.warnings.push(
          `status skipped while creating ${params.task.name} (${params.task.id}) because OpenProject rejected the imported ClickUp status`
        );
        continue;
      }

      if (includeAssignee && isAssigneeMappingError(error)) {
        includeAssignee = false;
        params.summary.assigneeRejectedByOpenProject += 1;
        params.summary.assigneeMappingErrors.push(
          `task ${params.task.id}: OpenProject rejected assignee mapping: ${openProjectErrorMessage(error)}`
        );
        params.summary.warnings.push(
          `task ${params.task.name} (${params.task.id}): created without assignee because OpenProject rejected it`
        );
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Could not create work package for ClickUp task ${params.task.id}`);
}

async function updateOpenProjectWorkPackage(params: {
  existing: OpenProjectWorkPackage;
  task: ClickUpTask;
  context: ClickUpTaskContext;
  type?: OpenProjectType;
  openProjectStatuses: OpenProjectStatus[];
  priorities: OpenProjectPriority[];
  summary: Summary;
  openProjectUserSync: OpenProjectUserSyncContext;
  categoryHref?: string;
}) {
  const { assigneeHref } = await clickUpAssigneeLinks(params.task, params.openProjectUserSync);
  let includeAssignee = Boolean(assigneeHref);
  let includeStatus = Boolean(params.task.status);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const updated = await openProjectRequest<OpenProjectWorkPackage>(
        `/api/v3/work_packages/${params.existing.id}`,
        {
          method: 'PATCH',
          body: {
            lockVersion: params.existing.lockVersion,
            ...buildTaskBody({
              task: params.task,
              context: params.context,
              type: params.type,
              openProjectStatuses: params.openProjectStatuses,
              priorities: params.priorities,
              includeStatus,
              assigneeHref: includeAssignee ? assigneeHref : undefined,
              categoryHref: params.categoryHref,
            }),
          },
        }
      );

      if (includeAssignee && assigneeHref) {
        params.summary.assigneesMapped += 1;
      }

      return updated;
    } catch (error) {
      if (includeStatus && isInvalidStatusTransitionError(error)) {
        includeStatus = false;
        params.summary.statusTransitionsSkipped += 1;
        params.summary.warnings.push(
          `status skipped while updating ${params.task.name} (${params.task.id}) because OpenProject rejected the imported ClickUp status`
        );
        continue;
      }

      if (includeAssignee && isAssigneeMappingError(error)) {
        includeAssignee = false;
        params.summary.assigneeRejectedByOpenProject += 1;
        params.summary.assigneeMappingErrors.push(
          `task ${params.task.id}: OpenProject rejected assignee update: ${openProjectErrorMessage(error)}`
        );
        params.summary.warnings.push(
          `task ${params.task.name} (${params.task.id}): assignee update skipped because OpenProject rejected it`
        );
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Could not update work package for ClickUp task ${params.task.id}`);
}

const clickUpNoisyTagPatterns = [
  /^cl-[a-z0-9]+-\d+/i,
  /^clickup.?import$/i,
  /^clickup$/i,
  /^imported$/i,
];

/** Best-effort color palette for ClickUp tag names stored in local DB */
/** Accumulated during seed: OP work package ID → meaningful ClickUp tag names */
const _seedTagCollector = new Map<string, string[]>();

function collectTagsForWP(wpId: string, tags: ClickUpTag[]): void {
  const meaningful = tags.filter(
    (t) => t.name && !clickUpNoisyTagPatterns.some((p) => p.test(t.name.trim()))
  );
  if (!meaningful.length) return;
  const existing = _seedTagCollector.get(wpId) || [];
  for (const t of meaningful) {
    const name = t.name.trim();
    if (!existing.includes(name)) existing.push(name);
  }
  _seedTagCollector.set(wpId, existing);
}

async function getProjectCategories(projectId: number): Promise<OpenProjectCategory[]> {
  const page = await openProjectRequest<HalCollection<OpenProjectCategory>>(
    `/api/v3/projects/${projectId}/categories`,
    { query: { pageSize: 200 } }
  ).catch(() => ({ _embedded: { elements: [] as OpenProjectCategory[] } }));
  return page._embedded?.elements || [];
}

async function ensureOpenProjectCategory(
  projectId: number,
  tagName: string,
  cache: CategoryCache,
  summary: Summary
): Promise<string | undefined> {
  const name = tagName.trim().replace(/\s+/g, ' ');
  const normalizedName = name.toLowerCase();
  const cacheKey = `${projectId}:${normalizedName}`;

  if (cache.has(cacheKey)) {
    summary.categoriesReused += 1;
    return cache.get(cacheKey);
  }

  try {
    const created = await openProjectRequest<OpenProjectCategory>(
      `/api/v3/projects/${projectId}/categories`,
      { method: 'POST', body: { name } }
    );
    const href = created._links.self.href;
    cache.set(cacheKey, href);
    summary.categoriesCreated += 1;
    return href;
  } catch (error) {
    // 422 likely means the category already exists; re-fetch to reconcile
    const existing = await getProjectCategories(projectId).catch(() => []);
    const found = existing.find((c) => c.name.toLowerCase() === normalizedName);
    if (found) {
      const href = found._links.self.href;
      cache.set(cacheKey, href);
      summary.categoriesReused += 1;
      return href;
    }
    // 404 = project has no "Work package tracking" module enabled — skip silently.
    // Tags are synced via the custom field; categories are a fallback only.
    const msg = (error as Error).message || '';
    if (!msg.includes('404') && !msg.toLowerCase().includes('not found')) {
      summary.warnings.push(`Could not create category "${name}" in project ${projectId}: ${msg}`);
    }
    return undefined;
  }
}

async function initializeProjectCategoryCache(
  projectId: number,
  cache: CategoryCache
): Promise<void> {
  const categories = await getProjectCategories(projectId);
  for (const cat of categories) {
    const key = `${projectId}:${cat.name.toLowerCase()}`;
    if (!cache.has(key)) {
      cache.set(key, cat._links.self.href);
    }
  }
}

async function resolveTagCategoryHref(
  projectId: number,
  tags: ClickUpTag[],
  cache: CategoryCache,
  summary: Summary
): Promise<string | undefined> {
  const meaningful = tags.filter(
    (t) => t.name && !clickUpNoisyTagPatterns.some((p) => p.test(t.name.trim()))
  );
  if (!meaningful.length) return undefined;

  // Ensure all tag categories exist in the project; return the first href for WP assignment
  const hrefs = await Promise.all(
    meaningful.map((t) => ensureOpenProjectCategory(projectId, t.name, cache, summary))
  );
  return hrefs.find(Boolean);
}

async function syncClickUpTasksIntoProject(params: {
  context: ClickUpTaskContext;
  project: OpenProjectProject;
  openProjectStatuses: OpenProjectStatus[];
  priorities: OpenProjectPriority[];
  summary: Summary;
  userSync: UserSyncContext;
  openProjectUserSync: OpenProjectUserSyncContext;
  workspaceId: string;
  categoryCache: CategoryCache;
}) {
  const [existingWorkPackages, type, allClickUpTasks] = await Promise.all([
    getProjectWorkPackages(params.project.id).catch(() => []),
    firstTaskType(params.project.id),
    getClickUpTasks(params.context.list.id),
    initializeProjectCategoryCache(params.project.id, params.categoryCache),
  ]);

  // ClickUp returns subtasks that belong to *other* lists when subtasks=true.
  // Only process tasks that actually live in this list to avoid cross-contamination.
  const clickUpTasks = allClickUpTasks.filter(
    (task) => !task.list || task.list.id === params.context.list.id
  );

  const { byClickUpTaskId } = indexExistingWorkPackages(existingWorkPackages);

  for (const task of clickUpTasks) {
    recordUnsupportedClickUpTaskData(task, params.summary);
    const assigneeGrants = taskAssigneePermissionGrants(task, params.summary);
    await syncPermissionGrantUsersIntoLocalWorkspace(
      assigneeGrants,
      params.userSync,
      params.openProjectUserSync
    );
    await applyOpenProjectMemberships(params.project, assigneeGrants, params.openProjectUserSync);

    const existing = byClickUpTaskId.get(task.id);

    try {
      const categoryHref = task.tags?.length
        ? await resolveTagCategoryHref(
            params.project.id,
            task.tags,
            params.categoryCache,
            params.summary
          ).catch((error) => {
            params.summary.warnings.push(
              `tags skipped for ${task.name} (${task.id}): ${(error as Error).message}`
            );
            return undefined;
          })
        : undefined;

      if (task.tags?.length) {
        params.summary.clickUpTagsSeen += task.tags.length;
      }

      if (existing) {
        const updated = await updateOpenProjectWorkPackage({
          existing,
          task,
          context: params.context,
          type,
          openProjectStatuses: params.openProjectStatuses,
          priorities: params.priorities,
          summary: params.summary,
          openProjectUserSync: params.openProjectUserSync,
          categoryHref,
        });

        byClickUpTaskId.set(task.id, updated);
        params.summary.tasksUpdated += 1;
        if (task.tags?.length) {
          collectTagsForWP(String(updated.id), task.tags);
        }
      } else {
        const created = await createOpenProjectWorkPackage({
          project: params.project,
          task,
          context: params.context,
          type,
          openProjectStatuses: params.openProjectStatuses,
          priorities: params.priorities,
          summary: params.summary,
          openProjectUserSync: params.openProjectUserSync,
          categoryHref,
        });

        byClickUpTaskId.set(task.id, created);
        params.summary.tasksCreated += 1;
        if (task.tags?.length) {
          collectTagsForWP(String(created.id), task.tags);
        }
      }
    } catch (error) {
      params.summary.errors.push(
        `task ${task.name} (${task.id}) in ${originalClickUpPath(params.context)}: ${
          (error as Error).message
        }`
      );
    }
  }

  // Second pass: set parent work-package links for ClickUp subtasks
  for (const task of clickUpTasks) {
    if (!task.parent) continue;
    const childWp = byClickUpTaskId.get(task.id);
    const parentWp = byClickUpTaskId.get(task.parent);
    if (!childWp || !parentWp) continue;
    const currentParentId = String((childWp as any)._links?.parent?.href ?? '')
      .split('/')
      .at(-1);
    if (currentParentId === String(parentWp.id)) continue;
    try {
      // Re-fetch to get fresh lockVersion
      const fresh = await openProjectRequest<OpenProjectWorkPackage>(
        `/api/v3/work_packages/${childWp.id}`
      );
      await openProjectRequest(`/api/v3/work_packages/${childWp.id}`, {
        method: 'PATCH',
        body: {
          lockVersion: fresh.lockVersion,
          _links: { parent: { href: `/api/v3/work_packages/${parentWp.id}` } },
        },
      });
    } catch (error) {
      params.summary.warnings.push(
        `parent link skipped for ${task.name} (${task.id}): ${(error as Error).message}`
      );
    }
  }
}

function createSeededSpace(space: ClickUpSpace): SeededWorkspace['spaces'][number] {
  return {
    id: space.id,
    clickupSpaceId: space.id,
    workspaceId: 'openproject',
    name: space.name,
    description: undefined,
    color: space.color || '#4c6ef5',
    initials: space.name.slice(0, 1).toUpperCase(),
    locked: Boolean(space.private),
    permissions: seededPermissions(),
    folders: [],
    documents: [],
  };
}

function createSeededFolder(params: {
  spaceId: string;
  folderId: string;
  clickupFolderId?: string;
  name: string;
  locked?: boolean;
  kind?: string;
}): SeededWorkspace['spaces'][number]['folders'][number] {
  return {
    id: params.folderId,
    clickupFolderId: params.clickupFolderId,
    spaceId: params.spaceId,
    name: params.name,
    kind: (params.kind || 'TEAM') as SeededWorkspace['spaces'][number]['folders'][number]['kind'],
    locked: Boolean(params.locked),
    taskLists: [],
  };
}

function createSeededTaskList(params: {
  project: OpenProjectProject;
  list: ClickUpList;
  folderId: string;
  statuses: ReturnType<typeof seededStatusesFromOpenProject>;
  space: ClickUpSpace;
  folder?: ClickUpFolder | null;
}) {
  return {
    id: `${params.project.id}:${params.list.id}`,
    clickupListId: params.list.id,
    openProjectProjectId: String(params.project.id),
    folderId: params.folderId,
    name: params.list.name,
    icon: '✓',
    importFilter: {
      spaceName: params.space.name,
      folderName: params.folder?.name,
      listName: params.list.name,
      clickUpSpaceId: params.space.id,
      clickUpFolderId: params.folder?.id,
      clickUpListId: params.list.id,
    },
    statuses: params.statuses,
    _count: { tasks: Number(params.list.task_count || 0) },
  };
}

async function seedFolderedLists(params: {
  space: ClickUpSpace;
  seededSpace: SeededWorkspace['spaces'][number];
  folder: ClickUpFolder;
  lists: ClickUpList[];
  spaceProject: OpenProjectProject | null;
  inheritedGrants: PermissionGrant[];
  projects: OpenProjectProject[];
  openProjectStatuses: OpenProjectStatus[];
  openProjectPriorities: OpenProjectPriority[];
  summary: Summary;
  userSync: UserSyncContext;
  openProjectUserSync: OpenProjectUserSyncContext;
  isSharedRoadmap?: boolean;
  workspaceId: string;
  categoryCache: CategoryCache;
}) {
  const folderProject = await ensureOpenProjectProject(
    {
      identifier: identifierFor('folder', params.folder.id),
      name: params.folder.name,
      parentProjectId: params.spaceProject?.id,
    },
    params.projects,
    params.summary,
    'folders'
  ).catch((error) => {
    params.summary.errors.push(`folder project ${params.folder.name}: ${(error as Error).message}`);
    return null;
  });

  if (params.folder.hidden) {
    const hasExplicitFolderGrants = params.inheritedGrants.some(
      (grant) => grant.source === 'folderMembers'
    );

    if (!hasExplicitFolderGrants) {
      params.summary.permissionWarnings.push(
        `folder ${params.folder.name}: ClickUp folder explicit access was not available from the current API response; inherited permissions were applied`
      );
    }
  }

  await syncPermissionGrantUsersIntoLocalWorkspace(
    params.inheritedGrants,
    params.userSync,
    params.openProjectUserSync
  );
  await applyOpenProjectMemberships(
    folderProject,
    params.inheritedGrants,
    params.openProjectUserSync,
    {
      sharedRoadmap: params.isSharedRoadmap,
    }
  );

  const seededFolder = createSeededFolder({
    spaceId: params.seededSpace.id,
    folderId: params.folder.id,
    clickupFolderId: params.folder.id,
    name: params.folder.name,
    locked: params.folder.hidden,
    kind: 'TEAM',
  });

  // If folder has exactly one list, skip the extra list-level project and use
  // the folder project directly — avoids Art Department → Artists Team → Art Task nesting.
  const flattenIntoFolder = params.lists.length === 1 && folderProject !== null;

  for (const list of params.lists) {
    const listGrants = await getClickUpListMembers(list.id, params.summary);
    const effectiveGrants = [...params.inheritedGrants, ...listGrants];

    let project: OpenProjectProject | null;

    if (flattenIntoFolder) {
      // Reuse the folder-level project as the task container
      project = folderProject;
      await syncPermissionGrantUsersIntoLocalWorkspace(
        effectiveGrants,
        params.userSync,
        params.openProjectUserSync
      );
      await applyOpenProjectMemberships(project, effectiveGrants, params.openProjectUserSync, {
        sharedRoadmap: params.isSharedRoadmap,
      });
    } else {
      project = await ensureOpenProjectProject(
        {
          identifier: identifierFor('list', list.id),
          name: list.name,
          parentProjectId: folderProject?.id || params.spaceProject?.id,
        },
        params.projects,
        params.summary,
        'lists'
      ).catch((error) => {
        params.summary.errors.push(`list project ${list.name}: ${(error as Error).message}`);
        return null;
      });

      if (!project) {
        continue;
      }

      await syncPermissionGrantUsersIntoLocalWorkspace(
        effectiveGrants,
        params.userSync,
        params.openProjectUserSync
      );
      await applyOpenProjectMemberships(project, effectiveGrants, params.openProjectUserSync, {
        sharedRoadmap: params.isSharedRoadmap,
      });
    }

    const context: ClickUpTaskContext = {
      space: params.space,
      folder: params.folder,
      list,
    };

    await syncClickUpTasksIntoProject({
      context,
      project,
      openProjectStatuses: params.openProjectStatuses,
      priorities: params.openProjectPriorities,
      summary: params.summary,
      userSync: params.userSync,
      openProjectUserSync: params.openProjectUserSync,
      workspaceId: params.workspaceId,
      categoryCache: params.categoryCache,
    });

    const taskListId = `${project.id}:${list.id}`;
    const statuses = seededStatusesFromOpenProject({
      openProjectStatuses: params.openProjectStatuses,
      taskListId,
    });

    params.summary.statuses += statuses.length;

    seededFolder.taskLists.push(
      createSeededTaskList({
        project,
        list,
        folderId: seededFolder.id,
        statuses,
        space: params.space,
        folder: params.folder,
      })
    );

    params.summary.lists += 1;
  }

  params.seededSpace.folders.push(seededFolder);
}

async function seedFolderlessLists(params: {
  space: ClickUpSpace;
  seededSpace: SeededWorkspace['spaces'][number];
  lists: ClickUpList[];
  spaceProject: OpenProjectProject | null;
  inheritedGrants: PermissionGrant[];
  projects: OpenProjectProject[];
  openProjectStatuses: OpenProjectStatus[];
  openProjectPriorities: OpenProjectPriority[];
  summary: Summary;
  userSync: UserSyncContext;
  openProjectUserSync: OpenProjectUserSyncContext;
  isSharedRoadmap?: boolean;
  workspaceId: string;
  categoryCache: CategoryCache;
}) {
  for (const list of params.lists) {
    const project = await ensureOpenProjectProject(
      {
        identifier: identifierFor('list', list.id),
        name: list.name,
        parentProjectId: params.spaceProject?.id,
      },
      params.projects,
      params.summary,
      'lists'
    ).catch((error) => {
      params.summary.errors.push(
        `folderless list project ${list.name}: ${(error as Error).message}`
      );
      return null;
    });

    if (!project) {
      continue;
    }

    const listGrants = await getClickUpListMembers(list.id, params.summary);
    const effectiveGrants = [...params.inheritedGrants, ...listGrants];
    await syncPermissionGrantUsersIntoLocalWorkspace(
      effectiveGrants,
      params.userSync,
      params.openProjectUserSync
    );
    await applyOpenProjectMemberships(project, effectiveGrants, params.openProjectUserSync, {
      sharedRoadmap: params.isSharedRoadmap,
    });

    const seededListFolder = createSeededFolder({
      spaceId: params.seededSpace.id,
      folderId: list.id,
      clickupFolderId: undefined,
      name: list.name,
      locked: false,
      kind: 'LIST',
    });

    const context: ClickUpTaskContext = {
      space: params.space,
      folder: null,
      list,
    };

    await syncClickUpTasksIntoProject({
      context,
      project,
      openProjectStatuses: params.openProjectStatuses,
      priorities: params.openProjectPriorities,
      summary: params.summary,
      userSync: params.userSync,
      openProjectUserSync: params.openProjectUserSync,
      workspaceId: params.workspaceId,
      categoryCache: params.categoryCache,
    });

    const taskListId = `${project.id}:${list.id}`;
    const statuses = seededStatusesFromOpenProject({
      openProjectStatuses: params.openProjectStatuses,
      taskListId,
    });

    params.summary.statuses += statuses.length;

    seededListFolder.taskLists.push(
      createSeededTaskList({
        project,
        list,
        folderId: seededListFolder.id,
        statuses,
        space: params.space,
        folder: null,
      })
    );

    params.seededSpace.folders.push(seededListFolder);
    params.summary.lists += 1;
  }
}

function addRecoveredList(params: {
  workspace: SeededWorkspace;
  spaceMap: Map<string, SeededWorkspace['spaces'][number]>;
  folderMap: Map<string, SeededWorkspace['spaces'][number]['folders'][number]>;
  listCounts: Map<string, number>;
  project: OpenProjectProject;
  meta: ImportedMeta;
  openProjectStatuses: OpenProjectStatus[];
}) {
  if (!params.meta.clickUpSpaceName || !params.meta.clickUpListName) {
    return false;
  }

  const spaceKey = params.meta.clickUpSpaceId || slug(params.meta.clickUpSpaceName);
  const listKey = params.meta.clickUpListId || slug(params.meta.clickUpListName);
  const folderKey = params.meta.clickUpFolderId || undefined;
  const listCountKey = `${params.project.id}:${spaceKey}:${folderKey || 'folderless'}:${listKey}`;

  params.listCounts.set(listCountKey, (params.listCounts.get(listCountKey) || 0) + 1);

  let space = params.spaceMap.get(spaceKey);

  if (!space) {
    space = {
      id: spaceKey,
      clickupSpaceId: spaceKey,
      workspaceId: params.workspace.id,
      name: params.meta.clickUpSpaceName,
      color: '#4c6ef5',
      initials: params.meta.clickUpSpaceName.slice(0, 1).toUpperCase(),
      locked: false,
      permissions: seededPermissions(),
      folders: [],
      documents: [],
    };

    params.spaceMap.set(spaceKey, space);
    params.workspace.spaces.push(space);
  }

  const folderId = folderKey || slug(params.meta.clickUpFolderName ?? params.meta.clickUpListName);

  let folder = params.folderMap.get(folderId);

  if (!folder) {
    folder = {
      id: folderId,
      clickupFolderId: params.meta.clickUpFolderId,
      spaceId: space.id,
      name: params.meta.clickUpFolderName || params.meta.clickUpListName,
      kind: (params.meta.clickUpFolderName
        ? 'TEAM'
        : 'LIST') as SeededWorkspace['spaces'][number]['folders'][number]['kind'],
      locked: false,
      taskLists: [],
    };

    params.folderMap.set(folderId, folder);
    space.folders.push(folder);
  }

  const taskListId = `${params.project.id}:${listKey}`;

  if (!folder.taskLists.some((list) => list.id === taskListId)) {
    folder.taskLists.push({
      id: taskListId,
      clickupListId: listKey,
      openProjectProjectId: String(params.project.id),
      importFilter: {
        spaceName: params.meta.clickUpSpaceName,
        folderName: params.meta.clickUpFolderName,
        listName: params.meta.clickUpListName,
        clickUpSpaceId: params.meta.clickUpSpaceId,
        clickUpFolderId: params.meta.clickUpFolderId,
        clickUpListId: params.meta.clickUpListId,
        originalClickUpPath: params.meta.originalClickUpPath,
      },
      folderId: folder.id,
      name: params.meta.clickUpListName,
      icon: '✓',
      statuses: seededStatusesFromOpenProject({
        openProjectStatuses: params.openProjectStatuses,
        taskListId,
      }),
      _count: { tasks: params.listCounts.get(listCountKey) || 0 },
    });
  }

  return true;
}

async function seedFromOpenProjectImportedDescriptions(
  projects: OpenProjectProject[],
  openProjectStatuses: OpenProjectStatus[],
  summary: Summary
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
  const folderMap = new Map<string, SeededWorkspace['spaces'][number]['folders'][number]>();
  const listCounts = new Map<string, number>();

  for (const project of projects) {
    const workPackages = await getProjectWorkPackages(project.id).catch((error) => {
      summary.warnings.push(
        `fallback: cannot read project ${project.name}: ${(error as Error).message}`
      );
      return [];
    });

    for (const workPackage of workPackages) {
      const meta = importedMeta(workPackage.description?.raw || '');

      if (!meta) {
        summary.fallbackSkippedTasks += 1;
        continue;
      }

      const recovered = addRecoveredList({
        workspace,
        spaceMap,
        folderMap,
        listCounts,
        project,
        meta,
        openProjectStatuses,
      });

      if (recovered) {
        summary.fallbackRecoveredTasks += 1;
      } else {
        summary.fallbackSkippedTasks += 1;
        summary.warnings.push(
          `fallback: cannot recover ${workPackage.subject} (${workPackage.id}) because space/list metadata is missing`
        );
      }
    }
  }

  for (const space of workspace.spaces) {
    for (const folder of space.folders) {
      for (const list of folder.taskLists) {
        const listKey = `${list.openProjectProjectId}:${
          list.importFilter?.clickUpSpaceId || slug(list.importFilter?.spaceName || space.name)
        }:${list.importFilter?.clickUpFolderId || 'folderless'}:${
          list.importFilter?.clickUpListId || slug(list.importFilter?.listName || list.name)
        }`;

        list._count = { tasks: listCounts.get(listKey) || 0 };
      }
    }
  }

  return workspace;
}

async function writeSeededHierarchy(workspace: SeededWorkspace) {
  const path = seededHierarchyPath();

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(workspace, null, 2)}\n`);

  return path;
}

function addUnsupportedFeatureWarnings(summary: Summary) {
  const unsupported = [
    ['ClickUp custom fields', summary.clickUpCustomFieldsSeen],
    ['ClickUp dependencies/linked tasks', summary.clickUpDependenciesSeen],
    ['ClickUp attachments', summary.clickUpAttachmentsSeen],
    ['ClickUp comments', summary.clickUpCommentsSeen],
    ['ClickUp time entries/estimates', summary.clickUpTimeEntriesSeen],
  ] as const;

  unsupported.forEach(([label, count]) => {
    if (count > 0) {
      summary.warnings.push(
        `${label} were present (${count}) but were not imported yet; OpenProject runtime support exists where applicable, migration mapping is pending.`
      );
    }
  });
}

/**
 * After all work packages are imported, push tag values to the OpenProject
 * "Tags" custom field using our local DB as the source of truth.
 *
 * This runs via `docker exec rails runner` to avoid the complexity of
 * managing custom option hrefs via the REST API.
 */
async function syncTagsCFViaRails(
  /** Map of OP work package ID (string) → tag names */
  tagsByWpId: Map<string, string[]>,
  containerName = process.env.OPENPROJECT_CONTAINER || 'openproject-web-1'
): Promise<void> {
  // Fetch CF ID from DB
  const cfId = process.env.OPENPROJECT_TAGS_CF_ID
    ? Number(process.env.OPENPROJECT_TAGS_CF_ID)
    : null;

  if (!cfId) {
    console.warn(
      '  ⚠ OPENPROJECT_TAGS_CF_ID not set — run setup:openproject first. Skipping CF sync.'
    );
    return;
  }

  const byWP = tagsByWpId;

  if (!byWP.size) {
    console.log('  ✓ No tags to sync to OP custom field');
    return;
  }

  // Encode data as base64 to avoid Ruby parsing issues with inline JSON
  const encodedData = Buffer.from(JSON.stringify(Array.from(byWP.entries()))).toString('base64');

  const railsScript = `
require 'base64'
require 'json'

cf = WorkPackageCustomField.find_by(id: ${cfId})
unless cf
  puts "CF_NOT_FOUND"
  exit
end

synced = 0
errors = 0

data = JSON.parse(Base64.decode64(${JSON.stringify(encodedData)}))

data.each do |wp_id, tag_names|
  begin
    wp = WorkPackage.find_by(id: wp_id)
    next unless wp

    options = tag_names.map do |name|
      cf.custom_options.find_or_create_by!(value: name)
    end

    wp.custom_field_values = { cf.id => options.map(&:id) }
    wp.save(validate: false)

    synced += 1
  rescue => e
    errors += 1
    puts "WP_ERROR:#{wp_id}:#{e.message[0..80]}"
  end
end

puts "CF_SYNC_DONE:synced=#{synced},errors=#{errors}"
`;

  console.log(`  → Syncing tags to OP custom field ${cfId} for ${byWP.size} work packages…`);

  try {
    const out = execSync(`docker exec -i ${containerName} bundle exec rails runner -`, {
      input: railsScript,
      timeout: 300_000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (out.includes('CF_NOT_FOUND')) {
      console.warn(`  ⚠ Tags CF id=${cfId} not found in OpenProject — re-run setup:openproject`);
      return;
    }

    const doneMatch = out.match(/CF_SYNC_DONE:synced=(\d+),errors=(\d+)/);
    if (doneMatch) {
      console.log(`  ✓ CF sync: ${doneMatch[1]} work packages updated, ${doneMatch[2]} errors`);
    }
  } catch (error: any) {
    const msg = (error?.stderr || error?.stdout || error?.message || String(error)).slice(0, 300);
    console.warn(`  ⚠ CF sync failed: ${msg}`);
  }
}

// ── ClickUp docs import ───────────────────────────────────────────────────────

async function getClickUpSpaceDocs(teamId: string, spaceId: string): Promise<ClickUpDoc[]> {
  try {
    const result = await clickUpRequest<{ docs?: ClickUpDoc[] }>(`/team/${teamId}/doc`, {
      query: { parent_id: spaceId, parent_type: 4 },
    });
    return result.docs || [];
  } catch {
    return [];
  }
}

async function getClickUpDocPages(docId: string, teamId: string): Promise<ClickUpDocPage[]> {
  try {
    // Use v3 API with content_format=text/md to get proper markdown content
    const url = `https://api.clickup.com/api/v3/workspaces/${teamId}/docs/${docId}/pages?content_format=text%2Fmd`;
    const token = process.env.CLICKUP_TOKEN;
    const res = await fetch(url, { headers: { Authorization: token! } });
    if (!res.ok) return [];
    const data = (await res.json()) as ClickUpDocPage[] | { pages?: ClickUpDocPage[] };
    return Array.isArray(data) ? data : data.pages || [];
  } catch {
    return [];
  }
}

function flattenDocPages(pages: ClickUpDocPage[]): ClickUpDocPage[] {
  const result: ClickUpDocPage[] = [];
  for (const page of pages) {
    result.push(page);
    const children = page.pages || page.sub_pages || [];
    if (children.length) result.push(...flattenDocPages(children));
  }
  return result;
}

function buildDocMarkdown(_docName: string, pages: ClickUpDocPage[]): string {
  const flat = flattenDocPages(pages);
  const lines: string[] = [];
  for (const page of flat) {
    // Page name is the content heading (h1 for first, h2 for subsequent pages)
    if (page.name) {
      const level = lines.length === 0 ? '#' : '##';
      lines.push(`${level} ${page.name}`, '');
    }
    // v3 API returns content in `content` field (proper markdown)
    const body = (page.content || page.text_content || '').trim();
    if (body) {
      lines.push(body, '');
    }
  }
  return lines.join('\n').trim();
}

async function importSpaceDocs(
  teamId: string,
  spaceId: string,
  opSpaceProjectId: string,
  opDocTypeId: string | null,
  summary: Summary
): Promise<void> {
  const clickUpDocs = await getClickUpSpaceDocs(teamId, spaceId);
  if (clickUpDocs.length === 0) return;

  // Find or create the "Docs" child project under the space
  const allProjects = await openProjectRequest<{
    _embedded?: {
      elements?: { id: number; name: string; _links: Record<string, { href?: string }> }[];
    };
  }>('/api/v3/projects', { query: { pageSize: 500 } });
  const linkTailFn = (href?: string | null) => href?.split('/').filter(Boolean).at(-1);
  const existing = (allProjects._embedded?.elements || []).find(
    (p) =>
      linkTailFn(p._links.parent?.href) === String(opSpaceProjectId) &&
      p.name.toLowerCase() === 'docs'
  );

  let docsProjectId: string;
  if (existing) {
    docsProjectId = String(existing.id);
  } else {
    let parentIdentifier = `p${opSpaceProjectId}`;
    try {
      const parent = await openProjectRequest<{ identifier?: string }>(
        `/api/v3/projects/${opSpaceProjectId}`
      );
      parentIdentifier = parent.identifier || parentIdentifier;
    } catch {
      /* ignore */
    }

    const baseId = parentIdentifier
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^[^a-z]+/, 'p')
      .slice(0, 93);

    try {
      const created = await openProjectRequest<{ id: number }>('/api/v3/projects', {
        method: 'POST',
        body: {
          name: 'Docs',
          identifier: `${baseId}-docs`,
          _links: { parent: { href: `/api/v3/projects/${opSpaceProjectId}` } },
        },
      });
      docsProjectId = String(created.id);
    } catch (error) {
      summary.errors.push(
        `Could not create Docs project for space ${opSpaceProjectId}: ${(error as Error).message}`
      );
      return;
    }
  }

  for (const doc of clickUpDocs) {
    const title = doc.name || doc.title || 'Untitled';
    const pages = await getClickUpDocPages(doc.id, teamId);
    const markdown = buildDocMarkdown(title, pages);

    const body: Record<string, unknown> = {
      subject: title,
      description: { format: 'markdown', raw: markdown },
      _links: {
        project: { href: `/api/v3/projects/${docsProjectId}` },
        ...(opDocTypeId ? { type: { href: `/api/v3/types/${opDocTypeId}` } } : {}),
      },
    };

    try {
      await openProjectRequest('/api/v3/work_packages', { method: 'POST', body });
      summary.docsImported += 1;
    } catch (error) {
      summary.docsSkipped += 1;
      summary.errors.push(`doc "${title}": ${(error as Error).message}`);
    }
  }

  console.log(`  → Docs: imported ${summary.docsImported} into space ${opSpaceProjectId}`);
}

async function getOpDocumentationTypeId(): Promise<string | null> {
  try {
    const page = await openProjectRequest<{
      _embedded?: { elements?: { id: number; name: string }[] };
    }>('/api/v3/types', { query: { pageSize: 200 } });
    const found = (page._embedded?.elements || []).find(
      (t) => t.name.toLowerCase() === 'documentation'
    );
    return found ? String(found.id) : null;
  } catch {
    return null;
  }
}

async function main() {
  const summary: Summary = {
    teams: 0,
    spaces: 0,
    folders: 0,
    lists: 0,
    statuses: 0,
    clickUpUsersSeen: 0,
    clickUpWorkspaceMembersSeen: 0,
    clickUpSpaceMembersSeen: 0,
    clickUpFolderMembersSeen: 0,
    clickUpListMembersSeen: 0,
    clickUpTaskAssigneesSeen: 0,
    localUsersCreated: 0,
    localUsersReused: 0,
    localUsersUpdated: 0,
    localMembershipsCreated: 0,
    openProjectUsersCreated: 0,
    openProjectUsersReused: 0,
    openProjectUsersUpdated: 0,
    openProjectUserErrors: [],
    openProjectMembershipsCreated: 0,
    openProjectMembershipsReused: 0,
    openProjectMembershipsUpdated: 0,
    openProjectMembershipErrors: [],
    permissionSourcesUsed: {
      teamMembers: false,
      spaceMembers: false,
      folderMembers: false,
      listMembers: false,
      taskAssignees: false,
    },
    permissionWarnings: [],
    openProjectProjectsCreated: 0,
    openProjectProjectsReused: 0,
    openProjectProjectHierarchy: { spaces: 0, folders: 0, lists: 0 },
    tasksCreated: 0,
    tasksUpdated: 0,
    tasksSkipped: 0,
    statusTransitionsSkipped: 0,
    clickUpCustomFieldsSeen: 0,
    clickUpDependenciesSeen: 0,
    clickUpTagsSeen: 0,
    clickUpAttachmentsSeen: 0,
    clickUpCommentsSeen: 0,
    clickUpTimeEntriesSeen: 0,
    assigneesMapped: 0,
    assigneeMappingErrors: [],
    assigneeRejectedByOpenProject: 0,
    fallbackRecoveredTasks: 0,
    fallbackSkippedTasks: 0,
    openProjectGroupsCreated: 0,
    openProjectGroupsReused: 0,
    openProjectGroupErrors: [],
    categoriesCreated: 0,
    categoriesReused: 0,
    docsImported: 0,
    docsSkipped: 0,
    errors: [],
    warnings: [],
  };

  const categoryCache: CategoryCache = new Map();

  // Ensure at least one active project exists before fetching global endpoints.
  // statuses, priorities, and roles all require view_work_packages in at least
  // one active project in some OpenProject versions — even for admin tokens.
  // We keep the placeholder alive until after all global fetches complete.
  const bootstrapProjectId = await activateArchivedProjectForBootstrap();

  const rawOpenProjectStatuses = await getOpenProjectStatuses();
  const openProjectStatuses = await ensureRequiredStatuses(rawOpenProjectStatuses);
  await ensureOpenProjectWorkflowTransitions(openProjectStatuses, summary);
  const openProjectPriorities = await getOpenProjectPriorities().catch((error) => {
    summary.warnings.push(
      `cannot read OpenProject priorities (priorities will not be mapped): ${(error as Error).message}`
    );
    return [] as OpenProjectPriority[];
  });
  const projects = await getOpenProjectProjects();
  const [openProjectUsers, openProjectRoles, openProjectMemberships] = await Promise.all([
    getOpenProjectUsers().catch((error) => {
      summary.openProjectUserErrors.push(
        `cannot read OpenProject users: ${(error as Error).message}`
      );
      return [] as OpenProjectUser[];
    }),
    getOpenProjectRoles().catch((error) => {
      summary.openProjectMembershipErrors.push(
        `cannot read OpenProject roles: ${(error as Error).message}`
      );
      return [] as OpenProjectRole[];
    }),
    getOpenProjectMemberships().catch((error) => {
      summary.openProjectMembershipErrors.push(
        `cannot read OpenProject memberships: ${(error as Error).message}`
      );
      return [] as OpenProjectMembership[];
    }),
  ]);

  // All global fetches done — clean up bootstrap placeholder (real projects come next)
  if (bootstrapProjectId != null) void deleteSeedBootstrapPlaceholder(bootstrapProjectId);
  const localWorkspace = await ensureLocalRuntimeWorkspace();

  const userSync: UserSyncContext = {
    workspaceId: localWorkspace.id,
    seenClickUpUserKeys: new Set<string>(),
    summary,
  };
  // adminEmails is populated before user sync (once we have the team).
  // Start with the env-var override list; ClickUp role 1/2 is added after getClickUpTeams().
  const adminEmails = new Set<string>([...importedAdminEmails]);

  const openProjectUserSync: OpenProjectUserSyncContext = {
    users: openProjectUsers,
    roles: openProjectRoles,
    memberships: openProjectMemberships,
    clickUpUserToOpenProjectUser: new Map<string, OpenProjectUser>(),
    failedClickUpUserKeys: new Set<string>(),
    adminEmails,
    summary,
  };

  if (!process.env.CLICKUP_TOKEN) {
    const workspace = await seedFromOpenProjectImportedDescriptions(
      projects,
      openProjectStatuses,
      summary
    );

    const path = await writeSeededHierarchy(workspace);
    // migration run tracking removed

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
          fallbackRecoveredTasks: summary.fallbackRecoveredTasks,
          fallbackSkippedTasks: summary.fallbackSkippedTasks,
          localUsersCreated: summary.localUsersCreated,
          localUsersReused: summary.localUsersReused,
          localUsersUpdated: summary.localUsersUpdated,
          localMembershipsCreated: summary.localMembershipsCreated,
          hierarchyPath: path,
          warnings: [
            'CLICKUP_TOKEN is missing, so this restored spaces/folders/lists only from imported OpenProject task metadata.',
            'Run this seed once with CLICKUP_TOKEN to rebuild hierarchy from native ClickUp Space/Folder/List data and import ClickUp users.',
            ...summary.warnings,
          ],
          errors: summary.errors,
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

  if (!team) {
    throw new Error('ClickUp returned no teams/workspaces');
  }

  // Extend adminEmails with users who are owner/admin in ClickUp (role 1 or 2)
  for (const email of buildAdminEmailsFromTeam(team)) {
    adminEmails.add(email);
  }

  await syncClickUpTeamUsersIntoLocalWorkspace(team, userSync, openProjectUserSync);
  const workspaceGrants = teamPermissionGrants(team, summary);

  const spaces = await getClickUpSpaces(team.id);
  summary.spaces = spaces.length;

  const opDocTypeId = await getOpDocumentationTypeId();

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

    const spaceDetails = await getClickUpSpaceDetails(space.id, summary);
    const spaceForPermissions = spaceDetails || space;
    const explicitSpaceGrants = extractSpaceGrants(spaceForPermissions, summary);
    const spaceGrants = [...workspaceGrants, ...explicitSpaceGrants];

    if (space.private && explicitSpaceGrants.length === 0) {
      summary.permissionWarnings.push(
        `space ${space.name}: ClickUp space explicit access was not available from the current API response; workspace members were applied`
      );
    }

    const isSharedRoadmap = /roadmap/i.test(space.name);

    await syncPermissionGrantUsersIntoLocalWorkspace(spaceGrants, userSync, openProjectUserSync);
    await applyOpenProjectMemberships(spaceProject, spaceGrants, openProjectUserSync, {
      sharedRoadmap: isSharedRoadmap,
    });

    const folders = await getClickUpFolders(space.id).catch((error) => {
      summary.errors.push(`space ${space.name}: ${(error as Error).message}`);
      return [];
    });

    const folderlessLists = await getClickUpFolderlessLists(space.id).catch((error) => {
      summary.errors.push(`folderless ${space.name}: ${(error as Error).message}`);
      return [];
    });

    summary.folders += folders.length;

    const seededSpace = createSeededSpace(space);

    for (const folder of folders) {
      const lists = await getClickUpLists(folder.id).catch((error) => {
        summary.errors.push(`folder ${folder.name}: ${(error as Error).message}`);
        return [];
      });
      const folderDetails = await getClickUpFolderDetails(folder.id, summary);
      const folderForPermissions = folderDetails || folder;
      const explicitFolderGrants = extractFolderGrants(folderForPermissions, summary);
      const folderGrants = [...spaceGrants, ...explicitFolderGrants];

      await seedFolderedLists({
        space,
        seededSpace,
        folder,
        lists,
        spaceProject,
        inheritedGrants: folderGrants,
        projects,
        openProjectStatuses,
        openProjectPriorities,
        summary,
        userSync,
        openProjectUserSync,
        isSharedRoadmap,
        workspaceId: localWorkspace.id,
        categoryCache,
      });
    }

    await seedFolderlessLists({
      space,
      seededSpace,
      lists: folderlessLists,
      spaceProject,
      inheritedGrants: spaceGrants,
      projects,
      openProjectStatuses,
      openProjectPriorities,
      summary,
      userSync,
      openProjectUserSync,
      isSharedRoadmap,
      workspaceId: localWorkspace.id,
      categoryCache,
    });

    // Import ClickUp docs for this space into an OP "Docs" sub-project
    if (spaceProject) {
      console.log(`\n→ Importing docs for space "${space.name}"…`);
      await importSpaceDocs(team.id, space.id, String(spaceProject.id), opDocTypeId, summary).catch(
        (error) => {
          summary.warnings.push(`docs import for space ${space.name}: ${(error as Error).message}`);
        }
      );
    }

    workspace.spaces.push(seededSpace);
  }

  // Sync ClickUp user groups → OpenProject groups (+ auto-create "Leads" from admins)
  const clickUpGroups = await getClickUpGroups(team.id);
  await syncGroupsToOpenProject(
    clickUpGroups,
    adminEmails,
    openProjectUserSync.users,
    openProjectUserSync.clickUpUserToOpenProjectUser,
    summary
  );
  // Add every group as a project member on all active projects so they appear in assignee dropdowns
  await syncGroupProjectMemberships(
    openProjectUserSync.memberships,
    openProjectUserSync.roles,
    summary
  );

  const path = await writeSeededHierarchy(workspace);
  addUnsupportedFeatureWarnings(summary);
  await cleanupDefaultDemoProjects(summary);

  // Sync tags to OP custom field (requires setup:openproject to have run first)
  console.log('\n→ Syncing tags to OpenProject custom field…');
  await syncTagsCFViaRails(_seedTagCollector);
  // migration run tracking removed

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

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {});
}
