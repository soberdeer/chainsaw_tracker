import { useMantineColorScheme } from '@mantine/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listToOpProjectId, useProjectUsers } from '@/hooks/useProjectUsers';
import { useTaskFilters } from '@/hooks/useTaskFilters';
import {
  allTasksPath,
  buildWorkspaceBreadcrumbs,
  bulkUpdateTasks,
  describeTaskCollectionState,
  docsPath,
  ensureDocsFolder,
  firstTaskFolder,
  firstTaskList,
  folderPath,
  getDocumentById,
  getDocuments,
  getErrorMessage,
  getImportReport,
  getImportReports,
  getNotifications,
  getOpenProjectTags,
  getOpenProjectTaskTypes,
  getTask,
  getTasks,
  getWorkspaces,
  logout,
  markAllNotificationsRead,
  markNotificationRead,
  myTasksPath,
  reorderBoardTasks,
  saveBoardCardOrder,
  showToast,
  taskPath,
  updateTask,
  workspaceHasWork,
  type CurrentUser,
  type DocumentItem,
  type MigrationRun,
  type NotificationItem,
  type OpenProjectTaskTypeOption,
  type Tag,
  type Task,
  type User,
  type Workspace,
} from '@/lib';
import {
  EXPANDED_FOLDER_KEY,
  EXPANDED_SPACE_KEY,
  findFolderById,
  findSpaceForFolder,
  readInitialQuery,
  readLastFolder,
  saveLastFolder,
} from '../helpers';
import { useWorkspaceRouteState } from './useWorkspaceRouteState';

export function useWorkspaceShellState(currentUser: CurrentUser) {
  const navigate = useNavigate();
  const route = useWorkspaceRouteState();
  const locationRef = useRef(route.location);
  locationRef.current = route.location;

  const initialQuery = useMemo(
    () => readInitialQuery(route.location.search),
    [route.location.search]
  );
  const cursorQuery = useMemo(
    () => new URLSearchParams(route.location.search).get('cursor') || undefined,
    [route.location.search]
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
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [resolvedDocsFolderId, setResolvedDocsFolderId] = useState<string | null>(null);
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
  const [subProjectParentId, setSubProjectParentId] = useState<string | null>(null);
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

  const reload = useCallback(() => setRefreshKey((key) => key + 1), []);
  const clearTaskSelection = useCallback(() => setSelectedTaskIds(new Set()), []);
  const toggleSortDirection = useCallback(
    () => setSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc')),
    [setSortDir]
  );
  const navigateTo = useCallback((url: string) => navigate(url), [navigate]);

  const runAction = useCallback(async (action: () => Promise<void>, successMessage?: string) => {
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
  }, []);

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
    const location = locationRef.current;
    if (!route.isFolderRoute) {
      if (location.search) {
        navigate({ pathname: location.pathname, search: '' }, { replace: true });
      }
      return;
    }

    const params = new URLSearchParams(location.search);
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
    if (nextSearch !== location.search) {
      navigate({ pathname: location.pathname, search: nextSearch }, { replace: true });
    }
  }, [
    assigneeFilter,
    dueBeforeFilter,
    hasGitHubPrFilter,
    navigate,
    overdueFilter,
    priorityFilter,
    responsibleFilter,
    route.isFolderRoute,
    sortDir,
    statusFilter,
    tagFilter,
    taskSearch,
    taskView,
    typeFilter,
    updatedSinceFilter,
  ]);

  useEffect(() => {
    getWorkspaces()
      .then((items) => {
        setWorkspaces(items);
        const defaultWorkspace =
          items.find((item) => item.spaces.some((space) => space.id === route.routeSpaceId)) ||
          items.find((item) => item.id === workspaceId) ||
          items.find(workspaceHasWork) ||
          items[0];

        if (defaultWorkspace?.id && defaultWorkspace.id !== workspaceId) {
          setWorkspaceId(defaultWorkspace.id);
        }

        const storedFolder = readLastFolder();
        const defaultSpace =
          defaultWorkspace?.spaces.find((space) => space.id === route.routeSpaceId) ||
          (storedFolder
            ? defaultWorkspace?.spaces.find((space) => space.id === storedFolder.spaceId)
            : undefined) ||
          defaultWorkspace?.spaces.find((space) => firstTaskFolder(space)) ||
          defaultWorkspace?.spaces[0];
        const isDocsRouteOrDoc = route.isDocsRoute || route.isDocRoute;
        const storedResolvedFolder =
          storedFolder?.spaceId === defaultSpace?.id
            ? findFolderById(defaultSpace?.folders || [], storedFolder.folderId)
            : undefined;
        const defaultTaskFolder =
          (storedResolvedFolder?.kind !== 'DOCS' ? storedResolvedFolder : undefined) ||
          firstTaskFolder(defaultSpace);
        const defaultFolder =
          (isDocsRouteOrDoc
            ? defaultSpace?.folders.find((folder) => folder.kind === 'DOCS')
            : undefined) ||
          (route.workspaceWideScope ? defaultTaskFolder : undefined) ||
          defaultSpace?.folders.find((folder) => folder.id === route.routeFolderId) ||
          storedResolvedFolder ||
          defaultTaskFolder;
        const defaultTaskList = firstTaskList(defaultFolder);

        setSpaceId(defaultSpace?.id);
        setFolderId(defaultFolder?.id);
        setTaskListId(defaultTaskList?.id);

        if (defaultSpace?.id && defaultFolder?.id) {
          saveLastFolder(defaultSpace.id, defaultFolder.id);
        }

        setExpandedSpaceIds(
          (current) => new Set([...current, ...(defaultSpace?.id ? [defaultSpace.id] : [])])
        );
        setExpandedFolderIds(
          (current) => new Set([...current, ...(defaultFolder?.id ? [defaultFolder.id] : [])])
        );
        setLoading(false);

        if (route.routeTaskId) {
          getTask(route.routeTaskId)
            .then((task) => {
              setSelectedTask(task);
              const allSpaces = items.flatMap((workspace) => workspace.spaces);
              const taskFolderId = task.folderId;
              const taskSpace =
                findSpaceForFolder(allSpaces, taskFolderId) ||
                allSpaces.find((space) => space.id === task.departmentId);
              if (taskSpace?.id) setSpaceId(taskSpace.id);
              if (taskFolderId) setFolderId(taskFolderId);
              if (task.taskListId) setTaskListId(task.taskListId);
            })
            .catch((error) => setActionError(getErrorMessage(error)));
          setSelectedDoc(null);
        } else if (route.routeDocId) {
          getDocumentById(route.routeDocId)
            .then((doc) => {
              setSelectedDoc(doc);
              setSelectedTask(null);
            })
            .catch(() => undefined);
        } else {
          setSelectedTask(null);
          setSelectedDoc(null);
        }

        if (!route.routeSpaceId && !route.workspaceWideScope && defaultSpace && defaultFolder) {
          navigate(folderPath(defaultSpace.id, defaultFolder.id), { replace: true });
        }
      })
      .catch((error) => {
        setActionError(getErrorMessage(error));
        setLoading(false);
      });
  }, [
    navigate,
    refreshKey,
    route.isDocRoute,
    route.isDocsRoute,
    route.routeDocId,
    route.routeFolderId,
    route.routeSpaceId,
    route.routeTaskId,
    route.workspaceWideScope,
    workspaceId,
  ]);

  const workspace = workspaces.find((item) => item.id === workspaceId) || workspaces[0];
  const currentMembership = workspace?.memberships.find(
    (membership) => membership.user.id === currentUser.id
  );
  const currentPermissionSet = workspace?.permissionSets.find(
    (permissionSet) => permissionSet.role === currentMembership?.role
  );
  const isPrivilegedRole = currentMembership?.role === 'ADMIN';
  const canWriteTasks = isPrivilegedRole || Boolean(currentPermissionSet?.manageTasks);
  const canManageSpaces = isPrivilegedRole || Boolean(currentPermissionSet?.manageSpaces);
  const canManageWorkspace = isPrivilegedRole || Boolean(currentPermissionSet?.manageWorkspace);
  const canManageDocs = Boolean(currentPermissionSet?.manageDocs);

  const activeSpace = useMemo(
    () => workspace?.spaces.find((space) => space.id === spaceId) || workspace?.spaces[0],
    [spaceId, workspace]
  );
  const activeFolder = useMemo(() => {
    const resolvedFolder = findFolderById(activeSpace?.folders || [], folderId);
    if (route.workspaceWideScope) {
      return resolvedFolder?.kind !== 'DOCS' ? resolvedFolder : firstTaskFolder(activeSpace);
    }
    return resolvedFolder || firstTaskFolder(activeSpace);
  }, [activeSpace, folderId, route.workspaceWideScope]);
  const activeTaskList = useMemo(
    () =>
      activeFolder?.taskLists?.find((list) => list.id === taskListId) ||
      firstTaskList(activeFolder),
    [activeFolder, taskListId]
  );
  const statuses = useMemo(() => activeTaskList?.statuses || [], [activeTaskList?.statuses]);
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
      if (task.assignee) {
        users.set(task.assignee.id, task.assignee);
      }
    });
    return [...users.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [tasks, workspace]);
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
  const workspaceWideLabel =
    route.workspaceWideScope === 'mine'
      ? 'My Tasks'
      : route.workspaceWideScope === 'all'
        ? 'All Tasks'
        : null;
  const isWorkspaceWide = Boolean(route.workspaceWideScope);
  const canManageBoardOrder = canWriteTasks;
  const isDocsFolder = activeFolder?.kind === 'DOCS';
  const emptyState = describeTaskCollectionState({
    hasLinkedOpenProjectUser: Boolean(currentOpenProjectUser),
    assignedToMeActive: assignedToMeActive || route.workspaceWideScope === 'mine',
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

  const loadTasks = useCallback(
    async (cursor?: string, append = Boolean(cursor)) => {
      if (!workspace?.id || (!isWorkspaceWide && !activeTaskList?.id)) {
        setTasks([]);
        setNextCursor(null);
        return;
      }

      const currentOpenProjectUser = currentOpenProjectUserRef.current;
      if (route.workspaceWideScope === 'mine' && !currentOpenProjectUser) {
        setTasks([]);
        setNextCursor(null);
        setTasksLoading(false);
        return;
      }

      try {
        setTasksLoading(true);
        setTasksError(null);
        const effectiveAssigneeIds =
          route.workspaceWideScope === 'mine' && currentOpenProjectUser
            ? [currentOpenProjectUser.id]
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
      activeTaskList?.id,
      assigneeFilter,
      dueBeforeFilter,
      hasGitHubPrFilter,
      isWorkspaceWide,
      overdueFilter,
      priorityFilter,
      responsibleFilter,
      route.workspaceWideScope,
      statusFilter,
      tagFilter,
      taskSearch,
      typeFilter,
      updatedSinceFilter,
      workspace?.id,
    ]
  );

  useEffect(() => {
    void loadTasks(cursorQuery, false);
  }, [cursorQuery, loadTasks, refreshKey]);

  useEffect(() => {
    if (!isDocsFolder || !activeFolder) {
      setDocs([]);
      setResolvedDocsFolderId(null);
      return;
    }

    setDocsLoading(true);
    setSelectedDoc(null);
    ensureDocsFolder(activeFolder.spaceId)
      .then(({ folderId }) => {
        setResolvedDocsFolderId(folderId);
        return getDocuments(folderId);
      })
      .then(({ items }) => setDocs(items))
      .catch((error) => setActionError(getErrorMessage(error)))
      .finally(() => setDocsLoading(false));
  }, [activeFolder, isDocsFolder, refreshKey]);

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
  }, [canManageWorkspace, refreshKey, workspace?.id]);

  useEffect(() => {
    getOpenProjectTaskTypes(activeTaskList?.id)
      .then(setTaskTypes)
      .catch(() => setTaskTypes([]));
  }, [activeTaskList?.id, refreshKey]);

  const addTask = useCallback(
    async (statusId: string) => {
      if (!activeTaskList || !canWriteTasks) return;
      setCreateTaskStatusId(statusId);
    },
    [activeTaskList, canWriteTasks]
  );

  const moveTask = useCallback(
    async (taskId: string, statusId: string, targetTaskId?: string | null) => {
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
    },
    [activeTaskList, canWriteTasks, selectedTask, statuses, tasks]
  );

  const toggleSelectedTask = useCallback((taskId: string, selected: boolean) => {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  }, []);

  const runBulkUpdate = useCallback(
    async (input: { statusId?: string; priority?: string; assigneeIds?: string[] }) => {
      const selectedTaskIdList = [...selectedTaskIds];
      if (!selectedTaskIdList.length) return;

      try {
        setActionError(null);
        setActionNotice(null);
        const result = await bulkUpdateTasks({ taskIds: selectedTaskIdList, ...input });
        clearTaskSelection();
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
    },
    [clearTaskSelection, reload, selectedTaskIds]
  );

  const openTask = useCallback(
    (task: Task) => {
      setSelectedTask(task);
      setSelectedDoc(null);
      setTaskReturnPath(route.location.pathname);

      if (isWorkspaceWide) {
        const taskFolderId = task.folderId || activeFolder?.id;
        const taskSpace =
          findSpaceForFolder(workspace?.spaces || [], taskFolderId) ||
          workspace?.spaces.find((space) => space.id === task.departmentId);
        const taskSpaceId = taskSpace?.id || activeSpace?.id;
        if (taskSpaceId) setSpaceId(taskSpaceId);
        if (taskFolderId) setFolderId(taskFolderId);
        if (taskSpaceId && taskFolderId) {
          navigate(taskPath(taskSpaceId, taskFolderId, task.id));
        }
      } else {
        const currentSpaceId = activeSpace?.id;
        const currentFolderId = activeFolder?.id;
        if (currentSpaceId && currentFolderId) {
          navigate(taskPath(currentSpaceId, currentFolderId, task.id));
        }
      }

      getTask(task.id)
        .then((fullTask) => setSelectedTask(fullTask))
        .catch((error) => setActionError(getErrorMessage(error)));
    },
    [
      activeFolder,
      activeSpace,
      isWorkspaceWide,
      navigate,
      route.location.pathname,
      workspace?.spaces,
    ]
  );

  const openSubtask = useCallback(
    (task: Task) => {
      const targetFolderId = task.folderId || activeFolder?.id;
      const targetSpace =
        findSpaceForFolder(workspace?.spaces || [], targetFolderId) ||
        workspace?.spaces.find((space) => space.id === task.departmentId);
      const targetSpaceId = targetSpace?.id || activeSpace?.id;
      if (!targetSpaceId || !targetFolderId) return;
      setSelectedTask(task);
      setTaskReturnPath(route.location.pathname);
      setSpaceId(targetSpaceId);
      setFolderId(targetFolderId);
      if (task.taskListId) {
        setTaskListId(task.taskListId);
      }
      navigate(taskPath(targetSpaceId, targetFolderId, task.id));
    },
    [activeFolder, activeSpace, navigate, route.location.pathname, workspace?.spaces]
  );

  const backToFolder = useCallback(() => {
    setSelectedTask(null);
    setSelectedDoc(null);
    if (taskReturnPath && taskReturnPath !== route.location.pathname) {
      navigate(taskReturnPath);
      return;
    }
    if (route.workspaceWideScope === 'all') {
      navigate(allTasksPath());
      return;
    }
    if (route.workspaceWideScope === 'mine') {
      navigate(myTasksPath());
      return;
    }
    if (!activeSpace || !activeFolder) return;
    navigate(folderPath(activeSpace.id, activeFolder.id));
  }, [
    activeFolder,
    activeSpace,
    navigate,
    route.location.pathname,
    route.workspaceWideScope,
    taskReturnPath,
  ]);

  const backToDocs = useCallback(() => {
    setSelectedDoc(null);
    if (activeSpace) {
      navigate(docsPath(activeSpace.id));
    }
  }, [activeSpace, navigate]);

  const handleDocumentSaved = useCallback((document: DocumentItem) => {
    setSelectedDoc(document);
    setDocs((current) => current.map((item) => (item.id === document.id ? document : item)));
  }, []);
  const handleTaskSaved = useCallback((task: Task) => {
    setSelectedTask(task);
    setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
  }, []);

  const toggleSpace = useCallback((id: string) => {
    setExpandedSpaceIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const openFolder = useCallback(
    (spaceIdValue: string, folder: Workspace['spaces'][number]['folders'][number]) => {
      setSpaceId(spaceIdValue);
      setFolderId(folder.id);
      setTaskListId(firstTaskList(folder)?.id);
      setSelectedTask(null);
      setSelectedDoc(null);
      if (folder.kind !== 'DOCS') {
        setTaskView('tasks');
      }
      setExpandedSpaceIds((current) => new Set([...current, spaceIdValue]));
      setExpandedFolderIds((current) => new Set([...current, folder.id]));
      saveLastFolder(spaceIdValue, folder.id);
      navigate(
        folder.kind === 'DOCS' ? docsPath(spaceIdValue) : folderPath(spaceIdValue, folder.id)
      );
    },
    [navigate, setTaskView]
  );

  const openAllTasks = useCallback(() => {
    setTaskView('tasks');
    setSelectedTask(null);
    setSelectedDoc(null);
    navigate(allTasksPath());
  }, [navigate, setTaskView]);

  const openMyTasks = useCallback(() => {
    if (!currentOpenProjectUser) return;
    setTaskView('tasks');
    setSelectedTask(null);
    setSelectedDoc(null);
    navigate(myTasksPath());
  }, [currentOpenProjectUser, navigate, setTaskView]);

  const openAssignedToMe = useCallback(() => {
    if (!currentOpenProjectUser) {
      setActionError('This account is not linked to an OpenProject user yet.');
      return;
    }
    setAssigneeFilter([currentOpenProjectUser.id]);
    setTaskView('tasks');
    setSelectedDoc(null);
    setSelectedTask(null);
    setProfileOpen(false);
  }, [currentOpenProjectUser, setAssigneeFilter, setTaskView]);

  const markNotificationAsRead = useCallback(async (id: string) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item))
    );
    setNotificationUnread((current) => Math.max(0, current - 1));
    await markNotificationRead(id).catch((error) => setActionError(getErrorMessage(error)));
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    setNotifications((current) =>
      current.map((item) => ({ ...item, readAt: new Date().toISOString() }))
    );
    setNotificationUnread(0);
    await markAllNotificationsRead().catch((error) => setActionError(getErrorMessage(error)));
  }, []);

  const navigateToNotificationTask = useCallback(
    (workPackageId: string) => {
      if (activeSpace && activeFolder) {
        navigate(taskPath(activeSpace.id, activeFolder.id, workPackageId));
      }
    },
    [activeFolder, activeSpace, navigate]
  );

  const logoutCurrentUser = useCallback(async () => {
    await logout().catch(() => undefined);
  }, []);
  const openImportReport = useCallback(
    (report: MigrationRun) =>
      void runAction(async () => {
        setActiveImportReport(await getImportReport(report.id));
      }),
    [runAction]
  );

  const activeFilterChips = buildActiveChips(statuses, taskTypes, openProjectTags);

  return {
    colorScheme,
    toggleColorScheme,
    loading,
    workspace,
    activeSpace,
    activeFolder,
    activeTaskList,
    currentMembership,
    currentPermissionSet,
    currentOpenProjectUser,
    activeTaskListUsers,
    activeTaskListUsersLoading,
    canWriteTasks,
    canManageSpaces,
    canManageWorkspace,
    canManageDocs,
    canManageBoardOrder,
    isWorkspaceWide,
    isDocsFolder,
    workspaceWideScope: route.workspaceWideScope,
    breadcrumbItems,
    actionError,
    setActionError,
    actionNotice,
    setActionNotice,
    searchOpen,
    setSearchOpen,
    createTaskStatusId,
    setCreateTaskStatusId,
    profileOpen,
    setProfileOpen,
    workspaceSettingsOpen,
    setWorkspaceSettingsOpen,
    workspaceSettingsTab,
    setWorkspaceSettingsTab,
    projectAccessOpen,
    setProjectAccessOpen,
    spaceCreateOpen,
    setSpaceCreateOpen,
    subProjectParentId,
    setSubProjectParentId,
    selectedTask,
    setSelectedTask,
    selectedDoc,
    setSelectedDoc,
    expandedSpaceIds,
    expandedFolderIds,
    selectedTaskIds,
    filterMenuOpen,
    setFilterMenuOpen,
    notifications,
    notificationUnread,
    importReports,
    activeImportReport,
    setActiveImportReport,
    taskTypes,
    openProjectTags,
    statuses,
    availableAssignees,
    emptyState,
    docs,
    docsLoading,
    resolvedDocsFolderId,
    tasks,
    tasksLoading,
    tasksError,
    nextCursor,
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
    activeFilterChips,
    assignedToMeActive,
    routeLocation: route.location,
    reload,
    runAction,
    addTask,
    moveTask,
    toggleSelectedTask,
    clearTaskSelection,
    runBulkUpdate,
    openTask,
    openSubtask,
    backToFolder,
    backToDocs,
    handleDocumentSaved,
    handleTaskSaved,
    handleLoadMoreTasks,
    toggleSpace,
    toggleFolder,
    openFolder,
    openAllTasks,
    openMyTasks,
    openAssignedToMe,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    navigateToNotificationTask,
    logoutCurrentUser,
    toggleSortDirection,
    navigateTo,
    openImportReport,
  };
}
