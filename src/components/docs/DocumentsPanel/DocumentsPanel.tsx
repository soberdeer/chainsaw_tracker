import {
  Box,
  Button,
  FileButton,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPaperclip, IconPlus } from '@tabler/icons-react';
import {
  createEmbedDoc,
  createMarkdownDoc,
  uploadDocument,
  getErrorMessage,
  type DocumentItem,
} from '@/lib';
import { promptForText } from '@/lib/modals';
import { DocCard } from './DocCard';
import classes from './DocumentsPanel.module.css';

export interface DocumentsPanelProps {
  documents: DocumentItem[];
  spaceId: string;
  onOpen: (doc: DocumentItem) => void;
  onChanged: () => void;
  onError: (message: string) => void;
  canEdit?: boolean;
}

export function DocumentsPanel({
  documents,
  spaceId,
  onOpen,
  onChanged,
  onError,
  canEdit = true,
}: DocumentsPanelProps) {
  const embedForm = useForm({
    initialValues: {
      title: 'Embedded document',
      embedUrl: 'https://drive.google.com/file/d/example/preview',
    },
    validate: {
      title: (value) => (value.trim().length ? null : 'Embed title is required'),
      embedUrl: (value) => (value.trim().length ? null : 'Embed link is required'),
    },
  });

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      onChanged();
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  const createMd = async () => {
    const title = await promptForText({
      title: 'New Markdown doc',
      label: 'Doc title',
      placeholder: 'Release notes',
      confirmLabel: 'Create doc',
    });
    if (!title) return;
    await run(() => createMarkdownDoc({ spaceId, title, markdown: `# ${title}\n` }));
  };

  const createEmbed = embedForm.onSubmit(async (values) => {
    await run(() =>
      createEmbedDoc({
        spaceId,
        title: values.title.trim(),
        embedUrl: values.embedUrl.trim(),
      })
    );
    embedForm.setValues({ title: 'Embedded document', embedUrl: '' });
  });

  return (
    <Stack gap="md" data-testid="docs-page">
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={3}>Local Docs</Title>
          <Text size="sm" c="dimmed">
            Images stay as files; text, docx and spreadsheets become Markdown.
          </Text>
        </Box>
        <Group>
          {canEdit && (
            <>
              <FileButton
                onChange={(file) => file && void run(() => uploadDocument(spaceId, file))}
                accept="image/*,.md,.txt,.docx,.xlsx,.csv,.json,.html"
              >
                {(props) => (
                  <Button {...props} leftSection={<IconPaperclip size="1rem" />} variant="light">
                    Upload
                  </Button>
                )}
              </FileButton>
              <Button leftSection={<IconPlus size="1rem" />} onClick={createMd}>
                New MD
              </Button>
            </>
          )}
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
        {documents.map((doc) => (
          <DocCard
            key={doc.id}
            doc={doc}
            canEdit={canEdit}
            onOpen={onOpen}
            onChanged={onChanged}
            onError={onError}
          />
        ))}
      </SimpleGrid>
      {canEdit && (
        <Box component="form" onSubmit={createEmbed}>
          <Group align="end">
            <TextInput
              label="Embed title"
              placeholder="Prototype board"
              {...embedForm.getInputProps('title')}
              className={classes.grow}
            />
            <TextInput
              label="Embed link"
              placeholder="Miro, Google Drive PDF, Figma preview..."
              {...embedForm.getInputProps('embedUrl')}
              className={classes.grow}
            />
            <Button
              type="submit"
              variant="light"
              disabled={!embedForm.values.embedUrl.trim() || !embedForm.values.title.trim()}
            >
              Add embed
            </Button>
          </Group>
        </Box>
      )}
    </Stack>
  );
}
