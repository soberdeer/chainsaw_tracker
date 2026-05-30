import {
  ActionIcon,
  Box,
  Button,
  Card,
  Group,
  Text,
  Textarea,
  Tooltip,
  Typography,
} from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import { marked } from 'marked';
import { useMemo, useRef, useState } from 'react';
import classes from './TaskDescription.module.css';

interface TaskDescriptionProps {
  value: string;
  canWriteTasks: boolean;
  onSave: (description: string) => Promise<void>;
}

export function TaskDescription({ value, canWriteTasks, onSave }: TaskDescriptionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const html = useMemo(() => {
    if (!value?.trim()) return '';
    return marked.parse(value, { async: false }) as string;
  }, [value]);

  const handleEdit = () => {
    setDraft(value);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
      setDraft('');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <Card withBorder>
        <Textarea
          data-testid="task-description-input"
          ref={textareaRef}
          minRows={8}
          autosize
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Group justify="flex-end" mt="xs" gap="xs">
          <Button variant="subtle" size="xs" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="xs" loading={saving} onClick={() => void handleSave()}>
            Save
          </Button>
        </Group>
      </Card>
    );
  }

  return (
    <Card withBorder mb="lg" className={classes.descriptionWrapper}>
      <Box className={classes.edit}>
        {canWriteTasks && (
          <Tooltip label="Edit description">
            <ActionIcon variant="subtle" className={classes.editButton} onClick={handleEdit}>
              <IconPencil />
            </ActionIcon>
          </Tooltip>
        )}
      </Box>
      {html ? (
        <Typography>
          <Box className={classes.markdownBody} dangerouslySetInnerHTML={{ __html: html }} />
        </Typography>
      ) : (
        <Text
          c="dimmed"
          size="sm"
          className={classes.emptyDescription}
          onClick={canWriteTasks ? handleEdit : undefined}
        >
          {canWriteTasks ? 'Click edit to add a description…' : 'No description.'}
        </Text>
      )}
    </Card>
  );
}
