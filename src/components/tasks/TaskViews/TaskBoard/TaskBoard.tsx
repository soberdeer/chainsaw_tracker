import {
  ActionIcon,
  Badge,
  Box,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconCalendar,
  IconChecklist,
  IconGitPullRequest,
  IconGripVertical,
  IconPlus,
} from '@tabler/icons-react';
import { Fragment, useState } from 'react';
import type { Task, TaskStatus } from '@/lib';
import { AvatarStack } from '../../../common/AvatarStack';
import classes from './TaskBoard.module.css';

export interface TaskBoardProps {
  tasks: Task[];
  statuses: TaskStatus[];
  canWriteTasks: boolean;
  onOpenTask: (task: Task) => void;
  onAddTask: (statusId: string) => void;
  onMoveTask: (
    taskId: string,
    statusId: string,
    targetTaskId?: string | null
  ) => Promise<void> | void;
  sortDir?: 'asc' | 'desc';
}

function formatEstimate(hours?: number | null) {
  if (!hours || hours <= 0) {
    return null;
  }
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function formatDueDate(dateStr?: string | null): { label: string; overdue: boolean } | null {
  if (!dateStr) return null;
  const due = new Date(dateStr);
  if (isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = due < today;
  const label = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { label, overdue };
}

export function TaskBoard({
  tasks,
  statuses,
  canWriteTasks,
  onOpenTask,
  onAddTask,
  onMoveTask,
  sortDir = 'asc',
}: TaskBoardProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const grouped = new Map(statuses.map((status) => [status.id, [] as Task[]]));

  const pullRequestBadge = (task: Task) => {
    const pullRequest = task.githubPullRequests?.[0];
    if (!pullRequest) {
      return null;
    }

    const label = pullRequest.isMerged
      ? 'Merged PR'
      : pullRequest.reviewStatus === 'APPROVED'
        ? 'Approved PR'
        : pullRequest.reviewStatus === 'CHANGES_REQUESTED'
          ? 'Changes requested'
          : pullRequest.draft
            ? 'Draft PR'
            : 'Open PR';
    const color = pullRequest.isMerged
      ? 'teal'
      : pullRequest.reviewStatus === 'APPROVED'
        ? 'green'
        : pullRequest.reviewStatus === 'CHANGES_REQUESTED'
          ? 'red'
          : 'blue';

    return (
      <Tooltip label={`${label}: #${pullRequest.number}`}>
        <Badge color={color} variant="light" leftSection={<IconGitPullRequest size="0.75rem" />}>
          PR
        </Badge>
      </Tooltip>
    );
  };

  tasks.forEach((task) => {
    const key = task.statusId || statuses[0]?.id;
    if (!key) return;
    grouped.set(key, [...(grouped.get(key) || []), task]);
  });

  return (
    <ScrollArea
      type="auto"
      className={classes.boardScroll}
      data-testid="task-board"
      data-dragging-task-id={draggingTaskId || ''}
    >
      <Group align="stretch" gap="md" wrap="nowrap" className={classes.board}>
        {statuses.map((status) => {
          // ascTasks: position-ascending order (source of truth for reorderBoardTasks)
          const ascTasks = grouped.get(status.id) || [];
          // displayTasks: what's actually rendered (reversed in desc mode)
          const displayTasks = sortDir === 'desc' ? [...ascTasks].reverse() : ascTasks;

          // Convert a visual display-index to the targetTaskId expected by reorderBoardTasks.
          // reorderBoardTasks inserts *before* targetTaskId in position-asc order.
          //
          // asc mode: drop zone before displayTasks[i] → insert before displayTasks[i] in asc → targetTaskId = displayTasks[i].id
          // desc mode: drop zone before displayTasks[i] → visually "above" it → in asc terms insert *after* displayTasks[i]
          //            = insert before displayTasks[i-1] (the task with the next-higher position)
          //            = targetTaskId = displayTasks[i-1]?.id ?? null
          // End-of-column drop zone:
          //   asc  → append at end of asc array → targetTaskId = null
          //   desc → prepend at start of asc array → insert before ascTasks[0] → targetTaskId = ascTasks[0]?.id ?? null
          const targetForDropBefore = (displayIndex: number): string | null => {
            if (sortDir === 'desc') {
              return displayTasks[displayIndex - 1]?.id ?? null;
            }
            return displayTasks[displayIndex]?.id ?? null;
          };
          const targetForEndZone = (): string | null => {
            if (sortDir === 'desc') {
              return ascTasks[0]?.id ?? null;
            }
            return null;
          };

          return (
            <section
              key={status.id}
              data-testid="board-column"
              data-status-id={status.id}
              className={classes.column}
              onDragOver={(event) => {
                if (canWriteTasks) event.preventDefault();
              }}
              onDrop={async (event) => {
                event.preventDefault();
                if (!canWriteTasks || !draggingTaskId) return;
                await onMoveTask(draggingTaskId, status.id, null);
                setDraggingTaskId(null);
              }}
            >
              <Group className={classes.columnHeader} justify="space-between" wrap="nowrap">
                <Tooltip label={status.name}>
                  <Badge variant="light">{status.name}</Badge>
                </Tooltip>
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" c="dimmed">
                    {ascTasks.length}
                  </Text>
                  {canWriteTasks && (
                    <Tooltip label={`Add task to ${status.name}`}>
                      <ActionIcon
                        variant="subtle"
                        className={classes.iconButton}
                        data-testid="board-add-task"
                        aria-label={`Add task to ${status.name}`}
                        onClick={() => onAddTask(status.id)}
                      >
                        <IconPlus size="1rem" />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Group>

              <Stack gap="sm" className={classes.cards}>
                {displayTasks.map((task, displayIndex) => {
                  const estimate = formatEstimate(task.estimatedHours);
                  const dropTarget = targetForDropBefore(displayIndex);
                  return (
                    <Fragment key={task.id}>
                      {canWriteTasks && (
                        <Divider
                          data-testid="board-dropzone"
                          data-status-id={status.id}
                          data-target-task-id={dropTarget ?? ''}
                          className={classes.dropZone}
                          onDragOver={(event) => {
                            event.preventDefault();
                          }}
                          onDrop={async (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!draggingTaskId) return;
                            await onMoveTask(draggingTaskId, status.id, dropTarget);
                            setDraggingTaskId(null);
                          }}
                        />
                      )}
                      <UnstyledButton
                        data-testid="task-card"
                        data-task-id={task.id}
                        className={classes.card}
                        draggable={canWriteTasks}
                        onDragStart={() => setDraggingTaskId(task.id)}
                        onDragEnd={() => setDraggingTaskId(null)}
                        onDragOver={(event) => {
                          if (canWriteTasks) {
                            event.preventDefault();
                          }
                        }}
                        onDrop={async (event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (!canWriteTasks || !draggingTaskId) return;
                          await onMoveTask(draggingTaskId, status.id, dropTarget);
                          setDraggingTaskId(null);
                        }}
                        onClick={() => onOpenTask(task)}
                      >
                        <Group gap="xs" wrap="nowrap" align="flex-start">
                          {canWriteTasks && (
                            <Tooltip label="Drag to another status">
                              <IconGripVertical size="1rem" className={classes.dragIcon} />
                            </Tooltip>
                          )}
                          <Box className={classes.cardBody}>
                            {task.taskKey && (
                              <Text size="xs" c="dimmed" fw={700}>
                                {task.taskKey}
                              </Text>
                            )}
                            <Text size="sm" fw={700} lineClamp={3}>
                              {task.title}
                            </Text>
                            {(() => {
                              const due = formatDueDate(task.dueDate);
                              return due ? (
                                <Tooltip label={`Due: ${task.dueDate}`}>
                                  <Group gap={4} mt={4}>
                                    <IconCalendar
                                      size="0.75rem"
                                      color={
                                        due.overdue
                                          ? 'var(--mantine-color-red-6)'
                                          : 'var(--mantine-color-dimmed)'
                                      }
                                    />
                                    <Text
                                      size="xs"
                                      c={due.overdue ? 'red' : 'dimmed'}
                                      fw={due.overdue ? 700 : 400}
                                    >
                                      {due.label}
                                    </Text>
                                  </Group>
                                </Tooltip>
                              ) : null;
                            })()}
                            <Group gap="xs" mt="xs" justify="space-between" wrap="nowrap">
                              <Group gap="xs" style={{ flex: 1, flexWrap: 'wrap' }}>
                                <Tooltip label={`Priority: ${task.priority}`}>
                                  <Badge variant="light">{task.priority}</Badge>
                                </Tooltip>
                                {estimate && (
                                  <Tooltip label={`Estimate: ${estimate}`}>
                                    <Badge color="cyan" variant="light">
                                      {estimate}
                                    </Badge>
                                  </Tooltip>
                                )}
                                {task.checklistSummary?.total ? (
                                  <Tooltip
                                    label={`Checklist progress: ${task.checklistSummary.completed}/${task.checklistSummary.total}`}
                                  >
                                    <Badge
                                      color="lime"
                                      variant="light"
                                      leftSection={<IconChecklist size="0.75rem" />}
                                    >
                                      {task.checklistSummary.completed}/
                                      {task.checklistSummary.total}
                                    </Badge>
                                  </Tooltip>
                                ) : null}
                                {task.tags.slice(0, 2).map(({ tag }) => (
                                  <Tooltip key={tag.id} label={tag.name}>
                                    <Badge variant="outline">{tag.name}</Badge>
                                  </Tooltip>
                                ))}
                                {pullRequestBadge(task)}
                              </Group>
                              {task.assignees?.length ? (
                                <AvatarStack users={task.assignees} size="1.5rem" max={3} />
                              ) : null}
                            </Group>
                          </Box>
                        </Group>
                      </UnstyledButton>
                    </Fragment>
                  );
                })}
                {canWriteTasks && ascTasks.length > 0 && (
                  <Divider
                    data-testid="board-dropzone"
                    data-status-id={status.id}
                    data-target-task-id={targetForEndZone() ?? ''}
                    className={classes.dropZone}
                    onDragOver={(event) => {
                      event.preventDefault();
                    }}
                    onDrop={async (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!draggingTaskId) return;
                      await onMoveTask(draggingTaskId, status.id, targetForEndZone());
                      setDraggingTaskId(null);
                    }}
                  />
                )}
                {!ascTasks.length && (
                  <Text size="sm" c="dimmed" className={classes.emptyColumn}>
                    No tasks
                  </Text>
                )}
              </Stack>
            </section>
          );
        })}
      </Group>
    </ScrollArea>
  );
}
