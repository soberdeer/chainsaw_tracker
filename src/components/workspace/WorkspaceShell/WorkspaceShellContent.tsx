import { Box, Tabs } from '@mantine/core';
import { IconLayoutKanban, IconList } from '@tabler/icons-react';
import { DocumentPage } from '../../docs/DocumentPage/DocumentPage';
import { DocumentsPanel } from '../../docs/DocumentsPanel/DocumentsPanel';
import { BoardPanel } from './BoardPanel';
import { TaskListPanel } from './TaskListPanel';
import { useWorkspaceShellContext } from './WorkspaceShellContext';
import classes from './WorkspaceShell.module.css';

export function WorkspaceShellContent() {
  const state = useWorkspaceShellContext();

  if (state.isDocsFolder) {
    return (
      <Box p="md">
        {state.selectedDoc ? (
          <DocumentPage
            document={state.selectedDoc}
            onBack={state.backToDocs}
            onSaved={state.handleDocumentSaved}
            onError={state.setActionError}
            canEdit={state.canManageDocs}
          />
        ) : (
          <DocumentsPanel
            documents={state.docs}
            loading={state.docsLoading}
            folderId={state.resolvedDocsFolderId || state.activeFolder?.id || ''}
            spaceId={state.activeSpace?.id || ''}
            onChanged={state.reload}
            onError={state.setActionError}
            canEdit={state.canManageDocs}
          />
        )}
      </Box>
    );
  }

  return (
    <Tabs
      value={state.taskView}
      onChange={state.setTaskView}
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
        <TaskListPanel />
      </Tabs.Panel>

      <Tabs.Panel value="board">
        <BoardPanel />
      </Tabs.Panel>
    </Tabs>
  );
}
