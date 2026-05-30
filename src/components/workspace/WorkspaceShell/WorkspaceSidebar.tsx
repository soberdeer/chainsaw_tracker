import {
  ActionIcon,
  Button,
  Group,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconCheck, IconFolder, IconList, IconPlus, IconSettings } from '@tabler/icons-react';
import { type CurrentUser, type Folder, type Space, type Workspace } from '@/lib';
import { AvatarStack } from '../../common/AvatarStack';
import { SpaceTreeItem } from './SpaceTreeItem';
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
        {workspace.spaces.map((space) => (
          <SpaceTreeItem
            key={space.id}
            space={space}
            activeSpace={activeSpace}
            activeFolder={activeFolder}
            expandedSpaceIds={expandedSpaceIds}
            expandedFolderIds={expandedFolderIds}
            onToggleSpace={onToggleSpace}
            onOpenFolder={onOpenFolder}
            onToggleFolder={onToggleFolder}
            onOpenProjectAccess={onOpenProjectAccess}
          />
        ))}
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
