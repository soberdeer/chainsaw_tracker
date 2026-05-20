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
} from '@mantine/core';
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
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [statusId, setStatusId] = useState(task.statusId || '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(toDateInput(task.startDate));
  const [dueDate, setDueDate] = useState(toDateInput(task.dueDate));
  const [saving, setSaving] = useState(false);
  const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [comment, setComment] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [relations, setRelations] = useState<OpenProjectRelationItem[]>([]);
  const [relationTargetId, setRelationTargetId] = useState('');
  const [relationType, setRelationType] = useState('relates');
  const [relationSaving, setRelationSaving] = useState(false);
  const [timeEntries, setTimeEntries] = useState<OpenProjectTimeEntryItem[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [timeHours, setTimeHours] = useState<number | string>(1);
  const [timeSpentOn, setTimeSpentOn] = useState(toDateInput(new Date().toISOString()));
  const [timeComment, setTimeComment] = useState('');
  const [timeSaving, setTimeSaving] = useState(false);
  const [attachments, setAttachments] = useState<OpenProjectAttachmentItem[]>([]);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentSaving, setAttachmentSaving] = useState(false);
  const [customFields, setCustomFields] = useState<OpenProjectCustomFieldItem[]>([]);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState('');
  const [manualPr, setManualPr] = useState('');
  const [githubBusy, setGithubBusy] = useState(false);
  const githubSupportedForTask = task.externalSource !== 'OPENPROJECT';

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setStatusId(task.statusId || '');
    setPriority(task.priority);
    setAssigneeIds(
      (task.assignees || (task.assignee ? [task.assignee] : [])).map((user) => user.id)
    );
    setStartDate(toDateInput(task.startDate));
    setDueDate(toDateInput(task.dueDate));
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
          setSelectedRepositoryId((current) => current || items[0]?.id || '');
        })
        .catch(() => setRepositories([]));
    } else {
      setRepositories([]);
      setSelectedRepositoryId('');
    }
  }, [task, workspace, onError, githubSupportedForTask]);

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
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  const save = async () => {
    if (!canWriteTasks) {
      return;
    }
    try {
      setSaving(true);
      const saved = await updateTask(task.id, {
        title,
        description,
        statusId: statusId || undefined,
        priority,
        assigneeIds,
        startDate: startDate || null,
        dueDate: dueDate || null,
      });
      onSaved(saved);
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const submitComment = async () => {
    if (!canWriteTasks || !comment.trim()) {
      return;
    }
    try {
      setCommentSaving(true);
      await addTaskComment(task.id, comment.trim());
      setComment('');
      const page = await getTaskActivity(task.id);
      setActivity(page.items);
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setCommentSaving(false);
    }
  };

  const submitRelation = async () => {
    if (!canWriteTasks || !relationTargetId.trim() || relationTargetId.trim() === task.id) {
      return;
    }
    try {
      setRelationSaving(true);
      await addTaskRelation(task.id, {
        targetTaskId: relationTargetId.trim(),
        type: relationType,
      });
      setRelationTargetId('');
      const page = await getTaskRelations(task.id);
      setRelations(page.items);
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setRelationSaving(false);
    }
  };

  const submitTimeEntry = async () => {
    if (!canWriteTasks || !Number(timeHours) || !timeSpentOn) {
      return;
    }
    try {
      setTimeSaving(true);
      await addTaskTimeEntry(task.id, {
        hours: Number(timeHours),
        spentOn: timeSpentOn,
        comment: timeComment,
      });
      setTimeComment('');
      const page = await getTaskTimeEntries(task.id);
      setTimeEntries(page.items);
      setTotalHours(page.totalHours);
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setTimeSaving(false);
    }
  };

  const submitAttachment = async () => {
    if (!canWriteTasks || !attachmentFile) {
      return;
    }
    try {
      setAttachmentSaving(true);
      await uploadTaskAttachment(task.id, attachmentFile);
      setAttachmentFile(null);
      const page = await getTaskAttachments(task.id);
      setAttachments(page.items);
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setAttachmentSaving(false);
    }
  };

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
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
          className={classes.titleInput}
          readOnly={!canWriteTasks}
        />
        <Group>
          {canWriteTasks && (
            <Button loading={saving} onClick={save}>
              Save
            </Button>
          )}
          <Button variant="light" onClick={onBack}>
            Back
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }} mb="xl">
        <Select
          label="Status"
          leftSection={<span className={classes.statusDot} style={{ background: status.color }} />}
          value={statusId}
          onChange={(value) => {
            setStatusId(value || '');
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
          value={assigneeIds}
          onChange={(value) => {
            setAssigneeIds(value);
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
          value={startDate}
          onChange={(event) => setStartDate(event.currentTarget.value)}
          onBlur={() => void updateAndRefresh({ startDate: startDate || null })}
          placeholder={start || 'No start'}
          readOnly={!canWriteTasks}
        />
        <TextInput
          label="Due date"
          leftSection={<IconCalendarDue size="1rem" />}
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.currentTarget.value)}
          onBlur={() => void updateAndRefresh({ dueDate: dueDate || null })}
          placeholder={due || 'No due'}
          readOnly={!canWriteTasks}
        />
        <Select
          label="Priority"
          leftSection={<IconFlag size="1rem" />}
          value={priority}
          onChange={(value) => {
            const next = (value || 'NORMAL') as TaskPriority;
            setPriority(next);
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
        value={description}
        onChange={(event) => setDescription(event.currentTarget.value)}
        mb="lg"
        readOnly={!canWriteTasks}
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
            <Text c="dimmed">Task fields are saved through the OpenProject API.</Text>
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
                    value={selectedRepositoryId}
                    onChange={(value) => setSelectedRepositoryId(value || '')}
                    data={repositories.map((repo) => ({
                      value: repo.id,
                      label: `${repo.owner}/${repo.repo}`,
                    }))}
                    placeholder="Add repository in API first"
                  />
                  <TextInput
                    label="PR URL or number"
                    value={manualPr}
                    onChange={(event) => setManualPr(event.currentTarget.value)}
                    placeholder="https://github.com/.../pull/12"
                  />
                  <Stack justify="flex-end">
                    <Group gap="xs">
                      <Button
                        leftSection={<IconGitPullRequest size="1rem" />}
                        disabled={!selectedRepositoryId || !manualPr.trim()}
                        loading={githubBusy}
                        onClick={async () => {
                          try {
                            setGithubBusy(true);
                            const number = /^\d+$/.test(manualPr.trim())
                              ? Number(manualPr.trim())
                              : undefined;
                            await linkTaskPullRequest(task.id, {
                              repositoryId: selectedRepositoryId,
                              number,
                              url: number ? undefined : manualPr.trim(),
                            });
                            setManualPr('');
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
              <button
                key={subtask.id}
                type="button"
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
                    <AvatarStack users={subtask.assignees} size="1.75rem" />
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
              </button>
            ))}
            {!task.subtasks?.length && (
              <button
                className={classes.addTask}
                type="button"
                onClick={() => setSubtaskModalOpen(true)}
              >
                <IconPlus size="1.125rem" />
                Add Task
              </button>
            )}
          </Paper>
        </Tabs.Panel>
        <Tabs.Panel value="activity" pt="md">
          <Stack gap="xs">
            {canWriteTasks && (
              <Paper withBorder p="sm">
                <Textarea
                  label="Add OpenProject comment"
                  value={comment}
                  onChange={(event) => setComment(event.currentTarget.value)}
                  minRows={3}
                  autosize
                />
                <Group justify="flex-end" mt="sm">
                  <Button
                    loading={commentSaving}
                    disabled={!comment.trim()}
                    onClick={submitComment}
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
            {!activity.length && <Text c="dimmed">No activity yet.</Text>}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="relations" pt="md">
          <Stack>
            {canWriteTasks && (
              <Paper withBorder p="sm">
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <TextInput
                    label="Target work package ID"
                    value={relationTargetId}
                    onChange={(event) => setRelationTargetId(event.currentTarget.value)}
                    leftSection={<IconLink size="1rem" />}
                  />
                  <Select
                    label="Relation type"
                    value={relationType}
                    onChange={(value) => setRelationType(value || 'relates')}
                    data={[
                      { value: 'relates', label: 'Relates' },
                      { value: 'blocks', label: 'Blocks' },
                      { value: 'blockedBy', label: 'Blocked by' },
                      { value: 'precedes', label: 'Precedes' },
                      { value: 'follows', label: 'Follows' },
                    ]}
                  />
                  <Stack justify="flex-end">
                    <Button loading={relationSaving} onClick={submitRelation}>
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
                          } catch (error) {
                            onError(getErrorMessage(error));
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
            {!relations.length && <Text c="dimmed">No OpenProject relations.</Text>}
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
              <Paper withBorder p="sm">
                <SimpleGrid cols={{ base: 1, sm: 4 }}>
                  <NumberInput
                    label="Hours"
                    min={0.01}
                    step={0.25}
                    value={timeHours}
                    onChange={setTimeHours}
                  />
                  <TextInput
                    label="Spent on"
                    type="date"
                    value={timeSpentOn}
                    onChange={(event) => setTimeSpentOn(event.currentTarget.value)}
                  />
                  <TextInput
                    label="Comment"
                    value={timeComment}
                    onChange={(event) => setTimeComment(event.currentTarget.value)}
                  />
                  <Stack justify="flex-end">
                    <Button loading={timeSaving} onClick={submitTimeEntry}>
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
            {!timeEntries.length && <Text c="dimmed">No OpenProject time entries.</Text>}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="files" pt="md">
          <Stack>
            {canWriteTasks && (
              <Paper withBorder p="sm">
                <Group align="end">
                  <FileInput
                    label="Upload attachment"
                    value={attachmentFile}
                    onChange={setAttachmentFile}
                    leftSection={<IconPaperclip size="1rem" />}
                  />
                  <Button
                    loading={attachmentSaving}
                    disabled={!attachmentFile}
                    onClick={submitAttachment}
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
            {!attachments.length && <Text c="dimmed">No OpenProject attachments.</Text>}
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
