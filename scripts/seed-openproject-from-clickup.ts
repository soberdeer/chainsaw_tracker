import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { openProjectRequest } from '../server/openproject/client.js';
import { seededHierarchyPath, type SeededWorkspace } from '../server/openproject/hierarchyStore.js';
import type {
  HalCollection,
  HalLink,
  OpenProjectMembership,
  OpenProjectPriority,
  OpenProjectProject,
  OpenProjectRole,
  OpenProjectStatus,
  OpenProjectType,
  OpenProjectUser,
  OpenProjectWorkPackage,
} from '../server/openproject/types.js';
import type { PermissionSet, WorkspaceRole } from '../src/lib/types.js';
import { clickUpRequest } from './migration/clickup/client.js';
import type {
  ClickUpFolder,
  ClickUpList,
  ClickUpSpace,
  ClickUpStatus,
  ClickUpTask,
  ClickUpTeam,
} from './migration/clickup/types.js';
import {
  appendAdditionalAssigneesMeta,
  splitClickUpAssignees,
  type ClickUpAssigneeLike,
} from './migration/clickupAssignees.js';
import {
  clickUpPermissionFromRaw,
  extractFolderPermissionGrants,
  extractSpacePermissionGrants,
  isRoleAtLeast,
  pickOpenProjectRoleForClickUpPermission,
  type OpenProjectRoleLike,
  type ImportedPermissionLevel,
} from './migration/openprojectPermissions.js';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();

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
  responsibleMapped: number;
  additionalAssigneesStored: number;
  assigneeMappingErrors: string[];
  assigneeRejectedByOpenProject: number;
  assigneeFallbackStored: number;
  fallbackRecoveredTasks: number;
  fallbackSkippedTasks: number;
  errors: string[];
  warnings: string[];
};

const META_START = '<!-- chainsaw-clickup-import-meta -->';
const META_END = '<!-- /chainsaw-clickup-import-meta -->';

const importedUserDefaultPassword = process.env.CLICKUP_IMPORTED_USER_PASSWORD || 'clickup!2026';
const openProjectImportedUserPassword =
  process.env.OPENPROJECT_IMPORTED_USER_PASSWORD || 'Clickup!2026';

const importedAdminEmails = new Set(
  (process.env.OP_IMPORTED_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

const defaultOwnerPassword = process.env.DEV_ADMIN_PASSWORD || 'admin123';

const permissionSets: PermissionSet[] = [
  {
    role: 'OWNER',
    manageWorkspace: true,
    manageSpaces: true,
    manageDocs: true,
    manageTasks: true,
    inviteMembers: true,
  },
  {
    role: 'ADMIN',
    manageWorkspace: false,
    manageSpaces: true,
    manageDocs: true,
    manageTasks: true,
    inviteMembers: true,
  },
  {
    role: 'LEAD',
    manageWorkspace: false,
    manageSpaces: false,
    manageDocs: true,
    manageTasks: false,
    inviteMembers: false,
  },
  {
    role: 'MEMBER',
    manageWorkspace: false,
    manageSpaces: false,
    manageDocs: true,
    manageTasks: false,
    inviteMembers: false,
  },
  {
    role: 'VIEWER',
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

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64url');
  const hash = scryptSync(password, salt, 64).toString('base64url');

  return `${salt}:${hash}`;
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
  const lastName = (parts.slice(1).join(' ') || 'User').slice(0, 30);

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
  const mapped = splitClickUpAssignees(
    ((task as unknown as { assignees?: ClickUpAssigneeLike[] }).assignees ||
      []) as ClickUpAssigneeLike[]
  );

  const [assigneeUser, responsibleUser] = await Promise.all([
    mapped.assignee
      ? openProjectUserForClickUpUser(mapped.assignee, openProjectUserSync)
      : Promise.resolve(null),
    mapped.responsible
      ? openProjectUserForClickUpUser(mapped.responsible, openProjectUserSync)
      : Promise.resolve(null),
  ]);

  return {
    assignee: mapped.assignee,
    responsible: mapped.responsible,
    assigneeHref: openProjectUserHref(assigneeUser),
    responsibleHref:
      responsibleUser && responsibleUser.id !== assigneeUser?.id
        ? openProjectUserHref(responsibleUser)
        : undefined,
    additionalAssignees: mapped.additional,
  };
}

function assigneeFallbackUsers(input: {
  assignee?: ClickUpAssigneeLike;
  responsible?: ClickUpAssigneeLike;
  additionalAssignees: ClickUpAssigneeLike[];
}) {
  return [
    ...(input.assignee ? [input.assignee] : []),
    ...(input.responsible ? [input.responsible] : []),
    ...input.additionalAssignees,
  ];
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

  return undefined;
}

function priorityHref(priorities: OpenProjectPriority[], priority: ClickUpTask['priority']) {
  const name = priorityNameFromClickUp(priority);

  if (!name) {
    return undefined;
  }

  return priorities.find((item) => item.name.toLowerCase() === name.toLowerCase())?._links.self
    .href;
}

function mapStatusToOpenProjectId(status: ClickUpStatus, openProjectStatuses: OpenProjectStatus[]) {
  const name = status.status.toLowerCase();
  const exact = openProjectStatuses.find((item) => item.name.toLowerCase() === name);

  if (exact) {
    return String(exact.id);
  }

  if (status.type === 'closed' || status.type === 'done' || name.includes('ship')) {
    return String(
      openProjectStatuses.find((item) => item.isClosed)?.id ||
        openProjectStatuses.find((item) => item.name.toLowerCase() === 'closed')?.id ||
        openProjectStatuses[0]?.id
    );
  }

  if (name.includes('review') || name.includes('test')) {
    return String(
      openProjectStatuses.find((item) => item.name.toLowerCase().includes('testing'))?.id ||
        openProjectStatuses.find((item) => item.name.toLowerCase().includes('progress'))?.id ||
        openProjectStatuses[0]?.id
    );
  }

  if (name.includes('develop') || name.includes('progress')) {
    return String(
      openProjectStatuses.find((item) => item.name.toLowerCase().includes('progress'))?.id ||
        openProjectStatuses[0]?.id
    );
  }

  return String(openProjectStatuses.find((item) => item.name.toLowerCase() === 'new')?.id || 1);
}

function clickUpStatuses(
  list: ClickUpList,
  folder: ClickUpFolder | null,
  space: ClickUpSpace
): ClickUpStatus[] {
  return list.statuses?.length
    ? list.statuses
    : folder?.statuses?.length
      ? folder.statuses
      : space.statuses || [];
}

function seededPermissions() {
  return permissionSets.map((set) => ({
    role: set.role as WorkspaceRole,
    canView: true,
    canEdit: set.manageTasks,
    canManage: set.manageSpaces,
  }));
}

function seededStatuses(params: {
  statuses: ClickUpStatus[];
  openProjectStatuses: OpenProjectStatus[];
  taskListId: string;
}) {
  return params.statuses
    .map((status, index) => {
      const openProjectStatusId = mapStatusToOpenProjectId(status, params.openProjectStatuses);

      return {
        id: `op-status:${openProjectStatusId}:clickup-status:${statusSlug(status.status)}`,
        clickupStatusId: status.id,
        clickupStatusName: status.status,
        openProjectStatusId,
        taskListId: params.taskListId,
        name: status.status,
        color: status.color || '#868e96',
        position: Number(status.orderindex ?? index),
        isDone: status.type === 'closed' || status.type === 'done',
      };
    })
    .sort((a, b) => a.position - b.position);
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
      color: status.isClosed
        ? '#4d9f87'
        : status.name.toLowerCase().includes('progress')
          ? '#228be6'
          : '#868e96',
      position: Number(status.position || status.id),
      isDone: Boolean(status.isClosed),
    }))
    .sort((a, b) => a.position - b.position);
}

function isInvalidStatusTransitionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.toLowerCase().includes('status is invalid') &&
    message.toLowerCase().includes('no valid transition')
  );
}

async function ensureLocalRuntimeWorkspace() {
  const owner = await prisma.user.upsert({
    where: { email: 'owner@local.app' },
    update: {},
    create: {
      id: 'local-user',
      email: 'owner@local.app',
      name: 'Workspace Owner',
      passwordHash: hashPassword(defaultOwnerPassword),
    },
  });

  if (!owner.passwordHash) {
    await prisma.user.update({
      where: { id: owner.id },
      data: { passwordHash: hashPassword(defaultOwnerPassword) },
    });
  }

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'chainsaw' },
    update: {},
    create: {
      name: 'Chainsaw',
      slug: 'chainsaw',
    },
  });

  await Promise.all([
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'OWNER' } },
      create: {
        workspaceId: workspace.id,
        role: 'OWNER',
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: true,
        manageTasks: true,
        inviteMembers: true,
      },
      update: {
        manageWorkspace: true,
        manageSpaces: true,
        manageDocs: true,
        manageTasks: true,
        inviteMembers: true,
      },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'ADMIN' } },
      create: {
        workspaceId: workspace.id,
        role: 'ADMIN',
        manageSpaces: true,
        manageDocs: true,
        manageTasks: true,
        inviteMembers: true,
      },
      update: {
        manageSpaces: true,
        manageDocs: true,
        manageTasks: true,
        inviteMembers: true,
      },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'LEAD' } },
      create: {
        workspaceId: workspace.id,
        role: 'LEAD',
        manageDocs: true,
        manageTasks: false,
      },
      update: {
        manageDocs: true,
        manageTasks: false,
      },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'MEMBER' } },
      create: {
        workspaceId: workspace.id,
        role: 'MEMBER',
        manageDocs: true,
        manageTasks: false,
      },
      update: {
        manageDocs: true,
        manageTasks: false,
      },
    }),
    prisma.permissionSet.upsert({
      where: { workspaceId_role: { workspaceId: workspace.id, role: 'VIEWER' } },
      create: {
        workspaceId: workspace.id,
        role: 'VIEWER',
        manageTasks: false,
      },
      update: {
        manageTasks: false,
      },
    }),
  ]);

  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: owner.id, workspaceId: workspace.id } },
    update: { role: 'OWNER' },
    create: {
      userId: owner.id,
      workspaceId: workspace.id,
      role: 'OWNER',
    },
  });

  return workspace;
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

  const email = clickUpUserEmail(user);
  const name = clickUpUserName(user);

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  let localUser;

  if (existing) {
    const needsUpdate = existing.name !== name || !existing.passwordHash;

    localUser = needsUpdate
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            name,
            avatarUrl:
              existing.avatarUrl || user.profilePicture || user.profile_picture || undefined,
            source: existing.source || 'CLICKUP_IMPORTED',
            ...(existing.passwordHash
              ? {}
              : { passwordHash: hashPassword(importedUserDefaultPassword) }),
          },
        })
      : existing;

    if (needsUpdate) {
      context.summary.localUsersUpdated += 1;
    } else {
      context.summary.localUsersReused += 1;
    }
  } else {
    localUser = await prisma.user.create({
      data: {
        email,
        name,
        avatarUrl: user.profilePicture || user.profile_picture || undefined,
        source: 'CLICKUP_IMPORTED',
        passwordHash: hashPassword(importedUserDefaultPassword),
      },
    });

    context.summary.localUsersCreated += 1;
  }

  const existingMembership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: localUser.id,
        workspaceId: context.workspaceId,
      },
    },
  });

  if (!existingMembership) {
    await prisma.membership.create({
      data: {
        userId: localUser.id,
        workspaceId: context.workspaceId,
        role: 'MEMBER',
      },
    });

    context.summary.localMembershipsCreated += 1;
  }

  return localUser;
}

async function linkLocalUserToOpenProjectUser(
  localUserId: string,
  openProjectUser: OpenProjectUser
) {
  return prisma.user.update({
    where: { id: localUserId },
    data: {
      openProjectUserId: String(openProjectUser.id),
      openProjectLogin:
        openProjectUser.login || openProjectUser.email || String(openProjectUser.id),
      source: 'CLICKUP_IMPORTED',
    },
  });
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

    const localUser = await syncClickUpUserIntoLocalWorkspace(clickUpUser, context);
    const openProjectUser = await ensureOpenProjectUserFromClickUp(
      clickUpUser,
      openProjectUserSync
    );
    if (localUser && openProjectUser) {
      await linkLocalUserToOpenProjectUser(localUser.id, openProjectUser);
    }
  }
}

async function syncPermissionGrantUsersIntoLocalWorkspace(
  grants: PermissionGrant[],
  context: UserSyncContext,
  openProjectUserSync: OpenProjectUserSyncContext
) {
  for (const grant of grants) {
    const localUser = await syncClickUpUserIntoLocalWorkspace(grant.user, context);
    const openProjectUser = await ensureOpenProjectUserFromClickUp(grant.user, openProjectUserSync);
    if (localUser && openProjectUser) {
      await linkLocalUserToOpenProjectUser(localUser.id, openProjectUser);
    }
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
  summary.clickUpTagsSeen += countArrayField(task.tags);
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
        admin: importedAdminEmails.has(email.toLowerCase()),
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
        details?: { attribute?: unknown };
      }>;
    };
  };

  const errors = body._embedded?.errors || [];
  const errorMessages = errors
    .map((item) => {
      const attribute = item.details?.attribute;
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
  context: OpenProjectUserSyncContext
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

async function getClickUpFolderlessLists(spaceId: string) {
  const payload = await clickUpRequest<{ lists: ClickUpList[] }>(`/space/${spaceId}/list`, {
    query: { archived: false },
  });

  return payload.lists || [];
}

async function getClickUpLists(folderId: string) {
  const payload = await clickUpRequest<{ lists: ClickUpList[] }>(`/folder/${folderId}/list`, {
    query: { archived: false },
  });

  return payload.lists || [];
}

async function getClickUpTasks(listId: string) {
  const tasks: ClickUpTask[] = [];

  for (let page = 0; page < 50; page += 1) {
    const payload = await clickUpRequest<{ tasks: ClickUpTask[] }>(`/list/${listId}/task`, {
      query: {
        archived: false,
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

async function getOpenProjectStatuses() {
  const page = await openProjectRequest<HalCollection<OpenProjectStatus>>('/api/v3/statuses', {
    query: { pageSize: 500 },
  });

  return page._embedded?.elements || [];
}

async function getOpenProjectPriorities() {
  const page = await openProjectRequest<HalCollection<OpenProjectPriority>>('/api/v3/priorities', {
    query: { pageSize: 100 },
  });

  return page._embedded?.elements || [];
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
  responsibleHref?: string;
  additionalAssignees?: ClickUpAssigneeLike[];
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

  if (params.responsibleHref) {
    links.responsible = { href: params.responsibleHref };
  }

  const meta = metaFromContext(params.task, params.context);
  const description = appendAdditionalAssigneesMeta(
    clickUpTaskDescription(params.task),
    params.additionalAssignees || []
  );

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

function isAssigneeMappingError(error: unknown) {
  return /assignee|responsible/i.test(openProjectErrorMessage(error));
}

function indexExistingWorkPackages(workPackages: OpenProjectWorkPackage[]) {
  const byClickUpTaskId = new Map<string, OpenProjectWorkPackage>();
  const bySubject = new Map<string, OpenProjectWorkPackage>();

  for (const workPackage of workPackages) {
    const meta = importedMeta(workPackage.description?.raw || '');

    if (meta?.clickUpTaskId) {
      byClickUpTaskId.set(meta.clickUpTaskId, workPackage);
    }

    if (!bySubject.has(workPackage.subject)) {
      bySubject.set(workPackage.subject, workPackage);
    }
  }

  return { byClickUpTaskId, bySubject };
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
}) {
  const assigneeMapping = await clickUpAssigneeLinks(params.task, params.openProjectUserSync);
  let includeStatus = true;
  let includeAssignments = Boolean(assigneeMapping.assigneeHref || assigneeMapping.responsibleHref);
  const rejectedAssignmentFallback = assigneeFallbackUsers({
    assignee: assigneeMapping.assignee,
    responsible: assigneeMapping.responsible,
    additionalAssignees: assigneeMapping.additionalAssignees,
  });

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
            assigneeHref: includeAssignments ? assigneeMapping.assigneeHref : undefined,
            responsibleHref: includeAssignments ? assigneeMapping.responsibleHref : undefined,
            additionalAssignees: includeAssignments
              ? assigneeMapping.additionalAssignees
              : rejectedAssignmentFallback,
          }),
        }
      );

      if (includeAssignments && assigneeMapping.assigneeHref) {
        params.summary.assigneesMapped += 1;
      }
      if (includeAssignments && assigneeMapping.responsibleHref) {
        params.summary.responsibleMapped += 1;
      }
      if (assigneeMapping.additionalAssignees.length) {
        params.summary.additionalAssigneesStored += assigneeMapping.additionalAssignees.length;
        params.summary.assigneeFallbackStored += assigneeMapping.additionalAssignees.length;
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

      if (includeAssignments && isAssigneeMappingError(error)) {
        includeAssignments = false;
        params.summary.assigneeRejectedByOpenProject += 1;
        params.summary.assigneeMappingErrors.push(
          `task ${params.task.id}: OpenProject rejected assignee/responsible mapping: ${openProjectErrorMessage(
            error
          )}`
        );
        params.summary.assigneeFallbackStored += rejectedAssignmentFallback.length;
        params.summary.warnings.push(
          `task ${params.task.name} (${params.task.id}): created without assignee/responsible because OpenProject rejected the imported assignee mapping; assignees were preserved in metadata fallback`
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
}) {
  if (params.task.status) {
    params.summary.statusTransitionsSkipped += 1;
  }
  const assigneeMapping = await clickUpAssigneeLinks(params.task, params.openProjectUserSync);
  let includeAssignments = Boolean(assigneeMapping.assigneeHref || assigneeMapping.responsibleHref);
  const rejectedAssignmentFallback = assigneeFallbackUsers({
    assignee: assigneeMapping.assignee,
    responsible: assigneeMapping.responsible,
    additionalAssignees: assigneeMapping.additionalAssignees,
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
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
              includeStatus: false,
              assigneeHref: includeAssignments ? assigneeMapping.assigneeHref : undefined,
              responsibleHref: includeAssignments ? assigneeMapping.responsibleHref : undefined,
              additionalAssignees: includeAssignments
                ? assigneeMapping.additionalAssignees
                : rejectedAssignmentFallback,
            }),
          },
        }
      );

      if (includeAssignments && assigneeMapping.assigneeHref) {
        params.summary.assigneesMapped += 1;
      }
      if (includeAssignments && assigneeMapping.responsibleHref) {
        params.summary.responsibleMapped += 1;
      }
      if (assigneeMapping.additionalAssignees.length) {
        params.summary.additionalAssigneesStored += assigneeMapping.additionalAssignees.length;
        params.summary.assigneeFallbackStored += assigneeMapping.additionalAssignees.length;
      }

      return updated;
    } catch (error) {
      if (includeAssignments && isAssigneeMappingError(error)) {
        includeAssignments = false;
        params.summary.assigneeRejectedByOpenProject += 1;
        params.summary.assigneeMappingErrors.push(
          `task ${params.task.id}: OpenProject rejected assignee/responsible update: ${openProjectErrorMessage(
            error
          )}`
        );
        params.summary.assigneeFallbackStored += rejectedAssignmentFallback.length;
        params.summary.warnings.push(
          `task ${params.task.name} (${params.task.id}): assignee/responsible update was skipped because OpenProject rejected the mapping; assignees were preserved in metadata fallback`
        );
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Could not update work package for ClickUp task ${params.task.id}`);
}

async function syncClickUpTasksIntoProject(params: {
  context: ClickUpTaskContext;
  project: OpenProjectProject;
  openProjectStatuses: OpenProjectStatus[];
  priorities: OpenProjectPriority[];
  summary: Summary;
  userSync: UserSyncContext;
  openProjectUserSync: OpenProjectUserSyncContext;
}) {
  const [existingWorkPackages, type, clickUpTasks] = await Promise.all([
    getProjectWorkPackages(params.project.id).catch(() => []),
    firstTaskType(params.project.id),
    getClickUpTasks(params.context.list.id),
  ]);

  const { byClickUpTaskId, bySubject } = indexExistingWorkPackages(existingWorkPackages);

  for (const task of clickUpTasks) {
    recordUnsupportedClickUpTaskData(task, params.summary);
    const assigneeGrants = taskAssigneePermissionGrants(task, params.summary);
    await syncPermissionGrantUsersIntoLocalWorkspace(
      assigneeGrants,
      params.userSync,
      params.openProjectUserSync
    );
    await applyOpenProjectMemberships(params.project, assigneeGrants, params.openProjectUserSync);

    const existingById = byClickUpTaskId.get(task.id);
    const existingBySubject = bySubject.get(task.name);
    const existing = existingById || existingBySubject;

    try {
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
        });

        byClickUpTaskId.set(task.id, updated);
        params.summary.tasksUpdated += 1;
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
        });

        byClickUpTaskId.set(task.id, created);
        bySubject.set(task.name, created);
        params.summary.tasksCreated += 1;
      }
    } catch (error) {
      params.summary.errors.push(
        `task ${task.name} (${task.id}) in ${originalClickUpPath(params.context)}: ${
          (error as Error).message
        }`
      );
    }
  }
}

function createSeededSpace(space: ClickUpSpace): SeededWorkspace['spaces'][number] {
  return {
    id: `clickup-space:${space.id}`,
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
    id: `clickup-folder:${params.folderId}`,
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
  statuses: ReturnType<typeof seededStatuses>;
}) {
  return {
    id: `op-project:${params.project.id}:clickup-list:${params.list.id}`,
    clickupListId: params.list.id,
    openProjectProjectId: String(params.project.id),
    folderId: params.folderId,
    name: params.list.name,
    icon: '✓',
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
    params.openProjectUserSync
  );

  const seededFolder = createSeededFolder({
    spaceId: params.seededSpace.id,
    folderId: params.folder.id,
    clickupFolderId: params.folder.id,
    name: params.folder.name,
    locked: params.folder.hidden,
    kind: 'TEAM',
  });

  for (const list of params.lists) {
    const project = await ensureOpenProjectProject(
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

    const listGrants = await getClickUpListMembers(list.id, params.summary);
    const effectiveGrants = [...params.inheritedGrants, ...listGrants];
    await syncPermissionGrantUsersIntoLocalWorkspace(
      effectiveGrants,
      params.userSync,
      params.openProjectUserSync
    );
    await applyOpenProjectMemberships(project, effectiveGrants, params.openProjectUserSync);

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
    });

    const taskListId = `op-project:${project.id}:clickup-list:${list.id}`;
    const statuses = seededStatuses({
      statuses: clickUpStatuses(list, params.folder, params.space),
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
    await applyOpenProjectMemberships(project, effectiveGrants, params.openProjectUserSync);

    const seededListFolder = createSeededFolder({
      spaceId: params.seededSpace.id,
      folderId: `${params.space.id}:list:${list.id}`,
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
    });

    const taskListId = `op-project:${project.id}:clickup-list:${list.id}`;
    const statuses = seededStatuses({
      statuses: clickUpStatuses(list, null, params.space),
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
      id: `clickup-space:${spaceKey}`,
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

  const folderId = params.meta.clickUpFolderName
    ? `clickup-folder:${spaceKey}:${folderKey || slug(params.meta.clickUpFolderName)}`
    : `clickup-folder:${spaceKey}:list:${listKey}`;

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

  const taskListId = `op-project:${params.project.id}:clickup-list:${listKey}`;

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
    ['ClickUp tags', summary.clickUpTagsSeen],
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
    responsibleMapped: 0,
    additionalAssigneesStored: 0,
    assigneeMappingErrors: [],
    assigneeRejectedByOpenProject: 0,
    assigneeFallbackStored: 0,
    fallbackRecoveredTasks: 0,
    fallbackSkippedTasks: 0,
    errors: [],
    warnings: [],
  };

  const migrationRun = await prisma.migrationRun.create({
    data: {
      source: 'CLICKUP',
      status: 'RUNNING',
    },
  });

  const openProjectStatuses = await getOpenProjectStatuses();
  const openProjectPriorities = await getOpenProjectPriorities();
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
  const localWorkspace = await ensureLocalRuntimeWorkspace();

  const userSync: UserSyncContext = {
    workspaceId: localWorkspace.id,
    seenClickUpUserKeys: new Set<string>(),
    summary,
  };
  const openProjectUserSync: OpenProjectUserSyncContext = {
    users: openProjectUsers,
    roles: openProjectRoles,
    memberships: openProjectMemberships,
    clickUpUserToOpenProjectUser: new Map<string, OpenProjectUser>(),
    failedClickUpUserKeys: new Set<string>(),
    summary,
  };

  if (!process.env.CLICKUP_TOKEN) {
    const workspace = await seedFromOpenProjectImportedDescriptions(
      projects,
      openProjectStatuses,
      summary
    );

    const path = await writeSeededHierarchy(workspace);
    await prisma.migrationRun.update({
      where: { id: migrationRun.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        summary: summary as unknown as object,
        warnings: summary.warnings,
        errors: summary.errors,
      },
    });

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

  await syncClickUpTeamUsersIntoLocalWorkspace(team, userSync, openProjectUserSync);
  const workspaceGrants = teamPermissionGrants(team, summary);

  const spaces = await getClickUpSpaces(team.id);
  summary.spaces = spaces.length;

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

    await syncPermissionGrantUsersIntoLocalWorkspace(spaceGrants, userSync, openProjectUserSync);
    await applyOpenProjectMemberships(spaceProject, spaceGrants, openProjectUserSync);

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
    });

    workspace.spaces.push(seededSpace);
  }

  const path = await writeSeededHierarchy(workspace);
  addUnsupportedFeatureWarnings(summary);
  await prisma.migrationRun.update({
    where: { id: migrationRun.id },
    data: {
      status: summary.errors.length ? 'FAILED' : 'SUCCESS',
      finishedAt: new Date(),
      workspaceId: localWorkspace.id,
      summary: summary as unknown as object,
      warnings: [...summary.warnings, ...summary.permissionWarnings],
      errors: [
        ...summary.errors,
        ...summary.assigneeMappingErrors,
        ...summary.openProjectUserErrors,
        ...summary.openProjectMembershipErrors,
      ],
    },
  });

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
    .finally(async () => {
      await prisma.$disconnect();
    });
}
