import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconPlus, IconSearch, IconSortAscending, IconSortDescending } from '@tabler/icons-react';
import { GroupedTaskList } from '../../tasks/StatusIcon';
import { BulkUpdateBar } from './BulkUpdateBar';
import { TaskFilterPanel } from './TaskFilterPanel';
import { useWorkspaceShellContext } from './WorkspaceShellContext';
import classes from './WorkspaceShell.module.css';

export function TaskListPanel() {
  const state = useWorkspaceShellContext();

  return (
    <Stack gap={0}>
      <Group className={classes.taskToolbar} justify="space-between" data-testid="filter-bar">
        <Group gap="xs">
          <TextInput
            data-testid="filter-search"
            value={state.taskSearch}
            onChange={(event) => state.setTaskSearch(event.currentTarget.value)}
            placeholder="Search tasks…"
            leftSection={<IconSearch size="1rem" />}
            w="14rem"
          />
        </Group>
        <Group gap="xs">
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
              data-testid="sort-direction-toggle"
              onClick={state.toggleSortDirection}
            >
              {state.sortDir === 'asc' ? (
                <IconSortAscending size="1rem" />
              ) : (
                <IconSortDescending size="1rem" />
              )}
            </ActionIcon>
          </Tooltip>
          {state.canWriteTasks && !state.isWorkspaceWide && state.activeTaskList?.id && (
            <Button
              color="teal"
              leftSection={<IconPlus size="1rem" />}
              onClick={() => state.statuses[0] && state.addTask(state.statuses[0].id)}
              data-testid="add-task-button"
            >
              Add Task
            </Button>
          )}
        </Group>
      </Group>
      <TaskFilterPanel />
      {state.activeFilterChips.length > 0 && (
        <Group gap="xs">
          {state.activeFilterChips.map((chip) => (
            <Badge key={chip.key} variant="light">
              {chip.label}
            </Badge>
          ))}
        </Group>
      )}
      {state.selectedTaskIds.size > 0 && state.canWriteTasks && <BulkUpdateBar />}
      {state.tasksError ? (
        <Box p="xl">
          <Stack gap="xs">
            <Text fw={700} c="red">
              Could not load tasks
            </Text>
            <Text c="dimmed" size="sm">
              {state.tasksError}
            </Text>
          </Stack>
        </Box>
      ) : state.tasksLoading && !state.tasks.length ? (
        <Box className={classes.center} p="xl">
          <Loader />
        </Box>
      ) : state.tasks.length === 0 ? (
        <Box p="xl">
          <Stack gap="sm">
            <Text fw={700}>{state.emptyState.title}</Text>
            <Text c="dimmed">{state.emptyState.message}</Text>
            {state.emptyState.actionLabel && (
              <Button variant="light" onClick={state.clearFilters}>
                {state.emptyState.actionLabel}
              </Button>
            )}
          </Stack>
        </Box>
      ) : (
        <GroupedTaskList
          tasks={state.tasks}
          statuses={state.statuses}
          onAddTask={state.addTask}
          onOpenTask={state.openTask}
          onMoveTask={state.moveTask}
          onChanged={state.reload}
          onError={state.setActionError}
          canWriteTasks={state.canWriteTasks}
          selectedTaskIds={state.selectedTaskIds}
          onSelectedTaskChange={state.toggleSelectedTask}
          sortDir={state.sortDir}
        />
      )}
      {state.nextCursor && (
        <Button
          data-testid="load-more-tasks"
          data-next-cursor={state.nextCursor}
          type="button"
          variant="subtle"
          loading={state.tasksLoading}
          onClick={state.handleLoadMoreTasks}
        >
          Load more
        </Button>
      )}
    </Stack>
  );
}
