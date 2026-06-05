import {
  Badge,
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { IconCalendarDue, IconFlag } from '@tabler/icons-react';
import { useState } from 'react';
import {
  createOpenProjectTag,
  displayStatus,
  formatDueDate,
  formatHours,
  type Tag,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type User,
  type Workspace,
} from '@/lib';
import { UserSelect } from '../../common/UserSelect';
import classes from './TaskDetailPage.module.css';

interface DetailsFormValues {
  statusId: string;
  priority: TaskPriority | null;
  assigneeIds: string[];
  startDate: string;
  dueDate: string;
  estimatedHours: number | string;
}

interface TaskDetailsGridProps {
  task: Task;
  workspace: Workspace;
  form: UseFormReturnType<DetailsFormValues>;
  workspaceTags: Tag[];
  setWorkspaceTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  taskTagIds: string[];
  tagSaving: boolean;
  statuses: TaskStatus[];
  projectUsers: User[];
  projectUsersLoading: boolean;
  canWriteTasks: boolean;
  onUpdateAndRefresh: (input: Partial<Task> & Record<string, unknown>) => Promise<void>;
  onSyncTags: (ids: string[]) => Promise<void>;
}

export function TaskDetailsGrid({
  task,
  workspace,
  form,
  workspaceTags,
  setWorkspaceTags,
  taskTagIds,
  tagSaving,
  statuses,
  projectUsers,
  projectUsersLoading,
  canWriteTasks,
  onUpdateAndRefresh,
  onSyncTags,
}: TaskDetailsGridProps) {
  const [tagCreating, setTagCreating] = useState(false);
  const [tagSearch, setTagSearch] = useState('');

  const tagOptions = workspaceTags.map((t) => ({ value: t.id, label: t.name }));

  const handleTagChange = async (values: string[]) => {
    const createValue = values.find((v) => v.startsWith('__create__:'));
    if (createValue) {
      const name = createValue.slice('__create__:'.length);
      setTagCreating(true);
      try {
        const created = await createOpenProjectTag({ workspaceId: workspace.id, name });
        setWorkspaceTags((prev) =>
          [...prev.filter((t) => t.id !== created.id), created].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
        const next = values.filter((v) => !v.startsWith('__create__:')).concat(created.id);
        await onSyncTags(next);
      } finally {
        setTagCreating(false);
        setTagSearch('');
      }
    } else {
      await onSyncTags(values);
    }
  };

  const tagData = [
    ...tagOptions,
    ...(tagSearch.trim() &&
    !tagOptions.some((t) => t.label.toLowerCase() === tagSearch.trim().toLowerCase())
      ? [{ value: `__create__:${tagSearch.trim()}`, label: `+ Create "${tagSearch.trim()}"` }]
      : []),
  ];

  const due = formatDueDate(task.dueDate);
  const start = formatDueDate(task.startDate);
  const status = displayStatus(undefined, task.status);

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} mb="xl">
      <Select
        data-testid="task-status-select"
        label="Status"
        leftSection={<span className={classes.statusDot} style={{ background: status.color }} />}
        value={form.values.statusId}
        onChange={(value) => {
          form.setFieldValue('statusId', value || '');
          void onUpdateAndRefresh({ statusId: value || undefined });
        }}
        data={statuses.map((item) => ({ value: item.id, label: displayStatus(item).label }))}
        placeholder={status.label}
        searchable
        disabled={!canWriteTasks}
      />
      <UserSelect
        data-testid="task-assignee-select"
        label="Assignee"
        users={projectUsers}
        loading={projectUsersLoading}
        value={form.values.assigneeIds}
        onChange={(value) => {
          const single = value.slice(0, 1);
          form.setFieldValue('assigneeIds', single);
          void onUpdateAndRefresh({ assigneeIds: single });
        }}
        maxValues={1}
        disabled={!canWriteTasks}
      />
      <Stack gap="xs">
        <NumberInput
          label="Estimate"
          value={form.values.estimatedHours}
          onChange={(value) => form.setFieldValue('estimatedHours', value)}
          min={0}
          step={0.5}
          decimalScale={2}
          suffix="h"
          disabled={!canWriteTasks}
          onBlur={() =>
            void onUpdateAndRefresh({
              estimatedHours:
                form.values.estimatedHours === '' ? null : Number(form.values.estimatedHours),
            })
          }
        />
        <Group gap="xs">
          {formatHours(task.remainingHours) && (
            <Tooltip label="OpenProject remaining time">
              <Badge color="orange" variant="light">
                Remaining {formatHours(task.remainingHours)}
              </Badge>
            </Tooltip>
          )}
          {formatHours(task.spentHours) && (
            <Tooltip label="OpenProject spent time">
              <Badge color="teal" variant="light">
                Spent {formatHours(task.spentHours)}
              </Badge>
            </Tooltip>
          )}
        </Group>
      </Stack>
      <TextInput
        label="Start date"
        type="date"
        value={form.values.startDate}
        onChange={(e) => form.setFieldValue('startDate', e.currentTarget.value)}
        onBlur={() => void onUpdateAndRefresh({ startDate: form.values.startDate || undefined })}
        placeholder={start || 'No start'}
        readOnly={!canWriteTasks}
      />
      <TextInput
        label="Due date"
        type="date"
        leftSection={<IconCalendarDue size="1rem" />}
        value={form.values.dueDate}
        onChange={(e) => form.setFieldValue('dueDate', e.currentTarget.value)}
        onBlur={() => void onUpdateAndRefresh({ dueDate: form.values.dueDate || undefined })}
        placeholder={due || 'No due'}
        readOnly={!canWriteTasks}
      />
      <Select
        data-testid="task-priority-select"
        label="Priority"
        leftSection={<IconFlag size="1rem" />}
        value={form.values.priority ?? null}
        clearable
        onChange={(value) => {
          const next = (value as TaskPriority | null) ?? null;
          form.setFieldValue('priority', next);
          void onUpdateAndRefresh({ priority: next ?? undefined });
        }}
        data={['LOW', 'NORMAL', 'HIGH', 'URGENT']}
        disabled={!canWriteTasks}
      />
      <Stack gap="xs">
        <MultiSelect
          data-testid="task-tag-picker"
          label="Tags"
          data={tagData}
          value={taskTagIds}
          onChange={(value) => void handleTagChange(value)}
          searchable
          clearable
          searchValue={tagSearch}
          onSearchChange={setTagSearch}
          disabled={!canWriteTasks || tagSaving || tagCreating}
          placeholder="Search or create a tag…"
        />
        {canWriteTasks && (
          <Group gap="xs">
            <TextInput
              label="Create tag"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.currentTarget.value)}
              placeholder="Tag name…"
              disabled={tagSaving || tagCreating}
              style={{ flex: 1 }}
            />
            <Button
              mt="lg"
              size="xs"
              variant="light"
              disabled={
                !tagSearch.trim() ||
                tagOptions.some((t) => t.label.toLowerCase() === tagSearch.trim().toLowerCase()) ||
                tagSaving ||
                tagCreating
              }
              onClick={() =>
                void handleTagChange([...taskTagIds, `__create__:${tagSearch.trim()}`])
              }
            >
              Create and add
            </Button>
          </Group>
        )}
      </Stack>
      <Stack gap="xs">
        <Group gap="xs">
          {task.externalUrl && (
            <Button
              size="xs"
              variant="subtle"
              component="a"
              href={task.externalUrl}
              target="_blank"
            >
              Open OpenProject
            </Button>
          )}
          {task.syncedAt && (
            <Text size="xs" c="dimmed">
              Synced {new Date(task.syncedAt).toLocaleString()}
            </Text>
          )}
        </Group>
      </Stack>
    </SimpleGrid>
  );
}
