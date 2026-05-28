import {
  Badge,
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCalendarDue, IconFlag } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { listToOpProjectId, useProjectUsers } from '@/hooks/useProjectUsers';
import { useTaskDetailData } from '@/hooks/useTaskDetailData';
import {
  createOpenProjectTag,
  displayStatus,
  formatDueDate,
  formatHours,
  getErrorMessage,
  getTask,
  priorityColor,
  setTaskTags,
  showToast,
  stripClickUpMeta,
  toDateInput,
  updateTask,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type Workspace,
} from '@/lib';
import { UserSelect } from '../../common/UserSelect';
import { TaskChecklists } from '../TaskChecklists/TaskChecklists';
import { TaskRelations } from '../TaskRelations/TaskRelations';
import { TaskActivityTab } from './TaskActivityTab';
import { TaskCustomFieldsTab } from './TaskCustomFieldsTab';
import { TaskFilesTab } from './TaskFilesTab';
import { TaskGitHubTab } from './TaskGitHubTab';
import { TaskSubtasksTab } from './TaskSubtasksTab';
import { TaskTimeTab } from './TaskTimeTab';
import classes from './TaskDetailPage.module.css';

export interface TaskDetailPageProps {
  task: Task;
  workspace: Workspace;
  statuses: TaskStatus[];
  onBack: () => void;
  onSaved: (task: Task) => void;
  onOpenSubtask: (task: Task) => void;
  onError: (message: string) => void;
  canWriteTasks: boolean;
}

export function TaskDetailPage({
  task,
  workspace,
  statuses,
  onBack,
  onSaved,
  onOpenSubtask,
  onError,
  canWriteTasks,
}: TaskDetailPageProps) {
  const due = formatDueDate(task.dueDate);
  const start = formatDueDate(task.startDate);
  const status = displayStatus(undefined, task.status);
  const [saving, setSaving] = useState(false);
  const [tagSaving, setTagSaving] = useState(false);

  const {
    activity,
    timeEntries,
    totalHours,
    timeEntryActivities,
    timeActivitiesError,
    defaultTimeActivityId,
    attachments,
    customFields,
    setCustomFields,
    workspaceTags,
    setWorkspaceTags,
    taskTagIds,
    setTaskTagIds,
    repositories,
    refreshActivity,
    refreshTimeEntries,
    refreshAttachments,
  } = useTaskDetailData(task, workspace.id, onError);

  const detailsForm = useForm({
    initialValues: {
      title: task.title,
      description: stripClickUpMeta(task.description),
      statusId: task.statusId || '',
      priority: task.priority,
      assigneeIds: [] as string[],
      startDate: toDateInput(task.startDate),
      dueDate: toDateInput(task.dueDate),
      estimatedHours: task.estimatedHours ?? ('' as number | string),
    },
    validate: {
      title: (value) => (value.trim().length ? null : 'Task title is required'),
    },
  });

  const tagForm = useForm({
    initialValues: { newTagName: '' },
    validate: {
      newTagName: (value) => (value.trim().length ? null : 'Tag name is required'),
    },
  });

  const detailsFormRef = useRef(detailsForm);
  detailsFormRef.current = detailsForm;

  useEffect(() => {
    detailsFormRef.current.setValues({
      title: task.title,
      description: stripClickUpMeta(task.description),
      statusId: task.statusId || '',
      priority: task.priority,
      assigneeIds: (task.assignees || (task.assignee ? [task.assignee] : [])).map((u) => u.id),
      startDate: toDateInput(task.startDate),
      dueDate: toDateInput(task.dueDate),
      estimatedHours: task.estimatedHours ?? '',
    });
  }, [task]);

  const opProjectId = listToOpProjectId(task.taskListId ?? task.taskList?.id);
  const { users: projectUsers, loading: projectUsersLoading } = useProjectUsers(
    workspace.id,
    opProjectId
  );

  const tagOptions = workspaceTags.map((item) => ({ value: item.id, label: item.name }));

  const updateAndRefresh = async (input: Parameters<typeof updateTask>[1]) => {
    if (!canWriteTasks) return;
    try {
      onSaved(await updateTask(task.id, input));
      showToast({
        tone: 'success',
        title: 'Task updated',
        message: 'The OpenProject task was updated.',
      });
    } catch (error) {
      const message = getErrorMessage(error);
      onError(message);
      showToast({ tone: 'error', title: 'Could not update task', message });
    }
  };

  const save = detailsForm.onSubmit(async (values) => {
    if (!canWriteTasks) return;
    try {
      setSaving(true);
      const saved = await updateTask(task.id, {
        title: values.title,
        description: values.description,
        statusId: values.statusId || undefined,
        priority: values.priority,
        assigneeIds: values.assigneeIds,
        startDate: values.startDate || null,
        dueDate: values.dueDate || null,
        estimatedHours: values.estimatedHours === '' ? null : Number(values.estimatedHours) || null,
      });
      onSaved(saved);
      showToast({
        tone: 'success',
        title: 'Task saved',
        message: 'Task details were saved to OpenProject.',
      });
    } catch (error) {
      const message = getErrorMessage(error);
      onError(message);
      showToast({ tone: 'error', title: 'Could not save task', message });
    } finally {
      setSaving(false);
    }
  });

  const syncTaskTags = async (nextTagIds: string[]) => {
    const previousTagIds = taskTagIds;
    setTaskTagIds(nextTagIds);
    try {
      setTagSaving(true);
      const page = await setTaskTags(task.id, nextTagIds);
      setTaskTagIds(page.items.map((item) => item.id));
      onSaved(await getTask(task.id));
      showToast({
        tone: 'success',
        title: 'Tags updated',
        message: 'Task tags were saved for this OpenProject work package.',
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setTaskTagIds(previousTagIds);
      onError(message);
      showToast({ tone: 'error', title: 'Could not save tags', message });
    } finally {
      setTagSaving(false);
    }
  };

  const createAndAssignTag = tagForm.onSubmit(async (values) => {
    if (!canWriteTasks) return;
    try {
      setTagSaving(true);
      const created = await createOpenProjectTag({
        workspaceId: workspace.id,
        name: values.newTagName.trim(),
      });
      setWorkspaceTags((current) =>
        [...current.filter((item) => item.id !== created.id), created].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      tagForm.reset();
      const nextTagIds = [...new Set([...taskTagIds, created.id])];
      const page = await setTaskTags(task.id, nextTagIds);
      setTaskTagIds(page.items.map((item) => item.id));
      onSaved(await getTask(task.id));
      showToast({
        tone: 'success',
        title: 'Tag created',
        message: `Added ${created.name} to this work package.`,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      onError(message);
      showToast({ tone: 'error', title: 'Could not create tag', message });
    } finally {
      setTagSaving(false);
    }
  });

  const showGitHubTab = Boolean(
    (task.githubPullRequests?.length || 0) > 0 ||
    (task.githubBranches?.length || 0) > 0 ||
    repositories.length > 0
  );

  return (
    <Paper className={classes.detailPage} withBorder data-testid="task-detail-page">
      <Group justify="space-between" mb="lg">
        <TextInput
          data-testid="task-title-input"
          className={classes.titleInput}
          readOnly={!canWriteTasks}
          style={{ flexGrow: 1 }}
          {...detailsForm.getInputProps('title')}
        />
        <Group>
          {canWriteTasks && (
            <Button loading={saving} onClick={() => save()}>
              Save
            </Button>
          )}
          <Button type="button" variant="light" onClick={onBack}>
            Close
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }} mb="xl">
        <Select
          data-testid="task-status-select"
          label="Status"
          leftSection={<span className={classes.statusDot} style={{ background: status.color }} />}
          value={detailsForm.values.statusId}
          onChange={(value) => {
            detailsForm.setFieldValue('statusId', value || '');
            void updateAndRefresh({ statusId: value || undefined });
          }}
          data={statuses.map((item) => ({ value: item.id, label: displayStatus(item).label }))}
          placeholder={status.label}
          searchable
          disabled={!canWriteTasks}
        />
        {task.taskKey && <TextInput label="Task key" value={task.taskKey} readOnly />}
        <TextInput label="List" value={task.taskList?.name || task.taskListId || ''} readOnly />
        <UserSelect
          data-testid="task-assignee-select"
          label="Assignee / responsible"
          users={projectUsers}
          loading={projectUsersLoading}
          value={detailsForm.values.assigneeIds}
          onChange={(value) => {
            detailsForm.setFieldValue('assigneeIds', value);
            void updateAndRefresh({ assigneeIds: value });
          }}
          maxValues={2}
          disabled={!canWriteTasks}
        />
        <Stack gap="xs">
          <NumberInput
            label="Estimate"
            value={detailsForm.values.estimatedHours}
            onChange={(value) => detailsForm.setFieldValue('estimatedHours', value)}
            min={0}
            step={0.5}
            decimalScale={2}
            suffix="h"
            disabled={!canWriteTasks}
            onBlur={() =>
              void updateAndRefresh({
                estimatedHours:
                  detailsForm.values.estimatedHours === ''
                    ? null
                    : Number(detailsForm.values.estimatedHours),
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
          leftSection={<IconCalendarDue size="1rem" />}
          type="date"
          value={detailsForm.values.startDate}
          onChange={(event) => detailsForm.setFieldValue('startDate', event.currentTarget.value)}
          onBlur={() => void updateAndRefresh({ startDate: detailsForm.values.startDate || null })}
          placeholder={start || 'No start'}
          readOnly={!canWriteTasks}
        />
        <TextInput
          label="Due date"
          leftSection={<IconCalendarDue size="1rem" />}
          type="date"
          value={detailsForm.values.dueDate}
          onChange={(event) => detailsForm.setFieldValue('dueDate', event.currentTarget.value)}
          onBlur={() => void updateAndRefresh({ dueDate: detailsForm.values.dueDate || null })}
          placeholder={due || 'No due'}
          readOnly={!canWriteTasks}
        />
        <Select
          data-testid="task-priority-select"
          label="Priority"
          leftSection={<IconFlag size="1rem" />}
          value={detailsForm.values.priority}
          onChange={(value) => {
            const next = (value || 'NORMAL') as TaskPriority;
            detailsForm.setFieldValue('priority', next);
            void updateAndRefresh({ priority: next });
          }}
          data={['LOW', 'NORMAL', 'HIGH', 'URGENT']}
          disabled={!canWriteTasks}
        />
        <Stack gap="xs">
          <MultiSelect
            data-testid="task-tag-picker"
            label="Tags"
            data={tagOptions}
            value={taskTagIds}
            onChange={(value) => void syncTaskTags(value)}
            searchable
            clearable
            disabled={!canWriteTasks || tagSaving}
            description="Stored locally for this OpenProject work package. Tags do not create a duplicate local task."
          />
          {canWriteTasks && (
            <form onSubmit={createAndAssignTag}>
              <Group align="flex-end">
                <TextInput
                  label="Create tag"
                  placeholder="polish"
                  {...tagForm.getInputProps('newTagName')}
                />
                <Button type="submit" variant="light" loading={tagSaving}>
                  Create and add
                </Button>
              </Group>
            </form>
          )}
        </Stack>
        <Stack gap="xs">
          <Text fw={700}>Source</Text>
          <Group gap="xs">
            <Tooltip label={`Source: ${task.externalSource || 'LOCAL'}`}>
              <Badge>{task.externalSource || 'LOCAL'}</Badge>
            </Tooltip>
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
        <Stack gap="xs">
          <Text fw={700}>Location</Text>
          <Text size="sm" c="dimmed">
            {task.folder?.space?.name || workspace.name} / {task.folder?.name || task.folderId}
            {task.taskList?.name ? ` / ${task.taskList.name}` : ''}
          </Text>
        </Stack>
        <Stack gap="xs">
          <Text fw={700}>OpenProject URL</Text>
          {task.externalUrl ? (
            <Button size="xs" variant="light" component="a" href={task.externalUrl} target="_blank">
              Open in OpenProject
            </Button>
          ) : (
            <Text size="sm" c="dimmed">
              No OpenProject URL
            </Text>
          )}
        </Stack>
        <Stack gap="xs">
          <Text fw={700}>Priority badge</Text>
          <Tooltip label={`Priority: ${task.priority}`}>
            <Badge
              color={priorityColor[task.priority]}
              variant="light"
              style={{ alignSelf: 'flex-start' }}
            >
              {task.priority}
            </Badge>
          </Tooltip>
        </Stack>
      </SimpleGrid>

      <Textarea
        data-testid="task-description-input"
        label="Description"
        minRows={8}
        autosize
        mb="lg"
        readOnly={!canWriteTasks}
        {...detailsForm.getInputProps('description')}
      />

      <TaskChecklists
        taskId={task.id}
        canWriteTasks={canWriteTasks}
        onError={onError}
        onChanged={() => {
          void getTask(task.id)
            .then(onSaved)
            .catch((error) => onError(getErrorMessage(error)));
        }}
      />
      <TaskRelations
        taskId={task.id}
        canWriteTasks={canWriteTasks}
        onError={onError}
        onOpenTask={(targetTaskId) => {
          void getTask(targetTaskId)
            .then(onOpenSubtask)
            .catch((error) => onError(getErrorMessage(error)));
        }}
      />

      <Tabs defaultValue="subtasks">
        <Tabs.List>
          <Tabs.Tab value="details">Details</Tabs.Tab>
          {showGitHubTab && (
            <Tabs.Tab value="github" data-testid="github-tab">
              GitHub{' '}
              <Tooltip
                label={`${task.githubPullRequests?.length || 0} linked GitHub pull requests`}
              >
                <Badge size="xs">{task.githubPullRequests?.length || 0}</Badge>
              </Tooltip>
            </Tabs.Tab>
          )}
          <Tabs.Tab value="subtasks">
            Subtasks{' '}
            <Tooltip label={`${task.subtasks?.length || 0} subtasks`}>
              <Badge size="xs">{task.subtasks?.length || 0}</Badge>
            </Tooltip>
          </Tabs.Tab>
          <Tabs.Tab value="activity">Activity</Tabs.Tab>
          <Tabs.Tab value="time" data-testid="time-tab">
            Time
          </Tabs.Tab>
          <Tabs.Tab value="files">Files</Tabs.Tab>
          {customFields.length > 0 && <Tabs.Tab value="custom-fields">Custom fields</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <Stack>
            <Text c="dimmed">
              Task fields are saved through the OpenProject API. Local tracker UI keeps the context,
              but OpenProject remains the source of truth for work package data.
            </Text>
            <Text size="sm" c="dimmed">
              Relations, activity, files, and time entries are saved through OpenProject. Custom
              fields are shown read-only unless the OpenProject schema exposes editable metadata.
              Tags are stored as local metadata keyed by OpenProject work package id.
            </Text>
          </Stack>
        </Tabs.Panel>

        {showGitHubTab && (
          <Tabs.Panel value="github" pt="md">
            <TaskGitHubTab
              task={task}
              repositories={repositories}
              canWriteTasks={canWriteTasks}
              onSaved={onSaved}
              onError={onError}
            />
          </Tabs.Panel>
        )}

        <Tabs.Panel value="subtasks" pt="md">
          <TaskSubtasksTab
            task={task}
            statuses={statuses}
            users={projectUsers}
            usersLoading={projectUsersLoading}
            canWriteTasks={canWriteTasks}
            onSaved={onSaved}
            onOpenSubtask={onOpenSubtask}
            onError={onError}
          />
        </Tabs.Panel>

        <Tabs.Panel value="activity" pt="md">
          <TaskActivityTab
            taskId={task.id}
            activity={activity}
            canWriteTasks={canWriteTasks}
            onActivityRefresh={refreshActivity}
            onError={onError}
          />
        </Tabs.Panel>

        <Tabs.Panel value="time" pt="md">
          <TaskTimeTab
            taskId={task.id}
            timeEntries={timeEntries}
            totalHours={totalHours}
            timeEntryActivities={timeEntryActivities}
            timeActivitiesError={timeActivitiesError}
            defaultActivityId={defaultTimeActivityId}
            canWriteTasks={canWriteTasks}
            onTimeRefresh={refreshTimeEntries}
            onError={onError}
          />
        </Tabs.Panel>

        <Tabs.Panel value="files" pt="md">
          <TaskFilesTab
            taskId={task.id}
            attachments={attachments}
            canWriteTasks={canWriteTasks}
            onAttachmentsRefresh={refreshAttachments}
            onError={onError}
          />
        </Tabs.Panel>

        {customFields.length > 0 && (
          <Tabs.Panel value="custom-fields" pt="md">
            <TaskCustomFieldsTab
              taskId={task.id}
              customFields={customFields}
              canWriteTasks={canWriteTasks}
              onFieldsChange={setCustomFields}
              onError={onError}
            />
          </Tabs.Panel>
        )}
      </Tabs>
    </Paper>
  );
}
