import {
  Button,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useRef, useState } from 'react';
import {
  createTask,
  getTask,
  displayStatus,
  getErrorMessage,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type User,
} from '@/lib';
import { UserSelect } from '../../../common/UserSelect';
import classes from './SubtaskModal.module.css';

export interface SubtaskModalProps {
  opened: boolean;
  parentTask: Task;
  statuses: TaskStatus[];
  users: User[];
  usersLoading?: boolean;
  onClose: () => void;
  onCreated: (task: Task) => void;
  onError: (message: string) => void;
}

export function SubtaskModal({
  opened,
  parentTask,
  statuses,
  users,
  usersLoading = false,
  onClose,
  onCreated,
  onError,
}: SubtaskModalProps) {
  const [saving, setSaving] = useState(false);
  const form = useForm({
    initialValues: {
      title: '',
      description: '',
      statusId: statuses[0]?.id || '',
      priority: 'NORMAL' as TaskPriority,
      assigneeIds: [] as string[],
      startDate: '',
      dueDate: '',
    },
    validate: {
      title: (value) => (value.trim().length ? null : 'Subtask name is required'),
    },
  });
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    if (opened) {
      formRef.current.setValues({
        title: '',
        description: '',
        statusId: parentTask.statusId || statuses[0]?.id || '',
        priority: parentTask.priority || 'NORMAL',
        assigneeIds: parentTask.assignee ? [parentTask.assignee.id] : [],
        startDate: '',
        dueDate: '',
      });
      formRef.current.resetDirty();
    }
  }, [
    opened,
    parentTask.id,
    parentTask.priority,
    parentTask.statusId,
    parentTask.assignee,
    statuses,
  ]);

  const create = form.onSubmit(async (values) => {
    if (!parentTask.taskListId || !values.title.trim()) {
      return;
    }
    try {
      setSaving(true);
      await createTask({
        taskListId: parentTask.taskListId,
        parentId: parentTask.id,
        title: values.title.trim(),
        description: values.description,
        statusId: values.statusId || undefined,
        priority: values.priority,
        assigneeIds: values.assigneeIds,
        startDate: values.startDate || undefined,
        dueDate: values.dueDate || undefined,
      });
      onCreated(await getTask(parentTask.id));
      onClose();
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      title="Add subtask"
      centered
      classNames={{ content: classes.modalContent }}
    >
      <form onSubmit={create}>
        <Stack>
          <TextInput label="Name" autoFocus {...form.getInputProps('title')} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Status"
              data={statuses.map((item) => ({ value: item.id, label: displayStatus(item).label }))}
              {...form.getInputProps('statusId')}
            />
            <Select
              label="Priority"
              data={['LOW', 'NORMAL', 'HIGH', 'URGENT']}
              {...form.getInputProps('priority')}
            />
            <UserSelect
              label="Assignee / responsible"
              users={users}
              loading={usersLoading}
              value={form.values.assigneeIds}
              onChange={(value) => form.setFieldValue('assigneeIds', value)}
              maxValues={2}
            />
            <TextInput label="Start date" type="date" {...form.getInputProps('startDate')} />
            <TextInput label="Due date" type="date" {...form.getInputProps('dueDate')} />
          </SimpleGrid>
          <Textarea
            label="Description"
            minRows={7}
            autosize
            {...form.getInputProps('description')}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={saving} type="submit">
              Create subtask
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
