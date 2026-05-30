import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCalendarDue, IconFlag, IconListCheck, IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import {
  createTask,
  displayStatus,
  getErrorMessage,
  showToast,
  type Task,
  type TaskList,
  type TaskPriority,
  type TaskStatus,
  type User,
} from '@/lib';
import { UserSelect } from '../../common/UserSelect';
import classes from './TaskCreateModal.module.css';

export interface TaskCreateModalProps {
  opened: boolean;
  taskList?: TaskList;
  statuses: TaskStatus[];
  users: User[];
  usersLoading?: boolean;
  initialStatusId?: string;
  onClose: () => void;
  onCreated: (task: Task) => void;
  onError: (message: string) => void;
}

export function TaskCreateModal({
  opened,
  taskList,
  statuses,
  users,
  usersLoading = false,
  initialStatusId,
  onClose,
  onCreated,
  onError,
}: TaskCreateModalProps) {
  const [saving, setSaving] = useState(false);
  const form = useForm({
    initialValues: {
      title: '',
      description: '',
      statusId: '',
      priority: 'NORMAL' as TaskPriority,
      assigneeIds: [] as string[],
      startDate: '',
      dueDate: '',
    },
    validate: {
      title: (value) => (value.trim().length ? null : 'Task title is required'),
    },
  });
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    if (!opened) {
      return;
    }
    formRef.current.setValues({
      title: '',
      description: '',
      statusId: initialStatusId || statuses[0]?.id || '',
      priority: 'NORMAL',
      assigneeIds: [],
      startDate: '',
      dueDate: '',
    });
    formRef.current.resetDirty();
  }, [opened, initialStatusId, statuses]);

  const submit = form.onSubmit(async (values) => {
    if (!taskList?.id || !values.title.trim()) {
      return;
    }
    try {
      setSaving(true);
      const task = await createTask({
        taskListId: taskList.id,
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        statusId: values.statusId || undefined,
        priority: values.priority,
        assigneeIds: values.assigneeIds,
        startDate: values.startDate || undefined,
        dueDate: values.dueDate || undefined,
      });
      onCreated(task as Task);
      showToast({
        tone: 'success',
        title: 'Task created',
        message: `${task.title} was created in OpenProject.`,
      });
      onClose();
    } catch (error) {
      const message = getErrorMessage(error);
      onError(message);
      showToast({
        tone: 'error',
        title: 'Could not create task',
        message,
      });
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="80rem"
      centered
      withCloseButton={false}
      data-testid="task-create-modal"
      classNames={{ content: classes.modalContent, body: classes.modalBody }}
    >
      <form onSubmit={submit}>
        <Stack gap={0}>
          <Group className={classes.header} justify="space-between">
            <Text className={classes.modalTitle}>Task</Text>
            <Tooltip label="Close task creator">
              <Button
                variant="subtle"
                className={classes.closeButton}
                onClick={onClose}
                aria-label="Close task creator"
              >
                <IconX size="1.25rem" />
              </Button>
            </Tooltip>
          </Group>

          <Stack gap="lg" className={classes.body}>
            <Group gap="sm">
              <Button variant="default" leftSection={<IconListCheck size="1rem" />}>
                {taskList?.name || 'Task list'}
              </Button>
              <Select
                {...form.getInputProps('statusId')}
                data={statuses.map((status) => ({
                  value: status.id,
                  label: displayStatus(status).label,
                }))}
                className={classes.statusSelect}
                leftSection={
                  <span
                    className={classes.statusDot}
                    style={{
                      background: displayStatus(
                        statuses.find((status) => status.id === form.values.statusId),
                        form.values.statusId
                      ).color,
                    }}
                  />
                }
              />
            </Group>

            <TextInput
              data-testid="task-create-title-input"
              placeholder="Task Name"
              classNames={{ input: classes.titleInput }}
              autoFocus
              {...form.getInputProps('title')}
            />

            <Textarea
              data-testid="task-create-description-input"
              placeholder="Add description"
              minRows={4}
              autosize
              classNames={{ input: classes.descriptionInput }}
              {...form.getInputProps('description')}
            />

            <Group gap="sm">
              <Select
                data-testid="task-create-status-select"
                {...form.getInputProps('statusId')}
                data={statuses.map((status) => ({
                  value: status.id,
                  label: displayStatus(status).label,
                }))}
                className={classes.compactField}
              />
              <UserSelect
                data-testid="task-create-assignee-select"
                placeholder="Assignee / responsible"
                users={users}
                loading={usersLoading}
                value={form.values.assigneeIds}
                onChange={(value) => form.setFieldValue('assigneeIds', value)}
                maxValues={2}
              />
              <TextInput
                data-testid="task-create-start-date-input"
                type="date"
                leftSection={<IconCalendarDue size="1rem" />}
                className={classes.dateField}
                aria-label="Start date"
                {...form.getInputProps('startDate')}
              />
              <TextInput
                data-testid="task-create-due-date-input"
                type="date"
                leftSection={<IconCalendarDue size="1rem" />}
                className={classes.dateField}
                aria-label="Due date"
                {...form.getInputProps('dueDate')}
              />
              <Select
                data-testid="task-create-priority-select"
                data={['LOW', 'NORMAL', 'HIGH', 'URGENT']}
                leftSection={<IconFlag size="1rem" />}
                className={classes.compactField}
                {...form.getInputProps('priority')}
              />
            </Group>

            <Alert color="blue" variant="light" title="OpenProject-backed fields">
              Custom field definitions are managed in OpenProject. Tags can be added right after
              creation from task detail without creating a duplicate local task.
            </Alert>
          </Stack>

          <Group className={classes.footer} justify="space-between">
            <Text size="sm" c="dimmed">
              OpenProject stores one assignee and one responsible user per task.
            </Text>
            <Button
              color="teal"
              size="lg"
              loading={saving}
              disabled={!taskList?.id}
              type="submit"
              data-testid="task-create-submit"
            >
              Create Task
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
