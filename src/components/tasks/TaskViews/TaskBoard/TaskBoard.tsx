import { Badge, Box, Button, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { displayStatus, type Task, type TaskStatus } from '@/lib';
import { KanbanCard } from '../KanbanCard/KanbanCard';
import classes from './TaskBoard.module.css';

export interface TaskBoardProps {
  tasks: Task[];
  statuses: TaskStatus[];
  onAddTask: (statusId: string) => void;
  onOpenTask: (task: Task) => void;
  onReorderTasks: (taskId: string, statusId: string, orderedTaskIds: string[]) => void;
  onChanged: () => void;
  onError: (message: string) => void;
}

export function TaskBoard({
  tasks,
  statuses,
  onAddTask,
  onOpenTask,
  onReorderTasks,
  onChanged,
  onError,
}: TaskBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const orderedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.position - b.position),
    [statuses]
  );

  return (
    <Box className={classes.boardScroller}>
      <Box className={classes.boardTrack}>
        {orderedStatuses.map((status) => {
          const meta = displayStatus(status);
          const columnTasks = tasks
            .filter((task) => task.statusId === status.id || task.status === status.name)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
          const reorderIntoColumn = (taskId: string, targetTaskId?: string) => {
            const withoutDragged = columnTasks
              .filter((task) => task.id !== taskId)
              .map((task) => task.id);
            const targetIndex = targetTaskId ? withoutDragged.indexOf(targetTaskId) : -1;
            const nextIds = [...withoutDragged];
            nextIds.splice(targetIndex >= 0 ? targetIndex : nextIds.length, 0, taskId);
            onReorderTasks(taskId, status.id, nextIds);
          };

          return (
            <Box
              className={classes.kanbanColumn}
              key={status.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const taskId = draggedTaskId || event.dataTransfer.getData('text/task-id');
                if (taskId) {
                  reorderIntoColumn(taskId);
                }
                setDraggedTaskId(null);
              }}
            >
              <Group justify="space-between" mb="sm">
                <Group gap="xs">
                  <Tooltip label={`Status: ${meta.label}`}>
                    <Box className={classes.statusDot} style={{ background: meta.color }} />
                  </Tooltip>
                  <Text fw={700}>{meta.label}</Text>
                </Group>
                <Tooltip label={`${columnTasks.length} tasks in ${meta.label}`}>
                  <Badge variant="light">{columnTasks.length}</Badge>
                </Tooltip>
              </Group>
              <Stack gap="sm">
                {columnTasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    onOpen={onOpenTask}
                    onDragStart={(taskId) => setDraggedTaskId(taskId)}
                    onDropOnTask={(targetTaskId) => {
                      const taskId = draggedTaskId;
                      if (taskId && taskId !== targetTaskId) {
                        reorderIntoColumn(taskId, targetTaskId);
                      }
                      setDraggedTaskId(null);
                    }}
                    onChanged={onChanged}
                    onError={onError}
                  />
                ))}
                <Button
                  variant="subtle"
                  leftSection={<IconPlus size="1rem" />}
                  onClick={() => onAddTask(status.id)}
                >
                  Add Task
                </Button>
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
