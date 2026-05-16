import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { sendInviteEmail } from '../services/email.js';
import { accessibleSpaceIds, requirePermission, currentUserId } from '../services/permissions.js';
import crypto from 'node:crypto';

export const workspacesRouter = Router();

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
  await requirePermission(req, req.params.workspaceId, 'manageWorkspace');
  const body = z
    .object({ role: z.enum(['OWNER', 'ADMIN', 'LEAD', 'MEMBER', 'VIEWER']) })
    .parse(req.body);
  const membership = await prisma.membership.update({
    where: { id: req.params.membershipId },
    data: { role: body.role },
    include: { user: true },
  });
  res.json(membership);
});

workspacesRouter.put('/:workspaceId/permissions/:role', async (req, res) => {
  await requirePermission(req, req.params.workspaceId, 'manageWorkspace');
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
    where: { workspaceId_role: { workspaceId: req.params.workspaceId, role } },
    create: { workspaceId: req.params.workspaceId, role, ...body },
    update: body,
  });

  res.json(permissionSet);
});

workspacesRouter.put('/:workspaceId/github', async (req, res) => {
  await requirePermission(req, req.params.workspaceId, 'manageWorkspace');
  const body = z
    .object({
      organization: z.string().optional(),
      repository: z.string().optional(),
    })
    .parse(req.body);

  const integration = await prisma.githubIntegration.upsert({
    where: { workspaceId: req.params.workspaceId },
    create: { workspaceId: req.params.workspaceId, ...body },
    update: body,
  });

  res.json(integration);
});
