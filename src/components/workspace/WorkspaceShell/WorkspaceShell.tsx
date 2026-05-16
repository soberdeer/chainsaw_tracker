import {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Menu,
  MultiSelect,
  ScrollArea,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconCheck,
  IconChevronDown,
  IconDots,
  IconFolder,
  IconFolderOpen,
  IconLayoutKanban,
  IconList,
  IconLock,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  createFolder,
  createSpace,
  createTaskList,
  getTask,
  getTasks,
  getWorkspaces,
  reorderTasks,
  updateSpace,
  updateTask,
} from '../../../lib/api';
import {
  firstTaskFolder,
  firstTaskList,
  folderPath,
  getErrorMessage,
  parseAppPath,
  taskPath,
  workspaceHasWork,
} from '../../../lib/taskUi';
import type { Task, User, Workspace } from '../../../lib/types';
import { GlobalSearchModal } from '../../search/GlobalSearchModal/GlobalSearchModal';
import { GroupedTaskList, TaskBoard } from '../../tasks/StatusIcon';
import { TaskCreateModal } from '../../tasks/TaskCreateModal';
import { TaskDetailPage } from '../../tasks/TaskDetailPage/TaskDetailPage';
import classes from './WorkspaceShell.module.css';

export function WorkspaceShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [spaceId, setSpaceId] = useState<string>();
  const [folderId, setFolderId] = useState<string>();
  const [taskListId, setTaskListId] = useState<string>();
  const [view] = useState<'list' | 'board'>('list');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [taskSearch, setTaskSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createTaskStatusId, setCreateTaskStatusId] = useState<string | null>(null);

  const reload = () => setRefreshKey((key) => key + 1);
  const runAction = async (action: () => Promise<void>) => {
    try {
      setActionError(null);
      await action();
    } catch (caughtError) {
      setActionError(getErrorMessage(caughtError));
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      } else if (!isInput && event.key === '/') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    getWorkspaces()
      .then((items) => {
        setWorkspaces(items);
        const route = parseAppPath(location.pathname);
        const defaultWorkspace =
          items.find((item) => item.spaces.some((space) => space.id === route.spaceId)) ||
          items.find((item) => item.id === workspaceId) ||
          items.find(workspaceHasWork) ||
          items[0];
        if (defaultWorkspace?.id && defaultWorkspace.id !== workspaceId)
          setWorkspaceId(defaultWorkspace.id);

        const defaultSpace =
          defaultWorkspace?.spaces.find((space) => space.id === route.spaceId) ||
          defaultWorkspace?.spaces.find((space) => firstTaskFolder(space)) ||
          defaultWorkspace?.spaces[0];
        const defaultFolder =
          defaultSpace?.folders.find((folder) => folder.id === route.folderId) ||
          firstTaskFolder(defaultSpace);
        const defaultTaskList = firstTaskList(defaultFolder);
        setSpaceId(defaultSpace?.id);
        setFolderId(defaultFolder?.id);
        setTaskListId(defaultTaskList?.id);
        setLoading(false);

        if (route.taskId) {
          getTask(route.taskId)
            .then(setSelectedTask)
            .catch((error) => setActionError(getErrorMessage(error)));
        } else {
          setSelectedTask(null);
        }

        if (!route.spaceId && defaultSpace && defaultFolder) {
          navigate(folderPath(defaultSpace.id, defaultFolder.id), { replace: true });
        }
      })
      .catch((error) => {
        setActionError(getErrorMessage(error));
        setLoading(false);
      });
  }, [refreshKey, workspaceId, location.pathname, navigate]);

  const workspace = workspaces.find((item) => item.id === workspaceId) || workspaces[0];
  const activeSpace = useMemo(
    () => workspace?.spaces.find((space) => space.id === spaceId) || workspace?.spaces[0],
    [workspace, spaceId]
  );
  const activeFolder = useMemo(
    () =>
      activeSpace?.folders.find((folder) => folder.id === folderId) || firstTaskFolder(activeSpace),
    [activeSpace, folderId]
  );
  const activeTaskList = useMemo(
    () =>
      activeFolder?.taskLists?.find((list) => list.id === taskListId) ||
      firstTaskList(activeFolder),
    [activeFolder, taskListId]
  );
  const statuses = activeTaskList?.statuses || [];
  const availableAssignees = useMemo(() => {
    const users = new Map<string, User>();
    workspace?.memberships.forEach((membership) => users.set(membership.user.id, membership.user));
    tasks.forEach((task) => {
      (task.assignees || (task.assignee ? [task.assignee] : [])).forEach((user) =>
        users.set(user.id, user)
      );
    });
    return [...users.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [workspace, tasks]);

  const loadTasks = async (cursor?: string) => {
    if (!workspace?.id || !activeTaskList?.id) {
      setTasks([]);
      setNextCursor(null);
      return;
    }
    try {
      setTasksLoading(true);
      setTasksError(null);
      const page = await getTasks({
        workspaceId: workspace.id,
        listId: activeTaskList.id,
        statusId: statusFilter || undefined,
        assigneeIds: assigneeFilter.length ? assigneeFilter : undefined,
        priority: priorityFilter || undefined,
        search: taskSearch,
        limit: 50,
        cursor,
      });
      setTasks((current) => (cursor ? [...current, ...page.items] : page.items));
      setNextCursor(page.nextCursor || null);
    } catch (error) {
      setTasksError(getErrorMessage(error));
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, [
    workspace?.id,
    activeTaskList?.id,
    taskSearch,
    statusFilter,
    assigneeFilter.join(','),
    priorityFilter,
    refreshKey,
  ]);

  const addTask = async (statusId: string) => {
    if (!activeTaskList) return;
    setCreateTaskStatusId(statusId);
  };

  const moveTask = async (taskId: string, statusId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (task?.statusId === statusId) return;
    await runAction(async () => {
      await updateTask(taskId, { statusId });
      reload();
    });
  };

  const reorderTaskGroup = async (taskId: string, statusId: string, orderedTaskIds: string[]) => {
    await runAction(async () => {
      await reorderTasks({ taskId, statusId, orderedTaskIds });
      reload();
    });
  };

  const openTask = (task: Task) => {
    if (!activeSpace || !activeFolder) return;
    setSelectedTask(task);
    navigate(taskPath(activeSpace.id, activeFolder.id, task.id));
    getTask(task.id)
      .then(setSelectedTask)
      .catch((error) => setActionError(getErrorMessage(error)));
  };

  const openSubtask = (task: Task) => {
    const targetSpaceId = activeSpace?.id;
    const targetFolderId = task.folderId || activeFolder?.id;
    if (!targetSpaceId || !targetFolderId) return;
    setSelectedTask(task);
    navigate(taskPath(targetSpaceId, targetFolderId, task.id));
  };

  const backToFolder = () => {
    if (!activeSpace || !activeFolder) return;
    setSelectedTask(null);
    navigate(folderPath(activeSpace.id, activeFolder.id));
  };

  if (loading)
    return (
      <Box className={classes.center}>
        <Loader />
      </Box>
    );

  if (!workspace) {
    if (actionError) {
      return (
        <Box className={`${classes.center} ${classes.setupScreen}`}>
          <Alert color="red" title="Could not load ClickUp workspace">
            {actionError}
          </Alert>
        </Box>
      );
    }
    return (
      <Box className={`${classes.center} ${classes.setupScreen}`}>
        <Alert color="yellow" title="No ClickUp workspaces">
          The ClickUp API returned no workspaces for this token.
        </Alert>
      </Box>
    );
  }

  if (!activeSpace) {
    return (
      <Box className={`${classes.center} ${classes.setupScreen}`}>
        <Stack>
          <Title order={2}>{workspace.name}</Title>
          <Text c="dimmed">Workspace created. Add the first space to start working.</Text>
          {actionError && (
            <Alert
              color="red"
              title="Could not create space"
              withCloseButton
              onClose={() => setActionError(null)}
            >
              {actionError}
            </Alert>
          )}
          <Button
            onClick={() =>
              runAction(async () => {
                await createSpace({
                  workspaceId: workspace.id,
                  name: 'General',
                  color: '#4c6ef5',
                  initials: 'G',
                });
                reload();
              })
            }
          >
            Create first space
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <AppShell navbar={{ width: '21.75rem', breakpoint: 'sm' }} padding={0}>
      <GlobalSearchModal
        opened={searchOpen}
        workspace={workspace}
        activeSpace={activeSpace}
        activeFolder={activeFolder}
        activeTaskList={activeTaskList}
        onClose={() => setSearchOpen(false)}
        onNavigate={(url) => navigate(url)}
        onReload={reload}
        onCreateTask={() => setCreateTaskStatusId(statuses[0]?.id || null)}
        onError={setActionError}
      />
      <TaskCreateModal
        opened={Boolean(createTaskStatusId)}
        taskList={activeTaskList}
        statuses={statuses}
        users={availableAssignees}
        initialStatusId={createTaskStatusId || statuses[0]?.id}
        onClose={() => setCreateTaskStatusId(null)}
        onCreated={() => reload()}
        onError={setActionError}
      />
      <AppShell.Navbar p="md" className={classes.workspaceSidebar}>
        <Group mb="lg" gap="sm" justify="space-between">
          <Group gap="sm">
            <Tooltip label="Workspace">
              <ThemeIcon size="lg" radius="md" color="dark">
                <IconCheck size="1.25rem" />
              </ThemeIcon>
            </Tooltip>
            <div>
              <Text fw={800}>{workspace.name}</Text>
              <Text size="xs" c="dimmed">
                All Tasks - studio workspace
              </Text>
            </div>
          </Group>
          <Tooltip label="Add space">
            <ActionIcon
              variant="light"
              aria-label="Add space"
              onClick={async () => {
                const name = window.prompt('Space name');
                if (!name) return;
                await runAction(async () => {
                  await createSpace({
                    workspaceId: workspace.id,
                    name,
                    color: '#4c6ef5',
                    initials: name.slice(0, 1).toUpperCase(),
                    locked: true,
                  });
                  reload();
                });
              }}
            >
              <IconPlus size="1.25rem" />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Text size="lg" fw={700} mb="md">
          Spaces
        </Text>
        <ScrollArea className={classes.spacesTree}>
          {workspace.spaces.map((space) => {
            const isActiveSpace = space.id === activeSpace.id;
            return (
              <Box key={space.id} className={classes.spaceTreeBlock}>
                <Group wrap="nowrap" gap={0}>
                  <button
                    type="button"
                    className={
                      isActiveSpace
                        ? `${classes.spaceTreeRow} ${classes.active}`
                        : classes.spaceTreeRow
                    }
                    onClick={() => {
                      setSpaceId(space.id);
                      const folder = firstTaskFolder(space);
                      setFolderId(folder?.id);
                      setTaskListId(firstTaskList(folder)?.id);
                      if (folder) navigate(folderPath(space.id, folder.id));
                    }}
                  >
                    <span className={classes.spaceInitial} style={{ background: space.color }}>
                      {space.initials || space.name.slice(0, 1)}
                    </span>
                    <span className={classes.spaceName}>{space.name}</span>
                    {space.locked && (
                      <Tooltip label={`${space.name} is private`}>
                        <IconLock size="1rem" className={classes.mutedIcon} />
                      </Tooltip>
                    )}
                  </button>
                  {isActiveSpace && (
                    <Menu width="22rem" position="right-start">
                      <Menu.Target>
                        <Tooltip label="Space actions">
                          <ActionIcon
                            component="div"
                            variant="subtle"
                            aria-label="Space actions"
                            className={classes.rowAction}
                          >
                            <IconDots size="1.125rem" />
                          </ActionIcon>
                        </Tooltip>
                      </Menu.Target>
                      <Menu.Dropdown
                        className={classes.menuDropdown}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Menu.Item
                          onClick={() => {
                            const name = window.prompt('Space name', space.name);
                            if (name)
                              void runAction(async () => {
                                await updateSpace(space.id, { name });
                                reload();
                              });
                          }}
                        >
                          Rename
                        </Menu.Item>
                        <Menu.Item
                          onClick={() =>
                            navigator.clipboard?.writeText(
                              `${window.location.origin}/space/${space.id}`
                            )
                          }
                        >
                          Copy link
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Label>Create new</Menu.Label>
                        <Menu.Item
                          onClick={async () => {
                            const name = window.prompt('Folder name');
                            if (!name) return;
                            await runAction(async () => {
                              await createFolder(space.id, { name, kind: 'TEAM', locked: true });
                              reload();
                            });
                          }}
                        >
                          Folder
                        </Menu.Item>
                        <Menu.Item
                          onClick={async () => {
                            const folder = firstTaskFolder(space);
                            if (!folder) return;
                            const name = window.prompt('List name');
                            if (!name) return;
                            await runAction(async () => {
                              await createTaskList(folder.id, { name, icon: '☣' });
                              reload();
                            });
                          }}
                        >
                          List
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
                  {isActiveSpace && (
                    <Tooltip label="Add folder">
                      <ActionIcon
                        variant="subtle"
                        aria-label="Add folder"
                        className={classes.rowAction}
                        onClick={async (event) => {
                          event.stopPropagation();
                          const name = window.prompt('Folder name');
                          if (!name) return;
                          await runAction(async () => {
                            await createFolder(space.id, { name, kind: 'TEAM', locked: true });
                            reload();
                          });
                        }}
                      >
                        <IconPlus size="1.125rem" />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>

                {isActiveSpace && (
                  <Box className={classes.folderTree}>
                    {space.folders.map((folder) => {
                      const isDocs = folder.kind === 'DOCS';
                      const isActiveFolder = folder.id === activeFolder?.id;
                      return (
                        <Box key={folder.id}>
                          <button
                            type="button"
                            className={
                              isActiveFolder
                                ? `${classes.folderTreeRow} ${classes.active}`
                                : classes.folderTreeRow
                            }
                            onClick={() => {
                              setFolderId(folder.id);
                              setTaskListId(firstTaskList(folder)?.id);
                              navigate(folderPath(space.id, folder.id));
                            }}
                          >
                            <Tooltip label={isDocs ? 'Docs folder' : 'Task folder'}>
                              {isDocs ? (
                                <IconFolderOpen size="1.25rem" color="#4c6ef5" />
                              ) : (
                                <IconFolder size="1.25rem" />
                              )}
                            </Tooltip>
                            <span>{folder.name}</span>
                            {folder.locked && (
                              <Tooltip label={`${folder.name} is private`}>
                                <IconLock size="0.9375rem" className={classes.mutedIcon} />
                              </Tooltip>
                            )}
                            {!isDocs && (
                              <Tooltip label="Add task list">
                                <ActionIcon
                                  variant="subtle"
                                  aria-label="Add task list"
                                  className={classes.rowAction}
                                  onClick={async (event) => {
                                    event.stopPropagation();
                                    const name = window.prompt('Task list name');
                                    if (!name) return;
                                    await runAction(async () => {
                                      await createTaskList(folder.id, { name, icon: '☣' });
                                      reload();
                                    });
                                  }}
                                >
                                  <IconPlus size="1rem" />
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </button>
                          {folder.taskLists?.map((taskList) => (
                            <button
                              key={taskList.id}
                              type="button"
                              className={
                                taskList.id === activeTaskList?.id
                                  ? `${classes.taskListNav} ${classes.active}`
                                  : classes.taskListNav
                              }
                              onClick={() => {
                                setFolderId(folder.id);
                                setTaskListId(taskList.id);
                                navigate(folderPath(space.id, folder.id));
                              }}
                            >
                              <Tooltip label={`Task list: ${taskList.name}`}>
                                <span className={classes.taskListIcon}>{taskList.icon || '☣'}</span>
                              </Tooltip>
                              <span>{taskList.name}</span>
                              <Tooltip
                                label={`${taskList._count?.tasks ?? taskList.tasks?.length ?? 0} tasks in ${taskList.name}`}
                              >
                                <Badge variant="light">
                                  {taskList._count?.tasks ?? taskList.tasks?.length ?? 0}
                                </Badge>
                              </Tooltip>
                            </button>
                          ))}
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            );
          })}
          <button
            className={classes.newSpaceRow}
            type="button"
            onClick={async () => {
              const name = window.prompt('Space name');
              if (!name) return;
              await runAction(async () => {
                await createSpace({
                  workspaceId: workspace.id,
                  name,
                  color: '#4c6ef5',
                  initials: name.slice(0, 1).toUpperCase(),
                  locked: true,
                });
                reload();
              });
            }}
          >
            <IconPlus size="1.125rem" />
            New Space
          </button>
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main className={classes.mainShell}>
        <Stack gap={0}>
          {actionError && (
            <Alert
              color="red"
              title="Action failed"
              withCloseButton
              onClose={() => setActionError(null)}
              m="md"
            >
              {actionError}
            </Alert>
          )}
          <Group className={classes.topBar} justify="space-between">
            <Group gap="xs" wrap="nowrap">
              <span className={classes.breadcrumbChip} style={{ background: activeSpace.color }}>
                {activeSpace.initials || activeSpace.name.slice(0, 1)}
              </span>
              <Button
                component={Link}
                to={folderPath(activeSpace.id, activeFolder?.id || '')}
                variant="subtle"
                size="compact-md"
              >
                {activeSpace.name}
              </Button>
              {activeSpace.locked && (
                <Tooltip label={`${activeSpace.name} is private`}>
                  <IconLock size="1rem" className={classes.mutedIcon} />
                </Tooltip>
              )}
              <Text c="dimmed">/</Text>
              <Tooltip label="Current folder">
                <IconFolder size="1.25rem" className={classes.mutedIcon} />
              </Tooltip>
              {activeFolder ? (
                <Button
                  component={Link}
                  to={folderPath(activeSpace.id, activeFolder.id)}
                  variant="subtle"
                  size="compact-md"
                >
                  {activeFolder.name}
                </Button>
              ) : (
                <Text fw={700}>Docs</Text>
              )}
              {activeFolder?.locked && (
                <Tooltip label={`${activeFolder.name} is private`}>
                  <IconLock size="1rem" className={classes.mutedIcon} />
                </Tooltip>
              )}
              <Text c="dimmed">/</Text>
              <Text fw={800}>{selectedTask?.title || activeTaskList?.name || 'DOC'}</Text>
              <Tooltip label="Current location">
                <IconChevronDown size="1rem" className={classes.mutedIcon} />
              </Tooltip>
            </Group>
            <Group gap="md">
              <Button
                variant="light"
                leftSection={<IconSearch size="1rem" />}
                onClick={() => setSearchOpen(true)}
              >
                Search ⌘K
              </Button>
              <Button variant="light" onClick={() => toggleColorScheme()}>
                {colorScheme === 'dark' ? 'Light' : 'Dark'}
              </Button>
            </Group>
          </Group>

          {selectedTask ? (
            <Box p="lg">
              <TaskDetailPage
                task={selectedTask}
                workspace={workspace}
                statuses={statuses}
                onBack={backToFolder}
                onSaved={(task) => {
                  setSelectedTask(task);
                  reload();
                }}
                onOpenSubtask={openSubtask}
                onError={setActionError}
              />
            </Box>
          ) : (
            <Tabs defaultValue="tasks" keepMounted={false} className={classes.contentTabs}>
              <Tabs.List className={classes.viewTabs}>
                <Tabs.Tab value="board" leftSection={<IconLayoutKanban size="1rem" />}>
                  Board
                </Tabs.Tab>
                <Tabs.Tab value="tasks" leftSection={<IconList size="1rem" />}>
                  List
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="tasks">
                <Stack gap={0}>
                  <Group className={classes.taskToolbar} justify="space-between">
                    <Group gap="xs">
                      <Tooltip label="Grouped by ClickUp status">
                        <Badge variant="light">Grouped by ClickUp status</Badge>
                      </Tooltip>
                    </Group>
                    <Group gap="xs">
                      <TextInput
                        value={taskSearch}
                        onChange={(event) => setTaskSearch(event.currentTarget.value)}
                        placeholder="Search tasks"
                        leftSection={<IconSearch size="1rem" />}
                        w="16rem"
                      />
                      <Select
                        value={statusFilter}
                        onChange={setStatusFilter}
                        clearable
                        placeholder="Status"
                        data={statuses.map((item) => ({ value: item.id, label: item.name }))}
                        w="10rem"
                      />
                      <MultiSelect
                        value={assigneeFilter}
                        onChange={setAssigneeFilter}
                        clearable
                        placeholder="Assignees"
                        data={availableAssignees.map((user) => ({
                          value: user.id,
                          label: user.name,
                        }))}
                        w="14rem"
                        searchable
                      />
                      <Select
                        value={priorityFilter}
                        onChange={setPriorityFilter}
                        clearable
                        placeholder="Priority"
                        data={['LOW', 'NORMAL', 'HIGH', 'URGENT']}
                        w="9rem"
                      />
                      <Tooltip label="Open search">
                        <ActionIcon
                          className={classes.pillIcon}
                          variant="subtle"
                          aria-label="Search"
                          onClick={() => setSearchOpen(true)}
                        >
                          <IconSearch size="1.25rem" />
                        </ActionIcon>
                      </Tooltip>
                      <Button
                        color="teal"
                        rightSection={<IconChevronDown size="1rem" />}
                        onClick={() => statuses[0] && addTask(statuses[0].id)}
                      >
                        Add Task
                      </Button>
                    </Group>
                  </Group>
                  {tasksError && (
                    <Alert color="red" title="Could not load tasks">
                      {tasksError}
                    </Alert>
                  )}
                  {tasksLoading && !tasks.length ? (
                    <Box className={classes.center} p="xl">
                      <Loader />
                    </Box>
                  ) : tasks.length === 0 ? (
                    <Box p="xl">
                      <Text c="dimmed">No tasks match these filters.</Text>
                    </Box>
                  ) : view === 'board' ? (
                    <TaskBoard
                      tasks={tasks}
                      statuses={statuses}
                      onAddTask={addTask}
                      onOpenTask={openTask}
                      onReorderTasks={reorderTaskGroup}
                      onChanged={reload}
                      onError={setActionError}
                    />
                  ) : (
                    <GroupedTaskList
                      tasks={tasks}
                      statuses={statuses}
                      onAddTask={addTask}
                      onOpenTask={openTask}
                      onMoveTask={moveTask}
                      onReorderTasks={reorderTaskGroup}
                      onChanged={reload}
                      onError={setActionError}
                    />
                  )}
                  {nextCursor && (
                    <Button
                      variant="subtle"
                      loading={tasksLoading}
                      onClick={() => void loadTasks(nextCursor)}
                    >
                      Load more
                    </Button>
                  )}
                </Stack>
              </Tabs.Panel>
              <Tabs.Panel value="board" p="lg">
                <TaskBoard
                  tasks={tasks}
                  statuses={statuses}
                  onAddTask={addTask}
                  onOpenTask={openTask}
                  onReorderTasks={reorderTaskGroup}
                  onChanged={reload}
                  onError={setActionError}
                />
              </Tabs.Panel>
            </Tabs>
          )}
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
