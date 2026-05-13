import type { ActivityEventType, Prisma } from '@prisma/client';
import { prisma } from '../db.js';

export async function logTaskActivity(input: {
  workspaceId?: string | null;
  taskId: string;
  actorId?: string | null;
  type: ActivityEventType;
  message?: string | null;
  previousValue?: string | null;
  nextValue?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const workspaceId =
    input.workspaceId ||
    (await prisma.task.findUnique({
      where: { id: input.taskId },
      select: { workspaceId: true, folder: { select: { space: { select: { workspaceId: true } } } } }
    }))?.workspaceId ||
    (await prisma.task.findUnique({
      where: { id: input.taskId },
      select: { folder: { select: { space: { select: { workspaceId: true } } } } }
    }))?.folder.space.workspaceId;

  if (!workspaceId) return null;

  return prisma.activityLog.create({
    data: {
      workspaceId,
      taskId: input.taskId,
      actorId: input.actorId,
      type: input.type,
      message: input.message,
      previousValue: input.previousValue,
      nextValue: input.nextValue,
      metadata: input.metadata
    }
  });
}
