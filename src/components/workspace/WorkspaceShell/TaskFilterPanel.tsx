import {
  Badge,
  Button,
  Checkbox,
  Group,
  MultiSelect,
  Popover,
  Select,
  Stack,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconFilter } from '@tabler/icons-react';
import { useWorkspaceShellContext } from './WorkspaceShellContext';

export function TaskFilterPanel() {
  const state = useWorkspaceShellContext();

  return (
    <Popover
      opened={state.filterMenuOpen}
      onChange={state.setFilterMenuOpen}
      position="bottom-start"
      width={340}
      withArrow
      shadow="md"
      trapFocus
    >
      <Popover.Target>
        <Button
          variant={state.filtersActive ? 'filled' : 'light'}
          leftSection={<IconFilter size="1rem" />}
          rightSection={
            state.activeFilterChips.length > 0 ? (
              <Badge size="xs" color="red" circle>
                {state.activeFilterChips.length}
              </Badge>
            ) : undefined
          }
          onClick={() => state.setFilterMenuOpen(!state.filterMenuOpen)}
          data-testid="filters-dropdown-button"
        >
          Filters
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Select
            data-testid="filter-status"
            label="Status"
            value={state.statusFilter}
            onChange={state.setStatusFilter}
            clearable
            placeholder="Any status"
            data={state.statuses.map((item) => ({ value: item.id, label: item.name }))}
          />
          <Select
            data-testid="filter-priority"
            label="Priority"
            value={state.priorityFilter}
            onChange={state.setPriorityFilter}
            clearable
            placeholder="Any priority"
            data={['LOW', 'NORMAL', 'HIGH', 'URGENT']}
          />
          <MultiSelect
            data-testid="filter-assignees"
            label="Assignees"
            value={state.assigneeFilter}
            onChange={state.setAssigneeFilter}
            clearable
            placeholder="Anyone"
            data={state.availableAssignees.map((user) => ({ value: user.id, label: user.name }))}
            searchable
          />
          <Tooltip
            label={
              state.currentOpenProjectUser
                ? 'Filter tasks assigned to you'
                : 'Your account is not linked to an OpenProject user'
            }
          >
            <Button
              data-testid="filter-assigned-to-me"
              variant={state.assignedToMeActive ? 'filled' : 'light'}
              size="xs"
              disabled={!state.currentOpenProjectUser}
              onClick={() => {
                if (!state.currentOpenProjectUser) return;
                state.setAssigneeFilter(
                  state.assignedToMeActive ? [] : [state.currentOpenProjectUser.id]
                );
              }}
            >
              Assigned to me
            </Button>
          </Tooltip>
          <MultiSelect
            data-testid="filter-responsible"
            label="Responsible"
            value={state.responsibleFilter}
            onChange={state.setResponsibleFilter}
            clearable
            placeholder="Anyone"
            data={state.availableAssignees.map((user) => ({ value: user.id, label: user.name }))}
            searchable
            maxValues={1}
          />
          <MultiSelect
            data-testid="filter-type"
            label="Type"
            value={state.typeFilter}
            onChange={state.setTypeFilter}
            clearable
            placeholder="Any type"
            data={state.taskTypes.map((type) => ({ value: type.id, label: type.name }))}
            searchable
          />
          <MultiSelect
            data-testid="filter-tags"
            label="Tags"
            value={state.tagFilter}
            onChange={state.setTagFilter}
            clearable
            placeholder="Any tag"
            data={state.openProjectTags.map((tag) => ({ value: tag.id, label: tag.name }))}
            searchable
          />
          <TextInput
            data-testid="filter-due-before"
            label="Due before"
            type="date"
            value={state.dueBeforeFilter}
            onChange={(event) => state.setDueBeforeFilter(event.currentTarget.value)}
          />
          <TextInput
            data-testid="filter-updated-since"
            label="Updated since"
            type="date"
            value={state.updatedSinceFilter}
            onChange={(event) => state.setUpdatedSinceFilter(event.currentTarget.value)}
          />
          <Group gap="lg">
            <Checkbox
              data-testid="filter-overdue"
              label="Overdue only"
              checked={state.overdueFilter}
              onChange={(event) => state.setOverdueFilter(event.currentTarget.checked)}
            />
            <Checkbox
              data-testid="filter-has-pr"
              label="Has GitHub PR"
              checked={state.hasGitHubPrFilter}
              onChange={(event) => state.setHasGitHubPrFilter(event.currentTarget.checked)}
            />
          </Group>
          {state.filtersActive && (
            <Button
              variant="subtle"
              color="red"
              size="xs"
              onClick={() => {
                state.clearFilters();
                state.setFilterMenuOpen(false);
              }}
              data-testid="clear-filters-button"
            >
              Clear all filters
            </Button>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
