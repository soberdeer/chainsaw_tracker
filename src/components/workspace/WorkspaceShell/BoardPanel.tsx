import { ActionIcon, Badge, Box, Button, Group, Loader, Tooltip } from '@mantine/core';
import { IconPlus, IconSortAscending, IconSortDescending } from '@tabler/icons-react';
import { TaskBoard } from '../../tasks/TaskViews/TaskBoard/TaskBoard';
import { useWorkspaceShellContext } from './WorkspaceShellContext';
import classes from './WorkspaceShell.module.css';

export function BoardPanel() {
  const state = useWorkspaceShellContext();

  return (
    <div>
      <Group className={classes.taskToolbar} justify="flex-end">
        {state.isWorkspaceWide && (
          <Tooltip label="Drag-and-drop card ordering is only available inside a specific folder view">
            <Badge color="gray" variant="light">
              Read-only
            </Badge>
          </Tooltip>
        )}
        <Tooltip
          label={
            state.sortDir === 'asc'
              ? 'Sort statuses: Backlog → Shipped (click to reverse)'
              : 'Sort statuses: Shipped → Backlog (click to reverse)'
          }
        >
          <ActionIcon
            variant="light"
            aria-label="Toggle sort direction"
            onClick={state.toggleSortDirection}
          >
            {state.sortDir === 'asc' ? (
              <IconSortAscending size="1rem" />
            ) : (
              <IconSortDescending size="1rem" />
            )}
          </ActionIcon>
        </Tooltip>
        {state.canManageBoardOrder && !state.isWorkspaceWide && state.activeTaskList?.id && (
          <Button
            color="teal"
            leftSection={<IconPlus size="1rem" />}
            onClick={() => state.statuses[0] && state.addTask(state.statuses[0].id)}
            data-testid="board-add-task-button"
          >
            Add Task
          </Button>
        )}
      </Group>
      {/*{tasksError && (*/}
      {/*  <Alert color="red" title="Could not load tasks">*/}
      {/*    {state.tasksError}*/}
      {/*  </Alert>*/}
      {/*)}*/}
      {state.tasksLoading && !state.tasks.length ? (
        <Box className={classes.center} p="xl">
          <Loader />
        </Box>
      ) : (
        <TaskBoard
          tasks={state.tasks}
          statuses={state.statuses}
          onAddTask={state.addTask}
          onOpenTask={state.openTask}
          onMoveTask={state.moveTask}
          canWriteTasks={state.canManageBoardOrder}
          sortDir={state.sortDir}
        />
      )}
    </div>
  );
}
