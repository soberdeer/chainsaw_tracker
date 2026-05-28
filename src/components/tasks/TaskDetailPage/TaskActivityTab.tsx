import { Button, Group, Paper, Stack, Text, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { addTaskComment, getErrorMessage, showToast, type ActivityLog } from '@/lib';

interface TaskActivityTabProps {
  taskId: string;
  activity: ActivityLog[];
  canWriteTasks: boolean;
  onActivityRefresh: () => void;
  onError: (msg: string) => void;
}

export function TaskActivityTab({
  taskId,
  activity,
  canWriteTasks,
  onActivityRefresh,
  onError,
}: TaskActivityTabProps) {
  const form = useForm({ initialValues: { comment: '' } });

  const submit = form.onSubmit(async (values) => {
    if (!canWriteTasks || !values.comment.trim()) return;
    try {
      await addTaskComment(taskId, values.comment.trim());
      form.reset();
      onActivityRefresh();
      showToast({
        tone: 'success',
        title: 'Comment posted',
        message: 'Saved in OpenProject activity.',
      });
    } catch (error) {
      const message = getErrorMessage(error);
      onError(message);
      showToast({ tone: 'error', title: 'Could not post comment', message });
    }
  });

  return (
    <Stack gap="xs">
      {canWriteTasks && (
        <Paper component="form" withBorder p="sm" onSubmit={submit} data-testid="task-comment-form">
          <Textarea
            data-testid="task-comment-input"
            label="Add OpenProject comment"
            minRows={3}
            autosize
            {...form.getInputProps('comment')}
          />
          <Group justify="flex-end" mt="sm">
            <Button
              data-testid="task-comment-submit"
              loading={form.submitting}
              disabled={!form.values.comment.trim()}
              type="submit"
            >
              Add comment
            </Button>
          </Group>
        </Paper>
      )}
      {activity.map((item) => (
        <Paper key={item.id} withBorder p="sm">
          <Group justify="space-between">
            <Text fw={700}>{item.type}</Text>
            <Text size="xs" c="dimmed">
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </Group>
          {item.message && (
            <Text size="sm" c="dimmed">
              {item.message}
            </Text>
          )}
          {(item.previousValue || item.nextValue) && (
            <Text size="xs" c="dimmed">
              {item.previousValue || '-'} → {item.nextValue || '-'}
            </Text>
          )}
        </Paper>
      ))}
      {!activity.length && (
        <Text c="dimmed">
          No OpenProject activity yet. Comments and field changes will appear here after the first
          update.
        </Text>
      )}
    </Stack>
  );
}
