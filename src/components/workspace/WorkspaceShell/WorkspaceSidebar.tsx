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
import { IconCheck, IconList, IconPlus, IconSettings } from '@tabler/icons-react';
import { AvatarStack } from '../../common/AvatarStack';
import { SpaceTreeItem } from './SpaceTreeItem';
import { useWorkspaceShellContext } from './WorkspaceShellContext';
import classes from './WorkspaceShell.module.css';

export function WorkspaceSidebar() {
  const state = useWorkspaceShellContext();
  const profileUser = {
    id: state.currentUser.id,
    email: state.currentUser.email,
    name: state.currentUser.name,
    avatarUrl: state.currentUser.avatarUrl || undefined,
  };

  return (
    <ScrollArea.Autosize scrollbars="y" classNames={{ scrollbar: classes.scrollbar }}>
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
            <Text fw={800}>{state.workspace.name}</Text>
            <Text size="xs" c="dimmed">
              Task tracker
            </Text>
          </div>
          {state.canManageSpaces && (
            <Tooltip label="Workspace settings">
              <ActionIcon
                variant="light"
                aria-label="Workspace settings"
                onClick={() => {
                  state.setWorkspaceSettingsTab('general');
                  state.setWorkspaceSettingsOpen(true);
                }}
              >
                <IconSettings size="1.25rem" />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      <UnstyledButton
        data-testid="profile-button"
        className={classes.profileButton}
        onClick={() => state.setProfileOpen(true)}
      >
        <AvatarStack users={[profileUser]} size="1.75rem" />
        <span>
          <Text size="sm" fw={700}>
            {state.currentUser.name || state.currentUser.email}
          </Text>
          <Text size="xs" c="dimmed">
            {state.currentMembership?.role || 'No role'} •{' '}
            {state.currentUser.openProjectUserId
              ? 'linked to OpenProject'
              : 'not linked to OpenProject'}
          </Text>
        </span>
      </UnstyledButton>

      <Button
        variant="subtle"
        size="compact-sm"
        mb="md"
        onClick={async () => {
          await state.logoutCurrentUser();
          state.onCurrentUserChange(null);
        }}
      >
        Logout
      </Button>

      <Text size="sm" fw={700} mb="xs">
        Workspace
      </Text>
      <Stack gap={4} mb="md">
        <Button
          data-testid="all-tasks-link"
          variant={
            state.workspaceWideScope === 'all' && !state.selectedTask && !state.selectedDoc
              ? 'light'
              : 'subtle'
          }
          justify="flex-start"
          leftSection={<IconList size="1rem" />}
          onClick={() => {
            state.openAllTasks();
            state.closeMobileNav();
          }}
        >
          All Tasks
        </Button>
        <Button
          data-testid="my-tasks-link"
          variant={
            state.workspaceWideScope === 'mine' && !state.selectedTask && !state.selectedDoc
              ? 'light'
              : 'subtle'
          }
          justify="flex-start"
          leftSection={<IconCheck size="1rem" />}
          disabled={!state.currentOpenProjectUser}
          onClick={() => {
            state.openMyTasks();
            state.closeMobileNav();
          }}
        >
          My Tasks
        </Button>
      </Stack>

      <Text size="lg" fw={700} mb="md">
        Spaces
      </Text>

      {state.workspace.spaces.map((space) => (
        <SpaceTreeItem key={space.id} space={space} />
      ))}
      {state.canManageSpaces && (
        <UnstyledButton
          data-testid="new-space-button"
          className={classes.newSpaceRow}
          onClick={() => state.setSpaceCreateOpen(true)}
        >
          <IconPlus size="1.125rem" />
          New Space
        </UnstyledButton>
      )}
    </ScrollArea.Autosize>
  );
}
