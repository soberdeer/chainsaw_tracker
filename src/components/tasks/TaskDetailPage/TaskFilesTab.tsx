import { Button, FileInput, Group, Paper, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPaperclip } from '@tabler/icons-react';
import {
  getErrorMessage,
  showToast,
  uploadTaskAttachment,
  type OpenProjectAttachmentItem,
} from '@/lib';

interface TaskFilesTabProps {
  taskId: string;
  attachments: OpenProjectAttachmentItem[];
  canWriteTasks: boolean;
  onAttachmentsRefresh: () => void;
  onError: (msg: string) => void;
}

export function TaskFilesTab({
  taskId,
  attachments,
  canWriteTasks,
  onAttachmentsRefresh,
  onError,
}: TaskFilesTabProps) {
  const form = useForm({ initialValues: { attachmentFile: null as File | null } });

  const submit = form.onSubmit(async (values) => {
    if (!canWriteTasks || !values.attachmentFile) return;
    try {
      await uploadTaskAttachment(taskId, values.attachmentFile);
      form.reset();
      onAttachmentsRefresh();
      showToast({
        tone: 'success',
        title: 'Attachment uploaded',
        message: 'File attached to the OpenProject task.',
      });
    } catch (error) {
      const message = getErrorMessage(error);
      onError(message);
      showToast({ tone: 'error', title: 'Could not upload attachment', message });
    }
  });

  return (
    <Stack>
      {canWriteTasks && (
        <Paper
          component="form"
          withBorder
          p="sm"
          onSubmit={submit}
          data-testid="task-attachments-form"
        >
          <Group align="end">
            <FileInput
              data-testid="task-attachment-input"
              label="Upload attachment"
              value={form.values.attachmentFile}
              onChange={(value) => form.setFieldValue('attachmentFile', value)}
              leftSection={<IconPaperclip size="1rem" />}
            />
            <Button
              data-testid="task-attachment-submit"
              loading={form.submitting}
              disabled={!form.values.attachmentFile}
              type="submit"
            >
              Upload
            </Button>
          </Group>
        </Paper>
      )}

      {attachments.map((attachment) => (
        <Paper key={attachment.id} withBorder p="sm">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={700}>{attachment.fileName}</Text>
              <Text size="sm" c="dimmed">
                {attachment.contentType || 'file'}
                {attachment.fileSize ? ` • ${Math.round(attachment.fileSize / 1024)} KB` : ''}
              </Text>
            </Stack>
            {attachment.downloadUrl && (
              <Button
                size="xs"
                variant="light"
                component="a"
                href={attachment.downloadUrl}
                target="_blank"
              >
                Open
              </Button>
            )}
          </Group>
        </Paper>
      ))}

      {!attachments.length && (
        <Text c="dimmed">
          No OpenProject attachments yet. Uploaded files stay on the work package after refresh.
        </Text>
      )}
    </Stack>
  );
}
