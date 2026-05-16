import type { Prisma, TaskPriority } from '@prisma/client';
import XLSX from 'xlsx';
import { prisma } from '../db.js';
import { logTaskActivity } from './activity.js';
import { extractTaskKey } from './taskKeys.js';
import { promises as fs } from 'node:fs';

type CsvRow = Record<string, unknown>;

const statusColors: Record<string, string> = {
  complete: '#12b886',
  closed: '#12b886',
  shipped: '#4d9f87',
  'in review': '#d6336c',
  'in development': '#3b82f6',
  backlog: '#868e96',
  open: '#868e96',
  'to do': '#868e96',
  scoping: '#7048e8',
};

function fixMojibake(value: string) {
  if (!/[ÐÑ]/.test(value)) return value;

  try {
    const fixed = Buffer.from(value, 'latin1').toString('utf8');

    if (fixed.includes('�')) return value;
    return fixed;
  } catch {
    return value;
  }
}

function text(value: unknown) {
  return fixMojibake(String(value ?? '').trim());
}

function parseJsonArray(value: unknown) {
  const raw = text(value);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseFolderName(value: unknown) {
  const raw = text(value);
  if (!raw) return 'General';

  const parsed = parseJsonArray(raw);
  return parsed.length ? text(parsed[parsed.length - 1]) : raw;
}

function parseDate(value: unknown) {
  const raw = text(value);
  if (!raw) return undefined;

  const numeric = Number(raw);

  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric);
  }

  const date = new Date(raw);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parsePriority(value: unknown): TaskPriority {
  const raw = text(value).toLowerCase();

  if (raw.includes('urgent')) return 'URGENT';
  if (raw.includes('high')) return 'HIGH';
  if (raw.includes('low')) return 'LOW';

  return 'NORMAL';
}

function hasMilestoneTag(value: unknown) {
  return parseJsonArray(value).some(
    (tagValue) =>
      text((tagValue as Record<string, unknown>).name || tagValue).toLowerCase() === 'milestone'
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'S'
  );
}

function colorForIndex(index: number) {
  return ['#fa5252', '#fcc419', '#20c997', '#e64980', '#ae3ec9', '#4c6ef5'][index % 6];
}

function normalizeRow(row: CsvRow): CsvRow {
  const normalized: CsvRow = {};

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = text(key);

    if (typeof value === 'string') {
      normalized[normalizedKey] = text(value);
    } else {
      normalized[normalizedKey] = value;
    }
  }

  return normalized;
}

async function readRows(filePath: string) {
  const csvBuffer = await fs.readFile(filePath);

  const workbook = XLSX.read(csvBuffer, {
    type: 'buffer',
    cellDates: false,
    raw: true,
    codepage: 65001,
  });

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return [];
  }

  const sheet = workbook.Sheets[sheetName];

  return XLSX.utils
    .sheet_to_json<CsvRow>(sheet, {
      defval: '',
      raw: true,
    })
    .map(normalizeRow);
}

export async function importClickUpCsv(filePath: string, workspaceId: string) {
  const rows = await readRows(filePath);

  const createdSpaces = new Map<string, string>();
  const createdFolders = new Map<string, string>();
  const createdLists = new Map<string, string>();
  const createdStatuses = new Map<string, string>();
  const createdTasks = new Map<string, string>();

  let spaceIndex = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const spaceName = text(row['Space Name']) || 'Imported Space';

      if (!createdSpaces.has(spaceName)) {
        const space = await prisma.space.upsert({
          where: {
            workspaceId_name: {
              workspaceId,
              name: spaceName,
            },
          },
          create: {
            workspaceId,
            name: spaceName,
            color: colorForIndex(spaceIndex++),
            initials: initials(spaceName),
            locked: true,
            permissions: {
              create: [
                {
                  role: 'OWNER',
                  canView: true,
                  canEdit: true,
                  canManage: true,
                },
                {
                  role: 'ADMIN',
                  canView: true,
                  canEdit: true,
                  canManage: true,
                },
                {
                  role: 'LEAD',
                  canView: true,
                  canEdit: true,
                },
                {
                  role: 'MEMBER',
                  canView: true,
                  canEdit: true,
                },
                {
                  role: 'VIEWER',
                  canView: true,
                },
              ],
            },
          },
          update: {},
        });

        createdSpaces.set(spaceName, space.id);
      }

      const spaceId = createdSpaces.get(spaceName)!;

      const folderName = parseFolderName(row['Folder Name/Path']);
      const folderKey = `${spaceId}:${folderName}`;

      if (!createdFolders.has(folderKey)) {
        const folder = await prisma.folder.upsert({
          where: {
            spaceId_name: {
              spaceId,
              name: folderName,
            },
          },
          create: {
            spaceId,
            name: folderName,
            kind: folderName.toLowerCase().includes('doc') ? 'DOCS' : 'TEAM',
            locked: true,
          },
          update: {},
        });

        createdFolders.set(folderKey, folder.id);
      }

      const folderId = createdFolders.get(folderKey)!;

      const listName = text(row['List Name']) || 'Imported Tasks';
      const listKey = `${folderId}:${listName}`;

      if (!createdLists.has(listKey)) {
        const taskList = await prisma.taskList.upsert({
          where: {
            folderId_name: {
              folderId,
              name: listName,
            },
          },
          create: {
            folderId,
            name: listName,
            icon: '☣',
          },
          update: {},
        });

        createdLists.set(listKey, taskList.id);
      }

      const taskListId = createdLists.get(listKey)!;

      const statusName = text(row.Status).toLowerCase() || 'to do';
      const statusKey = `${taskListId}:${statusName}`;

      if (!createdStatuses.has(statusKey)) {
        const statusCount = [...createdStatuses.keys()].filter((key) =>
          key.startsWith(`${taskListId}:`)
        ).length;

        const status = await prisma.taskStatus.upsert({
          where: {
            taskListId_name: {
              taskListId,
              name: statusName,
            },
          },
          create: {
            taskListId,
            name: statusName,
            color: statusColors[statusName] || '#868e96',
            isDone: ['complete', 'closed', 'shipped'].includes(statusName),
            position: statusCount,
          },
          update: {},
        });

        createdStatuses.set(statusKey, status.id);
      }

      const sourceExternalId = text(row['Task ID']);
      if (!sourceExternalId) {
        skipped += 1;
        continue;
      }
      const title = text(row['Task Name']) || sourceExternalId || 'Untitled task';

      const assignees = parseJsonArray(row.Assignees);
      const firstAssignee = assignees[0] as Record<string, unknown> | undefined;

      const assigneeEmail = text(firstAssignee?.email);
      const assigneeName = text(firstAssignee?.username) || assigneeEmail;

      const assignee = assigneeEmail
        ? await prisma.user.upsert({
            where: {
              email: assigneeEmail,
            },
            create: {
              email: assigneeEmail,
              name: assigneeName || assigneeEmail,
            },
            update: {
              name: assigneeName || assigneeEmail,
            },
          })
        : null;

      const statusId = createdStatuses.get(statusKey);
      const isMilestone = hasMilestoneTag(row.Tags);
      const milestone = isMilestone
        ? await prisma.milestone.upsert({
            where: { workspaceId_title: { workspaceId, title } },
            create: { workspaceId, folderId, title, dueDate: parseDate(row['Due Date']) },
            update: { folderId, dueDate: parseDate(row['Due Date']) },
          })
        : null;

      const externalUrl = text(row['Task Link']) || null;
      const description = text(row['Task Content']) || null;
      const priority = parsePriority(row.Priority);
      const startDate = parseDate(row['Start Date']);
      const dueDate = parseDate(row['Due Date']);
      const extractedTaskKey = extractTaskKey(title);
      const importPayload = JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue;

      const existing = sourceExternalId
        ? await prisma.task.findUnique({
            where: {
              externalSource_externalId: {
                externalSource: 'CLICKUP',
                externalId: sourceExternalId,
              },
            },
          })
        : null;
      const taskKeyOwner = extractedTaskKey
        ? await prisma.task.findUnique({
            where: {
              workspaceId_taskKey: {
                workspaceId,
                taskKey: extractedTaskKey,
              },
            },
            select: { id: true },
          })
        : null;
      const taskKey = taskKeyOwner && taskKeyOwner.id !== existing?.id ? null : extractedTaskKey;

      const clickUpData = {
        workspaceId,
        departmentId: spaceId,
        teamId: folderId,
        listId: taskListId,
        folderId,
        taskListId,
        statusId,
        milestoneId: milestone?.id || null,
        externalSource: 'CLICKUP' as const,
        externalId: sourceExternalId || null,
        externalUrl,
        syncedAt: new Date(),
        taskKey,
        externalTitle: title,
        externalDescription: description,
        externalStatus: statusName,
        sourceExternalId,
        sourceUrl: externalUrl,
        importPayload,
      };

      const editableData = {
        title,
        description,
        status: statusName,
        priority,
        startDate,
        dueDate,
        assigneeId: assignee?.id,
        position: await prisma.task.count({
          where: {
            taskListId,
            statusId,
          },
        }),
      };

      const shouldUpdateLocalFields =
        !existing ||
        !existing.locallyEditedAt ||
        !existing.syncedAt ||
        existing.locallyEditedAt <= existing.syncedAt;

      const task = existing
        ? await prisma.task.update({
            where: { id: existing.id },
            data: {
              ...clickUpData,
              ...(shouldUpdateLocalFields ? editableData : {}),
            },
          })
        : await prisma.task.create({
            data: {
              ...clickUpData,
              ...editableData,
            },
          });

      if (existing) {
        updated += 1;
      } else {
        created += 1;
        await logTaskActivity({
          workspaceId,
          taskId: task.id,
          type: 'TASK_IMPORTED_FROM_CLICKUP',
          message: `Imported from ClickUp ${sourceExternalId}`,
          metadata: { externalId: sourceExternalId, externalUrl },
        });
      }

      createdTasks.set(sourceExternalId, task.id);

      const tags = parseJsonArray(row.Tags);

      for (const tagValue of tags) {
        const tagName = text((tagValue as Record<string, unknown>).name || tagValue);

        if (!tagName) continue;

        const tag = await prisma.tag.upsert({
          where: {
            workspaceId_name: {
              workspaceId,
              name: tagName,
            },
          },
          create: {
            workspaceId,
            name: tagName,
            color: '#7048e8',
          },
          update: {},
        });

        await prisma.taskTag.upsert({
          where: {
            taskId_tagId: {
              taskId: task.id,
              tagId: tag.id,
            },
          },
          create: {
            taskId: task.id,
            tagId: tag.id,
          },
          update: {},
        });
      }
    } catch (error) {
      errors += 1;
      console.warn('ClickUp import row failed:', error instanceof Error ? error.message : error);
    }
  }

  for (const row of rows) {
    const sourceExternalId = text(row['Task ID']);
    const parentExternalId = text(row['Parent ID']);

    const taskId = createdTasks.get(sourceExternalId);
    const parentId = createdTasks.get(parentExternalId);

    if (taskId && parentId) {
      await prisma.task.update({
        where: {
          id: taskId,
        },
        data: {
          parentId,
        },
      });
    }
  }

  return {
    importedTasks: created + updated,
    created,
    updated,
    skipped,
    errors,
    spaces: createdSpaces.size,
    folders: createdFolders.size,
    lists: createdLists.size,
    statuses: createdStatuses.size,
  };
}
