import { ActionIcon, Alert, Box, Button, Group, Loader, Tooltip } from '@mantine/core';
import { IconPlus, IconSortAscending, IconSortDescending } from '@tabler/icons-react';
import type { Task, TaskStatus } from '@/lib';
import { TaskBoard } from '../../tasks/TaskViews/TaskBoard/TaskBoard';
import classes from './WorkspaceShell.module.css';

interface BoardPanelProps {
  tasks: Task[];
  tasksLoading: boolean;
  tasksError: string | null;
  statuses: TaskStatus[];
  canWriteTasks: boolean;
  isWorkspaceWide: boolean;
  activeTaskListId?: string;
  sortDir: 'asc' | 'desc';
  onToggleSortDir: () => void;
  onAddTask: (statusId: string) => void;
  onOpenTask: (task: Task) => void;
  onMoveTask: (
    taskId: string,
    statusId: string,
    targetTaskId?: string | null
  ) => Promise<void> | void;
}

export function BoardPanel({
  tasks,
  tasksLoading,
  tasksError,
  statuses,
  canWriteTasks,
  isWorkspaceWide,
  activeTaskListId,
  sortDir,
  onToggleSortDir,
  onAddTask,
  onOpenTask,
  onMoveTask,
}: BoardPanelProps) {
  return (
    <div>
      <Group className={classes.taskToolbar} justify="flex-end">
        <Tooltip
          label={
            sortDir === 'asc'
              ? 'Sort statuses: Backlog → Shipped (click to reverse)'
              : 'Sort statuses: Shipped → Backlog (click to reverse)'
          }
        >
          <ActionIcon variant="light" aria-label="Toggle sort direction" onClick={onToggleSortDir}>
            {sortDir === 'asc' ? (
              <IconSortAscending size="1rem" />
            ) : (
              <IconSortDescending size="1rem" />
            )}
          </ActionIcon>
        </Tooltip>
        {canWriteTasks && !isWorkspaceWide && activeTaskListId && (
          <Button
            color="teal"
            leftSection={<IconPlus size="1rem" />}
            onClick={() => statuses[0] && onAddTask(statuses[0].id)}
            data-testid="board-add-task-button"
          >
            Add Task
          </Button>
        )}
      </Group>
      {tasksError && (
        <Alert color="red" title="Could not load tasks">
          {tasksError}
        </Alert>
      )}
      {tasksLoading && !tasks.length ? (
        <Box className={classes.center} p="xl">
          <Loader />
        </Box>
      ) : (
        <TaskBoard
          tasks={tasks}
          statuses={statuses}
          onAddTask={onAddTask}
          onOpenTask={onOpenTask}
          onMoveTask={onMoveTask}
          canWriteTasks={canWriteTasks}
          sortDir={sortDir}
        />
      )}
    </div>
  );
}
