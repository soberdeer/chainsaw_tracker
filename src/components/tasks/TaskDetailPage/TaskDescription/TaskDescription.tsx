import { Card, Text, Textarea } from '@mantine/core';
import { marked } from 'marked';
import { useMemo } from 'react';
import classes from './TaskDescription.module.css';

interface TaskDescriptionProps {
  value: string;
  canWriteTasks: boolean;
  onChange: (description: string) => void;
}

export function TaskDescription({ value, canWriteTasks, onChange }: TaskDescriptionProps) {
  const html = useMemo(
    () => (value?.trim() ? (marked.parse(value, { async: false }) as string) : ''),
    [value]
  );

  if (!canWriteTasks) {
    return (
      <Card withBorder mb="lg" className={classes.descriptionWrapper}>
        {html ? (
          <div className={classes.markdownBody} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <Text c="dimmed" size="sm" className={classes.emptyDescription}>
            No description.
          </Text>
        )}
      </Card>
    );
  }

  return (
    <Card withBorder mb="lg">
      <Textarea
        data-testid="task-description-input"
        minRows={8}
        autosize
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add a description…"
      />
    </Card>
  );
}
