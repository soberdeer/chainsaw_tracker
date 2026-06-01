import { ActionIcon, Box, Group, Menu, Text, ThemeIcon } from '@mantine/core';
import { IconDots, IconFileText } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { deleteDocument, docPath, getErrorMessage, updateDocument, type DocumentItem } from '@/lib';
import { confirmAction, promptForText } from '@/lib/modals';
import classes from './DocumentsPanel.module.css';

interface DocCardProps {
  doc: DocumentItem;
  spaceId: string;
  canEdit: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
}

export function DocCard({ doc, spaceId, canEdit, onChanged, onError }: DocCardProps) {
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      onChanged();
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  const handleRename = async () => {
    const title = await promptForText({
      title: 'Rename doc',
      label: 'Doc name',
      initialValue: doc.title,
      confirmLabel: 'Rename',
    });
    if (!title) return;
    await run(() => updateDocument(doc.id, { title }));
  };

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: 'Delete doc',
      message: `Delete "${doc.title}"? This removes the work package from OpenProject.`,
      confirmLabel: 'Delete',
      confirmColor: 'red',
    });
    if (!confirmed) return;
    await run(() => deleteDocument(doc.id));
  };

  const copyLink = () =>
    navigator.clipboard?.writeText(`${window.location.origin}${docPath(spaceId, doc.id)}`);

  const preview = (doc.markdown || '')
    .replace(/^#+\s+.*/gm, '')
    .replace(/[*_`#>[\]]/g, '')
    .trim()
    .slice(0, 200);

  return (
    <Box className={classes.docCard} style={{ position: 'relative' }}>
      {/* Menu sits on top with absolute position so it doesn't interfere with the link */}
      <Box
        style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', zIndex: 1 }}
        onClick={(e) => e.preventDefault()}
      >
        <Menu width="16rem" position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" aria-label="Doc actions" size="sm">
              <IconDots size="1rem" />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={copyLink}>Copy link</Menu.Item>
            {canEdit && (
              <>
                <Menu.Item onClick={() => void handleRename()}>Rename</Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" onClick={() => void handleDelete()}>
                  Delete
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </Box>

      {/* Card body is a plain link */}
      <Link to={docPath(spaceId, doc.id)} className={classes.docCardLink}>
        <Group gap="xs" mb="xs" pr="2rem">
          <ThemeIcon variant="light" color="blue" size="sm">
            <IconFileText size="1rem" />
          </ThemeIcon>
          <Text fw={700} lineClamp={1} style={{ flex: 1 }}>
            {doc.title}
          </Text>
        </Group>
        <Text size="sm" c="dimmed" lineClamp={4}>
          {preview || 'Empty document'}
        </Text>
      </Link>
    </Box>
  );
}
