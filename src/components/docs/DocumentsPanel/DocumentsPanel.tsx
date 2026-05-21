import {
  ActionIcon,
  Badge,
  Box,
  Button,
  FileButton,
  Group,
  Menu,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconDots, IconFileText, IconPaperclip, IconPhoto, IconPlus } from '@tabler/icons-react';
import {
  createEmbedDoc,
  createMarkdownDoc,
  deleteDocument,
  duplicateDocument,
  uploadDocument,
  getErrorMessage,
  updateDocument,
  type DocumentItem,
} from '@/lib';
import { confirmAction, promptForText } from '@/lib/modals';
import classes from './DocumentsPanel.module.css';

export interface DocumentsPanelProps {
  documents: DocumentItem[];
  spaceId: string;
  onOpen: (doc: DocumentItem) => void;
  onChanged: () => void;
  onError: (message: string) => void;
}

export function DocumentsPanel({
  documents,
  spaceId,
  onOpen,
  onChanged,
  onError,
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
    if (!title) {
      return;
    }
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
    embedForm.setValues({
      title: 'Embedded document',
      embedUrl: '',
    });
  });

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={3}>Local Docs</Title>
          <Text size="sm" c="dimmed">
            Images stay as files; text, docx and spreadsheets become Markdown.
          </Text>
        </Box>
        <Group>
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
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
        {documents.map((doc) => (
          <UnstyledButton key={doc.id} className={classes.docCard} onClick={() => onOpen(doc)}>
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
                    <Tooltip label="Document settings">
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
                    <Menu.Item
                      onClick={() => {
                        void (async () => {
                          const title = await promptForText({
                            title: 'Rename doc',
                            label: 'Doc name',
                            initialValue: doc.title,
                            confirmLabel: 'Rename',
                          });
                          if (!title) {
                            return;
                          }
                          await run(() => updateDocument(doc.id, { title }));
                        })();
                      }}
                    >
                      Rename
                    </Menu.Item>
                    <Menu.Item
                      onClick={() =>
                        navigator.clipboard?.writeText(
                          `${window.location.origin}/space/${doc.spaceId}/doc/${doc.id}`
                        )
                      }
                    >
                      Copy link
                    </Menu.Item>
                    <Menu.Item onClick={() => void run(() => duplicateDocument(doc.id))}>
                      Duplicate
                    </Menu.Item>
                    <Menu.Item
                      color="red"
                      onClick={() => {
                        void (async () => {
                          const confirmed = await confirmAction({
                            title: 'Delete doc',
                            message: `Delete "${doc.title}"? This removes the local tracker document.`,
                            confirmLabel: 'Delete doc',
                            confirmColor: 'red',
                          });
                          if (!confirmed) {
                            return;
                          }
                          await run(() => deleteDocument(doc.id));
                        })();
                      }}
                    >
                      Delete
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item disabled>
                      Managed through workspace members and project access
                    </Menu.Item>
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
        ))}
      </SimpleGrid>
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
    </Stack>
  );
}
