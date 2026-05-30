import { ActionIcon, Badge, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconGripVertical, IconPlus } from '@tabler/icons-react';
import { useCallback, type RefObject } from 'react';
import type { Task, TaskStatus } from '@/lib';
import { TaskCard } from './TaskCard';
import classes from './TaskBoard.module.css';

interface BoardColumnProps {
  status: TaskStatus;
  tasks: Task[];
  canWriteTasks: boolean;
  sortDir: 'asc' | 'desc';
  draggingTaskIdRef: RefObject<string | null>;
  draggingStatusIdRef: RefObject<string | null>;
  onAddTask: (statusId: string) => void;
  onOpenTask: (task: Task) => void;
  onMoveTask: (
    taskId: string,
    statusId: string,
    targetTaskId?: string | null
  ) => Promise<void> | void;
  onTaskDragStart: (taskId: string) => void;
  onTaskDragEnd: () => void;
  onStatusDragStart: (statusId: string) => void;
  onStatusDragEnd: () => void;
  onStatusDrop: (afterStatusId: string) => void;
}

export function BoardColumn({
  status,
  tasks: ascTasks,
  canWriteTasks,
  sortDir,
  draggingTaskIdRef,
  draggingStatusIdRef,
  onAddTask,
  onOpenTask,
  onMoveTask,
  onTaskDragStart,
  onTaskDragEnd,
  onStatusDragStart,
  onStatusDragEnd,
  onStatusDrop,
}: BoardColumnProps) {
  const displayTasks = sortDir === 'desc' ? [...ascTasks].reverse() : ascTasks;

  /**
   * "Insert before this card" target — used when dropping on the TOP half.
   * Accounts for sort direction so the server's ascending position array
   * receives the correct insertion anchor.
   */
  const topTargetForIndex = (displayIndex: number): string | null => {
    if (sortDir === 'desc') return displayTasks[displayIndex - 1]?.id ?? null;
    return displayTasks[displayIndex]?.id ?? null;
  };

  /**
   * "Insert after this card" target — used when dropping on the BOTTOM half.
   * Equivalent to inserting before the next card in display order.
   */
  const bottomTargetForIndex = (displayIndex: number): string | null => {
    if (sortDir === 'desc') return displayTasks[displayIndex]?.id ?? null;
    return displayTasks[displayIndex + 1]?.id ?? null;
  };

  const handleColumnDrop = useCallback(
    async (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.currentTarget.removeAttribute('data-status-over');

      const draggingStatus = draggingStatusIdRef.current;
      if (draggingStatus && draggingStatus !== status.id) {
        onStatusDrop(status.id);
        onStatusDragEnd();
        return;
      }

      const id = draggingTaskIdRef.current;
      if (!canWriteTasks || !id) return;
      // Dropped in empty area (below all cards) → append to end
      await onMoveTask(id, status.id, null);
      onTaskDragEnd();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canWriteTasks, status.id]
  );

  return (
    <section
      data-testid="board-column"
      data-status-col={status.id}
      data-status-id={status.id}
      className={classes.column}
      onDragOver={(e) => {
        if (!canWriteTasks) return;
        const draggingStatus = draggingStatusIdRef.current;
        const draggingTask = draggingTaskIdRef.current;
        if (draggingStatus && draggingStatus !== status.id) {
          e.preventDefault();
          e.currentTarget.setAttribute('data-status-over', '1');
        } else if (draggingTask) {
          e.preventDefault();
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          e.currentTarget.removeAttribute('data-status-over');
        }
      }}
      onDrop={handleColumnDrop}
    >
      <Group className={classes.columnHeader} justify="space-between" wrap="nowrap">
        {canWriteTasks && (
          <Tooltip label="Drag to reorder column">
            <span
              className={classes.statusGrip}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                onStatusDragStart(status.id);
              }}
              onDragEnd={onStatusDragEnd}
              onDragOver={(e) => e.stopPropagation()}
            >
              <IconGripVertical size="1rem" />
            </span>
          </Tooltip>
        )}
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
        {displayTasks.map((task, displayIndex) => (
          <TaskCard
            key={task.id}
            task={task}
            canWriteTasks={canWriteTasks}
            topTarget={topTargetForIndex(displayIndex)}
            bottomTarget={bottomTargetForIndex(displayIndex)}
            statusId={status.id}
            onOpen={onOpenTask}
            onDragStart={onTaskDragStart}
            onDragEnd={onTaskDragEnd}
            onDrop={(sid, target) => {
              const id = draggingTaskIdRef.current;
              if (id) void onMoveTask(id, sid, target);
              onTaskDragEnd();
            }}
          />
        ))}
        {!ascTasks.length && (
          <Text size="sm" c="dimmed" className={classes.emptyColumn}>
            No tasks
          </Text>
        )}
      </Stack>
    </section>
  );
}
