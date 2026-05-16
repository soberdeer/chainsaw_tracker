import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Group,
  MultiSelect,
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
  IconPlus,
  IconRefresh,
  IconUsers,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import {
  getGitHubRepositories,
  getTask,
  getTaskActivity,
  linkTaskPullRequest,
  refreshTaskGitHub,
  unlinkTaskPullRequest,
  updateTask,
} from '../../../lib/api';
import {
  displayStatus,
  formatDueDate,
  getErrorMessage,
  priorityColor,
  toDateInput,
} from '../../../lib/taskUi';
import type {
  ActivityLog,
  GitHubRepository,
  Task,
  TaskPriority,
  TaskStatus,
  Workspace,
} from '../../../lib/types';
import { AvatarStack } from '../../common/AvatarStack';
import { SubtaskModal } from './SubtaskModal/SubtaskModal';
import classes from './TaskDetailPage.module.css';

export function TaskDetailPage({
  task,
  workspace,
  statuses,
  onBack,
  onSaved,
  onOpenSubtask,
  onError,
}: {
  task: Task;
  workspace: Workspace;
  statuses: TaskStatus[];
  onBack: () => void;
  onSaved: (task: Task) => void;
  onOpenSubtask: (task: Task) => void;
  onError: (message: string) => void;
}) {
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
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState('');
  const [manualPr, setManualPr] = useState('');
  const [githubBusy, setGithubBusy] = useState(false);

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
    getGitHubRepositories(workspace.id)
      .then((items) => {
        setRepositories(items);
        setSelectedRepositoryId((current) => current || items[0]?.id || '');
      })
      .catch(() => setRepositories([]));
  }, [task]);

  const showGitHubTab = Boolean(
    (task.githubPullRequests?.length || 0) > 0 ||
    (task.githubBranches?.length || 0) > 0 ||
    repositories.length > 0
  );

  const updateAndRefresh = async (input: Parameters<typeof updateTask>[1]) => {
    try {
      onSaved(await updateTask(task.id, input));
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  const save = async () => {
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
        />
        <Group>
          <Button loading={saving} onClick={save}>
            Save
          </Button>
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
        />
        {task.taskKey && <TextInput label="Task key" value={task.taskKey} readOnly />}
        <TextInput label="List" value={task.taskList?.name || task.taskListId || ''} readOnly />
        <MultiSelect
          label="Assignees"
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
        />
        <TextInput
          label="Start date"
          leftSection={<IconCalendarDue size="1rem" />}
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.currentTarget.value)}
          onBlur={() => void updateAndRefresh({ startDate: startDate || null })}
          placeholder={start || 'No start'}
        />
        <TextInput
          label="Due date"
          leftSection={<IconCalendarDue size="1rem" />}
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.currentTarget.value)}
          onBlur={() => void updateAndRefresh({ dueDate: dueDate || null })}
          placeholder={due || 'No due'}
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
                Open ClickUp
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
          <Text fw={700}>ClickUp URL</Text>
          {task.externalUrl ? (
            <Button size="xs" variant="light" component="a" href={task.externalUrl} target="_blank">
              Open in ClickUp
            </Button>
          ) : (
            <Text size="sm" c="dimmed">
              No ClickUp URL
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
        </Tabs.List>
        <Tabs.Panel value="details" pt="md">
          <Stack>
            <Text c="dimmed">Task fields are saved through the ClickUp API.</Text>
            <Text size="sm" c="dimmed">
              Dependencies, linked tasks, custom fields, attachments, and timers are intentionally
              hidden until wired to ClickUp endpoints.
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
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size="0.875rem" />}
                onClick={() => setSubtaskModalOpen(true)}
              >
                Add subtask
              </Button>
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
      </Tabs>
    </Paper>
  );
}
