import { Box, Button, Group, Paper, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import { updateDocument, getErrorMessage, type DocumentItem } from '@/lib';
import classes from './DocumentPage.module.css';

export interface DocumentPageProps {
  document: DocumentItem;
  onBack: () => void;
  onSaved: (document: DocumentItem) => void;
  onError: (message: string) => void;
  canEdit?: boolean;
}

export function DocumentPage({
  document,
  onBack,
  onSaved,
  onError,
  canEdit = true,
}: DocumentPageProps) {
  const [saving, setSaving] = useState(false);
  const form = useForm({
    initialValues: {
      title: document.title,
      markdown: document.markdown || '',
      embedUrl: document.embedUrl || '',
    },
    validate: {
      title: (value) => (value.trim().length ? null : 'Document title is required'),
    },
  });

  useEffect(() => {
    form.setValues({
      title: document.title,
      markdown: document.markdown || '',
      embedUrl: document.embedUrl || '',
    });
  }, [document, form]);

  const save = form.onSubmit(async (values) => {
    try {
      setSaving(true);
      onSaved(
        await updateDocument(document.id, {
          title: values.title,
          ...(document.kind === 'MARKDOWN' || document.kind === 'SPREADSHEET'
            ? { markdown: values.markdown }
            : {}),
          ...(document.kind === 'EMBED' ? { embedUrl: values.embedUrl } : {}),
        })
      );
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  });

  return (
    <Paper className={classes.detailPage} withBorder data-testid="docs-page">
      <form onSubmit={save}>
        <Group justify="space-between" mb="lg">
          <Box>
            <Text size="xs" c="dimmed">
              {document.kind}
            </Text>
            <TextInput
              data-testid="doc-title-input"
              className={classes.titleInput}
              {...form.getInputProps('title')}
            />
          </Box>
          <Group>
            {canEdit && (
              <Button loading={saving} type="submit">
                Save
              </Button>
            )}
            <Button type="button" variant="light" onClick={onBack}>
              Back
            </Button>
          </Group>
        </Group>
        {document.kind === 'EMBED' && document.embedUrl ? (
          <Stack>
            <TextInput
              data-testid="doc-embed-url-input"
              label="Embed link"
              readOnly={!canEdit}
              {...form.getInputProps('embedUrl')}
            />
            <Box className={classes.embedPreview}>
              <Text>{form.values.embedUrl}</Text>
            </Box>
          </Stack>
        ) : document.kind === 'IMAGE' && document.fileUrl ? (
          <img src={document.fileUrl} alt={document.title} className={classes.imagePreview} />
        ) : (
          <Textarea
            data-testid="doc-markdown-input"
            minRows={18}
            autosize
            readOnly={!canEdit}
            {...form.getInputProps('markdown')}
          />
        )}
      </form>
    </Paper>
  );
}
