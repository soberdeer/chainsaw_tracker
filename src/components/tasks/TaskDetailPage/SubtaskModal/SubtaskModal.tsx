import { useEffect, useState } from 'react';
import { Button, Group, Modal, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core';
import { createTask, getTask } from '../../../../lib/api';
import type { Task, TaskPriority, TaskStatus } from '../../../../lib/types';
import { displayStatus, getErrorMessage } from '../../../../lib/taskUi';
import classes from './SubtaskModal.module.css';

export function SubtaskModal({
  opened,
  parentTask,
  statuses,
  onClose,
  onCreated,
  onError
}: {
  opened: boolean;
  parentTask: Task;
  statuses: TaskStatus[];
  onClose: () => void;
  onCreated: (task: Task) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusId, setStatusId] = useState(statuses[0]?.id || '');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      setTitle('');
      setDescription('');
      setStatusId(parentTask.statusId || statuses[0]?.id || '');
      setPriority(parentTask.priority || 'NORMAL');
      setStartDate('');
      setDueDate('');
      setGithubUrl('');
    }
  }, [opened, parentTask.id, parentTask.priority, parentTask.statusId, statuses]);

  const create = async () => {
    if (!parentTask.taskListId || !title.trim()) return;
    try {
      setSaving(true);
      await createTask({
        taskListId: parentTask.taskListId,
        parentId: parentTask.id,
        title: title.trim(),
        description,
        statusId: statusId || undefined,
        priority,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        githubUrl: githubUrl || undefined
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
    <Modal opened={opened} onClose={onClose} size="xl" title="Add subtask" centered classNames={{ content: classes.modalContent }}>
      <Stack>
        <TextInput label="Name" value={title} onChange={(event) => setTitle(event.currentTarget.value)} autoFocus />
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
          <TextInput label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.currentTarget.value)} />
          <TextInput label="Due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.currentTarget.value)} />
        </SimpleGrid>
        <TextInput label="GitHub URL" value={githubUrl} onChange={(event) => setGithubUrl(event.currentTarget.value)} placeholder="https://github.com/..." />
        <Textarea label="Description" minRows={7} autosize value={description} onChange={(event) => setDescription(event.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={!title.trim()} onClick={create}>Create subtask</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
