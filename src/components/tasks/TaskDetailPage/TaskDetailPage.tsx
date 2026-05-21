import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  FileInput,
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
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconCalendarDue,
  IconExternalLink,
  IconFlag,
  IconGitPullRequest,
  IconLink,
  IconPaperclip,
  IconPlus,
  IconRefresh,
  IconClock,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import {
  addTaskComment,
  addTaskRelation,
  addTaskTimeEntry,
  deleteTaskRelation,
  getGitHubRepositories,
  getTask,
  getTaskActivity,
  getTaskAttachments,
  getTaskCustomFields,
  getTaskRelations,
  getTaskTimeEntries,
  linkTaskPullRequest,
  refreshTaskGitHub,
  showToast,
  uploadTaskAttachment,
  unlinkTaskPullRequest,
  updateTaskCustomField,
  updateTask,
  displayStatus,
  formatDueDate,
  getErrorMessage,
  priorityColor,
  toDateInput,
  type ActivityLog,
  type GitHubRepository,
  type OpenProjectAttachmentItem,
  type OpenProjectCustomFieldItem,
  type OpenProjectRelationItem,
  type OpenProjectTimeEntryItem,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type Workspace,
} from '@/lib';
import { AvatarStack } from '../../common/AvatarStack';
import { SubtaskModal } from './SubtaskModal/SubtaskModal';
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
  const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [commentSaving, setCommentSaving] = useState(false);
  const [relations, setRelations] = useState<OpenProjectRelationItem[]>([]);
  const [relationSaving, setRelationSaving] = useState(false);
  const [timeEntries, setTimeEntries] = useState<OpenProjectTimeEntryItem[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [timeSaving, setTimeSaving] = useState(false);
  const [attachments, setAttachments] = useState<OpenProjectAttachmentItem[]>([]);
  const [attachmentSaving, setAttachmentSaving] = useState(false);
  const [customFields, setCustomFields] = useState<OpenProjectCustomFieldItem[]>([]);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [githubBusy, setGithubBusy] = useState(false);
  const detailsForm = useForm({
    initialValues: {
      title: task.title,
      description: task.description || '',
      statusId: task.statusId || '',
      priority: task.priority,
      assigneeIds: [] as string[],
      startDate: toDateInput(task.startDate),
      dueDate: toDateInput(task.dueDate),
    },
    validate: {
      title: (value) => (value.trim().length ? null : 'Task title is required'),
    },
  });
  const commentForm = useForm({
    initialValues: {
      comment: '',
    },
  });
  const relationForm = useForm({
    initialValues: {
      relationTargetId: '',
      relationType: 'relates',
    },
    validate: {
      relationTargetId: (value) =>
        value.trim().length ? null : 'Target work package ID is required',
    },
  });
  const timeForm = useForm({
    initialValues: {
      timeHours: 1 as number | string,
      timeSpentOn: toDateInput(new Date().toISOString()),
      timeComment: '',
    },
    validate: {
      timeHours: (value) => (Number(value) > 0 ? null : 'Hours must be greater than zero'),
      timeSpentOn: (value) => (value ? null : 'Spent on date is required'),
    },
  });
  const attachmentForm = useForm({
    initialValues: {
      attachmentFile: null as File | null,
    },
  });
  const githubForm = useForm({
    initialValues: {
      selectedRepositoryId: '',
      manualPr: '',
    },
  });
  const githubSupportedForTask = task.externalSource !== 'OPENPROJECT';

  useEffect(() => {
    detailsForm.setValues({
      title: task.title,
      description: task.description || '',
      statusId: task.statusId || '',
      priority: task.priority,
      assigneeIds: (task.assignees || (task.assignee ? [task.assignee] : [])).map(
        (user) => user.id
      ),
      startDate: toDateInput(task.startDate),
      dueDate: toDateInput(task.dueDate),
    });
    commentForm.reset();
    relationForm.reset();
    timeForm.setValues({
      timeHours: 1,
      timeSpentOn: toDateInput(new Date().toISOString()),
      timeComment: '',
    });
    attachmentForm.reset();
    getTaskActivity(task.id)
      .then((page) => setActivity(page.items))
      .catch((error) => onError(getErrorMessage(error)));
    getTaskRelations(task.id)
      .then((page) => setRelations(page.items))
      .catch(() => setRelations([]));
    getTaskTimeEntries(task.id)
      .then((page) => {
        setTimeEntries(page.items);
        setTotalHours(page.totalHours);
      })
      .catch(() => {
        setTimeEntries([]);
        setTotalHours(0);
      });
    getTaskAttachments(task.id)
      .then((page) => setAttachments(page.items))
      .catch(() => setAttachments([]));
    getTaskCustomFields(task.id)
      .then((page) => setCustomFields(page.items))
      .catch(() => setCustomFields([]));
    if (githubSupportedForTask) {
      getGitHubRepositories(workspace.id)
        .then((items) => {
          setRepositories(items);
          githubForm.setValues({
            selectedRepositoryId: items[0]?.id || '',
            manualPr: '',
          });
        })
        .catch(() => setRepositories([]));
    } else {
      setRepositories([]);
      githubForm.reset();
    }
  }, [
    task,
    workspace,
    onError,
    githubSupportedForTask,
    detailsForm,
    commentForm,
    relationForm,
    timeForm,
    attachmentForm,
    githubForm,
  ]);

  const showGitHubTab = Boolean(
    githubSupportedForTask &&
    ((task.githubPullRequests?.length || 0) > 0 ||
      (task.githubBranches?.length || 0) > 0 ||
      repositories.length > 0)
  );

  const updateAndRefresh = async (input: Parameters<typeof updateTask>[1]) => {
    if (!canWriteTasks) {
      return;
    }
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
      showToast({
        tone: 'error',
        title: 'Could not update task',
        message,
      });
    }
  };

  const save = detailsForm.onSubmit(async (values) => {
    if (!canWriteTasks) {
      return;
    }
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
      showToast({
        tone: 'error',
        title: 'Could not save task',
        message,
      });
    } finally {
      setSaving(false);
    }
  });

  const submitComment = commentForm.onSubmit(async (values) => {
    if (!canWriteTasks || !values.comment.trim()) {
      return;
    }
    try {
      setCommentSaving(true);
      await addTaskComment(task.id, values.comment.trim());
      commentForm.reset();
      const page = await getTaskActivity(task.id);
      setActivity(page.items);
      showToast({
        tone: 'success',
        title: 'Comment posted',
        message: 'Your comment was saved in OpenProject activity.',
      });
    } catch (error) {
      const message = getErrorMessage(error);
      onError(message);
      showToast({
        tone: 'error',
        title: 'Could not post comment',
        message,
      });
    } finally {
      setCommentSaving(false);
    }
  });

  const submitRelation = relationForm.onSubmit(async (values) => {
    const trimmedTargetId = values.relationTargetId.trim();
    if (!canWriteTasks || !trimmedTargetId || trimmedTargetId === task.id) {
      return;
    }
    try {
      setRelationSaving(true);
      await addTaskRelation(task.id, {
        targetTaskId: trimmedTargetId,
        type: values.relationType,
      });
      relationForm.reset();
      const page = await getTaskRelations(task.id);
      setRelations(page.items);
      showToast({
        tone: 'success',
        title: 'Relation added',
        message: 'The dependency was saved in OpenProject.',
      });
    } catch (error) {
      const message = getErrorMessage(error);
      onError(message);
      showToast({
        tone: 'error',
        title: 'Could not add relation',
        message,
      });
    } finally {
      setRelationSaving(false);
    }
  });

  const submitTimeEntry = timeForm.onSubmit(async (values) => {
    if (!canWriteTasks || !Number(values.timeHours) || !values.timeSpentOn) {
      return;
    }
    try {
      setTimeSaving(true);
      await addTaskTimeEntry(task.id, {
        hours: Number(values.timeHours),
        spentOn: values.timeSpentOn,
        comment: values.timeComment,
      });
      timeForm.setValues({
        timeHours: 1,
        timeSpentOn: toDateInput(new Date().toISOString()),
        timeComment: '',
      });
      const page = await getTaskTimeEntries(task.id);
      setTimeEntries(page.items);
      setTotalHours(page.totalHours);
      showToast({
        tone: 'success',
        title: 'Time logged',
        message: 'The OpenProject time entry was created.',
      });
    } catch (error) {
      const message = getErrorMessage(error);
      onError(message);
      showToast({
        tone: 'error',
        title: 'Could not log time',
        message,
      });
    } finally {
      setTimeSaving(false);
    }
  });

  const submitAttachment = attachmentForm.onSubmit(async (values) => {
    if (!canWriteTasks || !values.attachmentFile) {
      return;
    }
    try {
      setAttachmentSaving(true);
      await uploadTaskAttachment(task.id, values.attachmentFile);
      attachmentForm.reset();
      const page = await getTaskAttachments(task.id);
      setAttachments(page.items);
      showToast({
        tone: 'success',
        title: 'Attachment uploaded',
        message: 'The file is now attached to the OpenProject task.',
      });
    } catch (error) {
      const message = getErrorMessage(error);
      onError(message);
      showToast({
        tone: 'error',
        title: 'Could not upload attachment',
        message,
      });
    } finally {
      setAttachmentSaving(false);
    }
  });

  const renderCustomFieldInput = (field: OpenProjectCustomFieldItem) => {
    const commonDescription = field.editable
      ? 'Saved through OpenProject custom field PATCH'
      : 'Read-only OpenProject custom field';

    if (field.kind === 'boolean') {
      return (
        <Checkbox
          label={field.label}
          checked={Boolean(field.rawValue)}
          disabled={!canWriteTasks || !field.editable}
          description={commonDescription}
          onChange={async (event) => {
            if (!canWriteTasks || !field.editable) return;
            try {
              const page = await updateTaskCustomField(
                task.id,
                field.key,
                event.currentTarget.checked
              );
              setCustomFields(page.items);
            } catch (error) {
              onError(getErrorMessage(error));
            }
          }}
        />
      );
    }

    if (field.kind === 'integer' || field.kind === 'float') {
      return (
        <NumberInput
          label={field.label}
          value={typeof field.rawValue === 'number' ? field.rawValue : undefined}
          decimalScale={field.kind === 'integer' ? 0 : 2}
          allowDecimal={field.kind === 'float'}
          allowNegative
          disabled={!canWriteTasks || !field.editable}
          description={commonDescription}
          onBlur={async (event) => {
            if (!canWriteTasks || !field.editable) return;
            const value = event.currentTarget.value.trim();
            if (!value || value === String(field.rawValue ?? '')) return;
            try {
              const page = await updateTaskCustomField(
                task.id,
                field.key,
                field.kind === 'integer' ? Number.parseInt(value, 10) : Number.parseFloat(value)
              );
              setCustomFields(page.items);
            } catch (error) {
              onError(getErrorMessage(error));
            }
          }}
        />
      );
    }

    if (field.kind === 'textarea') {
      return (
        <Textarea
          label={field.label}
          defaultValue={field.value}
          readOnly={!canWriteTasks || !field.editable}
          description={commonDescription}
          autosize
          minRows={3}
          onBlur={async (event) => {
            if (!canWriteTasks || !field.editable || event.currentTarget.value === field.value)
              return;
            try {
              const page = await updateTaskCustomField(
                task.id,
                field.key,
                event.currentTarget.value
              );
              setCustomFields(page.items);
            } catch (error) {
              onError(getErrorMessage(error));
            }
          }}
        />
      );
    }

    if (field.kind === 'date') {
      return (
        <TextInput
          label={field.label}
          type="date"
          defaultValue={typeof field.rawValue === 'string' ? field.rawValue : field.value}
          readOnly={!canWriteTasks || !field.editable}
          description={commonDescription}
          onBlur={async (event) => {
            if (!canWriteTasks || !field.editable || event.currentTarget.value === field.value)
              return;
            try {
              const page = await updateTaskCustomField(
                task.id,
                field.key,
                event.currentTarget.value
              );
              setCustomFields(page.items);
            } catch (error) {
              onError(getErrorMessage(error));
            }
          }}
        />
      );
    }

    return (
      <TextInput
        label={field.label}
        defaultValue={field.value}
        readOnly={!canWriteTasks || !field.editable}
        description={commonDescription}
        onBlur={async (event) => {
          if (!canWriteTasks || !field.editable || event.currentTarget.value === field.value)
            return;
          try {
            const page = await updateTaskCustomField(task.id, field.key, event.currentTarget.value);
            setCustomFields(page.items);
          } catch (error) {
            onError(getErrorMessage(error));
          }
        }}
      />
    );
  };

  return (
    <Paper className={classes.detailPage} withBorder>
      <SubtaskModal
        opened={subtaskModalOpen}
        parentTask={task}
        statuses={statuses}
        users={workspace.memberships.map((membership) => membership.user)}
        onClose={() => setSubtaskModalOpen(false)}
        onCreated={onSaved}
        onError={onError}
      />
      <Group justify="space-between" mb="lg">
        <TextInput
          className={classes.titleInput}
          readOnly={!canWriteTasks}
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
        <MultiSelect
          label="Assignee / responsible"
          leftSection={<IconUsers size="1rem" />}
          value={detailsForm.values.assigneeIds}
          onChange={(value) => {
            detailsForm.setFieldValue('assigneeIds', value);
            void updateAndRefresh({ assigneeIds: value });
          }}
          data={workspace.memberships.map((membership) => ({
            value: membership.user.id,
            label: membership.user.name,
          }))}
          searchable
          clearable
          maxValues={2}
          description="OpenProject stores one assignee and one responsible user."
          disabled={!canWriteTasks}
        />
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
        <TextInput label="Tags" value={task.tags.map(({ tag }) => tag.name).join(', ')} readOnly />
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
      </SimpleGrid>

      <Textarea
        label="Description"
        minRows={8}
        autosize
        mb="lg"
        readOnly={!canWriteTasks}
        {...detailsForm.getInputProps('description')}
      />

      <Tabs defaultValue="subtasks">
        <Tabs.List>
          <Tabs.Tab value="details">Details</Tabs.Tab>
          {showGitHubTab && (
            <Tabs.Tab value="github">
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
          <Tabs.Tab value="relations">Relations</Tabs.Tab>
          <Tabs.Tab value="time">Time</Tabs.Tab>
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
            </Text>
          </Stack>
        </Tabs.Panel>
        {showGitHubTab && (
          <Tabs.Panel value="github" pt="md">
            <Paper withBorder className={classes.relationshipPanel}>
              <Group justify="space-between" mb="md">
                <Title order={3}>GitHub</Title>
                <Tooltip label={`Development status: ${task.developmentStatus || 'NOT_STARTED'}`}>
                  <Badge variant="light">{task.developmentStatus || 'NOT_STARTED'}</Badge>
                </Tooltip>
              </Group>
              <Stack>
                {(task.githubBranches || []).map((branch) => (
                  <Group
                    key={branch.id}
                    justify="space-between"
                    className={classes.relationshipRow}
                  >
                    <Group gap="xs">
                      <Tooltip label="GitHub branch">
                        <IconGitPullRequest size="1rem" />
                      </Tooltip>
                      <Text fw={700}>{branch.name}</Text>
                    </Group>
                    {branch.url && (
                      <Button
                        size="xs"
                        variant="subtle"
                        component="a"
                        href={branch.url}
                        target="_blank"
                        leftSection={<IconExternalLink size="0.875rem" />}
                      >
                        Open
                      </Button>
                    )}
                  </Group>
                ))}
                {(task.githubPullRequests || []).map((pr) => (
                  <Paper key={pr.id} withBorder p="md">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={2}>
                        <Text fw={800}>
                          #{pr.number} {pr.title}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {pr.repository?.owner}/{pr.repository?.repo} • {pr.headBranch} →{' '}
                          {pr.baseBranch}
                        </Text>
                        <Group gap="xs">
                          <Tooltip label={`PR state: ${pr.state}`}>
                            <Badge>{pr.state}</Badge>
                          </Tooltip>
                          <Tooltip label={`PR readiness: ${pr.draft ? 'Draft' : 'Ready'}`}>
                            <Badge color={pr.draft ? 'gray' : 'green'}>
                              {pr.draft ? 'Draft' : 'Ready'}
                            </Badge>
                          </Tooltip>
                          <Tooltip label={`Review status: ${pr.reviewStatus}`}>
                            <Badge
                              color={
                                pr.reviewStatus === 'CHANGES_REQUESTED'
                                  ? 'red'
                                  : pr.reviewStatus === 'APPROVED'
                                    ? 'green'
                                    : 'blue'
                              }
                            >
                              {pr.reviewStatus}
                            </Badge>
                          </Tooltip>
                          {pr.authorLogin && (
                            <Tooltip label={`Author: ${pr.authorLogin}`}>
                              <Badge variant="light">{pr.authorLogin}</Badge>
                            </Tooltip>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed">
                          Last sync: {pr.syncedAt ? new Date(pr.syncedAt).toLocaleString() : '-'}
                        </Text>
                      </Stack>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="subtle"
                          component="a"
                          href={pr.url}
                          target="_blank"
                          leftSection={<IconExternalLink size="0.875rem" />}
                        >
                          Open
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={async () => {
                            try {
                              await unlinkTaskPullRequest(task.id, pr.id);
                              onSaved(await getTask(task.id));
                            } catch (error) {
                              onError(getErrorMessage(error));
                            }
                          }}
                        >
                          Unlink
                        </Button>
                      </Group>
                    </Group>
                  </Paper>
                ))}
                {!task.githubPullRequests?.length && !task.githubBranches?.length && (
                  <Text c="dimmed">No linked GitHub branch or PR.</Text>
                )}
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <Select
                    label="Repository"
                    value={githubForm.values.selectedRepositoryId}
                    onChange={(value) =>
                      githubForm.setFieldValue('selectedRepositoryId', value || '')
                    }
                    data={repositories.map((repo) => ({
                      value: repo.id,
                      label: `${repo.owner}/${repo.repo}`,
                    }))}
                    placeholder="Add repository in API first"
                  />
                  <TextInput
                    label="PR URL or number"
                    {...githubForm.getInputProps('manualPr')}
                    placeholder="https://github.com/.../pull/12"
                  />
                  <Stack justify="flex-end">
                    <Group gap="xs">
                      <Button
                        leftSection={<IconGitPullRequest size="1rem" />}
                        disabled={
                          !githubForm.values.selectedRepositoryId ||
                          !githubForm.values.manualPr.trim()
                        }
                        loading={githubBusy}
                        onClick={async () => {
                          try {
                            setGithubBusy(true);
                            const trimmedPr = githubForm.values.manualPr.trim();
                            const number = /^\d+$/.test(trimmedPr) ? Number(trimmedPr) : undefined;
                            await linkTaskPullRequest(task.id, {
                              repositoryId: githubForm.values.selectedRepositoryId,
                              number,
                              url: number ? undefined : trimmedPr,
                            });
                            githubForm.setFieldValue('manualPr', '');
                            onSaved(await getTask(task.id));
                          } catch (error) {
                            onError(getErrorMessage(error));
                          } finally {
                            setGithubBusy(false);
                          }
                        }}
                      >
                        Link PR
                      </Button>
                      <Tooltip label="Refresh GitHub status">
                        <ActionIcon
                          variant="light"
                          aria-label="Refresh GitHub status"
                          loading={githubBusy}
                          onClick={async () => {
                            try {
                              setGithubBusy(true);
                              await refreshTaskGitHub(task.id);
                              onSaved(await getTask(task.id));
                            } catch (error) {
                              onError(getErrorMessage(error));
                            } finally {
                              setGithubBusy(false);
                            }
                          }}
                        >
                          <IconRefresh size="1rem" />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Stack>
                </SimpleGrid>
              </Stack>
            </Paper>
          </Tabs.Panel>
        )}
        <Tabs.Panel value="subtasks" pt="md">
          <Paper withBorder className={classes.subtaskTable}>
            <Group justify="space-between" p="md">
              <Group>
                <Title order={4}>Subtasks</Title>
                <Tooltip label={`${task.subtasks?.length || 0} subtasks`}>
                  <Badge variant="light">{task.subtasks?.length || 0}</Badge>
                </Tooltip>
              </Group>
              {canWriteTasks && (
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size="0.875rem" />}
                  onClick={() => setSubtaskModalOpen(true)}
                >
                  Add subtask
                </Button>
              )}
            </Group>
            <div className={classes.subtaskHead}>
              <Text>Name</Text>
              <Text>Assignee</Text>
              <Text>Priority</Text>
              <Text>Due date</Text>
            </div>
            {(task.subtasks || []).map((subtask) => (
              <UnstyledButton
                key={subtask.id}
                className={classes.subtaskRow}
                onClick={() => onOpenSubtask(subtask)}
              >
                <Group gap="sm" wrap="nowrap">
                  <span
                    className={classes.statusRing}
                    style={{ borderColor: displayStatus(undefined, subtask.status).color }}
                  />
                  <Text fw={700}>{subtask.title}</Text>
                </Group>
                <span>
                  {subtask.assignees?.length ? (
                    <AvatarStack users={subtask.assignees} size="1.625rem" max={3} />
                  ) : (
                    <Text c="dimmed">-</Text>
                  )}
                </span>
                <Tooltip label={`Priority: ${subtask.priority}`}>
                  <Badge color={priorityColor[subtask.priority]} variant="light">
                    {subtask.priority}
                  </Badge>
                </Tooltip>
                <Text c={formatDueDate(subtask.dueDate).includes('ago') ? 'red' : 'dimmed'}>
                  {formatDueDate(subtask.dueDate) || '-'}
                </Text>
              </UnstyledButton>
            ))}
            {!task.subtasks?.length && (
              <UnstyledButton className={classes.addTask} onClick={() => setSubtaskModalOpen(true)}>
                <IconPlus size="1.125rem" />
                Add Task
              </UnstyledButton>
            )}
          </Paper>
        </Tabs.Panel>
        <Tabs.Panel value="activity" pt="md">
          <Stack gap="xs">
            {canWriteTasks && (
              <Paper component="form" withBorder p="sm" onSubmit={submitComment}>
                <Textarea
                  label="Add OpenProject comment"
                  minRows={3}
                  autosize
                  {...commentForm.getInputProps('comment')}
                />
                <Group justify="flex-end" mt="sm">
                  <Button
                    loading={commentSaving}
                    disabled={!commentForm.values.comment.trim()}
                    type="submit"
                  >
                    Add comment
                  </Button>
                </Group>
              </Paper>
            )}
            {activity.map((item) => (
              <Paper key={item.id} withBorder p="sm">
                <Group justify="space-between">
                  <Text fw={700}>{item.type}</Text>
                  <Text size="xs" c="dimmed">
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </Group>
                {item.message && (
                  <Text size="sm" c="dimmed">
                    {item.message}
                  </Text>
                )}
                {(item.previousValue || item.nextValue) && (
                  <Text size="xs" c="dimmed">
                    {item.previousValue || '-'} → {item.nextValue || '-'}
                  </Text>
                )}
              </Paper>
            ))}
            {!activity.length && (
              <Text c="dimmed">
                No OpenProject activity yet. Comments and field changes will appear here after the
                first update.
              </Text>
            )}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="relations" pt="md">
          <Stack>
            {canWriteTasks && (
              <Paper component="form" withBorder p="sm" onSubmit={submitRelation}>
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <TextInput
                    label="Target work package ID"
                    leftSection={<IconLink size="1rem" />}
                    {...relationForm.getInputProps('relationTargetId')}
                  />
                  <Select
                    label="Relation type"
                    value={relationForm.values.relationType}
                    onChange={(value) =>
                      relationForm.setFieldValue('relationType', value || 'relates')
                    }
                    data={[
                      { value: 'relates', label: 'Relates' },
                      { value: 'blocks', label: 'Blocks' },
                      { value: 'blockedBy', label: 'Blocked by' },
                      { value: 'precedes', label: 'Precedes' },
                      { value: 'follows', label: 'Follows' },
                    ]}
                  />
                  <Stack justify="flex-end">
                    <Button loading={relationSaving} type="submit">
                      Add relation
                    </Button>
                  </Stack>
                </SimpleGrid>
              </Paper>
            )}
            {relations.map((relation) => (
              <Paper key={relation.id} withBorder p="sm">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Text fw={700}>{relation.type}</Text>
                    <Text size="sm" c="dimmed">
                      {relation.fromTitle || relation.fromId} → {relation.toTitle || relation.toId}
                    </Text>
                  </Stack>
                  {canWriteTasks && (
                    <Tooltip label="Delete relation">
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        aria-label="Delete relation"
                        onClick={async () => {
                          try {
                            await deleteTaskRelation(task.id, relation.id);
                            const page = await getTaskRelations(task.id);
                            setRelations(page.items);
                            showToast({
                              tone: 'success',
                              title: 'Relation removed',
                              message: 'The OpenProject relation was deleted.',
                            });
                          } catch (error) {
                            const message = getErrorMessage(error);
                            onError(message);
                            showToast({
                              tone: 'error',
                              title: 'Could not remove relation',
                              message,
                            });
                          }
                        }}
                      >
                        <IconTrash size="1rem" />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Paper>
            ))}
            {!relations.length && (
              <Text c="dimmed">
                No OpenProject relations yet. Use this tab to link blockers, dependencies, and
                related work packages.
              </Text>
            )}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="time" pt="md">
          <Stack>
            <Group justify="space-between">
              <Title order={4}>Time entries</Title>
              <Tooltip label={`${totalHours.toFixed(2)} hours logged`}>
                <Badge leftSection={<IconClock size="0.875rem" />}>{totalHours.toFixed(2)}h</Badge>
              </Tooltip>
            </Group>
            {canWriteTasks && (
              <Paper component="form" withBorder p="sm" onSubmit={submitTimeEntry}>
                <SimpleGrid cols={{ base: 1, sm: 4 }}>
                  <NumberInput
                    label="Hours"
                    min={0.01}
                    step={0.25}
                    value={timeForm.values.timeHours}
                    onChange={(value) => timeForm.setFieldValue('timeHours', value)}
                  />
                  <TextInput
                    label="Spent on"
                    type="date"
                    value={timeForm.values.timeSpentOn}
                    onChange={(event) =>
                      timeForm.setFieldValue('timeSpentOn', event.currentTarget.value)
                    }
                  />
                  <TextInput label="Comment" {...timeForm.getInputProps('timeComment')} />
                  <Stack justify="flex-end">
                    <Button loading={timeSaving} type="submit">
                      Log time
                    </Button>
                  </Stack>
                </SimpleGrid>
              </Paper>
            )}
            {timeEntries.map((entry) => (
              <Paper key={entry.id} withBorder p="sm">
                <Group justify="space-between">
                  <Text fw={700}>{entry.hours}h</Text>
                  <Text size="sm" c="dimmed">
                    {entry.spentOn || '-'} {entry.user ? `• ${entry.user.name}` : ''}
                  </Text>
                </Group>
                {entry.comment && <Text size="sm">{entry.comment}</Text>}
              </Paper>
            ))}
            {!timeEntries.length && (
              <Text c="dimmed">
                No OpenProject time entries yet. Logged time will appear here after the first entry
                is saved.
              </Text>
            )}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="files" pt="md">
          <Stack>
            {canWriteTasks && (
              <Paper component="form" withBorder p="sm" onSubmit={submitAttachment}>
                <Group align="end">
                  <FileInput
                    label="Upload attachment"
                    value={attachmentForm.values.attachmentFile}
                    onChange={(value) => attachmentForm.setFieldValue('attachmentFile', value)}
                    leftSection={<IconPaperclip size="1rem" />}
                  />
                  <Button
                    loading={attachmentSaving}
                    disabled={!attachmentForm.values.attachmentFile}
                    type="submit"
                  >
                    Upload
                  </Button>
                </Group>
              </Paper>
            )}
            {attachments.map((attachment) => (
              <Paper key={attachment.id} withBorder p="sm">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Text fw={700}>{attachment.fileName}</Text>
                    <Text size="sm" c="dimmed">
                      {attachment.contentType || 'file'}{' '}
                      {attachment.fileSize ? `• ${Math.round(attachment.fileSize / 1024)} KB` : ''}
                    </Text>
                  </Stack>
                  {attachment.downloadUrl && (
                    <Button
                      size="xs"
                      variant="light"
                      component="a"
                      href={attachment.downloadUrl}
                      target="_blank"
                    >
                      Open
                    </Button>
                  )}
                </Group>
              </Paper>
            ))}
            {!attachments.length && (
              <Text c="dimmed">
                No OpenProject attachments yet. Uploaded files stay on the work package after
                refresh.
              </Text>
            )}
          </Stack>
        </Tabs.Panel>
        {customFields.length > 0 && (
          <Tabs.Panel value="custom-fields" pt="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {customFields.map((field) => (
                <Group key={field.key} align="stretch" wrap="nowrap">
                  {renderCustomFieldInput(field)}
                </Group>
              ))}
            </SimpleGrid>
          </Tabs.Panel>
        )}
      </Tabs>
    </Paper>
  );
}
