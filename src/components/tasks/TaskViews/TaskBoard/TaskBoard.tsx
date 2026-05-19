import { Badge, Box, Group, ScrollArea, Stack, Text, Tooltip } from '@mantine/core';
import { IconGripVertical, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import type { Task, TaskStatus } from '@/lib';
import { AvatarStack } from '../../../common/AvatarStack';
import classes from './TaskBoard.module.css';

export interface TaskBoardProps {
  tasks: Task[];
  statuses: TaskStatus[];
  canWriteTasks: boolean;
  onOpenTask: (task: Task) => void;
  onAddTask: (statusId: string) => void;
  onMoveTask: (taskId: string, statusId: string) => Promise<void> | void;
}

export function TaskBoard({
  tasks,
  statuses,
  canWriteTasks,
  onOpenTask,
  onAddTask,
  onMoveTask,
}: TaskBoardProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const grouped = new Map(statuses.map((status) => [status.id, [] as Task[]]));

  tasks.forEach((task) => {
    const key = task.statusId || statuses[0]?.id;
    if (!key) return;
    grouped.set(key, [...(grouped.get(key) || []), task]);
  });

  return (
    <ScrollArea type="auto" className={classes.boardScroll}>
      <Group align="stretch" gap="md" wrap="nowrap" className={classes.board}>
        {statuses.map((status) => {
          const columnTasks = grouped.get(status.id) || [];
          return (
            <section
              key={status.id}
              className={classes.column}
              onDragOver={(event) => {
                if (canWriteTasks) event.preventDefault();
              }}
              onDrop={async (event) => {
                event.preventDefault();
                if (!canWriteTasks || !draggingTaskId) return;
                await onMoveTask(draggingTaskId, status.id);
                setDraggingTaskId(null);
              }}
            >
              <Group className={classes.columnHeader} justify="space-between" wrap="nowrap">
                <Tooltip label={status.name}>
                  <Badge variant="light">{status.name}</Badge>
                </Tooltip>
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" c="dimmed">
                    {columnTasks.length}
                  </Text>
                  {canWriteTasks && (
                    <Tooltip label={`Add task to ${status.name}`}>
                      <button
                        type="button"
                        className={classes.iconButton}
                        onClick={() => onAddTask(status.id)}
                      >
                        <IconPlus size="1rem" />
                      </button>
                    </Tooltip>
                  )}
                </Group>
              </Group>

              <Stack gap="sm" className={classes.cards}>
                {columnTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className={classes.card}
                    draggable={canWriteTasks}
                    onDragStart={() => setDraggingTaskId(task.id)}
                    onDragEnd={() => setDraggingTaskId(null)}
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
                        <Group gap="xs" mt="xs" wrap="nowrap">
                          <Tooltip label={`Priority: ${task.priority}`}>
                            <Badge variant="light">{task.priority}</Badge>
                          </Tooltip>
                          {task.assignees?.length ? (
                            <AvatarStack users={task.assignees} size="1.5rem" max={3} />
                          ) : null}
                        </Group>
                      </Box>
                    </Group>
                  </button>
                ))}
                {!columnTasks.length && (
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
