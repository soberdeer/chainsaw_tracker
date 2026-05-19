import {
  ActionIcon,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconCheck,
  IconFileText,
  IconFolder,
  IconFolderOpen,
  IconList,
  IconPlus,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import {
  createSpace,
  getErrorMessage,
  searchAll,
  type Folder,
  type SearchResult,
  type Space,
  type TaskList,
  type Workspace,
} from '@/lib';
import classes from './GlobalSearchModal.module.css';

export interface GlobalSearchModalProps {
  opened: boolean;
  workspace: Workspace;
  activeSpace?: Space;
  activeFolder?: Folder;
  activeTaskList?: TaskList;
  onClose: () => void;
  onNavigate: (url: string) => void;
  onReload: () => void;
  onCreateTask: () => void;
  onError: (message: string) => void;
  canManageSpaces: boolean;
  canWriteTasks: boolean;
}

export function GlobalSearchModal({
  opened,
  workspace,
  activeSpace: _activeSpace,
  activeFolder: _activeFolder,
  activeTaskList,
  onClose,
  onNavigate,
  onReload,
  onCreateTask,
  onError,
  canManageSpaces,
  canWriteTasks,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!opened) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(() => {
      searchAll(query, workspace.id)
        .then((items) => {
          if (!cancelled) {
            setResults(items);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            onError(getErrorMessage(error));
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [opened, query, workspace.id, onError]);

  useEffect(() => {
    if (opened) {
      setQuery('');
    }
  }, [opened]);

  const runSearchAction = async (result: SearchResult) => {
    if (result.url) {
      onNavigate(result.url);
      onClose();
      return;
    }

    try {
      if (result.action === 'create-task') {
        if (!activeTaskList || !canWriteTasks) {
          return;
        }
        onCreateTask();
      }
      if (result.action === 'create-space') {
        if (!canManageSpaces) {
          return;
        }
        const name = window.prompt('Space name');
        if (!name) {
          return;
        }
        await createSpace({
          workspaceId: workspace.id,
          name,
          color: '#4c6ef5',
          initials: name.slice(0, 1).toUpperCase(),
          locked: true,
        });
        onReload();
      }
      onClose();
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  const iconFor = (type: SearchResult['type']) => {
    if (type === 'task') {
      return <IconCheck size="1.125rem" />;
    }
    if (type === 'doc') {
      return <IconFileText size="1.125rem" />;
    }
    if (type === 'space') {
      return <IconFolderOpen size="1.125rem" />;
    }
    if (type === 'folder') {
      return <IconFolder size="1.125rem" />;
    }
    if (type === 'list') {
      return <IconList size="1.125rem" />;
    }
    return <IconPlus size="1.125rem" />;
  };

  const actionDisabled = (result: SearchResult) =>
    (result.action === 'create-task' && !canWriteTasks) ||
    (result.action === 'create-space' && !canManageSpaces);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="80rem"
      yOffset="6vh"
      withCloseButton={false}
      classNames={{ content: classes.modalContent, body: classes.modalBody }}
    >
      <Stack gap={0}>
        <Group className={classes.modalHeader} wrap="nowrap">
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search, run a command..."
            variant="unstyled"
            autoFocus
            className={classes.searchInput}
          />
          <Tooltip label="Close search">
            <ActionIcon variant="subtle" onClick={onClose} aria-label="Close search">
              ×
            </ActionIcon>
          </Tooltip>
        </Group>
        <Group className={classes.tabs} gap="xs">
          <Text size="sm" c="dimmed">
            OpenProject task search
          </Text>
          {loading && <Loader size="xs" />}
        </Group>
        <ScrollArea h="32.5rem">
          <Stack gap={4} p="md">
            <Text size="sm" c="dimmed" fw={700}>
              Results
            </Text>
            {results.map((result) => (
              <button
                key={`${result.type}:${result.id}`}
                type="button"
                className={classes.resultRow}
                disabled={actionDisabled(result)}
                onClick={() => runSearchAction(result)}
              >
                <Tooltip label={`Result type: ${result.type}`}>
                  <ThemeIcon variant="subtle" color={result.type === 'action' ? 'teal' : 'gray'}>
                    {iconFor(result.type)}
                  </ThemeIcon>
                </Tooltip>
                <span className={classes.resultTitle}>{result.title}</span>
                {result.subtitle && (
                  <span className={classes.resultSubtitle}>{result.subtitle}</span>
                )}
              </button>
            ))}
            {!results.length && !loading && <Text c="dimmed">Nothing found</Text>}
          </Stack>
        </ScrollArea>
        <Group className={classes.modalFooter}>
          <Text size="sm" c="dimmed">
            Press / to open search, Enter to open a result
          </Text>
        </Group>
      </Stack>
    </Modal>
  );
}
