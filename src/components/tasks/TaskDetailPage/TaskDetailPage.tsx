import { Button, Group, Paper, Stack, Tabs, Text, TextInput, Tooltip, Badge } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useRef, useState } from 'react';
import { listToOpProjectId, useProjectUsers } from '@/hooks/useProjectUsers';
import { useTaskDetailData } from '@/hooks/useTaskDetailData';
import {
  getErrorMessage,
  getTask,
  setTaskTags,
  showToast,
  stripClickUpMeta,
  toDateInput,
  updateTask,
  type Task,
  type TaskStatus,
  type User,
  type Workspace,
} from '@/lib';
import { TaskChecklists } from '../TaskChecklists/TaskChecklists';
import { TaskRelations } from '../TaskRelations/TaskRelations';
import { TaskActivityTab } from './TaskActivityTab';
import { TaskCustomFieldsTab } from './TaskCustomFieldsTab';
import { TaskDescription } from './TaskDescription/TaskDescription';
import { TaskDetailsGrid } from './TaskDetailsGrid';
import { TaskFilesTab } from './TaskFilesTab';
import { TaskGitHubTab } from './TaskGitHubTab';
import { TaskSubtasksTab } from './TaskSubtasksTab';
import { TaskTimeTab } from './TaskTimeTab';
import classes from './TaskDetailPage.module.css';

export interface TaskDetailPageProps {
  task: Task;
  workspace: Workspace;
  statuses: TaskStatus[];
  fallbackUsers?: User[];
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
  fallbackUsers = [],
  onBack,
  onSaved,
  onOpenSubtask,
  onError,
  canWriteTasks,
}: TaskDetailPageProps) {
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

  const detailsFormRef = useRef(detailsForm);
  detailsFormRef.current = detailsForm;

  useEffect(() => {
    detailsFormRef.current.setValues({
      title: task.title,
      description: stripClickUpMeta(task.description),
      statusId: task.statusId || '',
      priority: task.priority,
      assigneeIds: task.assignee ? [task.assignee.id] : [],
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

      <TaskDetailsGrid
        task={task}
        workspace={workspace}
        form={detailsForm as Parameters<typeof TaskDetailsGrid>[0]['form']}
        workspaceTags={workspaceTags}
        setWorkspaceTags={setWorkspaceTags}
        taskTagIds={taskTagIds}
        tagSaving={tagSaving}
        statuses={statuses}
        projectUsers={projectUsers.length > 0 ? projectUsers : fallbackUsers}
        projectUsersLoading={projectUsersLoading}
        canWriteTasks={canWriteTasks}
        onUpdateAndRefresh={updateAndRefresh}
        onSyncTags={syncTaskTags}
      />

      <TaskDescription
        value={detailsForm.values.description}
        canWriteTasks={canWriteTasks}
        onChange={(description) => detailsForm.setFieldValue('description', description)}
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
