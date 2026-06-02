import { Alert, Box, Button, Drawer, Loader, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet } from 'react-router-dom';
import type { CurrentUser } from '@/lib';
import { TaskDetailPage } from '../../tasks/TaskDetailPage/TaskDetailPage';
import { SpaceCreateModal } from '../SpaceCreateModal/SpaceCreateModal';
import { useWorkspaceShellState } from './hooks/useWorkspaceShellState';
import { ImportReportModal } from './ImportReportModal';
import { WorkspaceShellProvider } from './WorkspaceShellContext';
import { WorkspaceShellHeader } from './WorkspaceShellHeader';
import { WorkspaceShellModals } from './WorkspaceShellModals';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import classes from './WorkspaceShell.module.css';

export interface WorkspaceShellProps {
  currentUser: CurrentUser;
  onCurrentUserChange: (user: CurrentUser | null) => void;
}

export function WorkspaceShell({ currentUser, onCurrentUserChange }: WorkspaceShellProps) {
  const state = useWorkspaceShellState(currentUser);
  const [mobileNavOpened, { toggle: toggleMobileNav, close: closeMobileNav }] =
    useDisclosure(false);
  const contextValue = {
    ...state,
    currentUser,
    onCurrentUserChange,
    mobileNavOpened,
    toggleMobileNav,
    closeMobileNav,
  };

  if (state.loading) {
    return (
      <Box className={classes.center}>
        <Loader />
      </Box>
    );
  }

  if (!state.workspace) {
    if (state.actionError) {
      return (
        <Box className={`${classes.center} ${classes.setupScreen}`}>
          <Alert color="red" title="Could not load ChainsawLeg workspace">
            {state.actionError}
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

  if (!state.activeSpace) {
    return (
      <Box className={`${classes.center} ${classes.setupScreen}`}>
        <SpaceCreateModal
          opened={state.spaceCreateOpen}
          workspace={state.workspace}
          onClose={() => state.setSpaceCreateOpen(false)}
          onCreated={state.reload}
        />
        <Stack>
          <Title order={2}>{state.workspace.name}</Title>
          <Text c="dimmed">Workspace created. Add the first space to start working.</Text>
          {state.actionError && (
            <Alert
              color="red"
              title="Could not create space"
              withCloseButton
              onClose={() => state.setActionError(null)}
            >
              {state.actionError}
            </Alert>
          )}
          {state.canManageSpaces && (
            <Button onClick={() => state.setSpaceCreateOpen(true)}>Create first space</Button>
          )}
        </Stack>
      </Box>
    );
  }

  return (
    <WorkspaceShellProvider value={contextValue}>
      <>
        <Box className={classes.shellLayout}>
          <WorkspaceShellModals />

          <Box
            visibleFrom="sm"
            component="nav"
            className={`${classes.workspaceSidebar} ${classes.desktopNav}`}
            data-testid="sidebar"
          >
            <Box p="md" className={classes.desktopNavInner}>
              <WorkspaceSidebar />
            </Box>
          </Box>

          <Box component="main" className={classes.mainShell} data-testid="workspace-shell">
            <Stack gap={0}>
              <WorkspaceShellHeader />
              <Outlet />
            </Stack>
          </Box>
        </Box>

        <Drawer
          opened={mobileNavOpened}
          onClose={closeMobileNav}
          position="left"
          size="21.75rem"
          withCloseButton={false}
          styles={{
            content: {
              background: 'var(--app-panel)',
              borderRight: '1px solid var(--app-border)',
            },
            body: { padding: 'var(--mantine-spacing-md)', height: '100%' },
          }}
          data-testid="mobile-nav-drawer"
        >
          <WorkspaceSidebar />
        </Drawer>

        <Drawer
          opened={Boolean(state.selectedTask)}
          onClose={state.backToFolder}
          position="right"
          size="78rem"
          title={
            state.selectedTask
              ? `Task • ${state.selectedTask.taskKey || state.selectedTask.id}`
              : 'Task'
          }
          data-testid="task-drawer"
        >
          {state.selectedTask && (
            <TaskDetailPage
              task={state.selectedTask}
              workspace={state.workspace}
              statuses={state.statuses}
              onBack={state.backToFolder}
              onSaved={state.handleTaskSaved}
              onOpenSubtask={state.openSubtask}
              onError={state.setActionError}
              canWriteTasks={state.canWriteTasks}
            />
          )}
        </Drawer>

        <ImportReportModal />
      </>
    </WorkspaceShellProvider>
  );
}
