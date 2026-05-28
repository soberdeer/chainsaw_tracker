import {
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconClock } from '@tabler/icons-react';
import { useEffect } from 'react';
import {
  addTaskTimeEntry,
  getErrorMessage,
  showToast,
  toDateInput,
  type OpenProjectTimeEntryActivityOption,
  type OpenProjectTimeEntryItem,
} from '@/lib';

interface TaskTimeTabProps {
  taskId: string;
  timeEntries: OpenProjectTimeEntryItem[];
  totalHours: number;
  timeEntryActivities: OpenProjectTimeEntryActivityOption[];
  timeActivitiesError: string | null;
  defaultActivityId: string;
  canWriteTasks: boolean;
  onTimeRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

export function TaskTimeTab({
  taskId,
  timeEntries,
  totalHours,
  timeEntryActivities,
  timeActivitiesError,
  defaultActivityId,
  canWriteTasks,
  onTimeRefresh,
  onError,
}: TaskTimeTabProps) {
  const form = useForm({
    initialValues: {
      timeHours: 1 as number | string,
      timeSpentOn: toDateInput(new Date().toISOString()),
      timeComment: '',
      timeActivityId: defaultActivityId,
    },
    validate: {
      timeHours: (value) => (Number(value) > 0 ? null : 'Hours must be greater than zero'),
      timeSpentOn: (value) => (value ? null : 'Spent on date is required'),
      timeActivityId: (value) => (value ? null : 'Activity is required'),
    },
  });

  // When the activity list loads (or when a single activity is available), pre-select it.
  useEffect(() => {
    if (defaultActivityId && !form.values.timeActivityId) {
      form.setFieldValue('timeActivityId', defaultActivityId);
    }
  }, [defaultActivityId]);

  const submit = form.onSubmit(async (values) => {
    if (!canWriteTasks || !Number(values.timeHours) || !values.timeSpentOn) return;
    try {
      await addTaskTimeEntry(taskId, {
        hours: Number(values.timeHours),
        spentOn: values.timeSpentOn,
        comment: values.timeComment,
        activityId: values.timeActivityId,
      });
      form.setValues({
        timeHours: 1,
        timeSpentOn: toDateInput(new Date().toISOString()),
        timeComment: '',
        timeActivityId:
          timeEntryActivities.length === 1
            ? (timeEntryActivities[0]?.id ?? '')
            : values.timeActivityId,
      });
      await onTimeRefresh();
      showToast({
        tone: 'success',
        title: 'Time logged',
        message: 'OpenProject time entry created.',
      });
    } catch (error) {
      const message = getErrorMessage(error);
      onError(message);
      showToast({ tone: 'error', title: 'Could not log time', message });
    }
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>Time entries</Title>
        <Tooltip label={`${totalHours.toFixed(2)} hours logged`}>
          <Badge leftSection={<IconClock size="0.875rem" />}>{totalHours.toFixed(2)}h</Badge>
        </Tooltip>
      </Group>

      {canWriteTasks && (
        <Paper component="form" withBorder p="sm" onSubmit={submit} data-testid="task-time-form">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
            <NumberInput
              data-testid="task-time-hours-input"
              label="Hours"
              min={0.01}
              step={0.25}
              value={form.values.timeHours}
              onChange={(value) => form.setFieldValue('timeHours', value)}
            />
            <TextInput
              data-testid="task-time-date-input"
              label="Spent on"
              type="date"
              value={form.values.timeSpentOn}
              onChange={(event) => form.setFieldValue('timeSpentOn', event.currentTarget.value)}
            />
            <Select
              data-testid="task-time-activity-select"
              label="Activity"
              value={form.values.timeActivityId}
              onChange={(value) => form.setFieldValue('timeActivityId', value || '')}
              data={timeEntryActivities.map((a) => ({ value: a.id, label: a.name }))}
              disabled={!timeEntryActivities.length || Boolean(timeActivitiesError)}
              error={form.errors.timeActivityId}
              placeholder={
                timeActivitiesError
                  ? 'Could not load activities'
                  : timeEntryActivities.length === 1
                    ? (timeEntryActivities[0]?.name ?? 'Activity')
                    : 'Select activity'
              }
            />
            <TextInput
              data-testid="task-time-comment-input"
              label="Comment"
              {...form.getInputProps('timeComment')}
            />
            <Stack justify="flex-end">
              <Button loading={form.submitting} type="submit" data-testid="task-time-submit">
                Log time
              </Button>
            </Stack>
          </SimpleGrid>
          {timeActivitiesError && (
            <Alert color="red" variant="light" mt="sm">
              {timeActivitiesError}
            </Alert>
          )}
        </Paper>
      )}

      {timeEntries.map((entry) => (
        <Paper key={entry.id} withBorder p="sm">
          <Group justify="space-between">
            <Text fw={700}>{entry.hours}h</Text>
            <Text size="sm" c="dimmed">
              {entry.spentOn || '-'} {entry.user ? `• ${entry.user.name}` : ''}
            </Text>
          </Group>
          {entry.comment && <Text size="sm">{entry.comment}</Text>}
        </Paper>
      ))}

      {!timeEntries.length && (
        <Text c="dimmed">
          No OpenProject time entries yet. Logged time will appear here after the first entry is
          saved.
        </Text>
      )}
    </Stack>
  );
}
