import {
  Alert,
  AppShell,
  Box,
  Breadcrumbs,
  Button,
  Drawer,
  Group,
  Loader,
  Stack,
  Tabs,
  Text,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { IconLayoutKanban, IconList, IconSearch } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listToOpProjectId, useProjectUsers } from '@/hooks/useProjectUsers';
import { useTaskFilters } from '@/hooks/useTaskFilters';
import {
  getTask,
  bulkUpdateTasks,
  getImportReport,
  getImportReports,
  getNotifications,
  getOpenProjectTags,
  getOpenProjectTaskTypes,
  getTasks,
  getWorkspaces,
  logout,
  markAllNotificationsRead,
  markNotificationRead,
  myTasksPath,
  allTasksPath,
  reorderBoardTasks,
  saveBoardCardOrder,
  updateTask,
  firstTaskFolder,
  firstTaskList,
  folderPath,
  getErrorMessage,
  parseAppPath,
  docPath,
  buildWorkspaceBreadcrumbs,
  describeTaskCollectionState,
  showToast,
  taskPath,
  workspaceHasWork,
  type Task,
  type CurrentUser,
  type DocumentItem,
  type Folder,
  type MigrationRun,
  type NotificationItem,
  type OpenProjectTaskTypeOption,
  type Tag,
  type User,
  type Workspace,
} from '@/lib';
import { ProfileModal } from '../../auth/ProfileModal/ProfileModal';
import { DocumentPage } from '../../docs/DocumentPage/DocumentPage';
import { DocumentsPanel } from '../../docs/DocumentsPanel/DocumentsPanel';
import { GlobalSearchModal } from '../../search/GlobalSearchModal/GlobalSearchModal';
import { TaskCreateModal } from '../../tasks/TaskCreateModal';
import { TaskDetailPage } from '../../tasks/TaskDetailPage/TaskDetailPage';
import { ProjectAccessModal } from '../ProjectAccessModal/ProjectAccessModal';
import { SpaceCreateModal } from '../SpaceCreateModal/SpaceCreateModal';
import { WorkspaceSettingsModal } from '../WorkspaceSettingsModal/WorkspaceSettingsModal';
import { BoardPanel } from './BoardPanel';
import { ImportReportModal } from './ImportReportModal';
import { ImportReportsMenu } from './ImportReportsMenu';
import { NotificationMenu } from './NotificationMenu';
import { TaskListPanel } from './TaskListPanel';
import { WorkspaceSidebar } from './WorkspaceSidebar';
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

/**
 * Given a folder ID, find the Space that contains it.
 * Without a seeded hierarchy the backend sets task.departmentId to the project's own ID,
 * which for child projects is a folder ID rather than a space ID.
 * This helper resolves the correct space by scanning the workspace tree.
 */
function findSpaceForFolder(
  spaces: { id: string; folders: Folder[] }[],
  folderId: string | undefined
): { id: string; folders: Folder[] } | undefined {
  if (!folderId) return undefined;
  return spaces.find((space) => Boolean(findFolderById(space.folders, folderId)));
}

function readInitialQuery(search = typeof window === 'undefined' ? '' : window.location.search) {
  const params = new URLSearchParams(search);
  return {
    taskView: params.get('view') || 'tasks',
    taskSearch: params.get('search') || '',
    statusFilter: params.get('status') || null,
    priorityFilter: params.get('priority') || null,
    assigneeFilter: params.get('assignees')?.split(',').filter(Boolean) || [],
    responsibleFilter: params.get('responsibles')?.split(',').filter(Boolean) || [],
    typeFilter: params.get('types')?.split(',').filter(Boolean) || [],
    tagFilter: params.get('tags')?.split(',').filter(Boolean) || [],
    dueBeforeFilter: params.get('dueBefore') || '',
    updatedSinceFilter: params.get('updatedSince') || '',
    overdueFilter: params.get('overdue') === 'true',
    hasGitHubPrFilter: params.get('hasGitHubPr') === 'true',
    cursor: params.get('cursor') || null,
    sortDir: (params.get('sort') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc',
  };
}

const EXPANDED_SPACE_KEY = 'op-tracker:expanded-spaces';
const EXPANDED_FOLDER_KEY = 'op-tracker:expanded-folders';

export function WorkspaceShell({ currentUser, onCurrentUserChange }: WorkspaceShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;
  const route = useMemo(() => parseAppPath(location.pathname), [location.pathname]);
  const initialQuery = useMemo(() => readInitialQuery(location.search), [location.search]);
  const cursorQuery = useMemo(
    () => new URLSearchParams(location.search).get('cursor') || undefined,
    [location.search]
  );
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
  const {
    taskView,
    setTaskView,
    taskSearch,
    setTaskSearch,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    assigneeFilter,
    setAssigneeFilter,
    responsibleFilter,
    setResponsibleFilter,
    typeFilter,
    setTypeFilter,
    tagFilter,
    setTagFilter,
    dueBeforeFilter,
    setDueBeforeFilter,
    updatedSinceFilter,
    setUpdatedSinceFilter,
    overdueFilter,
    setOverdueFilter,
    hasGitHubPrFilter,
    setHasGitHubPrFilter,
    sortDir,
    setSortDir,
    filtersActive,
    clearFilters,
    buildActiveChips,
  } = useTaskFilters(initialQuery);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createTaskStatusId, setCreateTaskStatusId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [workspaceSettingsTab, setWorkspaceSettingsTab] = useState<string | undefined>(undefined);
  const [projectAccessOpen, setProjectAccessOpen] = useState(false);
  const [spaceCreateOpen, setSpaceCreateOpen] = useState(false);
  const [taskReturnPath, setTaskReturnPath] = useState<string | null>(null);
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
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [importReports, setImportReports] = useState<MigrationRun[]>([]);
  const [taskTypes, setTaskTypes] = useState<OpenProjectTaskTypeOption[]>([]);
  const [openProjectTags, setOpenProjectTags] = useState<Tag[]>([]);
  const [activeImportReport, setActiveImportReport] = useState<MigrationRun | null>(null);

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
    if (!actionNotice) return;
    showToast({
      tone: 'success',
      title: 'Saved',
      message: actionNotice,
    });
  }, [actionNotice]);

  useEffect(() => {
    if (!actionError) return;
    showToast({
      tone: 'error',
      title: 'Could not complete action',
      message: actionError,
      autoCloseMs: 5600,
    });
  }, [actionError]);

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
    const loc = locationRef.current;
    const params = new URLSearchParams(loc.search);
    taskView ? params.set('view', taskView) : params.delete('view');
    taskSearch ? params.set('search', taskSearch) : params.delete('search');
    statusFilter ? params.set('status', statusFilter) : params.delete('status');
    priorityFilter ? params.set('priority', priorityFilter) : params.delete('priority');
    assigneeFilter.length
      ? params.set('assignees', assigneeFilter.join(','))
      : params.delete('assignees');
    responsibleFilter.length
      ? params.set('responsibles', responsibleFilter.join(','))
      : params.delete('responsibles');
    typeFilter.length ? params.set('types', typeFilter.join(',')) : params.delete('types');
    tagFilter.length ? params.set('tags', tagFilter.join(',')) : params.delete('tags');
    dueBeforeFilter ? params.set('dueBefore', dueBeforeFilter) : params.delete('dueBefore');
    updatedSinceFilter
      ? params.set('updatedSince', updatedSinceFilter)
      : params.delete('updatedSince');
    overdueFilter ? params.set('overdue', 'true') : params.delete('overdue');
    hasGitHubPrFilter ? params.set('hasGitHubPr', 'true') : params.delete('hasGitHubPr');
    sortDir === 'desc' ? params.set('sort', 'desc') : params.delete('sort');
    const nextSearch = params.toString() ? `?${params.toString()}` : '';
    if (nextSearch !== loc.search) {
      navigate(
        {
          pathname: loc.pathname,
          search: nextSearch,
        },
        { replace: true }
      );
    }
  }, [
    assigneeFilter,
    responsibleFilter,
    typeFilter,
    tagFilter,
    dueBeforeFilter,
    updatedSinceFilter,
    overdueFilter,
    hasGitHubPrFilter,
    navigate,
    priorityFilter,
    sortDir,
    statusFilter,
    taskSearch,
    taskView,
  ]);

  useEffect(() => {
    getWorkspaces()
      .then((items) => {
        setWorkspaces(items);
        const route = parseAppPath(locationRef.current.pathname);
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
            .then((task) => {
              setSelectedTask(task);
              // task.departmentId can equal the sub-project's own ID (a folder ID)
              // when there is no seeded hierarchy, so we resolve the space by finding
              // which space actually contains the task's folder.
              const allSpaces = items.flatMap((w) => w.spaces);
              const taskFolderId = task.folderId;
              const taskSpace =
                findSpaceForFolder(allSpaces, taskFolderId) ||
                allSpaces.find((s) => s.id === task.departmentId);
              if (taskSpace?.id) setSpaceId(taskSpace.id);
              if (taskFolderId) setFolderId(taskFolderId);
              if (task.taskListId) setTaskListId(task.taskListId);
            })
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

        if (!route.spaceId && !route.scope && defaultSpace && defaultFolder) {
          navigate(folderPath(defaultSpace.id, defaultFolder.id), { replace: true });
        }
      })
      .catch((error) => {
        setActionError(getErrorMessage(error));
        setLoading(false);
      });
  }, [refreshKey, workspaceId, navigate, setTaskView]);

  const workspace = workspaces.find((item) => item.id === workspaceId) || workspaces[0];
  const currentMembership = workspace?.memberships.find(
    (membership) => membership.user.id === currentUser.id
  );
  const currentPermissionSet = workspace?.permissionSets.find(
    (set) => set.role === currentMembership?.role
  );
  const isPrivilegedRole = currentMembership?.role === 'ADMIN';
  const canWriteTasks = isPrivilegedRole || Boolean(currentPermissionSet?.manageTasks);
  const canManageSpaces = isPrivilegedRole || Boolean(currentPermissionSet?.manageSpaces);
  const canManageWorkspace = isPrivilegedRole || Boolean(currentPermissionSet?.manageWorkspace);
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
      if (task.assignee) users.set(task.assignee.id, task.assignee);
    });
    return [...users.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [workspace, tasks]);
  const activeTaskListOpProjectId = listToOpProjectId(activeTaskList?.id);
  const { users: activeTaskListUsers, loading: activeTaskListUsersLoading } = useProjectUsers(
    workspace?.id,
    activeTaskListOpProjectId
  );
  const currentOpenProjectUser = useMemo(
    () =>
      availableAssignees.find(
        (user) =>
          (currentUser.openProjectUserId && user.id === currentUser.openProjectUserId) ||
          user.email === currentUser.email
      ),
    [availableAssignees, currentUser.email, currentUser.openProjectUserId]
  );
  const currentOpenProjectUserRef = useRef(currentOpenProjectUser);
  currentOpenProjectUserRef.current = currentOpenProjectUser;
  const assignedToMeActive = Boolean(
    currentOpenProjectUser && assigneeFilter.includes(currentOpenProjectUser.id)
  );
  const workspaceWideScope = route.scope || null;
  const workspaceWideLabel =
    workspaceWideScope === 'mine' ? 'My Tasks' : workspaceWideScope === 'all' ? 'All Tasks' : null;
  const isWorkspaceWide = Boolean(workspaceWideScope);
  const canManageBoardOrder = canWriteTasks;
  const docsAvailable = Boolean(activeSpace?.documents.length);
  const emptyState = describeTaskCollectionState({
    hasLinkedOpenProjectUser: Boolean(currentOpenProjectUser),
    assignedToMeActive: assignedToMeActive || workspaceWideScope === 'mine',
    filtersActive,
    isWorkspaceWide,
  });
  const breadcrumbItems = buildWorkspaceBreadcrumbs({
    workspace,
    activeSpace,
    activeFolder,
    activeTaskList,
    selectedTaskTitle: selectedTask?.title || null,
    selectedDocTitle: selectedDoc?.title || null,
    currentView: selectedDoc ? 'docs' : (taskView as 'tasks' | 'board' | 'docs') || 'tasks',
    workspaceWideLabel,
  });

  useEffect(() => {
    if (taskView === 'docs' && !docsAvailable) {
      setTaskView('tasks');
    }
  }, [docsAvailable, taskView, setTaskView]);

  const loadTasks = useCallback(
    async (cursor?: string, append = Boolean(cursor)) => {
      if (!workspace?.id || (!isWorkspaceWide && !activeTaskList?.id)) {
        setTasks([]);
        setNextCursor(null);
        return;
      }
      const currentOPUser = currentOpenProjectUserRef.current;
      if (workspaceWideScope === 'mine' && !currentOPUser) {
        setTasks([]);
        setNextCursor(null);
        setTasksLoading(false);
        return;
      }

      try {
        setTasksLoading(true);
        setTasksError(null);
        const effectiveAssigneeIds =
          workspaceWideScope === 'mine' && currentOPUser
            ? [currentOPUser.id]
            : assigneeFilter.length
              ? assigneeFilter
              : undefined;

        const page = await getTasks({
          workspaceId: workspace.id,
          listId: isWorkspaceWide ? undefined : activeTaskList?.id,
          statusId: statusFilter || undefined,
          assigneeIds: effectiveAssigneeIds,
          responsibleIds: responsibleFilter.length ? responsibleFilter : undefined,
          typeIds: typeFilter.length ? typeFilter : undefined,
          dueBefore: dueBeforeFilter || undefined,
          overdue: overdueFilter || undefined,
          updatedSince: updatedSinceFilter || undefined,
          tagIds: tagFilter.length ? tagFilter : undefined,
          hasGitHubPr: hasGitHubPrFilter || undefined,
          priority: priorityFilter || undefined,
          search: taskSearch,
          limit: 50,
          cursor,
        });

        setTasks((current) => (append ? [...current, ...page.items] : page.items));
        setNextCursor(page.nextCursor || null);
      } catch (error) {
        setTasksError(getErrorMessage(error));
      } finally {
        setTasksLoading(false);
      }
    },
    [
      workspace?.id,
      activeTaskList?.id,
      statusFilter,
      assigneeFilter,
      responsibleFilter,
      typeFilter,
      dueBeforeFilter,
      updatedSinceFilter,
      tagFilter,
      overdueFilter,
      hasGitHubPrFilter,
      priorityFilter,
      taskSearch,
      isWorkspaceWide,
      workspaceWideScope,
    ]
  );

  useEffect(() => {
    loadTasks(cursorQuery, false);
    // refreshKey is intentionally listed to force a re-fetch when reload() is called
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorQuery, loadTasks, refreshKey]);

  const handleLoadMoreTasks = useCallback(() => {
    if (!nextCursor) {
      return;
    }
    void loadTasks(nextCursor, true);
  }, [loadTasks, nextCursor]);

  useEffect(() => {
    if (!workspace?.id) return;
    getOpenProjectTags(workspace.id)
      .then(setOpenProjectTags)
      .catch(() => setOpenProjectTags([]));
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
  }, [workspace?.id, refreshKey, canManageWorkspace]);

  useEffect(() => {
    getOpenProjectTaskTypes(activeTaskList?.id)
      .then(setTaskTypes)
      .catch(() => setTaskTypes([]));
  }, [activeTaskList?.id, refreshKey]);

  const addTask = async (statusId: string) => {
    if (!activeTaskList || !canWriteTasks) return;
    setCreateTaskStatusId(statusId);
  };

  const moveTask = async (taskId: string, statusId: string, targetTaskId?: string | null) => {
    if (!canWriteTasks) return;
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const nextBoard = reorderBoardTasks(tasks, statuses, {
      taskId,
      toStatusId: statusId,
      targetTaskId,
    });
    if (!nextBoard) {
      return;
    }

    const previousTasks = tasks;
    const previousSelectedTask = selectedTask;
    const previousStatusId = task.statusId;
    const statusChanged = previousStatusId !== statusId;
    setTasks(nextBoard.tasks);
    if (selectedTask?.id === taskId) {
      setSelectedTask(nextBoard.updatedTask);
    }

    let statusUpdated = false;
    try {
      if (statusChanged) {
        const updated = await updateTask(taskId, { statusId });
        statusUpdated = true;
        setTasks((current) => current.map((item) => (item.id === taskId ? updated : item)));
        if (selectedTask?.id === taskId) {
          setSelectedTask(updated);
        }
      }

      if (activeTaskList) {
        await saveBoardCardOrder({
          listId: activeTaskList.id,
          orders: nextBoard.orders,
        });
      }
      setActionNotice(statusChanged ? 'Task status updated.' : 'Task order updated.');
    } catch (error) {
      if (statusUpdated && previousStatusId) {
        await updateTask(taskId, { statusId: previousStatusId }).catch(() => undefined);
      }
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
    try {
      setActionError(null);
      setActionNotice(null);
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
      } else {
        setActionNotice('Bulk update completed.');
      }
    } catch (caughtError) {
      setActionError(getErrorMessage(caughtError));
    }
  };

  const openTask = (task: Task) => {
    setSelectedTask(task);
    setSelectedDoc(null);
    setTaskReturnPath(location.pathname);

    // For workspace-wide views ("All Tasks" / "My Tasks") navigate to the task's
    // canonical folder so the sidebar and underlying list reflect the task's home.
    // For folder-specific views we must NOT change spaceId / folderId / taskListId —
    // doing so would cause the task list behind the drawer to reload with different
    // content (jumping back to the default folder).
    if (isWorkspaceWide) {
      const taskFolderId = task.folderId || activeFolder?.id;
      // task.departmentId may equal the sub-project's own ID (a folder ID) rather than
      // the root space ID when there is no seeded hierarchy — resolve from the tree.
      const taskSpace =
        findSpaceForFolder(workspace?.spaces || [], taskFolderId) ||
        workspace?.spaces.find((s) => s.id === task.departmentId);
      const taskSpaceId = taskSpace?.id || activeSpace?.id;
      if (taskSpaceId) setSpaceId(taskSpaceId);
      if (taskFolderId) setFolderId(taskFolderId);
      if (taskSpaceId && taskFolderId) {
        navigate(taskPath(taskSpaceId, taskFolderId, task.id));
      }
    } else {
      // Stay in the current folder — only update the URL to include the task id.
      const curSpaceId = activeSpace?.id;
      const curFolderId = activeFolder?.id;
      if (curSpaceId && curFolderId) {
        navigate(taskPath(curSpaceId, curFolderId, task.id));
      }
    }

    // Fetch full task details (relations, attachments, etc.).
    // Do NOT mutate spaceId / folderId / taskListId from the async result —
    // navigation context is already correct from the sync block above.
    getTask(task.id)
      .then((fullTask) => {
        setSelectedTask(fullTask);
      })
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
    const targetFolderId = task.folderId || activeFolder?.id;
    const targetSpace =
      findSpaceForFolder(workspace?.spaces || [], targetFolderId) ||
      workspace?.spaces.find((s) => s.id === task.departmentId);
    const targetSpaceId = targetSpace?.id || activeSpace?.id;
    if (!targetSpaceId || !targetFolderId) return;
    setSelectedTask(task);
    setTaskReturnPath(location.pathname);
    setSpaceId(targetSpaceId);
    setFolderId(targetFolderId);
    if (task.taskListId) {
      setTaskListId(task.taskListId);
    }
    navigate(taskPath(targetSpaceId, targetFolderId, task.id));
  };

  const backToFolder = () => {
    setSelectedTask(null);
    setSelectedDoc(null);
    if (taskReturnPath && taskReturnPath !== location.pathname) {
      navigate(taskReturnPath);
      return;
    }
    if (workspaceWideScope === 'all') {
      navigate(allTasksPath());
      return;
    }
    if (workspaceWideScope === 'mine') {
      navigate(myTasksPath());
      return;
    }
    if (!activeSpace || !activeFolder) return;
    navigate(folderPath(activeSpace.id, activeFolder.id));
  };

  const backToDocs = () => {
    if (!activeSpace) return;
    setSelectedDoc(null);
    setTaskView('docs');
    navigate(`/space/${activeSpace.id}`);
  };

  const activeFilterChips = buildActiveChips(statuses, taskTypes, openProjectTags);

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
          <Alert color="red" title="Could not load ChainsawLeg workspace">
            {actionError}
          </Alert>
        </Box>
      );
    }
    return (
      <Box className={`${classes.center} ${classes.setupScreen}`}>
        <Alert color="yellow" title="No ChainsawLeg projects">
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
          users={activeTaskListUsers.length > 0 ? activeTaskListUsers : availableAssignees}
          usersLoading={activeTaskListUsersLoading}
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
        <AppShell.Navbar p="md" className={classes.workspaceSidebar} data-testid="sidebar">
          <WorkspaceSidebar
            workspace={workspace}
            currentUser={currentUser}
            currentMembership={currentMembership}
            canManageSpaces={canManageSpaces}
            activeSpace={activeSpace}
            activeFolder={activeFolder}
            expandedSpaceIds={expandedSpaceIds}
            expandedFolderIds={expandedFolderIds}
            workspaceWideScope={workspaceWideScope}
            taskView={taskView}
            docsAvailable={docsAvailable}
            selectedTask={selectedTask}
            selectedDoc={selectedDoc}
            currentOpenProjectUser={currentOpenProjectUser}
            onToggleSpace={toggleSpace}
            onToggleFolder={toggleFolder}
            onOpenFolder={openFolder}
            onSelectAllTasks={() => {
              setTaskView('tasks');
              setSelectedTask(null);
              setSelectedDoc(null);
              navigate(allTasksPath());
            }}
            onSelectMyTasks={() => {
              if (!currentOpenProjectUser) return;
              setTaskView('tasks');
              setSelectedTask(null);
              setSelectedDoc(null);
              navigate(myTasksPath());
            }}
            onSelectDocs={() => {
              setTaskView('docs');
              setSelectedTask(null);
            }}
            onOpenProfile={() => setProfileOpen(true)}
            onOpenSettings={() => {
              setWorkspaceSettingsTab('general');
              setWorkspaceSettingsOpen(true);
            }}
            onOpenProjectAccess={() => setProjectAccessOpen(true)}
            onCreateSpace={() => setSpaceCreateOpen(true)}
            onLogout={async () => {
              await logout().catch(() => undefined);
              onCurrentUserChange(null);
            }}
          />
        </AppShell.Navbar>

        <AppShell.Main className={classes.mainShell} data-testid="workspace-shell">
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
              <Breadcrumbs separator="/" separatorMargin="xs" data-testid="breadcrumbs">
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
                  </Group>
                ))}
              </Breadcrumbs>
              <Group gap="md">
                <NotificationMenu
                  notifications={notifications}
                  unreadCount={notificationUnread}
                  onMarkRead={async (id) => {
                    setNotifications((current) =>
                      current.map((item) =>
                        item.id === id ? { ...item, readAt: new Date().toISOString() } : item
                      )
                    );
                    setNotificationUnread((current) => Math.max(0, current - 1));
                    await markNotificationRead(id).catch((error) =>
                      setActionError(getErrorMessage(error))
                    );
                  }}
                  onMarkAllRead={async () => {
                    setNotifications((current) =>
                      current.map((item) => ({ ...item, readAt: new Date().toISOString() }))
                    );
                    setNotificationUnread(0);
                    await markAllNotificationsRead().catch((error) =>
                      setActionError(getErrorMessage(error))
                    );
                  }}
                  onNavigateToTask={(workPackageId) => {
                    if (activeSpace && activeFolder) {
                      navigate(taskPath(activeSpace.id, activeFolder.id, workPackageId));
                    }
                  }}
                />
                {canManageWorkspace && (
                  <ImportReportsMenu
                    reports={importReports}
                    onOpenReport={(report) =>
                      void runAction(async () => {
                        setActiveImportReport(await getImportReport(report.id));
                      })
                    }
                  />
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
                <TaskListPanel
                  tasks={tasks}
                  tasksLoading={tasksLoading}
                  tasksError={tasksError}
                  nextCursor={nextCursor}
                  emptyState={emptyState}
                  taskSearch={taskSearch}
                  statusFilter={statusFilter}
                  priorityFilter={priorityFilter}
                  assigneeFilter={assigneeFilter}
                  responsibleFilter={responsibleFilter}
                  typeFilter={typeFilter}
                  tagFilter={tagFilter}
                  dueBeforeFilter={dueBeforeFilter}
                  updatedSinceFilter={updatedSinceFilter}
                  overdueFilter={overdueFilter}
                  hasGitHubPrFilter={hasGitHubPrFilter}
                  filtersActive={filtersActive}
                  filterMenuOpen={filterMenuOpen}
                  activeFilterChips={activeFilterChips}
                  sortDir={sortDir}
                  onSearchChange={setTaskSearch}
                  onStatusChange={setStatusFilter}
                  onPriorityChange={setPriorityFilter}
                  onAssigneesChange={setAssigneeFilter}
                  onResponsibleChange={setResponsibleFilter}
                  onTypeChange={setTypeFilter}
                  onTagsChange={setTagFilter}
                  onDueBeforeChange={setDueBeforeFilter}
                  onUpdatedSinceChange={setUpdatedSinceFilter}
                  onOverdueChange={setOverdueFilter}
                  onHasGitHubPrChange={setHasGitHubPrFilter}
                  onFilterMenuOpenChange={setFilterMenuOpen}
                  onClearFilters={clearFilters}
                  onToggleSortDir={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  statuses={statuses}
                  availableAssignees={availableAssignees}
                  taskTypes={taskTypes}
                  openProjectTags={openProjectTags}
                  currentOpenProjectUser={currentOpenProjectUser}
                  assignedToMeActive={assignedToMeActive}
                  canWriteTasks={canWriteTasks}
                  isWorkspaceWide={isWorkspaceWide}
                  activeTaskListId={activeTaskList?.id}
                  selectedTaskIds={selectedTaskIds}
                  onAddTask={addTask}
                  onOpenTask={openTask}
                  onMoveTask={moveTask}
                  onTaskChanged={reload}
                  onError={setActionError}
                  onSelectedTaskChange={toggleSelectedTask}
                  onBulkStatus={(statusId) => void runBulkUpdate({ statusId })}
                  onBulkPriority={(priority) => void runBulkUpdate({ priority })}
                  onBulkAssignees={(assigneeIds) => void runBulkUpdate({ assigneeIds })}
                  onClearSelection={() => setSelectedTaskIds(new Set())}
                  onLoadMore={handleLoadMoreTasks}
                />
              </Tabs.Panel>

              <Tabs.Panel value="board">
                <BoardPanel
                  tasks={tasks}
                  tasksLoading={tasksLoading}
                  tasksError={tasksError}
                  statuses={statuses}
                  canWriteTasks={canManageBoardOrder}
                  isWorkspaceWide={isWorkspaceWide}
                  activeTaskListId={activeTaskList?.id}
                  sortDir={sortDir}
                  onToggleSortDir={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  onAddTask={addTask}
                  onOpenTask={openTask}
                  onMoveTask={moveTask}
                />
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
                          setWorkspaces((current) =>
                            current.map((item) =>
                              item.id !== workspace.id
                                ? item
                                : {
                                    ...item,
                                    spaces: item.spaces.map((space) =>
                                      space.id !== document.spaceId
                                        ? space
                                        : {
                                            ...space,
                                            documents: space.documents.map((existing) =>
                                              existing.id === document.id ? document : existing
                                            ),
                                          }
                                    ),
                                  }
                            )
                          );
                          reload();
                        }}
                        onError={setActionError}
                        canEdit={Boolean(currentPermissionSet?.manageDocs)}
                      />
                    ) : (
                      <DocumentsPanel
                        documents={activeSpace.documents}
                        spaceId={activeSpace.id}
                        onOpen={openDoc}
                        onChanged={reload}
                        onError={setActionError}
                        canEdit={Boolean(currentPermissionSet?.manageDocs)}
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
        data-testid="task-drawer"
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
      <ImportReportModal
        report={activeImportReport}
        onClose={() => setActiveImportReport(null)}
        onCopied={setActionNotice}
      />
    </>
  );
}
