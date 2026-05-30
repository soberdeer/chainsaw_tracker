import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Menu,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconDots, IconFileText, IconPhoto } from '@tabler/icons-react';
import {
  deleteDocument,
  duplicateDocument,
  getErrorMessage,
  updateDocument,
  type DocumentItem,
} from '@/lib';
import { confirmAction, promptForText } from '@/lib/modals';
import classes from './DocumentsPanel.module.css';

interface DocCardProps {
  doc: DocumentItem;
  canEdit: boolean;
  onOpen: (doc: DocumentItem) => void;
  onChanged: () => void;
  onError: (message: string) => void;
}

export function DocCard({ doc, canEdit, onOpen, onChanged, onError }: DocCardProps) {
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
      message: `Delete "${doc.title}"? This removes the local tracker document.`,
      confirmLabel: 'Delete doc',
      confirmColor: 'red',
    });
    if (!confirmed) return;
    await run(() => deleteDocument(doc.id));
  };

  const copyLink = () =>
    navigator.clipboard?.writeText(`${window.location.origin}/space/${doc.spaceId}/doc/${doc.id}`);

  return (
    <UnstyledButton className={classes.docCard} onClick={() => onOpen(doc)}>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <Tooltip label={`Document type: ${doc.kind}`}>
            <ThemeIcon
              variant="light"
              color={doc.kind === 'IMAGE' ? 'pink' : doc.kind === 'EMBED' ? 'violet' : 'blue'}
            >
              {doc.kind === 'IMAGE' ? (
                <IconPhoto size="1.125rem" />
              ) : (
                <IconFileText size="1.125rem" />
              )}
            </ThemeIcon>
          </Tooltip>
          <Text fw={700}>{doc.title}</Text>
        </Group>
        <Group gap="xs">
          <Tooltip label={`Document type: ${doc.kind}`}>
            <Badge variant="outline">{doc.kind}</Badge>
          </Tooltip>
          <Menu width="18rem" position="bottom-end">
            <Menu.Target>
              <Tooltip label={canEdit ? 'Document settings' : 'Read-only document'}>
                <ActionIcon
                  component="div"
                  variant="subtle"
                  aria-label="Doc settings"
                  onClick={(event) => event.stopPropagation()}
                >
                  <IconDots size="1rem" />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown
              className={classes.menuDropdown}
              onClick={(event) => event.stopPropagation()}
            >
              <Menu.Label>Doc settings</Menu.Label>
              {canEdit ? (
                <>
                  <Menu.Item onClick={() => void handleRename()}>Rename</Menu.Item>
                  <Menu.Item onClick={copyLink}>Copy link</Menu.Item>
                  <Menu.Item onClick={() => void run(() => duplicateDocument(doc.id))}>
                    Duplicate
                  </Menu.Item>
                  <Menu.Item color="red" onClick={() => void handleDelete()}>
                    Delete
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item disabled>
                    Managed through workspace members and project access
                  </Menu.Item>
                </>
              ) : (
                <>
                  <Menu.Item onClick={copyLink}>Copy link</Menu.Item>
                  <Menu.Item disabled>Your current role can view local docs only.</Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
      {doc.kind === 'EMBED' ? (
        <Box className={classes.embedPreview}>
          <Text size="sm" c="dimmed">
            {doc.embedUrl}
          </Text>
        </Box>
      ) : (
        <Text size="sm" c="dimmed" lineClamp={5}>
          {doc.markdown || doc.sourceName || 'Image asset'}
        </Text>
      )}
    </UnstyledButton>
  );
}
