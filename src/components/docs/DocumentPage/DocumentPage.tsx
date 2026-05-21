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
}

export function DocumentPage({ document, onBack, onSaved, onError }: DocumentPageProps) {
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
    <Paper className={classes.detailPage} withBorder>
      <form onSubmit={save}>
        <Group justify="space-between" mb="lg">
          <Box>
            <Text size="xs" c="dimmed">
              {document.kind}
            </Text>
            <TextInput className={classes.titleInput} {...form.getInputProps('title')} />
          </Box>
          <Group>
            <Button loading={saving} type="submit">
              Save
            </Button>
            <Button type="button" variant="light" onClick={onBack}>
              Back
            </Button>
          </Group>
        </Group>
        {document.kind === 'EMBED' && document.embedUrl ? (
          <Stack>
            <TextInput label="Embed link" {...form.getInputProps('embedUrl')} />
            <Box className={classes.embedPreview}>
              <Text>{form.values.embedUrl}</Text>
            </Box>
          </Stack>
        ) : document.kind === 'IMAGE' && document.fileUrl ? (
          <img src={document.fileUrl} alt={document.title} className={classes.imagePreview} />
        ) : (
          <Textarea minRows={18} autosize {...form.getInputProps('markdown')} />
        )}
      </form>
    </Paper>
  );
}
