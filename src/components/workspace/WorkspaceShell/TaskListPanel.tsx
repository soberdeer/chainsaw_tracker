import {
  ActionIcon,
  Alert,
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
import type { OpenProjectTaskTypeOption, Tag, Task, TaskStatus, User } from '@/lib';
import { GroupedTaskList } from '../../tasks/StatusIcon';
import { BulkUpdateBar } from './BulkUpdateBar';
import { TaskFilterPanel } from './TaskFilterPanel';
import classes from './WorkspaceShell.module.css';

interface EmptyState {
  title: string;
  message: string;
  actionLabel?: string;
}

interface TaskListPanelProps {
  // task data
  tasks: Task[];
  tasksLoading: boolean;
  tasksError: string | null;
  nextCursor: string | null;
  emptyState: EmptyState;
  // filter state
  taskSearch: string;
  statusFilter: string | null;
  priorityFilter: string | null;
  assigneeFilter: string[];
  responsibleFilter: string[];
  typeFilter: string[];
  tagFilter: string[];
  dueBeforeFilter: string;
  updatedSinceFilter: string;
  overdueFilter: boolean;
  hasGitHubPrFilter: boolean;
  filtersActive: boolean;
  filterMenuOpen: boolean;
  activeFilterChips: { key: string; label: string }[];
  sortDir: 'asc' | 'desc';
  // filter setters
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string | null) => void;
  onPriorityChange: (value: string | null) => void;
  onAssigneesChange: (value: string[]) => void;
  onResponsibleChange: (value: string[]) => void;
  onTypeChange: (value: string[]) => void;
  onTagsChange: (value: string[]) => void;
  onDueBeforeChange: (value: string) => void;
  onUpdatedSinceChange: (value: string) => void;
  onOverdueChange: (value: boolean) => void;
  onHasGitHubPrChange: (value: boolean) => void;
  onFilterMenuOpenChange: (value: boolean) => void;
  onClearFilters: () => void;
  onToggleSortDir: () => void;
  // reference data
  statuses: TaskStatus[];
  availableAssignees: User[];
  taskTypes: OpenProjectTaskTypeOption[];
  openProjectTags: Tag[];
  currentOpenProjectUser: { id: string } | undefined;
  assignedToMeActive: boolean;
  // task actions
  canWriteTasks: boolean;
  isWorkspaceWide: boolean;
  activeTaskListId?: string;
  selectedTaskIds: Set<string>;
  onAddTask: (statusId: string) => void;
  onOpenTask: (task: Task) => void;
  onMoveTask: (
    taskId: string,
    statusId: string,
    targetTaskId?: string | null
  ) => Promise<void> | void;
  onTaskChanged: () => void;
  onError: (message: string) => void;
  onSelectedTaskChange: (taskId: string, selected: boolean) => void;
  onBulkStatus: (statusId: string) => void;
  onBulkPriority: (priority: string) => void;
  onBulkAssignees: (ids: string[]) => void;
  onClearSelection: () => void;
  onLoadMore: () => void;
}

export function TaskListPanel({
  tasks,
  tasksLoading,
  tasksError,
  nextCursor,
  emptyState,
  taskSearch,
  statusFilter,
  priorityFilter,
  assigneeFilter,
  responsibleFilter,
  typeFilter,
  tagFilter,
  dueBeforeFilter,
  updatedSinceFilter,
  overdueFilter,
  hasGitHubPrFilter,
  filtersActive,
  filterMenuOpen,
  activeFilterChips,
  sortDir,
  onSearchChange,
  onStatusChange,
  onPriorityChange,
  onAssigneesChange,
  onResponsibleChange,
  onTypeChange,
  onTagsChange,
  onDueBeforeChange,
  onUpdatedSinceChange,
  onOverdueChange,
  onHasGitHubPrChange,
  onFilterMenuOpenChange,
  onClearFilters,
  onToggleSortDir,
  statuses,
  availableAssignees,
  taskTypes,
  openProjectTags,
  currentOpenProjectUser,
  assignedToMeActive,
  canWriteTasks,
  isWorkspaceWide,
  activeTaskListId,
  selectedTaskIds,
  onAddTask,
  onOpenTask,
  onMoveTask,
  onTaskChanged,
  onError,
  onSelectedTaskChange,
  onBulkStatus,
  onBulkPriority,
  onBulkAssignees,
  onClearSelection,
  onLoadMore,
}: TaskListPanelProps) {
  return (
    <Stack gap={0}>
      <Group className={classes.taskToolbar} justify="space-between" data-testid="filter-bar">
        <Group gap="xs">
          <TextInput
            data-testid="filter-search"
            value={taskSearch}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            placeholder="Search tasks…"
            leftSection={<IconSearch size="1rem" />}
            w="14rem"
          />
          <TaskFilterPanel
            opened={filterMenuOpen}
            onOpenChange={onFilterMenuOpenChange}
            statusFilter={statusFilter}
            priorityFilter={priorityFilter}
            assigneeFilter={assigneeFilter}
            responsibleFilter={responsibleFilter}
            typeFilter={typeFilter}
            tagFilter={tagFilter}
            dueBeforeFilter={dueBeforeFilter}
            updatedSinceFilter={updatedSinceFilter}
            overdueFilter={overdueFilter}
            hasGitHubPrFilter={hasGitHubPrFilter}
            filtersActive={filtersActive}
            activeFilterChipsCount={activeFilterChips.length}
            onStatusChange={onStatusChange}
            onPriorityChange={onPriorityChange}
            onAssigneesChange={onAssigneesChange}
            onResponsibleChange={onResponsibleChange}
            onTypeChange={onTypeChange}
            onTagsChange={onTagsChange}
            onDueBeforeChange={onDueBeforeChange}
            onUpdatedSinceChange={onUpdatedSinceChange}
            onOverdueChange={onOverdueChange}
            onHasGitHubPrChange={onHasGitHubPrChange}
            onClear={onClearFilters}
            statuses={statuses}
            assignees={availableAssignees}
            taskTypes={taskTypes}
            tags={openProjectTags}
            currentOpenProjectUser={currentOpenProjectUser}
            assignedToMeActive={assignedToMeActive}
          />
        </Group>
        <Group gap="xs">
          <Tooltip
            label={
              sortDir === 'asc'
                ? 'Sort statuses: Backlog → Shipped (click to reverse)'
                : 'Sort statuses: Shipped → Backlog (click to reverse)'
            }
          >
            <ActionIcon
              variant="light"
              aria-label="Toggle sort direction"
              data-testid="sort-direction-toggle"
              onClick={onToggleSortDir}
            >
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
              data-testid="add-task-button"
            >
              Add Task
            </Button>
          )}
        </Group>
      </Group>
      {activeFilterChips.length > 0 && (
        <Group gap="xs">
          {activeFilterChips.map((chip) => (
            <Badge key={chip.key} variant="light">
              {chip.label}
            </Badge>
          ))}
        </Group>
      )}
      {tasksError && (
        <Alert color="red" title="Could not load tasks">
          {tasksError}
        </Alert>
      )}
      {selectedTaskIds.size > 0 && canWriteTasks && (
        <BulkUpdateBar
          selectedCount={selectedTaskIds.size}
          statuses={statuses}
          assignees={availableAssignees}
          onBulkStatus={onBulkStatus}
          onBulkPriority={onBulkPriority}
          onBulkAssignees={onBulkAssignees}
          onClearSelection={onClearSelection}
        />
      )}
      {tasksLoading && !tasks.length ? (
        <Box className={classes.center} p="xl">
          <Loader />
        </Box>
      ) : tasks.length === 0 ? (
        <Box p="xl">
          <Stack gap="sm">
            <Text fw={700}>{emptyState.title}</Text>
            <Text c="dimmed">{emptyState.message}</Text>
            {emptyState.actionLabel && (
              <Button variant="light" onClick={onClearFilters}>
                {emptyState.actionLabel}
              </Button>
            )}
          </Stack>
        </Box>
      ) : (
        <GroupedTaskList
          tasks={tasks}
          statuses={statuses}
          onAddTask={onAddTask}
          onOpenTask={onOpenTask}
          onMoveTask={onMoveTask}
          onChanged={onTaskChanged}
          onError={onError}
          canWriteTasks={canWriteTasks}
          selectedTaskIds={selectedTaskIds}
          onSelectedTaskChange={onSelectedTaskChange}
          sortDir={sortDir}
        />
      )}
      {nextCursor && (
        <Button
          data-testid="load-more-tasks"
          data-next-cursor={nextCursor}
          type="button"
          variant="subtle"
          loading={tasksLoading}
          onClick={onLoadMore}
        >
          Load more
        </Button>
      )}
    </Stack>
  );
}
