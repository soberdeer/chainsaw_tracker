import { Box, Button, Group, Paper, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';
import { updateDocument } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/taskUi';
import type { DocumentItem } from '../../../lib/types';
import classes from './DocumentPage.module.css';

export function DocumentPage({
  document,
  onBack,
  onSaved,
  onError,
}: {
  document: DocumentItem;
  onBack: () => void;
  onSaved: (document: DocumentItem) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(document.title);
  const [markdown, setMarkdown] = useState(document.markdown || '');
  const [embedUrl, setEmbedUrl] = useState(document.embedUrl || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(document.title);
    setMarkdown(document.markdown || '');
    setEmbedUrl(document.embedUrl || '');
  }, [document]);

  const save = async () => {
    try {
      setSaving(true);
      onSaved(
        await updateDocument(document.id, {
          title,
          ...(document.kind === 'MARKDOWN' || document.kind === 'SPREADSHEET' ? { markdown } : {}),
          ...(document.kind === 'EMBED' ? { embedUrl } : {}),
        })
      );
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper className={classes.detailPage} withBorder>
      <Group justify="space-between" mb="lg">
        <Box>
          <Text size="xs" c="dimmed">
            {document.kind}
          </Text>
          <TextInput
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            className={classes.titleInput}
          />
        </Box>
        <Group>
          <Button loading={saving} onClick={save}>
            Save
          </Button>
          <Button variant="light" onClick={onBack}>
            Back
          </Button>
        </Group>
      </Group>
      {document.kind === 'EMBED' && document.embedUrl ? (
        <Stack>
          <TextInput
            label="Embed link"
            value={embedUrl}
            onChange={(event) => setEmbedUrl(event.currentTarget.value)}
          />
          <Box className={classes.embedPreview}>
            <Text>{embedUrl}</Text>
          </Box>
        </Stack>
      ) : document.kind === 'IMAGE' && document.fileUrl ? (
        <img src={document.fileUrl} alt={document.title} className={classes.imagePreview} />
      ) : (
        <Textarea
          value={markdown}
          onChange={(event) => setMarkdown(event.currentTarget.value)}
          minRows={18}
          autosize
        />
      )}
    </Paper>
  );
}
