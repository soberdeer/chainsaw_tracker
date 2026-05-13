import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Alert, AppShell, Badge, Box, Button, Group, Loader, Menu, ScrollArea, Select, Stack, Tabs, Text, TextInput, ThemeIcon, Title, useMantineColorScheme } from '@mantine/core';
import { IconCheck, IconChevronDown, IconColumns, IconDots, IconFileText, IconFilter, IconFolder, IconFolderOpen, IconLayoutKanban, IconList, IconLock, IconPlus, IconSearch, IconSettings, IconSubtask, IconUsers } from '@tabler/icons-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createFolder, createMarkdownDoc, createSpace, createTask, createTaskList, getMilestones, getTask, getTasks, getWorkspaces, reorderTasks, updateSpace, updateTask } from '../../lib/api';
import type { DocumentItem, Milestone, Task, Workspace } from '../../lib/types';
import {
  docPath,
  firstTaskFolder,
  firstTaskList,
  folderPath,
  getErrorMessage,
  parseAppPath,
  taskPath,
  workspaceHasWork
} from '../../lib/taskUi';
import { DocumentPage, DocumentsPanel } from '../docs/DocumentsPanel';
import { EmptySetup } from '../setup/EmptySetup';
import { GlobalSearchModal } from '../search/GlobalSearchModal';
import { TaskDetailPage } from '../tasks/TaskDetailPage';
import { GroupedTaskList, TaskBoard } from '../tasks/TaskViews';
import { TeamPanel } from '../team/TeamPanel';
import { ShareSpaceModal } from './ShareSpaceModal';

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
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [milestoneFilter, setMilestoneFilter] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shareSpaceOpen, setShareSpaceOpen] = useState(false);

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
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
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
    getWorkspaces().then((items) => {
      setWorkspaces(items);
      const route = parseAppPath(location.pathname);
      const defaultWorkspace =
        items.find((item) => item.spaces.some((space) => space.id === route.spaceId)) ||
        items.find((item) => item.id === workspaceId) ||
        items.find(workspaceHasWork) ||
        items[0];
      if (defaultWorkspace?.id && defaultWorkspace.id !== workspaceId) setWorkspaceId(defaultWorkspace.id);

      const defaultSpace =
        defaultWorkspace?.spaces.find((space) => space.id === route.spaceId) ||
        defaultWorkspace?.spaces.find((space) => firstTaskFolder(space)) ||
        defaultWorkspace?.spaces[0];
      const defaultFolder = defaultSpace?.folders.find((folder) => folder.id === route.folderId) || firstTaskFolder(defaultSpace);
      const defaultTaskList = firstTaskList(defaultFolder);
      setSpaceId(defaultSpace?.id);
      setFolderId(defaultFolder?.id);
      setTaskListId(defaultTaskList?.id);
      setLoading(false);

      if (route.taskId) {
        getTask(route.taskId).then(setSelectedTask).catch((error) => setActionError(getErrorMessage(error)));
        setSelectedDoc(null);
      } else {
        setSelectedTask(null);
      }

      if (route.docId && defaultSpace) {
        setSelectedDoc(defaultSpace.documents.find((doc) => doc.id === route.docId) || null);
      } else {
        setSelectedDoc(null);
      }

      if (!route.spaceId && defaultSpace && defaultFolder) {
        navigate(folderPath(defaultSpace.id, defaultFolder.id), { replace: true });
      }
    });
  }, [refreshKey, workspaceId, location.pathname, navigate]);

  const workspace = workspaces.find((item) => item.id === workspaceId) || workspaces[0];
  const activeSpace = useMemo(() => workspace?.spaces.find((space) => space.id === spaceId) || workspace?.spaces[0], [workspace, spaceId]);
  const activeFolder = useMemo(() => activeSpace?.folders.find((folder) => folder.id === folderId) || firstTaskFolder(activeSpace), [activeSpace, folderId]);
  const activeTaskList = useMemo(() => activeFolder?.taskLists?.find((list) => list.id === taskListId) || firstTaskList(activeFolder), [activeFolder, taskListId]);
  const statuses = activeTaskList?.statuses || [];

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
        assigneeId: assigneeFilter || undefined,
        priority: priorityFilter || undefined,
        milestoneId: milestoneFilter || undefined,
        search: taskSearch,
        limit: 50,
        cursor
      });
      setTasks((current) => cursor ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor || null);
    } catch (error) {
      setTasksError(getErrorMessage(error));
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, [workspace?.id, activeTaskList?.id, taskSearch, statusFilter, assigneeFilter, priorityFilter, milestoneFilter, refreshKey]);

  useEffect(() => {
    if (!workspace?.id) return;
    getMilestones(workspace.id, activeFolder?.id).then(setMilestones).catch(() => setMilestones([]));
  }, [workspace?.id, activeFolder?.id]);

  const addTask = async (statusId: string) => {
    if (!activeTaskList) return;
    const title = window.prompt('Task name');
    if (!title) return;
    await runAction(async () => {
      await createTask({ taskListId: activeTaskList.id, statusId, title, priority: 'NORMAL' });
      reload();
    });
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
    getTask(task.id).then(setSelectedTask).catch((error) => setActionError(getErrorMessage(error)));
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

  const openDoc = (document: DocumentItem) => {
    if (!activeSpace) return;
    setSelectedDoc(document);
    setSelectedTask(null);
    navigate(docPath(activeSpace.id, document.id));
  };

  if (loading) return <Box className="center"><Loader /></Box>;

  if (!workspace) {
    return (
      <EmptySetup
        onCreated={(createdWorkspace) => {
          setWorkspaces([createdWorkspace]);
          setWorkspaceId(createdWorkspace.id);
          const defaultSpace = createdWorkspace.spaces[0];
          const defaultFolder = firstTaskFolder(defaultSpace);
          setSpaceId(defaultSpace?.id);
          setFolderId(defaultFolder?.id);
          setTaskListId(firstTaskList(defaultFolder)?.id);
          reload();
        }}
      />
    );
  }

  if (!activeSpace) {
    return (
      <Box className="center setup-screen">
        <Stack>
          <Title order={2}>{workspace.name}</Title>
          <Text c="dimmed">Workspace created. Add the first space to start working.</Text>
          {actionError && <Alert color="red" title="Could not create space" withCloseButton onClose={() => setActionError(null)}>{actionError}</Alert>}
          <Button
            onClick={() => runAction(async () => {
              await createSpace({ workspaceId: workspace.id, name: 'General', color: '#4c6ef5', initials: 'G' });
              reload();
            })}
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
        statuses={statuses}
        onClose={() => setSearchOpen(false)}
        onNavigate={(url) => navigate(url)}
        onReload={reload}
        onError={setActionError}
      />
      <ShareSpaceModal
        opened={shareSpaceOpen}
        workspace={workspace}
        space={activeSpace}
        onClose={() => setShareSpaceOpen(false)}
        onError={setActionError}
      />
      <AppShell.Navbar p="md" className="workspace-sidebar">
        <Group mb="lg" gap="sm" justify="space-between">
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" color="dark"><IconCheck size="1.25rem" /></ThemeIcon>
            <div>
              <Text fw={800}>{workspace.name}</Text>
              <Text size="xs" c="dimmed">All Tasks - studio workspace</Text>
            </div>
          </Group>
          <ActionIcon
            variant="light"
            aria-label="Add space"
            onClick={async () => {
              const name = window.prompt('Space name');
              if (!name) return;
              await runAction(async () => {
                await createSpace({ workspaceId: workspace.id, name, color: '#4c6ef5', initials: name.slice(0, 1).toUpperCase(), locked: true });
                reload();
              });
            }}
          >
            <IconPlus size="1.25rem" />
          </ActionIcon>
        </Group>
        <Text size="lg" fw={700} mb="md">Spaces</Text>
        <ScrollArea className="spaces-tree">
          {workspace.spaces.map((space) => {
            const isActiveSpace = space.id === activeSpace.id;
            return (
              <Box key={space.id} className="space-tree-block">
                <button
                  type="button"
                  className={isActiveSpace ? 'space-tree-row active' : 'space-tree-row'}
                  onClick={() => {
                    setSpaceId(space.id);
                    const folder = firstTaskFolder(space);
                    setFolderId(folder?.id);
                    setTaskListId(firstTaskList(folder)?.id);
                    if (folder) navigate(folderPath(space.id, folder.id));
                  }}
                >
                  <span className="space-initial" style={{ background: space.color }}>{space.initials || space.name.slice(0, 1)}</span>
                  <span className="space-name">{space.name}</span>
                  {space.locked && <IconLock size="1rem" className="muted-icon" />}
                  {isActiveSpace && (
                    <Menu width="22rem" position="right-start">
                      <Menu.Target>
                        <IconDots size="1.125rem" className="row-action" onClick={(event) => event.stopPropagation()} />
                      </Menu.Target>
                      <Menu.Dropdown className="clickup-menu" onClick={(event) => event.stopPropagation()}>
                        <Menu.Item onClick={() => setShareSpaceOpen(true)}>Sharing & Permissions</Menu.Item>
                        <Menu.Item onClick={() => {
                          const name = window.prompt('Space name', space.name);
                          if (name) void runAction(async () => {
                            await updateSpace(space.id, { name });
                            reload();
                          });
                        }}>Rename</Menu.Item>
                        <Menu.Item onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/space/${space.id}`)}>Copy link</Menu.Item>
                        <Menu.Divider />
                        <Menu.Label>Create new</Menu.Label>
                        <Menu.Item onClick={async () => {
                          const name = window.prompt('Folder name');
                          if (!name) return;
                          await runAction(async () => {
                            await createFolder(space.id, { name, kind: 'TEAM', locked: true });
                            reload();
                          });
                        }}>Folder</Menu.Item>
                        <Menu.Item onClick={async () => {
                          const title = window.prompt('Doc title');
                          if (!title) return;
                          await runAction(async () => {
                            await createMarkdownDoc({ spaceId: space.id, title, markdown: `# ${title}` });
                            reload();
                          });
                        }}>Doc</Menu.Item>
                        <Menu.Item onClick={async () => {
                          const folder = firstTaskFolder(space);
                          if (!folder) return;
                          const name = window.prompt('List name');
                          if (!name) return;
                          await runAction(async () => {
                            await createTaskList(folder.id, { name, icon: '☣' });
                            reload();
                          });
                        }}>List</Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
                  {isActiveSpace && (
                    <IconPlus
                      size="1.125rem"
                      className="row-action"
                      onClick={async (event) => {
                        event.stopPropagation();
                        const name = window.prompt('Folder name');
                        if (!name) return;
                        await runAction(async () => {
                          await createFolder(space.id, { name, kind: 'TEAM', locked: true });
                          reload();
                        });
                      }}
                    />
                  )}
                </button>

                {isActiveSpace && (
                  <Box className="folder-tree">
                    {space.folders.map((folder) => {
                      const isDocs = folder.kind === 'DOCS';
                      const isActiveFolder = folder.id === activeFolder?.id;
                      return (
                        <Box key={folder.id}>
                          <button
                            type="button"
                            className={isActiveFolder ? 'folder-tree-row active' : 'folder-tree-row'}
                            onClick={() => {
                              setFolderId(folder.id);
                              setTaskListId(firstTaskList(folder)?.id);
                              navigate(folderPath(space.id, folder.id));
                            }}
                          >
                            {isDocs ? <IconFolderOpen size="1.25rem" color="#4c6ef5" /> : <IconFolder size="1.25rem" />}
                            <span>{folder.name}</span>
                            {folder.locked && <IconLock size="0.9375rem" className="muted-icon" />}
                            {!isDocs && <IconDots size="1rem" className="row-action" />}
                            {!isDocs && (
                              <IconPlus
                                size="1rem"
                                className="row-action"
                                onClick={async (event) => {
                                  event.stopPropagation();
                                  const name = window.prompt('Task list name');
                                  if (!name) return;
                                  await runAction(async () => {
                                    await createTaskList(folder.id, { name, icon: '☣' });
                                    reload();
                                  });
                                }}
                              />
                            )}
                          </button>
                          {folder.taskLists?.map((taskList) => (
                            <button
                              key={taskList.id}
                              type="button"
                              className={taskList.id === activeTaskList?.id ? 'task-list-nav active' : 'task-list-nav'}
                              onClick={() => {
                                setFolderId(folder.id);
                                setTaskListId(taskList.id);
                                navigate(folderPath(space.id, folder.id));
                              }}
                            >
                              <span className="task-list-icon">{taskList.icon || '☣'}</span>
                              <span>{taskList.name}</span>
                              <Badge className="task-count">{taskList._count?.tasks ?? taskList.tasks?.length ?? 0}</Badge>
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
            className="new-space-row"
            type="button"
            onClick={async () => {
              const name = window.prompt('Space name');
              if (!name) return;
              await runAction(async () => {
                await createSpace({ workspaceId: workspace.id, name, color: '#4c6ef5', initials: name.slice(0, 1).toUpperCase(), locked: true });
                reload();
              });
            }}
          >
            <IconPlus size="1.125rem" />New Space
          </button>
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main className="main-shell">
        <Stack gap={0}>
          {actionError && (
            <Alert color="red" title="Action failed" withCloseButton onClose={() => setActionError(null)} m="md">
              {actionError}
            </Alert>
          )}
          <Group className="top-bar" justify="space-between">
            <Group gap="xs" wrap="nowrap">
              <span className="breadcrumb-chip" style={{ background: activeSpace.color }}>{activeSpace.initials || activeSpace.name.slice(0, 1)}</span>
              <Button component={Link} to={folderPath(activeSpace.id, activeFolder?.id || '')} variant="subtle" size="compact-md">{activeSpace.name}</Button>
              {activeSpace.locked && <IconLock size="1rem" className="muted-icon" />}
              <Text c="dimmed">/</Text>
              <IconFolder size="1.25rem" className="muted-icon" />
              {activeFolder ? <Button component={Link} to={folderPath(activeSpace.id, activeFolder.id)} variant="subtle" size="compact-md">{activeFolder.name}</Button> : <Text fw={700}>Docs</Text>}
              {activeFolder?.locked && <IconLock size="1rem" className="muted-icon" />}
              <Text c="dimmed">/</Text>
              <Text fw={800}>{selectedTask?.title || activeTaskList?.name || 'DOC'}</Text>
              <IconChevronDown size="1rem" className="muted-icon" />
              <ActionIcon variant="subtle" color="gray" aria-label="Favorite"><IconCheck size="1.125rem" /></ActionIcon>
            </Group>
            <Group gap="md">
              <Button variant="light" leftSection={<IconSearch size="1rem" />} onClick={() => setSearchOpen(true)}>Search ⌘K</Button>
              <Button variant="light" onClick={() => toggleColorScheme()}>{colorScheme === 'dark' ? 'Light' : 'Dark'}</Button>
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
          ) : selectedDoc ? (
            <Box p="lg">
              <DocumentPage
                document={selectedDoc}
                onBack={backToFolder}
                onSaved={(document) => {
                  setSelectedDoc(document);
                  reload();
                }}
                onError={setActionError}
              />
            </Box>
          ) : (
            <Tabs defaultValue="tasks" keepMounted={false} className="content-tabs">
              <Tabs.List className="view-tabs">
                <Tabs.Tab value="board" leftSection={<IconLayoutKanban size="1rem" />}>Board</Tabs.Tab>
                <Tabs.Tab value="tasks" leftSection={<IconList size="1rem" />}>List</Tabs.Tab>
                <Tabs.Tab value="docs" leftSection={<IconFileText size="1rem" />}>Docs</Tabs.Tab>
                <Tabs.Tab value="team" leftSection={<IconUsers size="1rem" />}>Permissions</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="tasks">
                <Stack gap={0}>
                  <Group className="task-toolbar" justify="space-between">
                    <Group gap="xs">
                      <Button className="pill-control active" variant="subtle" leftSection={<IconFilter size="1.125rem" />}>Group: Status</Button>
                      <Button className="pill-control" variant="subtle" leftSection={<IconSubtask size="1.125rem" />}>Subtasks</Button>
                      <Button className="pill-control" variant="subtle" leftSection={<IconColumns size="1.125rem" />}>Columns</Button>
                    </Group>
                    <Group gap="xs">
                      <Button className="pill-control" variant="subtle" leftSection={<IconFilter size="1.125rem" />}>Filter</Button>
                      <TextInput value={taskSearch} onChange={(event) => setTaskSearch(event.currentTarget.value)} placeholder="Search tasks" leftSection={<IconSearch size="1rem" />} w="16rem" />
                      <Select
                        value={statusFilter}
                        onChange={setStatusFilter}
                        clearable
                        placeholder="Status"
                        data={statuses.map((item) => ({ value: item.id, label: item.name }))}
                        w="10rem"
                      />
                      <Select
                        value={assigneeFilter}
                        onChange={setAssigneeFilter}
                        clearable
                        placeholder="Assignee"
                        data={workspace.memberships.map((membership) => ({ value: membership.user.id, label: membership.user.name }))}
                        w="11rem"
                      />
                      <Select
                        value={priorityFilter}
                        onChange={setPriorityFilter}
                        clearable
                        placeholder="Priority"
                        data={['LOW', 'NORMAL', 'HIGH', 'URGENT']}
                        w="9rem"
                      />
                      <Select
                        value={milestoneFilter}
                        onChange={setMilestoneFilter}
                        clearable
                        placeholder="Milestone"
                        data={milestones.map((milestone) => ({ value: milestone.id, label: milestone.title }))}
                        w="11rem"
                      />
                      <ActionIcon className="pill-icon" variant="subtle" aria-label="Search" onClick={() => setSearchOpen(true)}><IconSearch size="1.25rem" /></ActionIcon>
                      <Button className="pill-control" variant="subtle" leftSection={<IconSettings size="1.125rem" />}>Customize</Button>
                      <Button color="teal" rightSection={<IconChevronDown size="1rem" />} onClick={() => statuses[0] && addTask(statuses[0].id)}>Add Task</Button>
                    </Group>
                  </Group>
                  {tasksError && <Alert color="red" title="Could not load tasks">{tasksError}</Alert>}
                  {tasksLoading && !tasks.length ? <Box className="center" p="xl"><Loader /></Box> : tasks.length === 0 ? (
                    <Box p="xl"><Text c="dimmed">No tasks match these filters.</Text></Box>
                  ) : view === 'board' ? (
                    <TaskBoard tasks={tasks} statuses={statuses} onAddTask={addTask} onOpenTask={openTask} onMoveTask={moveTask} onReorderTasks={reorderTaskGroup} onChanged={reload} onError={setActionError} />
                  ) : (
                    <GroupedTaskList tasks={tasks} statuses={statuses} onAddTask={addTask} onOpenTask={openTask} onMoveTask={moveTask} onReorderTasks={reorderTaskGroup} onChanged={reload} onError={setActionError} />
                  )}
                  {nextCursor && <Button variant="subtle" loading={tasksLoading} onClick={() => void loadTasks(nextCursor)}>Load more</Button>}
                </Stack>
              </Tabs.Panel>
              <Tabs.Panel value="docs" p="lg"><DocumentsPanel documents={activeSpace.documents} spaceId={activeSpace.id} onOpen={openDoc} onChanged={reload} onError={setActionError} /></Tabs.Panel>
              <Tabs.Panel value="team" p="lg"><TeamPanel workspace={workspace} onChanged={reload} onError={setActionError} /></Tabs.Panel>
              <Tabs.Panel value="board" p="lg"><TaskBoard tasks={tasks} statuses={statuses} onAddTask={addTask} onOpenTask={openTask} onMoveTask={moveTask} onReorderTasks={reorderTaskGroup} onChanged={reload} onError={setActionError} /></Tabs.Panel>
            </Tabs>
          )}
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
