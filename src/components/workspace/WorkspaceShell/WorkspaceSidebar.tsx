import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Menu,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconFolder,
  IconList,
  IconPlus,
  IconSettings,
} from '@tabler/icons-react';
import {
  firstTaskFolder,
  firstTaskList,
  type CurrentUser,
  type Folder,
  type Space,
  type Workspace,
} from '@/lib';
import { AvatarStack } from '../../common/AvatarStack';
import classes from './WorkspaceShell.module.css';

interface WorkspaceSidebarProps {
  workspace: Workspace;
  currentUser: CurrentUser;
  currentMembership: { role?: string } | undefined;
  canManageSpaces: boolean;
  activeSpace: Space | undefined;
  activeFolder: Folder | undefined;
  expandedSpaceIds: Set<string>;
  expandedFolderIds: Set<string>;
  workspaceWideScope: string | null;
  taskView: string | null;
  docsAvailable: boolean;
  selectedTask: { id: string } | null;
  selectedDoc: { id: string } | null;
  currentOpenProjectUser: { id: string } | undefined;
  onToggleSpace: (id: string) => void;
  onToggleFolder: (id: string) => void;
  onOpenFolder: (spaceId: string, folder: Folder) => void;
  onSelectAllTasks: () => void;
  onSelectMyTasks: () => void;
  onSelectDocs: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenProjectAccess: () => void;
  onCreateSpace: () => void;
  onLogout: () => void;
}

// function findFolderById(folders: Folder[], id?: string): Folder | undefined {
//   for (const folder of folders) {
//     if (folder.id === id) return folder;
//     const child = findFolderById(folder.folders || [], id);
//     if (child) return child;
//   }
//   return undefined;
// }

export function WorkspaceSidebar({
  workspace,
  currentUser,
  currentMembership,
  canManageSpaces,
  activeSpace,
  activeFolder,
  expandedSpaceIds,
  expandedFolderIds,
  workspaceWideScope,
  taskView,
  docsAvailable,
  selectedTask,
  selectedDoc,
  currentOpenProjectUser,
  onToggleSpace,
  onToggleFolder,
  onOpenFolder,
  onSelectAllTasks,
  onSelectMyTasks,
  onSelectDocs,
  onOpenProfile,
  onOpenSettings,
  onOpenProjectAccess,
  onCreateSpace,
  onLogout,
}: WorkspaceSidebarProps) {
  const profileUser = {
    id: currentUser.id,
    email: currentUser.email,
    name: currentUser.name,
    avatarUrl: currentUser.avatarUrl || undefined,
  };

  const renderFolder = (spaceIdValue: string, folder: Folder, depth = 0): React.ReactNode => {
    const isExpanded = expandedFolderIds.has(folder.id);
    const hasChildren = Boolean(folder.folders?.length);
    const list = firstTaskList(folder);
    const taskCount = list?._count?.tasks ?? list?.tasks?.length ?? 0;
    const isActive = folder.id === activeFolder?.id;
    return (
      <Box key={folder.id}>
        <UnstyledButton
          className={
            isActive ? `${classes.folderTreeRow} ${classes.active}` : classes.folderTreeRow
          }
          style={{ paddingLeft: `${0.5 + depth * 1.1}rem` }}
          onClick={() => {
            if (list) onOpenFolder(spaceIdValue, folder);
            else onToggleFolder(folder.id);
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
          <span style={{ flex: 1 }}>{folder.name}</span>
          {taskCount > 0 && (
            <Tooltip label={`${taskCount} tasks`}>
              <Badge variant="light" size="xs" style={{ marginRight: 4 }}>
                {taskCount}
              </Badge>
            </Tooltip>
          )}
        </UnstyledButton>
        {isExpanded && folder.folders?.map((child) => renderFolder(spaceIdValue, child, depth + 1))}
      </Box>
    );
  };

  return (
    <>
      <Group mb="lg" gap="sm" justify="space-between">
        <Group gap="sm" wrap="nowrap">
          <Tooltip label="Workspace">
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'var(--mantine-color-dark-6)',
              }}
            >
              <IconCheck size="1.25rem" />
            </span>
          </Tooltip>
          <div>
            <Text fw={800}>{workspace.name}</Text>
            <Text size="xs" c="dimmed">
              OpenProject-backed tracker workspace
            </Text>
          </div>
          {canManageSpaces && (
            <Tooltip label="Workspace settings">
              <ActionIcon variant="light" aria-label="Workspace settings" onClick={onOpenSettings}>
                <IconSettings size="1.25rem" />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      <UnstyledButton className={classes.profileButton} onClick={onOpenProfile}>
        <AvatarStack users={[profileUser]} size="1.75rem" />
        <span>
          <Text size="sm" fw={700}>
            {currentUser.name || currentUser.email}
          </Text>
          <Text size="xs" c="dimmed">
            {currentMembership?.role || 'No role'} •{' '}
            {currentUser.openProjectUserId ? 'linked to OpenProject' : 'not linked to OpenProject'}
          </Text>
        </span>
      </UnstyledButton>

      <Button variant="subtle" size="compact-sm" mb="md" onClick={onLogout}>
        Logout
      </Button>

      <Text size="sm" fw={700} mb="xs">
        Workspace
      </Text>
      <Stack gap={4} mb="md">
        <Button
          data-testid="all-tasks-link"
          variant={
            workspaceWideScope === 'all' && !selectedTask && !selectedDoc ? 'light' : 'subtle'
          }
          justify="flex-start"
          leftSection={<IconList size="1rem" />}
          onClick={onSelectAllTasks}
        >
          All Tasks
        </Button>
        <Button
          data-testid="my-tasks-link"
          variant={
            workspaceWideScope === 'mine' && !selectedTask && !selectedDoc ? 'light' : 'subtle'
          }
          justify="flex-start"
          leftSection={<IconCheck size="1rem" />}
          disabled={!currentOpenProjectUser}
          onClick={onSelectMyTasks}
        >
          My Tasks
        </Button>
        {docsAvailable && (
          <Button
            variant={taskView === 'docs' ? 'light' : 'subtle'}
            justify="flex-start"
            leftSection={<IconFolder size="1rem" />}
            onClick={onSelectDocs}
          >
            Local Docs
          </Button>
        )}
      </Stack>

      <Text size="lg" fw={700} mb="md">
        Spaces
      </Text>
      <ScrollArea className={classes.spacesTree}>
        {workspace.spaces.map((space) => {
          const isActiveSpace = space.id === activeSpace?.id;
          const isExpanded = expandedSpaceIds.has(space.id);
          return (
            <Box key={space.id} className={classes.spaceTreeBlock}>
              <Group wrap="nowrap" gap={0}>
                <UnstyledButton
                  data-testid="project-link"
                  data-project-id={space.id}
                  className={
                    isActiveSpace
                      ? `${classes.spaceTreeRow} ${classes.active}`
                      : classes.spaceTreeRow
                  }
                  onClick={() => {
                    onToggleSpace(space.id);
                    if (!isActiveSpace) {
                      const folder = firstTaskFolder(space) ?? space.folders[0];
                      if (folder) onOpenFolder(space.id, folder);
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
                </UnstyledButton>
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
                      <Menu.Item onClick={onOpenProjectAccess}>OpenProject access</Menu.Item>
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
          <UnstyledButton className={classes.newSpaceRow} onClick={onCreateSpace}>
            <IconPlus size="1.125rem" />
            New Space
          </UnstyledButton>
        )}
      </ScrollArea>
    </>
  );
}
