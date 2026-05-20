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
  IconBell,
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconFolder,
  IconLayoutKanban,
  IconList,
  IconLock,
  IconPlus,
  IconReport,
  IconSearch,
  IconTableOptions,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  getTask,
  bulkUpdateTasks,
  createSavedView,
  deleteSavedView,
  getImportReports,
  getNotifications,
  getSavedViews,
  getTasks,
  getWorkspaces,
  logout,
  markAllNotificationsRead,
  markNotificationRead,
  updateTask,
  firstTaskFolder,
  firstTaskList,
  folderPath,
  getErrorMessage,
  parseAppPath,
  taskPath,
  workspaceHasWork,
  type Task,
  type CurrentUser,
  type Folder,
  type MigrationRun,
  type NotificationItem,
  type SavedView,
  type User,
  type Workspace,
} from '@/lib';
import { ProfileModal } from '../../auth/ProfileModal/ProfileModal';
import { AvatarStack } from '../../common/AvatarStack';
import { GlobalSearchModal } from '../../search/GlobalSearchModal/GlobalSearchModal';
import { GroupedTaskList } from '../../tasks/StatusIcon';
import { TaskCreateModal } from '../../tasks/TaskCreateModal';
import { TaskDetailPage } from '../../tasks/TaskDetailPage/TaskDetailPage';
import { TaskBoard } from '../../tasks/TaskViews/TaskBoard/TaskBoard';
import { SpaceCreateModal } from '../SpaceCreateModal/SpaceCreateModal';
import classes from './WorkspaceShell.module.css';

export interface WorkspaceShellProps {
  currentUser: CurrentUser;
  onCurrentUserChange: (user: CurrentUser | null) => void;
}

function findFolderById(folders: Folder[], id?: string): Folder | undefined {
  for (const folder of folders) {
    if (folder.id === id) return folder;
    const child = findFolderById(folder.folders || [], id);
    if (child) return child;
  }
  return undefined;
}

export function WorkspaceShell({ currentUser, onCurrentUserChange }: WorkspaceShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [spaceId, setSpaceId] = useState<string>();
  const [folderId, setFolderId] = useState<string>();
  const [taskListId, setTaskListId] = useState<string>();
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [spaceCreateOpen, setSpaceCreateOpen] = useState(false);
  const [taskView, setTaskView] = useState<string | null>('tasks');
  const [expandedSpaceIds, setExpandedSpaceIds] = useState<Set<string>>(() => new Set());
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set());
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [savedViewName, setSavedViewName] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [importReports, setImportReports] = useState<MigrationRun[]>([]);
  const profileUser = {
    id: currentUser.id,
    email: currentUser.email,
    name: currentUser.name,
    avatarUrl: currentUser.avatarUrl || undefined,
  };

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
        setExpandedSpaceIds(
          (current) => new Set([...current, ...(defaultSpace?.id ? [defaultSpace.id] : [])])
        );
        setExpandedFolderIds(
          (current) => new Set([...current, ...(defaultFolder?.id ? [defaultFolder.id] : [])])
        );
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
  const currentMembership = workspace?.memberships.find(
    (membership) => membership.user.id === currentUser.id
  );
  const currentPermissionSet = workspace?.permissionSets.find(
    (set) => set.role === currentMembership?.role
  );
  const canWriteTasks = Boolean(currentPermissionSet?.manageTasks);
  const canManageSpaces = Boolean(currentPermissionSet?.manageSpaces);
  const activeSpace = useMemo(
    () => workspace?.spaces.find((space) => space.id === spaceId) || workspace?.spaces[0],
    [workspace, spaceId]
  );
  const activeFolder = useMemo(
    () => findFolderById(activeSpace?.folders || [], folderId) || firstTaskFolder(activeSpace),
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
  const currentOpenProjectUser = useMemo(
    () => availableAssignees.find((user) => user.email === currentUser.email),
    [availableAssignees, currentUser.email]
  );
  const assignedToMeActive = Boolean(
    currentOpenProjectUser && assigneeFilter.includes(currentOpenProjectUser.id)
  );

  const loadTasks = useCallback(
    async (cursor?: string) => {
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
    },
    [workspace?.id, activeTaskList?.id, statusFilter, assigneeFilter, priorityFilter, taskSearch]
  );

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!workspace?.id) return;
    getSavedViews(workspace.id)
      .then(setSavedViews)
      .catch(() => setSavedViews([]));
    getNotifications()
      .then((page) => {
        setNotifications(page.items);
        setNotificationUnread(page.unread);
      })
      .catch(() => {
        setNotifications([]);
        setNotificationUnread(0);
      });
    getImportReports()
      .then(setImportReports)
      .catch(() => setImportReports([]));
  }, [workspace?.id, refreshKey]);

  const addTask = async (statusId: string) => {
    if (!activeTaskList || !canWriteTasks) return;
    setCreateTaskStatusId(statusId);
  };

  const moveTask = async (taskId: string, statusId: string) => {
    if (!canWriteTasks) return;
    const task = tasks.find((item) => item.id === taskId);
    if (task?.statusId === statusId) return;
    await runAction(async () => {
      await updateTask(taskId, { statusId });
      reload();
    });
  };

  const toggleSelectedTask = (taskId: string, selected: boolean) => {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (selected) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  };

  const selectedTaskIdList = [...selectedTaskIds];

  const runBulkUpdate = async (input: {
    statusId?: string;
    priority?: string;
    assigneeIds?: string[];
  }) => {
    if (!selectedTaskIdList.length) return;
    await runAction(async () => {
      const result = await bulkUpdateTasks({ taskIds: selectedTaskIdList, ...input });
      setSelectedTaskIds(new Set());
      reload();
      if (result.failed) {
        setActionError(
          `Bulk update completed with ${result.updated} updated and ${result.failed} failed.`
        );
      }
    });
  };

  const currentFilters = {
    search: taskSearch,
    statusId: statusFilter,
    assigneeIds: assigneeFilter,
    priority: priorityFilter,
  };

  const saveCurrentView = async () => {
    if (!workspace?.id || !savedViewName.trim()) return;
    await runAction(async () => {
      const view = await createSavedView({
        workspaceId: workspace.id,
        listId: activeTaskList?.id,
        name: savedViewName.trim(),
        filters: currentFilters,
      });
      setSavedViews((current) => [view, ...current]);
      setSavedViewName('');
    });
  };

  const applySavedView = (viewId: string | null) => {
    const view = savedViews.find((item) => item.id === viewId);
    if (!view) return;
    const filters = view.filters as {
      search?: string;
      statusId?: string | null;
      assigneeIds?: string[];
      priority?: string | null;
    };
    setTaskSearch(filters.search || '');
    setStatusFilter(filters.statusId || null);
    setAssigneeFilter(filters.assigneeIds || []);
    setPriorityFilter(filters.priority || null);
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

  const toggleSpace = (id: string) => {
    setExpandedSpaceIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFolder = (id: string) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openFolder = (spaceIdValue: string, folder: Folder) => {
    setSpaceId(spaceIdValue);
    setFolderId(folder.id);
    setTaskListId(firstTaskList(folder)?.id);
    setExpandedSpaceIds((current) => new Set([...current, spaceIdValue]));
    setExpandedFolderIds((current) => new Set([...current, folder.id]));
    navigate(folderPath(spaceIdValue, folder.id));
  };

  const renderFolder = (spaceIdValue: string, folder: Folder, depth = 0) => {
    const isExpanded = expandedFolderIds.has(folder.id);
    const hasChildren = Boolean(folder.folders?.length);
    const list = firstTaskList(folder);
    return (
      <Box key={folder.id}>
        <button
          type="button"
          className={
            folder.id === activeFolder?.id
              ? `${classes.folderTreeRow} ${classes.active}`
              : classes.folderTreeRow
          }
          style={{ paddingLeft: `${0.5 + depth * 1.1}rem` }}
          onClick={() => {
            if (list) openFolder(spaceIdValue, folder);
            else toggleFolder(folder.id);
          }}
        >
          <span className={classes.treeCaret}>
            {hasChildren ? (
              isExpanded ? (
                <IconChevronDown size="0.875rem" />
              ) : (
                <IconChevronRight size="0.875rem" />
              )
            ) : (
              <IconFolder size="0.875rem" />
            )}
          </span>
          <span>{folder.name}</span>
          {folder.locked && <IconLock size="0.875rem" className={classes.mutedIcon} />}
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
            style={{ marginLeft: `${1.375 + depth * 1.1}rem` }}
            onClick={() => openFolder(spaceIdValue, folder)}
          >
            <Tooltip label={`Task list: ${taskList.name}`}>
              <span className={classes.taskListIcon}>{taskList.icon || '✓'}</span>
            </Tooltip>
            <span>{taskList.name}</span>
            <Tooltip
              label={`${taskList._count?.tasks ?? taskList.tasks?.length ?? 0} tasks in ${taskList.name}`}
            >
              <Badge variant="light">{taskList._count?.tasks ?? taskList.tasks?.length ?? 0}</Badge>
            </Tooltip>
          </button>
        ))}
        {isExpanded && folder.folders?.map((child) => renderFolder(spaceIdValue, child, depth + 1))}
      </Box>
    );
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
          <Alert color="red" title="Could not load OpenProject workspace">
            {actionError}
          </Alert>
        </Box>
      );
    }
    return (
      <Box className={`${classes.center} ${classes.setupScreen}`}>
        <Alert color="yellow" title="No OpenProject projects">
          The OpenProject API returned no projects for this token.
        </Alert>
      </Box>
    );
  }

  if (!activeSpace) {
    return (
      <Box className={`${classes.center} ${classes.setupScreen}`}>
        <SpaceCreateModal
          opened={spaceCreateOpen}
          workspace={workspace}
          onClose={() => setSpaceCreateOpen(false)}
          onCreated={reload}
        />
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
          {canManageSpaces && (
            <Button onClick={() => setSpaceCreateOpen(true)}>Create first space</Button>
          )}
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
        onCreateTask={() => setCreateTaskStatusId(statuses[0]?.id || null)}
        onCreateSpace={() => setSpaceCreateOpen(true)}
        onError={setActionError}
        canManageSpaces={canManageSpaces}
        canWriteTasks={canWriteTasks}
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
      <ProfileModal
        opened={profileOpen}
        user={currentUser}
        role={currentMembership?.role}
        onClose={() => setProfileOpen(false)}
        onSaved={onCurrentUserChange}
      />
      {workspace && (
        <SpaceCreateModal
          opened={spaceCreateOpen}
          workspace={workspace}
          onClose={() => setSpaceCreateOpen(false)}
          onCreated={reload}
        />
      )}
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
          {canManageSpaces && (
            <Tooltip label="Add space">
              <ActionIcon
                variant="light"
                aria-label="Add space"
                onClick={() => setSpaceCreateOpen(true)}
              >
                <IconPlus size="1.25rem" />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
        <button
          type="button"
          className={classes.profileButton}
          onClick={() => setProfileOpen(true)}
        >
          <AvatarStack users={[profileUser]} size="1.75rem" />
          <span>
            <Text size="sm" fw={700}>
              {currentUser.name}
            </Text>
            <Text size="xs" c="dimmed">
              {currentMembership?.role || 'No role'} • service-token mode
            </Text>
          </span>
        </button>
        <Button
          variant="subtle"
          size="compact-sm"
          mb="md"
          onClick={async () => {
            await logout().catch(() => undefined);
            onCurrentUserChange(null);
          }}
        >
          Logout
        </Button>
        <Text size="lg" fw={700} mb="md">
          Spaces
        </Text>
        <ScrollArea className={classes.spacesTree}>
          {workspace.spaces.map((space) => {
            const isActiveSpace = space.id === activeSpace.id;
            const isExpanded = expandedSpaceIds.has(space.id);
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
                      toggleSpace(space.id);
                      if (!isActiveSpace) {
                        setSpaceId(space.id);
                        const folder = firstTaskFolder(space);
                        setFolderId(folder?.id);
                        setTaskListId(firstTaskList(folder)?.id);
                        if (folder) navigate(folderPath(space.id, folder.id));
                      }
                    }}
                  >
                    <span className={classes.treeCaret}>
                      {isExpanded ? (
                        <IconChevronDown size="0.875rem" />
                      ) : (
                        <IconChevronRight size="0.875rem" />
                      )}
                    </span>
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
                        <Menu.Item disabled>Rename in OpenProject project settings</Menu.Item>
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
                        <Menu.Item disabled>Folders are not available in OpenProject</Menu.Item>
                        <Menu.Item disabled>Lists are not available in OpenProject</Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
                  {isActiveSpace && (
                    <Tooltip label="OpenProject projects do not have folders">
                      <ActionIcon
                        variant="subtle"
                        aria-label="Folders are not available in OpenProject"
                        className={classes.rowAction}
                        disabled
                      >
                        <IconPlus size="1.125rem" />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>

                {isExpanded && (
                  <Box className={classes.folderTree}>
                    {space.folders.map((folder) => renderFolder(space.id, folder))}
                  </Box>
                )}
              </Box>
            );
          })}
          {canManageSpaces && (
            <button
              className={classes.newSpaceRow}
              type="button"
              onClick={async () => {
                setSpaceCreateOpen(true);
              }}
            >
              <IconPlus size="1.125rem" />
              New Space
            </button>
          )}
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
                <Text fw={700}>Local Docs</Text>
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
              <Menu width="22rem" position="bottom-end">
                <Menu.Target>
                  <Tooltip label="Notifications">
                    <ActionIcon variant="light" aria-label="Notifications">
                      <IconBell size="1.125rem" />
                      {notificationUnread > 0 && (
                        <Badge size="xs" color="red">
                          {notificationUnread}
                        </Badge>
                      )}
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Notifications</Menu.Label>
                  {notifications.slice(0, 8).map((notification) => (
                    <Menu.Item
                      key={notification.id}
                      fw={notification.readAt ? 400 : 700}
                      onClick={async () => {
                        await markNotificationRead(notification.id).catch(() => undefined);
                        if (notification.workPackageId && activeSpace && activeFolder) {
                          navigate(
                            taskPath(activeSpace.id, activeFolder.id, notification.workPackageId)
                          );
                        }
                        reload();
                      }}
                    >
                      {notification.title}
                    </Menu.Item>
                  ))}
                  {!notifications.length && <Menu.Item disabled>No notifications</Menu.Item>}
                  <Menu.Divider />
                  <Menu.Item
                    onClick={async () => {
                      await markAllNotificationsRead().catch(() => undefined);
                      reload();
                    }}
                  >
                    Mark all as read
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
              {canManageSpaces && (
                <Menu width="24rem" position="bottom-end">
                  <Menu.Target>
                    <Tooltip label="Import reports">
                      <ActionIcon variant="light" aria-label="Import reports">
                        <IconReport size="1.125rem" />
                      </ActionIcon>
                    </Tooltip>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Latest import reports</Menu.Label>
                    {importReports.slice(0, 8).map((report) => (
                      <Menu.Item
                        key={report.id}
                        component="a"
                        href={`/api/import-reports/${report.id}/json`}
                        target="_blank"
                      >
                        {report.source} • {report.status} •{' '}
                        {new Date(report.startedAt).toLocaleString()}
                      </Menu.Item>
                    ))}
                    {!importReports.length && <Menu.Item disabled>No import reports yet</Menu.Item>}
                  </Menu.Dropdown>
                </Menu>
              )}
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
                canWriteTasks={canWriteTasks}
              />
            </Box>
          ) : (
            <Tabs
              value={taskView}
              onChange={setTaskView}
              keepMounted={false}
              className={classes.contentTabs}
            >
              <Tabs.List className={classes.viewTabs}>
                <Tabs.Tab value="tasks" leftSection={<IconList size="1rem" />}>
                  List
                </Tabs.Tab>
                <Tabs.Tab value="board" leftSection={<IconLayoutKanban size="1rem" />}>
                  Board
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="tasks">
                <Stack gap={0}>
                  <Group className={classes.taskToolbar} justify="space-between">
                    <Group gap="xs">
                      <Tooltip label="Grouped by OpenProject status">
                        <Badge variant="light">Grouped by OpenProject status</Badge>
                      </Tooltip>
                      <Select
                        placeholder="Saved views"
                        data={savedViews.map((view) => ({ value: view.id, label: view.name }))}
                        onChange={applySavedView}
                        leftSection={<IconTableOptions size="1rem" />}
                        w="12rem"
                      />
                      <TextInput
                        value={savedViewName}
                        onChange={(event) => setSavedViewName(event.currentTarget.value)}
                        placeholder="View name"
                        w="9rem"
                      />
                      <Button
                        variant="light"
                        disabled={!savedViewName.trim()}
                        onClick={saveCurrentView}
                      >
                        Save view
                      </Button>
                      {savedViews.length > 0 && (
                        <Menu>
                          <Menu.Target>
                            <ActionIcon variant="subtle" aria-label="Manage saved views">
                              <IconDots size="1rem" />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            {savedViews.map((view) => (
                              <Menu.Item
                                key={view.id}
                                color="red"
                                onClick={async () => {
                                  await deleteSavedView(view.id).catch((error) =>
                                    setActionError(getErrorMessage(error))
                                  );
                                  setSavedViews((current) =>
                                    current.filter((item) => item.id !== view.id)
                                  );
                                }}
                              >
                                Delete {view.name}
                              </Menu.Item>
                            ))}
                          </Menu.Dropdown>
                        </Menu>
                      )}
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
                      <Tooltip
                        label={
                          currentOpenProjectUser
                            ? 'Filter tasks assigned to current user'
                            : 'Current tracker user is not linked to an OpenProject user'
                        }
                      >
                        <Button
                          variant={assignedToMeActive ? 'filled' : 'light'}
                          disabled={!currentOpenProjectUser}
                          onClick={() => {
                            if (!currentOpenProjectUser) return;
                            setAssigneeFilter(
                              assignedToMeActive ? [] : [currentOpenProjectUser.id]
                            );
                          }}
                        >
                          Assigned to me
                        </Button>
                      </Tooltip>
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
                      {canWriteTasks && (
                        <Button
                          color="teal"
                          rightSection={<IconChevronDown size="1rem" />}
                          onClick={() => statuses[0] && addTask(statuses[0].id)}
                        >
                          Add Task
                        </Button>
                      )}
                    </Group>
                  </Group>
                  {tasksError && (
                    <Alert color="red" title="Could not load tasks">
                      {tasksError}
                    </Alert>
                  )}
                  {selectedTaskIds.size > 0 && canWriteTasks && (
                    <Alert color="blue" title={`${selectedTaskIds.size} selected`}>
                      <Group gap="xs">
                        <Select
                          placeholder="Bulk status"
                          data={statuses.map((item) => ({ value: item.id, label: item.name }))}
                          onChange={(value) => value && void runBulkUpdate({ statusId: value })}
                          w="12rem"
                        />
                        <Select
                          placeholder="Bulk priority"
                          data={['LOW', 'NORMAL', 'HIGH', 'URGENT']}
                          onChange={(value) => value && void runBulkUpdate({ priority: value })}
                          w="12rem"
                        />
                        <MultiSelect
                          placeholder="Bulk assignee/responsible"
                          data={availableAssignees.map((user) => ({
                            value: user.id,
                            label: user.name,
                          }))}
                          maxValues={2}
                          onChange={(value) => void runBulkUpdate({ assigneeIds: value })}
                          w="16rem"
                        />
                        <Button variant="subtle" onClick={() => setSelectedTaskIds(new Set())}>
                          Clear selection
                        </Button>
                      </Group>
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
                  ) : (
                    <GroupedTaskList
                      tasks={tasks}
                      statuses={statuses}
                      onAddTask={addTask}
                      onOpenTask={openTask}
                      onMoveTask={moveTask}
                      onChanged={reload}
                      onError={setActionError}
                      canWriteTasks={canWriteTasks}
                      selectedTaskIds={selectedTaskIds}
                      onSelectedTaskChange={toggleSelectedTask}
                    />
                  )}
                  {nextCursor && (
                    <Button
                      variant="subtle"
                      loading={tasksLoading}
                      onClick={() => loadTasks(nextCursor)}
                    >
                      Load more
                    </Button>
                  )}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="board">
                <Stack gap={0}>
                  <Group className={classes.taskToolbar} justify="space-between">
                    <Tooltip label="Board columns are OpenProject statuses. Dragging changes status only; card order is not persisted.">
                      <Badge variant="light">OpenProject status board</Badge>
                    </Tooltip>
                    <Group gap="xs">
                      {canWriteTasks && (
                        <Button
                          color="teal"
                          rightSection={<IconChevronDown size="1rem" />}
                          onClick={() => statuses[0] && addTask(statuses[0].id)}
                        >
                          Add Task
                        </Button>
                      )}
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
                  ) : (
                    <TaskBoard
                      tasks={tasks}
                      statuses={statuses}
                      onAddTask={addTask}
                      onOpenTask={openTask}
                      onMoveTask={moveTask}
                      canWriteTasks={canWriteTasks}
                    />
                  )}
                </Stack>
              </Tabs.Panel>
            </Tabs>
          )}
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
