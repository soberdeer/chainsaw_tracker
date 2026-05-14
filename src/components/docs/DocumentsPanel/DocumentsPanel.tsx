import { useState } from 'react';
import { ActionIcon, Badge, Box, Button, FileButton, Group, Menu, Paper, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { IconDots, IconFileText, IconPaperclip, IconPhoto, IconPlus } from '@tabler/icons-react';
import { createEmbedDoc, createMarkdownDoc, deleteDocument, duplicateDocument, updateDocument, uploadDocument } from '../../../lib/api';
import type { DocumentItem } from '../../../lib/types';
import { getErrorMessage } from '../../../lib/taskUi';
import classes from './DocumentsPanel.module.css';

export function DocumentsPanel({
  documents,
  spaceId,
  onOpen,
  onChanged,
  onError
}: {
  documents: DocumentItem[];
  spaceId: string;
  onOpen: (doc: DocumentItem) => void;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [embedUrl, setEmbedUrl] = useState('https://drive.google.com/file/d/example/preview');
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      onChanged();
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  const createMd = async () => {
    const title = window.prompt('Doc title');
    if (!title) return;
    await run(() => createMarkdownDoc({ spaceId, title, markdown: `# ${title}\n` }));
  };

  const createEmbed = async () => {
    const title = window.prompt('Embed title') || 'Embedded document';
    await run(() => createEmbedDoc({ spaceId, title, embedUrl }));
    setEmbedUrl('');
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={3}>Docs</Title>
          <Text size="sm" c="dimmed">Images stay as files; text, docx and spreadsheets become Markdown.</Text>
        </Box>
        <Group>
          <FileButton onChange={(file) => file && void run(() => uploadDocument(spaceId, file))} accept="image/*,.md,.txt,.docx,.xlsx,.csv,.json,.html">
            {(props) => <Button {...props} leftSection={<IconPaperclip size="1rem" />} variant="light">Upload</Button>}
          </FileButton>
          <Button leftSection={<IconPlus size="1rem" />} onClick={createMd}>New MD</Button>
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
        {documents.map((doc) => (
          <Paper key={doc.id} withBorder className={classes.docCard} onClick={() => onOpen(doc)}>
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" color={doc.kind === 'IMAGE' ? 'pink' : doc.kind === 'EMBED' ? 'violet' : 'blue'}>
                  {doc.kind === 'IMAGE' ? <IconPhoto size="1.125rem" /> : <IconFileText size="1.125rem" />}
                </ThemeIcon>
                <Text fw={700}>{doc.title}</Text>
              </Group>
              <Group gap="xs">
                <Badge variant="outline">{doc.kind}</Badge>
                <Menu width="18rem" position="bottom-end">
                  <Menu.Target>
                    <ActionIcon variant="subtle" aria-label="Doc settings" onClick={(event) => event.stopPropagation()}><IconDots size="1rem" /></ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown className={classes.menuDropdown} onClick={(event) => event.stopPropagation()}>
                    <Menu.Label>Doc settings</Menu.Label>
                    <Menu.Item onClick={() => {
                      const title = window.prompt('Doc name', doc.title);
                      if (title) void run(() => updateDocument(doc.id, { title }));
                    }}>Rename</Menu.Item>
                    <Menu.Item onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/space/${doc.spaceId}/doc/${doc.id}`)}>Copy link</Menu.Item>
                    <Menu.Item onClick={() => void run(() => duplicateDocument(doc.id))}>Duplicate</Menu.Item>
                    <Menu.Item color="red" onClick={() => {
                      if (window.confirm(`Delete "${doc.title}"?`)) void run(() => deleteDocument(doc.id));
                    }}>Delete</Menu.Item>
                    <Menu.Divider />
                    <Menu.Item>Sharing and Permissions</Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>
            {doc.kind === 'EMBED' ? (
              <Box className={classes.embedPreview}>
                <Text size="sm" c="dimmed">{doc.embedUrl}</Text>
              </Box>
            ) : (
              <Text size="sm" c="dimmed" lineClamp={5}>{doc.markdown || doc.sourceName || 'Image asset'}</Text>
            )}
          </Paper>
        ))}
      </SimpleGrid>
      <Paper withBorder p="md">
        <Group align="end">
          <TextInput
            label="Embed link"
            value={embedUrl}
            onChange={(event) => setEmbedUrl(event.currentTarget.value)}
            placeholder="Miro, Google Drive PDF, Figma preview..."
            className={classes.grow}
          />
          <Button variant="light" disabled={!embedUrl.trim()} onClick={createEmbed}>Add embed</Button>
        </Group>
      </Paper>
    </Stack>
  );
}
