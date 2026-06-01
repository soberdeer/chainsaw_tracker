import { Box, Button, Group, Paper, Text, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconEdit, IconEye } from '@tabler/icons-react';
import { marked, Renderer } from 'marked';
import { useEffect, useMemo, useRef, useState } from 'react';
import { updateDocument, getErrorMessage, type DocumentItem } from '@/lib';
import { buildEmbedHtml, resolveEmbed } from './embedUtils';
import classes from './DocumentPage.module.css';

// Custom renderer: turns embeddable links into iframes
function makeRenderer(): Renderer {
  const renderer = new Renderer();
  const orig = renderer.link.bind(renderer);
  renderer.link = (token) => {
    const embed = resolveEmbed(token.href);
    if (embed) return buildEmbedHtml(embed, token.href);
    return orig(token);
  };
  return renderer;
}

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
  canEdit = false,
}: DocumentPageProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm({
    initialValues: {
      title: document.title,
      markdown: document.markdown || '',
    },
    validate: {
      title: (v) => (v.trim().length ? null : 'Title is required'),
    },
  });
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    formRef.current.setValues({ title: document.title, markdown: document.markdown || '' });
    setEditing(false);
  }, [document.id, document.markdown, document.title]);

  const renderer = useMemo(() => makeRenderer(), []);

  const renderedHtml = useMemo(
    () =>
      marked.parse(editing ? form.values.markdown : document.markdown || '', {
        renderer,
      }) as string,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, document.markdown, form.values.markdown, renderer]
  );

  const save = form.onSubmit(async (values) => {
    try {
      setSaving(true);
      const saved = await updateDocument(document.id, {
        title: values.title,
        markdown: values.markdown,
      });
      onSaved(saved);
      setEditing(false);
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  });

  const cancelEdit = () => {
    form.setValues({ title: document.title, markdown: document.markdown || '' });
    setEditing(false);
  };

  return (
    <Paper className={classes.detailPage} withBorder data-testid="docs-page">
      <form onSubmit={save}>
        <Group justify="space-between" mb="lg" wrap="nowrap">
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="xs" c="dimmed" mb={4}>
              Documentation
            </Text>
            {editing ? (
              <TextInput
                data-testid="doc-title-input"
                className={classes.titleInput}
                {...form.getInputProps('title')}
              />
            ) : (
              <Text className={classes.titleText}>{form.values.title}</Text>
            )}
          </Box>
          <Group gap="xs" wrap="nowrap">
            {canEdit && !editing && (
              <Button
                variant="light"
                leftSection={<IconEdit size="1rem" />}
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            )}
            {editing && (
              <>
                <Button loading={saving} type="submit">
                  Save
                </Button>
                <Button variant="subtle" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </Button>
              </>
            )}
            {!editing && (
              <Button leftSection={<IconEye size="1rem" />} variant="light" onClick={onBack}>
                Back
              </Button>
            )}
          </Group>
        </Group>

        {editing ? (
          <Textarea
            data-testid="doc-markdown-input"
            minRows={24}
            autosize
            styles={{ input: { fontFamily: 'monospace', fontSize: '0.875rem' } }}
            {...form.getInputProps('markdown')}
          />
        ) : (
          <Box
            className={classes.markdownBody}
            data-testid="doc-markdown-preview"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )}
      </form>
    </Paper>
  );
}
