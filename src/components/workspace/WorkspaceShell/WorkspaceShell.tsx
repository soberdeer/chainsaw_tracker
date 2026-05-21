import {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  Loader,
  Menu,
  Modal,
  MultiSelect,
  SimpleGrid,
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
  IconSettings,
  IconTableOptions,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getTask,
  bulkUpdateTasks,
  createSavedView,
  deleteSavedView,
  getImportReport,
  getImportReports,
  getNotifications,
  getWorkspaceOpenProjectStatus,
  getSavedViews,
  getTasks,
  getWorkspaces,
  logout,
  markAllNotificationsRead,
  markNotificationRead,
  updateTask,
  updateSavedView,
  firstTaskFolder,
  firstTaskList,
  folderPath,
  getErrorMessage,
  parseAppPath,
  docPath,
  buildWorkspaceBreadcrumbs,
  buildWorkspaceChecklist,
  describeTaskCollectionState,
  summarizeImportRun,
  taskPath,
  workspaceHasWork,
  type Task,
  type CurrentUser,
  type DocumentItem,
  type Folder,
  type MigrationRun,
  type NotificationItem,
  type OpenProjectConnectionStatus,
  type SavedView,
  type User,
  type Workspace,
} from '@/lib';
import { ProfileModal } from '../../auth/ProfileModal/ProfileModal';
import { AvatarStack } from '../../common/AvatarStack';
import { DocumentPage } from '../../docs/DocumentPage/DocumentPage';
import { DocumentsPanel } from '../../docs/DocumentsPanel/DocumentsPanel';
import { GlobalSearchModal } from '../../search/GlobalSearchModal/GlobalSearchModal';
import { GroupedTaskList } from '../../tasks/StatusIcon';
import { TaskCreateModal } from '../../tasks/TaskCreateModal';
import { TaskDetailPage } from '../../tasks/TaskDetailPage/TaskDetailPage';
import { TaskBoard } from '../../tasks/TaskViews/TaskBoard/TaskBoard';
import { ProjectAccessModal } from '../ProjectAccessModal/ProjectAccessModal';
import { SpaceCreateModal } from '../SpaceCreateModal/SpaceCreateModal';
import { WorkspaceSettingsModal } from '../WorkspaceSettingsModal/WorkspaceSettingsModal';
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

function readInitialQuery() {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  return {
    taskView: params.get('view') || 'tasks',
    taskSearch: params.get('search') || '',
    statusFilter: params.get('status') || null,
    priorityFilter: params.get('priority') || null,
    assigneeFilter: params.get('assignees')?.split(',').filter(Boolean) || [],
    savedViewId: params.get('savedView') || null,
  };
}

const initialQuery = readInitialQuery();

const EXPANDED_SPACE_KEY = 'op-tracker:expanded-spaces';
const EXPANDED_FOLDER_KEY = 'op-tracker:expanded-folders';

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
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [taskSearch, setTaskSearch] = useState(initialQuery.taskSearch);
  const [statusFilter, setStatusFilter] = useState<string | null>(initialQuery.statusFilter);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>(initialQuery.assigneeFilter);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(initialQuery.priorityFilter);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createTaskStatusId, setCreateTaskStatusId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [workspaceSettingsTab, setWorkspaceSettingsTab] = useState<string | undefined>(undefined);
  const [projectAccessOpen, setProjectAccessOpen] = useState(false);
  const [spaceCreateOpen, setSpaceCreateOpen] = useState(false);
  const [taskView, setTaskView] = useState<string | null>(initialQuery.taskView);
  const [expandedSpaceIds, setExpandedSpaceIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') {
      return new Set();
    }
    try {
      const stored = JSON.parse(localStorage.getItem(EXPANDED_SPACE_KEY) || '[]');
      return new Set(Array.isArray(stored) ? stored : []);
    } catch {
      return new Set();
    }
  });
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') {
      return new Set();
    }
    try {
      const stored = JSON.parse(localStorage.getItem(EXPANDED_FOLDER_KEY) || '[]');
      return new Set(Array.isArray(stored) ? stored : []);
    } catch {
      return new Set();
    }
  });
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [savedViewName, setSavedViewName] = useState('');
  const [savedViewVisibility, setSavedViewVisibility] = useState<'PRIVATE' | 'WORKSPACE'>(
    'PRIVATE'
  );
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(
    initialQuery.savedViewId
  );
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [importReports, setImportReports] = useState<MigrationRun[]>([]);
  const [activeImportReport, setActiveImportReport] = useState<MigrationRun | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<OpenProjectConnectionStatus | null>(
    null
  );
  const profileUser = {
    id: currentUser.id,
    email: currentUser.email,
    name: currentUser.name,
    avatarUrl: currentUser.avatarUrl || undefined,
  };

  const reload = () => setRefreshKey((key) => key + 1);
  const runAction = async (action: () => Promise<void>, successMessage?: string) => {
    try {
      setActionError(null);
      setActionNotice(null);
      await action();
      if (successMessage) {
        setActionNotice(successMessage);
      }
    } catch (caughtError) {
      setActionError(getErrorMessage(caughtError));
    }
  };

  useEffect(() => {
    if (!actionNotice) return;
    const timeout = window.setTimeout(() => setActionNotice(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [actionNotice]);

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
    if (typeof window === 'undefined') return;
    localStorage.setItem(EXPANDED_SPACE_KEY, JSON.stringify([...expandedSpaceIds]));
  }, [expandedSpaceIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(EXPANDED_FOLDER_KEY, JSON.stringify([...expandedFolderIds]));
  }, [expandedFolderIds]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    taskView ? params.set('view', taskView) : params.delete('view');
    taskSearch ? params.set('search', taskSearch) : params.delete('search');
    statusFilter ? params.set('status', statusFilter) : params.delete('status');
    priorityFilter ? params.set('priority', priorityFilter) : params.delete('priority');
    assigneeFilter.length
      ? params.set('assignees', assigneeFilter.join(','))
      : params.delete('assignees');
    activeSavedViewId ? params.set('savedView', activeSavedViewId) : params.delete('savedView');
    const nextSearch = params.toString() ? `?${params.toString()}` : '';
    if (nextSearch !== location.search) {
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch,
        },
        { replace: true }
      );
    }
  }, [
    activeSavedViewId,
    assigneeFilter,
    location.pathname,
    location.search,
    navigate,
    priorityFilter,
    statusFilter,
    taskSearch,
    taskView,
  ]);

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
          setSelectedDoc(null);
        } else if (route.docId) {
          const doc =
            defaultSpace?.documents.find((item) => item.id === route.docId) ||
            items
              .flatMap((item) => item.spaces)
              .flatMap((space) => space.documents)
              .find((item) => item.id === route.docId);
          setSelectedDoc(doc || null);
          setSelectedTask(null);
          setTaskView('docs');
        } else {
          setSelectedTask(null);
          setSelectedDoc(null);
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
  const canManageWorkspace = Boolean(currentPermissionSet?.manageWorkspace);
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
    (workspace?.openProjectUsers || []).forEach((user) => users.set(user.id, user));
    workspace?.memberships.forEach((membership) => {
      if (membership.user.openProjectUserId) {
        users.set(membership.user.openProjectUserId, {
          ...membership.user,
          id: membership.user.openProjectUserId,
          name: membership.user.name,
        });
      }
      users.set(membership.user.id, membership.user);
    });
    tasks.forEach((task) => {
      (task.assignees || (task.assignee ? [task.assignee] : [])).forEach((user) =>
        users.set(user.id, user)
      );
    });
    return [...users.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [workspace, tasks]);
  const currentOpenProjectUser = useMemo(
    () =>
      availableAssignees.find(
        (user) =>
          (currentUser.openProjectUserId && user.id === currentUser.openProjectUserId) ||
          user.email === currentUser.email
      ),
    [availableAssignees, currentUser.email, currentUser.openProjectUserId]
  );
  const assignedToMeActive = Boolean(
    currentOpenProjectUser && assigneeFilter.includes(currentOpenProjectUser.id)
  );
  const latestImportReport = importReports[0] || null;
  const latestImportSummary = summarizeImportRun(latestImportReport);
  const checklist = buildWorkspaceChecklist({
    connectionStatus,
    latestImport: latestImportReport,
    workspaceMemberCount: workspace?.memberships.length || 0,
    githubEnabled: Boolean(workspace?.githubIntegration),
  });
  const docsAvailable = Boolean(activeSpace?.documents.length);
  const filtersActive = Boolean(
    taskSearch.trim() || statusFilter || priorityFilter || assigneeFilter.length
  );
  const emptyState = describeTaskCollectionState({
    hasLinkedOpenProjectUser: Boolean(currentOpenProjectUser),
    assignedToMeActive,
    filtersActive,
    isWorkspaceWide: false,
  });
  const breadcrumbItems = buildWorkspaceBreadcrumbs({
    workspace,
    activeSpace,
    activeFolder,
    activeTaskList,
    selectedTaskTitle: selectedTask?.title || null,
    selectedDocTitle: selectedDoc?.title || null,
    currentView: selectedDoc ? 'docs' : (taskView as 'tasks' | 'board' | 'docs') || 'tasks',
  });

  useEffect(() => {
    if (taskView === 'docs' && !docsAvailable) {
      setTaskView('tasks');
    }
  }, [docsAvailable, taskView]);

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
    if (canManageWorkspace) {
      getWorkspaceOpenProjectStatus(workspace.id)
        .then(setConnectionStatus)
        .catch(() => setConnectionStatus(null));
    } else {
      setConnectionStatus(null);
    }
  }, [workspace?.id, refreshKey, canManageWorkspace]);

  const addTask = async (statusId: string) => {
    if (!activeTaskList || !canWriteTasks) return;
    setCreateTaskStatusId(statusId);
  };

  const moveTask = async (taskId: string, statusId: string) => {
    if (!canWriteTasks) return;
    const task = tasks.find((item) => item.id === taskId);
    if (task?.statusId === statusId) return;
    const previousTasks = tasks;
    const previousSelectedTask = selectedTask;
    const nextStatusName = statuses.find((candidate) => candidate.id === statusId)?.name;
    setTasks((current) =>
      current.map((item) =>
        item.id === taskId
          ? { ...item, statusId, ...(nextStatusName ? { status: nextStatusName } : {}) }
          : item
      )
    );
    if (selectedTask?.id === taskId) {
      setSelectedTask({
        ...selectedTask,
        statusId,
        ...(nextStatusName ? { status: nextStatusName } : {}),
      });
    }
    try {
      const updated = await updateTask(taskId, { statusId });
      setTasks((current) => current.map((item) => (item.id === taskId ? updated : item)));
      if (selectedTask?.id === taskId) {
        setSelectedTask(updated);
      }
      setActionNotice('Task status updated.');
    } catch (error) {
      setTasks(previousTasks);
      setSelectedTask(previousSelectedTask);
      setActionError(getErrorMessage(error));
    }
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
        setActionNotice(
          `Bulk update finished: ${result.updated} updated, ${result.failed} failed, ${result.skipped} skipped.`
        );
        setActionError(
          result.results
            .filter((item) => item.status === 'failed')
            .map((item) => `${item.taskId}: ${item.reason || 'OpenProject rejected the update'}`)
            .slice(0, 5)
            .join(' | ')
        );
      }
    }, 'Bulk update completed.');
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
        visibility: savedViewVisibility,
      });
      setSavedViews((current) => [view, ...current]);
      setSavedViewName('');
      setSavedViewVisibility('PRIVATE');
      setActiveSavedViewId(view.id);
    }, 'Saved view created.');
  };

  const applySavedView = (viewId: string | null) => {
    setActiveSavedViewId(viewId);
    const view = savedViews.find((item) => item.id === viewId);
    if (!view) {
      clearFilters();
      return;
    }
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
    setSelectedDoc(null);
    navigate(taskPath(activeSpace.id, activeFolder.id, task.id));
    getTask(task.id)
      .then(setSelectedTask)
      .catch((error) => setActionError(getErrorMessage(error)));
  };

  const openDoc = (doc: DocumentItem) => {
    if (!activeSpace) return;
    setSelectedDoc(doc);
    setSelectedTask(null);
    setTaskView('docs');
    navigate(docPath(activeSpace.id, doc.id));
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
    setSelectedDoc(null);
    navigate(folderPath(activeSpace.id, activeFolder.id));
  };

  const backToDocs = () => {
    if (!activeSpace) return;
    setSelectedDoc(null);
    setTaskView('docs');
    navigate(`/space/${activeSpace.id}`);
  };

  const clearFilters = () => {
    setTaskSearch('');
    setStatusFilter(null);
    setPriorityFilter(null);
    setAssigneeFilter([]);
    setActiveSavedViewId(null);
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
    setSelectedTask(null);
    setSelectedDoc(null);
    setTaskView('tasks');
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
    <>
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
          onOpenAssignedToMe={() => {
            if (!currentOpenProjectUser) {
              setActionError('This account is not linked to an OpenProject user yet.');
              return;
            }
            setAssigneeFilter([currentOpenProjectUser.id]);
            setTaskView('tasks');
            setSelectedDoc(null);
            setSelectedTask(null);
            setProfileOpen(false);
          }}
        />
        {workspace && (
          <WorkspaceSettingsModal
            opened={workspaceSettingsOpen}
            workspaceId={workspace.id}
            currentRole={currentMembership?.role}
            canManageWorkspace={canManageWorkspace}
            initialTab={workspaceSettingsTab}
            onClose={() => setWorkspaceSettingsOpen(false)}
            onUpdated={() => reload()}
            onOpenImportReport={(report) =>
              void runAction(async () => {
                setActiveImportReport(await getImportReport(report.id));
              })
            }
          />
        )}
        {workspace && activeSpace && (
          <ProjectAccessModal
            opened={projectAccessOpen}
            workspaceId={workspace.id}
            projectId={activeSpace.id}
            projectName={activeSpace.name}
            onClose={() => setProjectAccessOpen(false)}
          />
        )}
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
                  OpenProject-backed tracker workspace
                </Text>
              </div>
            </Group>
            <Group gap="xs">
              <Tooltip label="Workspace settings">
                <ActionIcon
                  variant="light"
                  aria-label="Workspace settings"
                  onClick={() => {
                    setWorkspaceSettingsTab('general');
                    setWorkspaceSettingsOpen(true);
                  }}
                >
                  <IconSettings size="1.25rem" />
                </ActionIcon>
              </Tooltip>
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
          </Group>
          <button
            type="button"
            className={classes.profileButton}
            onClick={() => setProfileOpen(true)}
          >
            <AvatarStack users={[profileUser]} size="1.75rem" />
            <span>
              <Text size="sm" fw={700}>
                {currentUser.name || currentUser.email}
              </Text>
              <Text size="xs" c="dimmed">
                {currentMembership?.role || 'No role'} •{' '}
                {currentUser.openProjectUserId
                  ? 'linked to OpenProject'
                  : 'not linked to OpenProject'}
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
          <Text size="sm" fw={700} mb="xs">
            Workspace
          </Text>
          <Stack gap={4} mb="md">
            <Button
              variant={taskView === 'tasks' && !selectedTask && !selectedDoc ? 'light' : 'subtle'}
              justify="flex-start"
              leftSection={<IconList size="1rem" />}
              onClick={() => {
                setTaskView('tasks');
                setSelectedTask(null);
                setSelectedDoc(null);
              }}
            >
              Open Tasks
            </Button>
            {docsAvailable && (
              <Button
                variant={taskView === 'docs' ? 'light' : 'subtle'}
                justify="flex-start"
                leftSection={<IconFolder size="1rem" />}
                onClick={() => {
                  setTaskView('docs');
                  setSelectedTask(null);
                }}
              >
                Local Docs
              </Button>
            )}
            {canManageWorkspace && (
              <>
                <Button
                  variant="subtle"
                  justify="flex-start"
                  leftSection={<IconReport size="1rem" />}
                  onClick={() => {
                    setWorkspaceSettingsTab('imports');
                    setWorkspaceSettingsOpen(true);
                  }}
                >
                  Import Reports
                </Button>
                <Button
                  variant="subtle"
                  justify="flex-start"
                  leftSection={<IconSettings size="1rem" />}
                  onClick={() => {
                    setWorkspaceSettingsTab('general');
                    setWorkspaceSettingsOpen(true);
                  }}
                >
                  Workspace Settings
                </Button>
              </>
            )}
          </Stack>
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
                          setSelectedTask(null);
                          setSelectedDoc(null);
                          setTaskView('tasks');
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
                          <Menu.Item onClick={() => setProjectAccessOpen(true)}>
                            OpenProject access
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
            {actionNotice && (
              <Alert
                color="green"
                title="Saved"
                withCloseButton
                onClose={() => setActionNotice(null)}
                m="md"
              >
                {actionNotice}
              </Alert>
            )}
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
                {breadcrumbItems.map((item, index) => (
                  <Group gap="xs" wrap="nowrap" key={`${item.label}:${index}`}>
                    {index === 0 && activeSpace ? (
                      <span
                        className={classes.breadcrumbChip}
                        style={{ background: activeSpace.color }}
                      >
                        {activeSpace.initials || activeSpace.name.slice(0, 1)}
                      </span>
                    ) : null}
                    <Text
                      fw={index === breadcrumbItems.length - 1 ? 800 : 600}
                      c={index === breadcrumbItems.length - 1 ? undefined : 'dimmed'}
                    >
                      {item.label}
                    </Text>
                    {index < breadcrumbItems.length - 1 && <Text c="dimmed">/</Text>}
                  </Group>
                ))}
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
                          setNotifications((current) =>
                            current.map((item) =>
                              item.id === notification.id
                                ? { ...item, readAt: new Date().toISOString() }
                                : item
                            )
                          );
                          setNotificationUnread((current) => Math.max(0, current - 1));
                          await markNotificationRead(notification.id).catch((error) =>
                            setActionError(getErrorMessage(error))
                          );
                          if (notification.workPackageId && activeSpace && activeFolder) {
                            navigate(
                              taskPath(activeSpace.id, activeFolder.id, notification.workPackageId)
                            );
                          }
                        }}
                      >
                        <Stack gap={2}>
                          <Text size="sm" fw={notification.readAt ? 500 : 700}>
                            {notification.title}
                          </Text>
                          {notification.message && (
                            <Text size="xs" c="dimmed">
                              {notification.message}
                            </Text>
                          )}
                        </Stack>
                      </Menu.Item>
                    ))}
                    {!notifications.length && <Menu.Item disabled>No notifications yet.</Menu.Item>}
                    <Menu.Divider />
                    <Menu.Item
                      onClick={async () => {
                        setNotifications((current) =>
                          current.map((item) => ({ ...item, readAt: new Date().toISOString() }))
                        );
                        setNotificationUnread(0);
                        await markAllNotificationsRead().catch((error) =>
                          setActionError(getErrorMessage(error))
                        );
                      }}
                    >
                      Mark all as read
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
                {canManageWorkspace && (
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
                          onClick={() =>
                            void runAction(async () => {
                              setActiveImportReport(await getImportReport(report.id));
                            })
                          }
                        >
                          <Stack gap={2}>
                            <Text size="sm" fw={700}>
                              {report.source} • {report.status}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {new Date(report.startedAt).toLocaleString()}
                            </Text>
                          </Stack>
                        </Menu.Item>
                      ))}
                      {!importReports.length && (
                        <Menu.Item disabled>No import reports yet</Menu.Item>
                      )}
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

            {!selectedTask && !selectedDoc && (
              <Box p="md" className={classes.overviewPanel}>
                <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="md">
                  <Alert color="blue" title={workspace.name}>
                    <Text size="sm">
                      Current workspace for imported OpenProject projects and work packages.
                    </Text>
                  </Alert>
                  <Alert
                    color={connectionStatus?.ok ? 'green' : canManageWorkspace ? 'yellow' : 'blue'}
                    title="OpenProject connection"
                  >
                    <Text size="sm">
                      {canManageWorkspace
                        ? connectionStatus?.ok
                          ? `Connected to ${connectionStatus.baseUrl}`
                          : 'Connection status needs attention.'
                        : 'OpenProject connection is managed by workspace admins.'}
                    </Text>
                  </Alert>
                  <Alert
                    color={latestImportReport?.status === 'SUCCESS' ? 'green' : 'yellow'}
                    title="Last import"
                  >
                    <Text size="sm">
                      {latestImportReport
                        ? `${latestImportReport.status} • ${new Date(latestImportReport.startedAt).toLocaleString()}`
                        : 'Import has not been run yet.'}
                    </Text>
                  </Alert>
                  <Alert color="teal" title="Import coverage">
                    <Text size="sm">
                      {latestImportSummary.projectsImported} projects,{' '}
                      {latestImportSummary.tasksImported} tasks, {latestImportSummary.usersImported}{' '}
                      users, {latestImportSummary.assigneesMapped} assignees mapped.
                    </Text>
                  </Alert>
                </SimpleGrid>
                <Group mt="md">
                  <Button
                    variant="light"
                    onClick={() => {
                      setTaskView('tasks');
                      setSelectedTask(null);
                      setSelectedDoc(null);
                    }}
                  >
                    Open Tasks
                  </Button>
                  <Button
                    variant="light"
                    disabled={!currentOpenProjectUser}
                    onClick={() => {
                      if (!currentOpenProjectUser) return;
                      setAssigneeFilter([currentOpenProjectUser.id]);
                      setTaskView('tasks');
                    }}
                  >
                    Open Assigned to me
                  </Button>
                  <Button
                    variant="light"
                    onClick={() => {
                      setWorkspaceSettingsTab('general');
                      setWorkspaceSettingsOpen(true);
                    }}
                  >
                    Open Workspace Settings
                  </Button>
                  {canManageWorkspace && (
                    <Button
                      variant="light"
                      onClick={() => {
                        if (latestImportReport) {
                          void runAction(async () => {
                            setActiveImportReport(await getImportReport(latestImportReport.id));
                          });
                          return;
                        }
                        setWorkspaceSettingsTab('imports');
                        setWorkspaceSettingsOpen(true);
                      }}
                    >
                      Open Import Reports
                    </Button>
                  )}
                  {connectionStatus?.baseUrl && (
                    <Button component="a" href={connectionStatus.baseUrl} target="_blank">
                      Open OpenProject
                    </Button>
                  )}
                </Group>
                {canManageWorkspace && (
                  <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm" mt="md">
                    {checklist.map((item) => (
                      <Alert
                        key={item.label}
                        color={item.done ? 'green' : 'yellow'}
                        variant="light"
                      >
                        <Text fw={700}>{item.label}</Text>
                      </Alert>
                    ))}
                  </SimpleGrid>
                )}
              </Box>
            )}

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
                {docsAvailable && <Tabs.Tab value="docs">Local Docs</Tabs.Tab>}
              </Tabs.List>

              <Tabs.Panel value="tasks">
                <Stack gap={0}>
                  <Group className={classes.taskToolbar} justify="space-between">
                    <Group gap="xs">
                      <Tooltip label="Grouped by OpenProject status">
                        <Badge variant="light">Grouped by OpenProject status</Badge>
                      </Tooltip>
                      {!canWriteTasks && (
                        <Tooltip label="Only workspace owners and admins can write to OpenProject in service-token mode.">
                          <Badge color="yellow" variant="light">
                            Read-only
                          </Badge>
                        </Tooltip>
                      )}
                      <Select
                        placeholder="Saved views"
                        data={savedViews.map((view) => ({ value: view.id, label: view.name }))}
                        value={activeSavedViewId}
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
                      <Select
                        value={savedViewVisibility}
                        onChange={(value) =>
                          setSavedViewVisibility((value as 'PRIVATE' | 'WORKSPACE') || 'PRIVATE')
                        }
                        data={[
                          { value: 'PRIVATE', label: 'Private' },
                          { value: 'WORKSPACE', label: 'Workspace' },
                        ]}
                        w="10rem"
                      />
                      <Button
                        variant="light"
                        disabled={!savedViewName.trim()}
                        onClick={saveCurrentView}
                      >
                        Save view
                      </Button>
                      {filtersActive && (
                        <Button variant="subtle" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      )}
                      {savedViews.length > 0 && (
                        <Menu>
                          <Menu.Target>
                            <ActionIcon variant="subtle" aria-label="Manage saved views">
                              <IconDots size="1rem" />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            {savedViews.map((view) => (
                              <Box key={view.id}>
                                <Menu.Item
                                  onClick={async () => {
                                    const nextName = window.prompt('Rename saved view', view.name);
                                    if (!nextName?.trim()) return;
                                    const updated = await updateSavedView(view.id, {
                                      name: nextName.trim(),
                                    }).catch((error) => {
                                      setActionError(getErrorMessage(error));
                                      return null;
                                    });
                                    if (!updated) return;
                                    setSavedViews((current) =>
                                      current.map((item) =>
                                        item.id === updated.id ? updated : item
                                      )
                                    );
                                    setActionNotice('Saved view renamed.');
                                  }}
                                >
                                  Rename {view.name}
                                </Menu.Item>
                                <Menu.Item
                                  onClick={async () => {
                                    const nextVisibility =
                                      view.visibility === 'PRIVATE' ? 'WORKSPACE' : 'PRIVATE';
                                    const updated = await updateSavedView(view.id, {
                                      visibility: nextVisibility,
                                    }).catch((error) => {
                                      setActionError(getErrorMessage(error));
                                      return null;
                                    });
                                    if (!updated) return;
                                    setSavedViews((current) =>
                                      current.map((item) =>
                                        item.id === updated.id ? updated : item
                                      )
                                    );
                                    setActionNotice('Saved view access updated.');
                                  }}
                                >
                                  Make {view.visibility === 'PRIVATE' ? 'workspace' : 'private'}
                                </Menu.Item>
                                <Menu.Item
                                  color="red"
                                  onClick={async () => {
                                    if (!window.confirm(`Delete saved view "${view.name}"?`)) {
                                      return;
                                    }
                                    await deleteSavedView(view.id).catch((error) =>
                                      setActionError(getErrorMessage(error))
                                    );
                                    setSavedViews((current) =>
                                      current.filter((item) => item.id !== view.id)
                                    );
                                    if (activeSavedViewId === view.id) {
                                      setActiveSavedViewId(null);
                                    }
                                    setActionNotice('Saved view deleted.');
                                  }}
                                >
                                  Delete {view.name}
                                </Menu.Item>
                              </Box>
                            ))}
                          </Menu.Dropdown>
                        </Menu>
                      )}
                    </Group>
                    <Group gap="xs">
                      <TextInput
                        value={taskSearch}
                        onChange={(event) => setTaskSearch(event.currentTarget.value)}
                        placeholder="Search title or task key"
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
                      <Stack gap="sm">
                        <Text fw={700}>{emptyState.title}</Text>
                        <Text c="dimmed">{emptyState.message}</Text>
                        {emptyState.actionLabel && (
                          <Button variant="light" onClick={clearFilters}>
                            {emptyState.actionLabel}
                          </Button>
                        )}
                      </Stack>
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
                    <Group gap="xs">
                      <Tooltip label="Board columns are OpenProject statuses. Dragging changes status only; card order is not persisted.">
                        <Badge variant="light">OpenProject status board</Badge>
                      </Tooltip>
                      {!canWriteTasks && (
                        <Tooltip label="Only workspace owners and admins can move tasks in service-token mode.">
                          <Badge color="yellow" variant="light">
                            Read-only
                          </Badge>
                        </Tooltip>
                      )}
                    </Group>
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

              {docsAvailable && (
                <Tabs.Panel value="docs">
                  <Box p="md">
                    {selectedDoc ? (
                      <DocumentPage
                        document={selectedDoc}
                        onBack={backToDocs}
                        onSaved={(document) => {
                          setSelectedDoc(document);
                          reload();
                        }}
                        onError={setActionError}
                      />
                    ) : (
                      <DocumentsPanel
                        documents={activeSpace.documents}
                        spaceId={activeSpace.id}
                        onOpen={openDoc}
                        onChanged={reload}
                        onError={setActionError}
                      />
                    )}
                  </Box>
                </Tabs.Panel>
              )}
            </Tabs>
          </Stack>
        </AppShell.Main>
      </AppShell>
      <Drawer
        opened={Boolean(selectedTask)}
        onClose={backToFolder}
        position="right"
        size="78rem"
        title={selectedTask ? `Task • ${selectedTask.taskKey || selectedTask.id}` : 'Task'}
      >
        {selectedTask && (
          <TaskDetailPage
            task={selectedTask}
            workspace={workspace}
            statuses={statuses}
            onBack={backToFolder}
            onSaved={(task) => {
              setSelectedTask(task);
              setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
            }}
            onOpenSubtask={openSubtask}
            onError={setActionError}
            canWriteTasks={canWriteTasks}
          />
        )}
      </Drawer>
      <Modal
        opened={Boolean(activeImportReport)}
        onClose={() => setActiveImportReport(null)}
        title="Import report"
        size="lg"
      >
        {activeImportReport && (
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }}>
              {(() => {
                const summary = summarizeImportRun(activeImportReport);
                return (
                  <>
                    <Alert variant="light" color="blue" title="Tasks imported">
                      {summary.tasksImported}
                    </Alert>
                    <Alert variant="light" color="teal" title="Users imported">
                      {summary.usersImported}
                    </Alert>
                    <Alert variant="light" color="grape" title="Assignees mapped">
                      {summary.assigneesMapped}
                    </Alert>
                    <Alert
                      variant="light"
                      color={summary.errorsCount > 0 ? 'red' : 'yellow'}
                      title="Warnings / errors"
                    >
                      {summary.warningsCount} / {summary.errorsCount}
                    </Alert>
                  </>
                );
              })()}
            </SimpleGrid>
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text fw={700}>
                  {activeImportReport.source} • {activeImportReport.status}
                </Text>
                <Text size="sm" c="dimmed">
                  Started {new Date(activeImportReport.startedAt).toLocaleString()}
                </Text>
                {activeImportReport.finishedAt && (
                  <Text size="sm" c="dimmed">
                    Finished {new Date(activeImportReport.finishedAt).toLocaleString()}
                  </Text>
                )}
              </Stack>
              <Button
                component="a"
                href={`/api/import-reports/${activeImportReport.id}/json`}
                target="_blank"
                variant="light"
              >
                Download JSON
              </Button>
            </Group>
            <Group>
              <Button
                variant="subtle"
                onClick={() =>
                  navigator.clipboard?.writeText(JSON.stringify(activeImportReport, null, 2))
                }
              >
                Copy JSON
              </Button>
            </Group>
            <Text size="sm" fw={700}>
              Summary
            </Text>
            <Text component="pre" size="xs" style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(activeImportReport.summary || {}, null, 2)}
            </Text>
            <Text size="sm" fw={700}>
              Warnings
            </Text>
            <Text component="pre" size="xs" style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(activeImportReport.warnings || [], null, 2)}
            </Text>
            <Text size="sm" fw={700}>
              Errors
            </Text>
            <Text component="pre" size="xs" style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(activeImportReport.errors || [], null, 2)}
            </Text>
          </Stack>
        )}
      </Modal>
    </>
  );
}
