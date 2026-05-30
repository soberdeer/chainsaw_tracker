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
import type { OpenProjectTaskTypeOption, Tag, TaskStatus, User } from '@/lib';

interface TaskFilterPanelProps {
  opened: boolean;
  onOpenChange: (opened: boolean) => void;
  // values
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
  activeFilterChipsCount: number;
  // setters
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
  onClear: () => void;
  // data
  statuses: TaskStatus[];
  assignees: User[];
  taskTypes: OpenProjectTaskTypeOption[];
  tags: Tag[];
  currentOpenProjectUser: { id: string } | undefined;
  assignedToMeActive: boolean;
}

export function TaskFilterPanel({
  opened,
  onOpenChange,
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
  activeFilterChipsCount,
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
  onClear,
  statuses,
  assignees,
  taskTypes,
  tags,
  currentOpenProjectUser,
  assignedToMeActive,
}: TaskFilterPanelProps) {
  return (
    <Popover
      opened={opened}
      onChange={onOpenChange}
      position="bottom-start"
      width={340}
      withArrow
      shadow="md"
      trapFocus
    >
      <Popover.Target>
        <Button
          variant={filtersActive ? 'filled' : 'light'}
          leftSection={<IconFilter size="1rem" />}
          rightSection={
            activeFilterChipsCount > 0 ? (
              <Badge size="xs" color="red" circle>
                {activeFilterChipsCount}
              </Badge>
            ) : undefined
          }
          onClick={() => onOpenChange(!opened)}
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
            value={statusFilter}
            onChange={onStatusChange}
            clearable
            placeholder="Any status"
            data={statuses.map((item) => ({ value: item.id, label: item.name }))}
          />
          <Select
            data-testid="filter-priority"
            label="Priority"
            value={priorityFilter}
            onChange={onPriorityChange}
            clearable
            placeholder="Any priority"
            data={['LOW', 'NORMAL', 'HIGH', 'URGENT']}
          />
          <MultiSelect
            data-testid="filter-assignees"
            label="Assignees"
            value={assigneeFilter}
            onChange={onAssigneesChange}
            clearable
            placeholder="Anyone"
            data={assignees.map((user) => ({ value: user.id, label: user.name }))}
            searchable
          />
          <Tooltip
            label={
              currentOpenProjectUser
                ? 'Filter tasks assigned to you'
                : 'Your account is not linked to an OpenProject user'
            }
          >
            <Button
              data-testid="filter-assigned-to-me"
              variant={assignedToMeActive ? 'filled' : 'light'}
              size="xs"
              disabled={!currentOpenProjectUser}
              onClick={() => {
                if (!currentOpenProjectUser) return;
                onAssigneesChange(assignedToMeActive ? [] : [currentOpenProjectUser.id]);
              }}
            >
              Assigned to me
            </Button>
          </Tooltip>
          <MultiSelect
            data-testid="filter-responsible"
            label="Responsible"
            value={responsibleFilter}
            onChange={onResponsibleChange}
            clearable
            placeholder="Anyone"
            data={assignees.map((user) => ({ value: user.id, label: user.name }))}
            searchable
            maxValues={1}
          />
          <MultiSelect
            data-testid="filter-type"
            label="Type"
            value={typeFilter}
            onChange={onTypeChange}
            clearable
            placeholder="Any type"
            data={taskTypes.map((type) => ({ value: type.id, label: type.name }))}
            searchable
          />
          <MultiSelect
            data-testid="filter-tags"
            label="Tags"
            value={tagFilter}
            onChange={onTagsChange}
            clearable
            placeholder="Any tag"
            data={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
            searchable
          />
          <TextInput
            data-testid="filter-due-before"
            label="Due before"
            type="date"
            value={dueBeforeFilter}
            onChange={(event) => onDueBeforeChange(event.currentTarget.value)}
          />
          <TextInput
            data-testid="filter-updated-since"
            label="Updated since"
            type="date"
            value={updatedSinceFilter}
            onChange={(event) => onUpdatedSinceChange(event.currentTarget.value)}
          />
          <Group gap="lg">
            <Checkbox
              data-testid="filter-overdue"
              label="Overdue only"
              checked={overdueFilter}
              onChange={(event) => onOverdueChange(event.currentTarget.checked)}
            />
            <Checkbox
              data-testid="filter-has-pr"
              label="Has GitHub PR"
              checked={hasGitHubPrFilter}
              onChange={(event) => onHasGitHubPrChange(event.currentTarget.checked)}
            />
          </Group>
          {filtersActive && (
            <Button
              variant="subtle"
              color="red"
              size="xs"
              onClick={() => {
                onClear();
                onOpenChange(false);
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
