import { useEffect, useState } from 'react';
import { ActionIcon, Avatar, Badge, Button, Group, Modal, MultiSelect, Paper, Popover, ScrollArea, Select, SimpleGrid, Stack, Tabs, Text, Textarea, TextInput, Title } from '@mantine/core';
import { IconCalendarDue, IconExternalLink, IconFlag, IconGitPullRequest, IconPlus, IconRefresh, IconSearch, IconTags, IconUsers, IconX } from '@tabler/icons-react';
import { addTaskDependency, createTask, getGitHubRepositories, getMilestones, getTask, getTaskActivity, linkTaskPullRequest, refreshTaskGitHub, removeTaskDependency, searchAll, unlinkTaskPullRequest, updateTask } from '../../lib/api';
import type { ActivityLog, GitHubRepository, Milestone, SearchResult, Task, TaskPriority, TaskStatus, Workspace } from '../../lib/types';
import { displayStatus, formatDueDate, getErrorMessage, priorityColor, toDateInput } from '../../lib/taskUi';

function SubtaskModal({
  opened,
  parentTask,
  statuses,
  onClose,
  onCreated,
  onError
}: {
  opened: boolean;
  parentTask: Task;
  statuses: TaskStatus[];
  onClose: () => void;
  onCreated: (task: Task) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusId, setStatusId] = useState(statuses[0]?.id || '');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      setTitle('');
      setDescription('');
      setStatusId(parentTask.statusId || statuses[0]?.id || '');
      setPriority(parentTask.priority || 'NORMAL');
      setStartDate('');
      setDueDate('');
      setGithubUrl('');
    }
  }, [opened, parentTask.id, parentTask.priority, parentTask.statusId, statuses]);

  const create = async () => {
    if (!parentTask.taskListId || !title.trim()) return;
    try {
      setSaving(true);
      await createTask({
        taskListId: parentTask.taskListId,
        parentId: parentTask.id,
        title: title.trim(),
        description,
        statusId: statusId || undefined,
        priority,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        githubUrl: githubUrl || undefined
      });
      onCreated(await getTask(parentTask.id));
      onClose();
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} size="xl" title="Add subtask" centered classNames={{ content: 'clickup-modal' }}>
      <Stack>
        <TextInput label="Name" value={title} onChange={(event) => setTitle(event.currentTarget.value)} autoFocus />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Status"
            value={statusId}
            onChange={(value) => setStatusId(value || '')}
            data={statuses.map((item) => ({ value: item.id, label: displayStatus(item).label }))}
          />
          <Select
            label="Priority"
            value={priority}
            onChange={(value) => setPriority((value || 'NORMAL') as TaskPriority)}
            data={['LOW', 'NORMAL', 'HIGH', 'URGENT']}
          />
          <TextInput label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.currentTarget.value)} />
          <TextInput label="Due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.currentTarget.value)} />
        </SimpleGrid>
        <TextInput label="GitHub URL" value={githubUrl} onChange={(event) => setGithubUrl(event.currentTarget.value)} placeholder="https://github.com/..." />
        <Textarea label="Description" minRows={7} autosize value={description} onChange={(event) => setDescription(event.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!title.trim()} onClick={create}>Create subtask</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function TaskDetailPage({
  task,
  workspace,
  statuses,
  onBack,
  onSaved,
  onOpenSubtask,
  onError
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
  const [taskKey, setTaskKey] = useState(task.taskKey || '');
  const [milestoneId, setMilestoneId] = useState(task.milestoneId || '');
  const [startDate, setStartDate] = useState(toDateInput(task.startDate));
  const [dueDate, setDueDate] = useState(toDateInput(task.dueDate));
  const [githubUrl, setGithubUrl] = useState(task.githubUrl || '');
  const [saving, setSaving] = useState(false);
  const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
  const [dependencyOpen, setDependencyOpen] = useState(false);
  const [dependencyQuery, setDependencyQuery] = useState('');
  const [dependencyResults, setDependencyResults] = useState<SearchResult[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState('');
  const [manualPr, setManualPr] = useState('');
  const [githubBusy, setGithubBusy] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setStatusId(task.statusId || '');
    setPriority(task.priority);
    setTaskKey(task.taskKey || '');
    setMilestoneId(task.milestoneId || '');
    setStartDate(toDateInput(task.startDate));
    setDueDate(toDateInput(task.dueDate));
    setGithubUrl(task.githubUrl || '');
    getTaskActivity(task.id).then((page) => setActivity(page.items)).catch((error) => onError(getErrorMessage(error)));
    getMilestones(workspace.id, task.teamId || task.folderId).then(setMilestones).catch(() => setMilestones([]));
    getGitHubRepositories(workspace.id)
      .then((items) => {
        setRepositories(items);
        setSelectedRepositoryId((current) => current || items[0]?.id || '');
      })
      .catch(() => setRepositories([]));
  }, [task]);

  const listOptions = workspace.spaces.flatMap((space) =>
    space.folders.flatMap((folder) => (folder.taskLists || []).map((list) => ({
      value: list.id,
      label: `${space.name} / ${folder.name} / ${list.name}`
    })))
  );
  const showGitHubTab = Boolean((task.githubPullRequests?.length || 0) > 0 || (task.githubBranches?.length || 0) > 0 || repositories.length > 0);

  useEffect(() => {
    if (!dependencyOpen) return;
    let cancelled = false;
    searchAll(dependencyQuery, workspace.id)
      .then((items) => {
        if (!cancelled) setDependencyResults(items.filter((item) => item.type === 'task' && item.id !== task.id).slice(0, 8));
      })
      .catch((error) => onError(getErrorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, [dependencyOpen, dependencyQuery, task.id, workspace.id, onError]);

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
        taskKey: taskKey || null,
        milestoneId: milestoneId || null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        githubUrl: githubUrl || null
      });
      onSaved(saved);
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper className="task-detail-page" withBorder>
      <SubtaskModal
        opened={subtaskModalOpen}
        parentTask={task}
        statuses={statuses}
        onClose={() => setSubtaskModalOpen(false)}
        onCreated={onSaved}
        onError={onError}
      />
      <Group justify="space-between" mb="lg">
        <TextInput value={title} onChange={(event) => setTitle(event.currentTarget.value)} className="task-title-input" />
        <Group>
          <Button loading={saving} onClick={save}>Save</Button>
          <Button variant="light" onClick={onBack}>Back</Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }} mb="xl">
        <Select
          label="Status"
          leftSection={<span className="status-dot" style={{ background: status.color }} />}
          value={statusId}
          onChange={(value) => {
            setStatusId(value || '');
            void updateAndRefresh({ statusId: value || undefined });
          }}
          data={statuses.map((item) => ({ value: item.id, label: displayStatus(item).label }))}
          placeholder={status.label}
          searchable
        />
        <TextInput
          label="Task key"
          value={taskKey}
          onChange={(event) => setTaskKey(event.currentTarget.value.toUpperCase())}
          onBlur={() => void updateAndRefresh({ taskKey: taskKey || null })}
          placeholder="CL-PROTO-001"
        />
        <Select
          label="List"
          value={task.taskListId || ''}
          onChange={(value) => void updateAndRefresh({ listId: value || null })}
          data={listOptions}
          searchable
        />
        <Select
          label="Milestone"
          value={milestoneId}
          onChange={(value) => {
            setMilestoneId(value || '');
            void updateAndRefresh({ milestoneId: value || null });
          }}
          data={[{ value: '', label: 'No milestone' }, ...milestones.map((milestone) => ({ value: milestone.id, label: milestone.title }))]}
          searchable
        />
        <Select
          label="Assignees"
          leftSection={<IconUsers size="1rem" />}
          value={task.assignee?.id || ''}
          onChange={(value) => void updateAndRefresh({ assigneeId: value || null })}
          data={[
            { value: '', label: 'Unassigned' },
            ...workspace.memberships.map((membership) => ({ value: membership.user.id, label: membership.user.name }))
          ]}
          searchable
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
        <MultiSelect
          label="Tags"
          leftSection={<IconTags size="1rem" />}
          value={task.tags.map(({ tag }) => tag.name)}
          onChange={(tagNames) => void updateAndRefresh({ tagNames })}
          data={Array.from(new Set(['architecture', 'art', 'bugfix', 'develop', 'feature', 'release', 'ui', ...task.tags.map(({ tag }) => tag.name)]))}
          searchable
        />
        <TextInput label="GitHub URL" value={githubUrl} onChange={(event) => setGithubUrl(event.currentTarget.value)} onBlur={() => void updateAndRefresh({ githubUrl: githubUrl || null })} placeholder="https://github.com/..." />
        <Stack gap="xs">
          <Text fw={700}>Source</Text>
          <Group gap="xs">
            <Badge>{task.externalSource || 'LOCAL'}</Badge>
            {task.externalUrl && <Button size="xs" variant="subtle" component="a" href={task.externalUrl} target="_blank">Open ClickUp</Button>}
            {task.syncedAt && <Text size="xs" c="dimmed">Synced {new Date(task.syncedAt).toLocaleString()}</Text>}
          </Group>
        </Stack>
        <Stack gap="xs">
          <Text fw={700}>Location</Text>
          <Text size="sm" c="dimmed">{task.folder?.space?.name || workspace.name} / {task.folder?.name || task.folderId}</Text>
        </Stack>
        <Stack gap="xs">
          <Text fw={700}>Relationships</Text>
          <Group gap="xs">
            <Badge color="orange" variant="light">{task.dependencies?.length || 0} Waiting on</Badge>
            <Badge color="gray" variant="light">{task.dependents?.length || 0} Blocking</Badge>
          </Group>
        </Stack>
      </SimpleGrid>

      <Textarea label="Description" minRows={8} autosize value={description} onChange={(event) => setDescription(event.currentTarget.value)} mb="lg" />

      <Tabs defaultValue="subtasks">
        <Tabs.List>
          <Tabs.Tab value="details">Details</Tabs.Tab>
          {showGitHubTab && <Tabs.Tab value="github">GitHub <Badge size="xs">{task.githubPullRequests?.length || 0}</Badge></Tabs.Tab>}
          <Tabs.Tab value="subtasks">Subtasks <Badge size="xs">{task.subtasks?.length || 0}</Badge></Tabs.Tab>
          <Tabs.Tab value="activity">Activity</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="details" pt="md">
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Stack>
              <Text c="dimmed">Task fields are saved directly to the database.</Text>
              <Group gap="xs">
                {(task.dependencies || []).map((dependency) => (
                  <Badge key={dependency.id} color="orange" rightSection={
                    <ActionIcon
                      size="xs"
                      variant="transparent"
                      onClick={async () => {
                        try {
                          await removeTaskDependency(task.id, dependency.dependsOnId);
                          onSaved(await getTask(task.id));
                        } catch (error) {
                          onError(getErrorMessage(error));
                        }
                      }}
                    >
                      <IconX size="0.75rem" />
                    </ActionIcon>
                  }>
                    Waiting on {dependency.dependsOn?.title || dependency.dependsOnId}
                  </Badge>
                ))}
              </Group>
              <Popover opened={dependencyOpen} onChange={setDependencyOpen} width="32rem" position="bottom-start">
                <Popover.Target>
                  <Button variant="subtle" leftSection={<IconPlus size="1rem" />} onClick={() => setDependencyOpen((open) => !open)}>Add dependency</Button>
                </Popover.Target>
                <Popover.Dropdown className="dependency-picker">
                  <Stack gap="sm">
                    <TextInput
                      value={dependencyQuery}
                      onChange={(event) => setDependencyQuery(event.currentTarget.value)}
                      leftSection={<IconSearch size="1rem" />}
                      placeholder="Search for task (or subtask) name, ID, or URL"
                      autoFocus
                    />
                    <Text size="sm" c="dimmed" fw={700}>Recent Tasks</Text>
                    <ScrollArea h="18rem">
                      <Stack gap={4}>
                        {dependencyResults.map((result) => (
                          <button
                            key={result.id}
                            className="dependency-result"
                            type="button"
                            onClick={async () => {
                              try {
                                await addTaskDependency(task.id, result.id);
                                onSaved(await getTask(task.id));
                                setDependencyOpen(false);
                              } catch (error) {
                                onError(getErrorMessage(error));
                              }
                            }}
                          >
                            <span className="cu-status-ring" />
                            <span>{result.title}</span>
                          </button>
                        ))}
                      </Stack>
                    </ScrollArea>
                  </Stack>
                </Popover.Dropdown>
              </Popover>
            </Stack>
            <Paper withBorder className="relationship-panel">
              <Group justify="space-between" mb="md">
                <Title order={3}>Waiting on</Title>
                <IconSearch size="1.125rem" className="muted-icon" />
              </Group>
              <Stack gap="xs">
                {(task.dependencies || []).map((dependency) => (
                  <div key={dependency.id} className="relationship-row">
                    <Text fw={700}>{dependency.dependsOn?.title || dependency.dependsOnId}</Text>
                    <Text c="dimmed">{formatDueDate(dependency.dependsOn?.dueDate) || '-'}</Text>
                    <Badge color={priorityColor[dependency.dependsOn?.priority || 'NORMAL']}>{dependency.dependsOn?.priority || 'NORMAL'}</Badge>
                  </div>
                ))}
                {!task.dependencies?.length && <Text c="dimmed">No dependencies</Text>}
              </Stack>
            </Paper>
          </SimpleGrid>
        </Tabs.Panel>
        {showGitHubTab && <Tabs.Panel value="github" pt="md">
          <Paper withBorder className="relationship-panel">
            <Group justify="space-between" mb="md">
              <Title order={3}>GitHub</Title>
              <Badge variant="light">{task.developmentStatus || 'NOT_STARTED'}</Badge>
            </Group>
            <Stack>
              {(task.githubBranches || []).map((branch) => (
                <Group key={branch.id} justify="space-between" className="relationship-row">
                  <Group gap="xs"><IconGitPullRequest size="1rem" /><Text fw={700}>{branch.name}</Text></Group>
                  {branch.url && <Button size="xs" variant="subtle" component="a" href={branch.url} target="_blank" leftSection={<IconExternalLink size="0.875rem" />}>Open</Button>}
                </Group>
              ))}
              {(task.githubPullRequests || []).map((pr) => (
                <Paper key={pr.id} withBorder p="md">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={2}>
                      <Text fw={800}>#{pr.number} {pr.title}</Text>
                      <Text size="sm" c="dimmed">{pr.repository?.owner}/{pr.repository?.repo} • {pr.headBranch} → {pr.baseBranch}</Text>
                      <Group gap="xs">
                        <Badge>{pr.state}</Badge>
                        <Badge color={pr.draft ? 'gray' : 'green'}>{pr.draft ? 'Draft' : 'Ready'}</Badge>
                        <Badge color={pr.reviewStatus === 'CHANGES_REQUESTED' ? 'red' : pr.reviewStatus === 'APPROVED' ? 'green' : 'blue'}>{pr.reviewStatus}</Badge>
                        {pr.authorLogin && <Badge variant="light">{pr.authorLogin}</Badge>}
                      </Group>
                      <Text size="xs" c="dimmed">Last sync: {pr.syncedAt ? new Date(pr.syncedAt).toLocaleString() : '-'}</Text>
                    </Stack>
                    <Group gap="xs">
                      <Button size="xs" variant="subtle" component="a" href={pr.url} target="_blank" leftSection={<IconExternalLink size="0.875rem" />}>Open</Button>
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
              {!task.githubPullRequests?.length && !task.githubBranches?.length && <Text c="dimmed">No linked GitHub branch or PR.</Text>}
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <Select
                  label="Repository"
                  value={selectedRepositoryId}
                  onChange={(value) => setSelectedRepositoryId(value || '')}
                  data={repositories.map((repo) => ({ value: repo.id, label: `${repo.owner}/${repo.repo}` }))}
                  placeholder="Add repository in API first"
                />
                <TextInput label="PR URL or number" value={manualPr} onChange={(event) => setManualPr(event.currentTarget.value)} placeholder="https://github.com/.../pull/12" />
                <Stack justify="flex-end">
                  <Group gap="xs">
                    <Button
                      leftSection={<IconGitPullRequest size="1rem" />}
                      disabled={!selectedRepositoryId || !manualPr.trim()}
                      loading={githubBusy}
                      onClick={async () => {
                        try {
                          setGithubBusy(true);
                          const number = /^\d+$/.test(manualPr.trim()) ? Number(manualPr.trim()) : undefined;
                          await linkTaskPullRequest(task.id, { repositoryId: selectedRepositoryId, number, url: number ? undefined : manualPr.trim() });
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
                    <ActionIcon
                      variant="light"
                      aria-label="Refresh GitHub"
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
                  </Group>
                </Stack>
              </SimpleGrid>
            </Stack>
          </Paper>
        </Tabs.Panel>}
        <Tabs.Panel value="subtasks" pt="md">
          <Paper withBorder className="subtask-table">
            <Group justify="space-between" p="md">
              <Group>
                <Title order={4}>Subtasks</Title>
                <Badge variant="light">{task.subtasks?.length || 0}</Badge>
              </Group>
              <Button size="xs" variant="light" leftSection={<IconPlus size="0.875rem" />} onClick={() => setSubtaskModalOpen(true)}>Add subtask</Button>
            </Group>
            <div className="subtask-head">
              <Text>Name</Text>
              <Text>Assignee</Text>
              <Text>Priority</Text>
              <Text>Due date</Text>
            </div>
            {(task.subtasks || []).map((subtask) => (
              <button key={subtask.id} type="button" className="subtask-row" onClick={() => onOpenSubtask(subtask)}>
                <Group gap="sm" wrap="nowrap">
                  <span className="cu-status-ring" style={{ borderColor: displayStatus(undefined, subtask.status).color }} />
                  <Text fw={700}>{subtask.title}</Text>
                </Group>
                <span>{subtask.assignee ? <Avatar size="1.75rem">{subtask.assignee.name.slice(0, 1)}</Avatar> : <Text c="dimmed">-</Text>}</span>
                <Badge color={priorityColor[subtask.priority]} variant="light">{subtask.priority}</Badge>
                <Text c={formatDueDate(subtask.dueDate).includes('ago') ? 'red' : 'dimmed'}>{formatDueDate(subtask.dueDate) || '-'}</Text>
              </button>
            ))}
            {!task.subtasks?.length && (
              <button className="cu-add-task" type="button" onClick={() => setSubtaskModalOpen(true)}><IconPlus size="1.125rem" />Add Task</button>
            )}
          </Paper>
        </Tabs.Panel>
        <Tabs.Panel value="activity" pt="md">
          <Stack gap="xs">
            {activity.map((item) => (
              <Paper key={item.id} withBorder p="sm">
                <Group justify="space-between">
                  <Text fw={700}>{item.type}</Text>
                  <Text size="xs" c="dimmed">{new Date(item.createdAt).toLocaleString()}</Text>
                </Group>
                {item.message && <Text size="sm" c="dimmed">{item.message}</Text>}
                {(item.previousValue || item.nextValue) && <Text size="xs" c="dimmed">{item.previousValue || '-'} → {item.nextValue || '-'}</Text>}
              </Paper>
            ))}
            {!activity.length && <Text c="dimmed">No activity yet.</Text>}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Paper>
  );
}
