import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { openProjectRequest } from '../openproject/client.js';
import {
  getOpenProjectConnectionStatus,
  getOpenProjectProjectMembers,
  getRuntimeWorkspaceSettings,
  getUsers as getOpenProjectUsers,
} from '../openproject/service.js';
import { hashPassword, requireCurrentUser } from '../services/auth.js';
import { sendInviteEmail } from '../services/email.js';
import { accessibleSpaceIds, requirePermission, currentUserId } from '../services/permissions.js';
import crypto from 'node:crypto';

export const workspacesRouter = Router();

async function resolveWorkspaceRecord(workspaceId: string) {
  if (workspaceId === 'openproject') {
    const runtime = await getRuntimeWorkspaceSettings();
    return prisma.workspace.findUniqueOrThrow({
      where: { id: runtime.id },
      include: {
        memberships: { include: { user: true } },
        permissionSets: true,
        migrationRuns: { orderBy: { startedAt: 'desc' }, take: 10 },
      },
    });
  }

  return prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: {
      memberships: { include: { user: true } },
      permissionSets: true,
      migrationRuns: { orderBy: { startedAt: 'desc' }, take: 10 },
    },
  });
}

function serializePermissionSet(set: {
  role: string;
  manageWorkspace: boolean;
  manageSpaces: boolean;
  manageDocs: boolean;
  manageTasks: boolean;
  inviteMembers: boolean;
  manageIntegrations?: boolean;
  manageImports?: boolean;
  viewReports?: boolean;
}) {
  return {
    role: set.role,
    manageWorkspace: set.manageWorkspace,
    manageSpaces: set.manageSpaces,
    manageDocs: set.manageDocs,
    manageTasks: set.manageTasks,
    inviteMembers: set.inviteMembers,
    manageIntegrations: Boolean(set.manageIntegrations),
    manageImports: Boolean(set.manageImports),
    viewReports: Boolean(set.viewReports),
  };
}

function serializeWorkspaceMember(member: {
  id: string;
  role: string;
  createdAt: Date;
  updatedAt?: Date;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
    source?: string | null;
    openProjectUserId?: string | null;
    openProjectLogin?: string | null;
    lastLoginAt?: Date | null;
  };
}) {
  return {
    id: member.id,
    role: member.role,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt?.toISOString(),
    user: {
      id: member.user.id,
      email: member.user.email,
      name: member.user.name,
      avatarUrl: member.user.avatarUrl,
      source: member.user.source,
      openProjectUserId: member.user.openProjectUserId,
      openProjectLogin: member.user.openProjectLogin,
      lastLoginAt: member.user.lastLoginAt?.toISOString() || null,
    },
  };
}

async function ownerCount(workspaceId: string) {
  return prisma.membership.count({
    where: {
      workspaceId,
      role: 'OWNER',
    },
  });
}

async function requireWorkspaceMemberAccess(
  req: Parameters<typeof requireCurrentUser>[0],
  workspaceId: string
) {
  const user = await requireCurrentUser(req);
  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId,
      },
    },
  });
  if (!membership) {
    const error = new Error('Workspace access is required');
    Object.assign(error, { statusCode: 403 });
    throw error;
  }
  return membership;
}

function splitDisplayName(name: string, email: string) {
  const trimmed = name.trim();
  const fallback = email.split('@')[0] || 'User';
  if (!trimmed) {
    return {
      firstName: fallback.slice(0, 100),
      lastName: 'User',
    };
  }
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: (firstName || fallback).slice(0, 100),
    lastName: (rest.join(' ') || 'User').slice(0, 100),
  };
}

async function ensureOpenProjectUserForInvite(input: { email: string; name?: string }) {
  const users = await getOpenProjectUsers();
  const existing = users.find((user) => user.email?.toLowerCase() === input.email.toLowerCase());
  if (existing) {
    return {
      id: existing.id,
      login: input.email,
    };
  }

  const { firstName, lastName } = splitDisplayName(input.name || '', input.email);
  const temporaryPassword = `tracker-${crypto.randomBytes(6).toString('base64url')}`;
  const created = await openProjectRequest<{ id: number; login?: string }>(`/api/v3/users`, {
    method: 'POST',
    body: {
      login: input.email,
      firstName,
      lastName,
      email: input.email,
      status: 'active',
      password: temporaryPassword,
      admin: false,
    },
  });

  return {
    id: created.id,
    login: created.login || input.email,
    temporaryPassword,
  };
}

workspacesRouter.get('/', async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.json([]);
      return;
    }
    const workspaces = await prisma.workspace.findMany({
      where: { memberships: { some: { userId } } },
      include: {
        spaces: {
          include: {
            folders: {
              include: {
                taskLists: {
                  include: {
                    statuses: { orderBy: { position: 'asc' } },
                    _count: { select: { tasks: true } },
                  },
                },
                _count: { select: { tasks: true } },
              },
            },
            documents: true,
            permissions: true,
          },
        },
        memberships: { include: { user: true } },
        permissionSets: true,
        githubIntegration: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const result = await Promise.all(
      workspaces.map(async (workspace) => {
        const ids = new Set(await accessibleSpaceIds(req, workspace.id));
        return {
          ...workspace,
          spaces: workspace.spaces.filter((space) => ids.has(space.id)),
        };
      })
    );
    res.json(result);
  } catch {
    res.json([]);
  }
});

workspacesRouter.get('/:workspaceId/settings', async (req, res) => {
  const workspace = await resolveWorkspaceRecord(req.params.workspaceId);
  await requireWorkspaceMemberAccess(req, workspace.id);

  res.json({
    id: req.params.workspaceId,
    persistedId: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    avatarUrl: workspace.avatarUrl,
    color: workspace.color,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  });
});

workspacesRouter.patch('/:workspaceId/settings', async (req, res) => {
  const workspace = await resolveWorkspaceRecord(req.params.workspaceId);
  await requirePermission(req, workspace.id, 'manageWorkspace');
  const body = z
    .object({
      name: z.string().min(2).max(120).optional(),
      slug: z
        .string()
        .min(2)
        .max(120)
        .regex(/^[a-z0-9-]+$/)
        .optional(),
      description: z.string().max(2000).nullable().optional(),
      avatarUrl: z.string().url().nullable().optional(),
      color: z.string().max(20).nullable().optional(),
    })
    .parse(req.body);

  const updated = await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.slug !== undefined ? { slug: body.slug } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
    },
  });

  res.json({
    id: req.params.workspaceId,
    persistedId: updated.id,
    name: updated.name,
    slug: updated.slug,
    description: updated.description,
    avatarUrl: updated.avatarUrl,
    color: updated.color,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

workspacesRouter.get('/:workspaceId/members', async (req, res) => {
  const workspace = await resolveWorkspaceRecord(req.params.workspaceId);
  await requireWorkspaceMemberAccess(req, workspace.id);

  res.json({
    items: workspace.memberships.map(serializeWorkspaceMember),
  });
});

workspacesRouter.post('/:workspaceId/members/invite', async (req, res) => {
  const workspace = await resolveWorkspaceRecord(req.params.workspaceId);
  await requirePermission(req, workspace.id, 'inviteMembers');
  const body = z
    .object({
      email: z.string().email(),
      name: z.string().max(120).optional(),
      role: z.enum(['OWNER', 'ADMIN', 'LEAD', 'MEMBER', 'VIEWER']).default('MEMBER'),
      createOpenProjectUser: z.boolean().default(false),
    })
    .parse(req.body);

  const temporaryPassword = `tracker-${crypto.randomBytes(6).toString('base64url')}`;
  const existing = await prisma.user.findUnique({ where: { email: body.email } });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          source: existing.source || 'MANUALLY_INVITED',
          ...(existing.passwordHash ? {} : { passwordHash: hashPassword(temporaryPassword) }),
        },
      })
    : await prisma.user.create({
        data: {
          email: body.email,
          name: body.name || '',
          passwordHash: hashPassword(temporaryPassword),
          source: 'MANUALLY_INVITED',
        },
      });

  let openProjectLink:
    | { id: number | string; login?: string; temporaryPassword?: string }
    | undefined;
  if (body.createOpenProjectUser) {
    openProjectLink = await ensureOpenProjectUserForInvite({
      email: user.email,
      name: body.name ?? user.name,
    });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        openProjectUserId: String(openProjectLink.id),
        openProjectLogin: openProjectLink.login || user.email,
      },
    });
  }

  const membership = await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    update: { role: body.role },
    create: {
      userId: user.id,
      workspaceId: workspace.id,
      role: body.role,
    },
    include: { user: true },
  });

  res.status(201).json({
    membership: serializeWorkspaceMember(membership),
    temporaryPassword: existing?.passwordHash ? null : temporaryPassword,
    openProjectTemporaryPassword:
      body.createOpenProjectUser && openProjectLink?.temporaryPassword
        ? openProjectLink.temporaryPassword
        : null,
  });
});

workspacesRouter.patch('/:workspaceId/members/:userId', async (req, res) => {
  const workspace = await resolveWorkspaceRecord(req.params.workspaceId);
  await requirePermission(req, workspace.id, 'manageWorkspace');
  const body = z
    .object({
      role: z.enum(['OWNER', 'ADMIN', 'LEAD', 'MEMBER', 'VIEWER']),
    })
    .parse(req.body);

  const membership = await prisma.membership.findUniqueOrThrow({
    where: {
      userId_workspaceId: {
        userId: req.params.userId,
        workspaceId: workspace.id,
      },
    },
    include: { user: true },
  });

  if (
    membership.role === 'OWNER' &&
    body.role !== 'OWNER' &&
    (await ownerCount(workspace.id)) <= 1
  ) {
    res.status(400).json({ error: 'Cannot downgrade the last owner' });
    return;
  }

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: { role: body.role },
    include: { user: true },
  });

  res.json(serializeWorkspaceMember(updated));
});

workspacesRouter.delete('/:workspaceId/members/:userId', async (req, res) => {
  const workspace = await resolveWorkspaceRecord(req.params.workspaceId);
  await requirePermission(req, workspace.id, 'manageWorkspace');
  const membership = await prisma.membership.findUniqueOrThrow({
    where: {
      userId_workspaceId: {
        userId: req.params.userId,
        workspaceId: workspace.id,
      },
    },
  });

  if (membership.role === 'OWNER' && (await ownerCount(workspace.id)) <= 1) {
    res.status(400).json({ error: 'Cannot remove the last owner' });
    return;
  }

  await prisma.membership.delete({ where: { id: membership.id } });
  res.status(204).send();
});

workspacesRouter.get('/:workspaceId/permissions', async (req, res) => {
  const workspace = await resolveWorkspaceRecord(req.params.workspaceId);
  await requireWorkspaceMemberAccess(req, workspace.id);
  res.json({
    items: workspace.permissionSets.map(serializePermissionSet),
  });
});

workspacesRouter.get('/:workspaceId/openproject', async (req, res) => {
  const workspace = await resolveWorkspaceRecord(req.params.workspaceId);
  await requirePermission(req, workspace.id, 'manageWorkspace');
  res.json(await getOpenProjectConnectionStatus());
});

workspacesRouter.get('/:workspaceId/imports', async (req, res) => {
  const workspace = await resolveWorkspaceRecord(req.params.workspaceId);
  await requirePermission(req, workspace.id, 'manageWorkspace');
  res.json({
    items: workspace.migrationRuns,
  });
});

workspacesRouter.get('/:workspaceId/projects/:projectId/members', async (req, res) => {
  const workspace = await resolveWorkspaceRecord(req.params.workspaceId);
  await requireWorkspaceMemberAccess(req, workspace.id);
  res.json(await getOpenProjectProjectMembers(req.params.projectId));
});

workspacesRouter.post('/', async (req, res) => {
  const body = z
    .object({
      name: z.string().min(2),
      slug: z
        .string()
        .min(2)
        .regex(/^[a-z0-9-]+$/),
    })
    .parse(req.body);

  const userId = currentUserId(req) || 'local-user';
  const workspace = await prisma.$transaction(async (tx) => {
    const createdWorkspace = await tx.workspace.create({
      data: {
        ...body,
        permissionSets: {
          create: [
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
              manageSpaces: true,
              manageDocs: true,
              manageTasks: true,
              inviteMembers: true,
            },
            { role: 'LEAD', manageDocs: true, manageTasks: true },
            { role: 'MEMBER', manageDocs: true, manageTasks: true },
            { role: 'VIEWER', manageTasks: false },
          ],
        },
      },
      include: {
        permissionSets: true,
        memberships: { include: { user: true } },
        githubIntegration: true,
        spaces: {
          include: {
            permissions: true,
            documents: true,
            folders: {
              include: {
                taskLists: {
                  include: {
                    statuses: { orderBy: { position: 'asc' } },
                    _count: { select: { tasks: true } },
                  },
                },
                _count: { select: { tasks: true } },
              },
            },
          },
        },
      },
    });

    const user = await tx.user.upsert({
      where: { id: userId },
      create: { id: userId, email: 'owner@local.app', name: 'Workspace Owner' },
      update: {},
    });

    await tx.membership.create({
      data: { userId: user.id, workspaceId: createdWorkspace.id, role: 'OWNER' },
    });

    const space = await tx.space.create({
      data: {
        workspaceId: createdWorkspace.id,
        name: 'General',
        description: 'Start here, then add team spaces and import tasks.',
        color: '#4c6ef5',
        initials: 'G',
        permissions: {
          create: [
            { role: 'OWNER', canView: true, canEdit: true, canManage: true },
            { role: 'ADMIN', canView: true, canEdit: true, canManage: true },
            { role: 'LEAD', canView: true, canEdit: true },
            { role: 'MEMBER', canView: true, canEdit: true },
            { role: 'VIEWER', canView: true },
          ],
        },
        folders: {
          create: {
            name: 'Main Team',
            kind: 'TEAM',
            taskLists: {
              create: {
                name: 'Tasks',
                icon: '☣',
                statuses: {
                  create: [
                    { name: 'backlog', color: '#868e96', position: 0 },
                    { name: 'in development', color: '#3b82f6', position: 1 },
                    { name: 'in review', color: '#d6336c', position: 2 },
                    { name: 'shipped', color: '#4d9f87', position: 3, isDone: true },
                  ],
                },
              },
            },
          },
        },
      },
    });

    return tx.workspace.findUniqueOrThrow({
      where: { id: createdWorkspace.id },
      include: {
        spaces: {
          where: { id: space.id },
          include: {
            permissions: true,
            documents: true,
            folders: {
              include: {
                taskLists: {
                  include: {
                    statuses: { orderBy: { position: 'asc' } },
                    _count: { select: { tasks: true } },
                  },
                },
                _count: { select: { tasks: true } },
              },
            },
          },
        },
        memberships: { include: { user: true } },
        permissionSets: true,
        githubIntegration: true,
      },
    });
  });

  res.status(201).json(workspace);
});

workspacesRouter.post('/:workspaceId/invites', async (req, res) => {
  await requirePermission(req, req.params.workspaceId, 'inviteMembers');
  const body = z
    .object({
      email: z.string().email(),
      role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
    })
    .parse(req.body);

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: req.params.workspaceId },
  });
  const invite = await prisma.invite.create({
    data: {
      workspaceId: req.params.workspaceId,
      email: body.email,
      role: body.role,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });
  const inviteUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/accept-invite/${invite.token}`;
  const delivery = await sendInviteEmail({
    to: invite.email,
    role: invite.role,
    inviteUrl,
    workspaceName: workspace.name,
  });

  res.status(201).json({
    ...invite,
    inviteUrl,
    delivery,
  });
});

workspacesRouter.post('/invites/:token/accept', async (req, res) => {
  const invite = await prisma.invite.findUniqueOrThrow({
    where: { token: req.params.token },
    include: { workspace: true },
  });
  if (invite.status !== 'PENDING' || invite.expiresAt < new Date()) {
    res.status(400).json({ error: 'Invite is expired or already used' });
    return;
  }

  const userId = currentUserId(req) || 'local-user';
  const user = await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email: invite.email, name: invite.email.split('@')[0] },
    update: { email: invite.email },
  });
  const membership = await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: invite.workspaceId } },
    create: { userId: user.id, workspaceId: invite.workspaceId, role: invite.role },
    update: { role: invite.role },
  });
  await prisma.invite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED' } });
  res.json({ workspaceId: invite.workspaceId, workspaceName: invite.workspace.name, membership });
});

workspacesRouter.patch('/:workspaceId/memberships/:membershipId', async (req, res) => {
  const workspace = await resolveWorkspaceRecord(req.params.workspaceId);
  await requirePermission(req, workspace.id, 'manageWorkspace');
  const body = z
    .object({ role: z.enum(['OWNER', 'ADMIN', 'LEAD', 'MEMBER', 'VIEWER']) })
    .parse(req.body);
  const existing = await prisma.membership.findUniqueOrThrow({
    where: { id: req.params.membershipId },
  });
  if (existing.workspaceId !== workspace.id) {
    res.status(404).json({ error: 'Membership not found in this workspace' });
    return;
  }
  if (existing.role === 'OWNER' && body.role !== 'OWNER' && (await ownerCount(workspace.id)) <= 1) {
    res.status(400).json({ error: 'Cannot downgrade the last owner' });
    return;
  }
  const membership = await prisma.membership.update({
    where: { id: req.params.membershipId },
    data: { role: body.role },
    include: { user: true },
  });
  res.json(membership);
});

workspacesRouter.put('/:workspaceId/permissions/:role', async (req, res) => {
  const workspace = await resolveWorkspaceRecord(req.params.workspaceId);
  await requirePermission(req, workspace.id, 'manageWorkspace');
  const role = z.enum(['OWNER', 'ADMIN', 'LEAD', 'MEMBER', 'VIEWER']).parse(req.params.role);
  const body = z
    .object({
      manageWorkspace: z.boolean(),
      manageSpaces: z.boolean(),
      manageDocs: z.boolean(),
      manageTasks: z.boolean(),
      inviteMembers: z.boolean(),
    })
    .parse(req.body);

  const permissionSet = await prisma.permissionSet.upsert({
    where: { workspaceId_role: { workspaceId: workspace.id, role } },
    create: { workspaceId: workspace.id, role, ...body },
    update: body,
  });

  res.json(permissionSet);
});

workspacesRouter.put('/:workspaceId/github', async (req, res) => {
  const workspace = await resolveWorkspaceRecord(req.params.workspaceId);
  await requirePermission(req, workspace.id, 'manageWorkspace');
  const body = z
    .object({
      organization: z.string().optional(),
      repository: z.string().optional(),
    })
    .parse(req.body);

  const integration = await prisma.githubIntegration.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, ...body },
    update: body,
  });

  res.json(integration);
});
