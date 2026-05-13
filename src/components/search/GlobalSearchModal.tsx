import { useEffect, useState } from 'react';
import { ActionIcon, Button, Group, Loader, Modal, ScrollArea, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconCheck, IconFileText, IconFolder, IconFolderOpen, IconList, IconPlus } from '@tabler/icons-react';
import { createFolder, createSpace, createTask, searchAll } from '../../lib/api';
import type { Folder, SearchResult, Space, TaskList, TaskStatus, Workspace } from '../../lib/types';
import { docPath, folderPath, getErrorMessage } from '../../lib/taskUi';

export function GlobalSearchModal({
  opened,
  workspace,
  activeSpace,
  activeFolder,
  activeTaskList,
  statuses,
  onClose,
  onNavigate,
  onReload,
  onError
}: {
  opened: boolean;
  workspace: Workspace;
  activeSpace?: Space;
  activeFolder?: Folder;
  activeTaskList?: TaskList;
  statuses: TaskStatus[];
  onClose: () => void;
  onNavigate: (url: string) => void;
  onReload: () => void;
  onError: (message: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(() => {
      searchAll(query, workspace.id)
        .then((items) => {
          if (!cancelled) setResults(items);
        })
        .catch((error) => {
          if (!cancelled) onError(getErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [opened, query, workspace.id, onError]);

  useEffect(() => {
    if (opened) setQuery('');
  }, [opened]);

  const runSearchAction = async (result: SearchResult) => {
    if (result.url) {
      onNavigate(result.url);
      onClose();
      return;
    }

    try {
      if (result.action === 'create-task') {
        const title = window.prompt('Task name');
        if (!title || !activeTaskList) return;
        await createTask({ taskListId: activeTaskList.id, title, statusId: statuses[0]?.id, priority: 'NORMAL' });
        onReload();
      }
      if (result.action === 'create-space') {
        const name = window.prompt('Space name');
        if (!name) return;
        await createSpace({ workspaceId: workspace.id, name, color: '#4c6ef5', initials: name.slice(0, 1).toUpperCase(), locked: true });
        onReload();
      }
      if (result.action === 'create-folder' && activeSpace) {
        const name = window.prompt('Folder name');
        if (!name) return;
        await createFolder(activeSpace.id, { name, kind: 'TEAM', locked: true });
        onReload();
      }
      if (result.action === 'open-board' && activeSpace && activeFolder) {
        onNavigate(folderPath(activeSpace.id, activeFolder.id));
      }
      if (result.action === 'open-docs' && activeSpace) {
        const doc = activeSpace.documents[0];
        if (doc) onNavigate(docPath(activeSpace.id, doc.id));
      }
      onClose();
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  const iconFor = (type: SearchResult['type']) => {
    if (type === 'task') return <IconCheck size="1.125rem" />;
    if (type === 'doc') return <IconFileText size="1.125rem" />;
    if (type === 'space') return <IconFolderOpen size="1.125rem" />;
    if (type === 'folder') return <IconFolder size="1.125rem" />;
    if (type === 'list') return <IconList size="1.125rem" />;
    return <IconPlus size="1.125rem" />;
  };

  return (
    <Modal opened={opened} onClose={onClose} size="80rem" yOffset="6vh" withCloseButton={false} classNames={{ content: 'search-modal-content', body: 'search-modal-body' }}>
      <Stack gap={0}>
        <Group className="search-modal-header" wrap="nowrap">
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search, run a command..."
            variant="unstyled"
            autoFocus
            className="global-search-input"
          />
          <ActionIcon variant="subtle" onClick={onClose} aria-label="Close search">×</ActionIcon>
        </Group>
        <Group className="search-tabs" gap="xs">
          {['All', 'Tasks', 'Docs', 'Spaces'].map((item) => <Button key={item} variant="subtle" size="compact-md">{item}</Button>)}
          {loading && <Loader size="xs" />}
        </Group>
        <ScrollArea h="32.5rem">
          <Stack gap={4} p="md">
            <Text size="sm" c="dimmed" fw={700}>Results</Text>
            {results.map((result) => (
              <button key={`${result.type}:${result.id}`} type="button" className="search-result-row" onClick={() => runSearchAction(result)}>
                <ThemeIcon variant="subtle" color={result.type === 'action' ? 'teal' : 'gray'}>{iconFor(result.type)}</ThemeIcon>
                <span className="search-result-title">{result.title}</span>
                {result.subtitle && <span className="search-result-subtitle">{result.subtitle}</span>}
              </button>
            ))}
            {!results.length && !loading && <Text c="dimmed">Nothing found</Text>}
          </Stack>
        </ScrollArea>
        <Group className="search-modal-footer">
          <Text size="sm" c="dimmed">Press / to open search, Enter to open a result</Text>
        </Group>
      </Stack>
    </Modal>
  );
}
