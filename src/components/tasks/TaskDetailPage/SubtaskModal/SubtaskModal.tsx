import {
  Button,
  Group,
  Modal,
  MultiSelect,
  Select,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useEffect, useState } from 'react';
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
import classes from './SubtaskModal.module.css';

export interface SubtaskModalProps {
  opened: boolean;
  parentTask: Task;
  statuses: TaskStatus[];
  users: User[];
  onClose: () => void;
  onCreated: (task: Task) => void;
  onError: (message: string) => void;
}

export function SubtaskModal({
  opened,
  parentTask,
  statuses,
  users,
  onClose,
  onCreated,
  onError,
}: SubtaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusId, setStatusId] = useState(statuses[0]?.id || '');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      setTitle('');
      setDescription('');
      setStatusId(parentTask.statusId || statuses[0]?.id || '');
      setPriority(parentTask.priority || 'NORMAL');
      setAssigneeIds(parentTask.assignees?.map((user) => user.id) || []);
      setStartDate('');
      setDueDate('');
    }
  }, [
    opened,
    parentTask.id,
    parentTask.priority,
    parentTask.statusId,
    parentTask.assignees,
    statuses,
  ]);

  const create = async () => {
    if (!parentTask.taskListId || !title.trim()) {
      return;
    }
    try {
      setSaving(true);
      await createTask({
        taskListId: parentTask.taskListId,
        parentId: parentTask.id,
        title: title.trim(),
        description,
        statusId: statusId || undefined,
        priority,
        assigneeIds,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
      });
      onCreated(await getTask(parentTask.id));
      onClose();
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      title="Add subtask"
      centered
      classNames={{ content: classes.modalContent }}
    >
      <Stack>
        <TextInput
          label="Name"
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
          autoFocus
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Status"
            value={statusId}
            onChange={(value) => setStatusId(value || '')}
            data={statuses.map((item) => ({ value: item.id, label: displayStatus(item).label }))}
          />
          <Select
            label="Priority"
            value={priority}
            onChange={(value) => setPriority((value || 'NORMAL') as TaskPriority)}
            data={['LOW', 'NORMAL', 'HIGH', 'URGENT']}
          />
          <MultiSelect
            label="Assignee / responsible"
            value={assigneeIds}
            onChange={setAssigneeIds}
            data={users.map((user) => ({ value: user.id, label: user.name }))}
            searchable
            clearable
            maxValues={2}
          />
          <TextInput
            label="Start date"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.currentTarget.value)}
          />
          <TextInput
            label="Due date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.currentTarget.value)}
          />
        </SimpleGrid>
        <Textarea
          label="Description"
          minRows={7}
          autosize
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} disabled={!title.trim()} onClick={create}>
            Create subtask
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
