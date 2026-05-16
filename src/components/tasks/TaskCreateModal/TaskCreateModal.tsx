import {
  Button,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconCalendarDue,
  IconFlag,
  IconListCheck,
  IconTag,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import {
  createTask,
  displayStatus,
  getErrorMessage,
  type Task,
  type TaskList,
  type TaskPriority,
  type TaskStatus,
  type User,
} from '@/lib';
import classes from './TaskCreateModal.module.css';

export interface TaskCreateModalProps {
  opened: boolean;
  taskList?: TaskList;
  statuses: TaskStatus[];
  users: User[];
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
  initialStatusId,
  onClose,
  onCreated,
  onError,
}: TaskCreateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusId, setStatusId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) {
      return;
    }
    setTitle('');
    setDescription('');
    setStatusId(initialStatusId || statuses[0]?.id || '');
    setPriority('NORMAL');
    setAssigneeIds([]);
    setDueDate('');
  }, [opened, initialStatusId, statuses]);

  const submit = async () => {
    if (!taskList?.id || !title.trim()) {
      return;
    }
    try {
      setSaving(true);
      const task = await createTask({
        taskListId: taskList.id,
        title: title.trim(),
        description: description.trim() || undefined,
        statusId: statusId || undefined,
        priority,
        assigneeIds,
        dueDate: dueDate || undefined,
      });
      onCreated(task as Task);
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
      size="80rem"
      centered
      withCloseButton={false}
      classNames={{ content: classes.modalContent, body: classes.modalBody }}
    >
      <Stack gap={0}>
        <Group className={classes.header} justify="space-between">
          <Tabs defaultValue="task" className={classes.tabs}>
            <Tabs.List>
              <Tabs.Tab value="task">Task</Tabs.Tab>
              <Tabs.Tab value="doc" disabled>
                Doc
              </Tabs.Tab>
              <Tabs.Tab value="reminder" disabled>
                Reminder
              </Tabs.Tab>
              <Tabs.Tab value="whiteboard" disabled>
                Whiteboard
              </Tabs.Tab>
              <Tabs.Tab value="dashboard" disabled>
                Dashboard
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>
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
              value={statusId}
              onChange={(value) => setStatusId(value || '')}
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
                      statuses.find((status) => status.id === statusId),
                      statusId
                    ).color,
                  }}
                />
              }
            />
          </Group>

          <TextInput
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder="Task Name or type '/' for commands"
            classNames={{ input: classes.titleInput }}
            autoFocus
          />

          <Textarea
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            placeholder="Add description"
            minRows={4}
            autosize
            classNames={{ input: classes.descriptionInput }}
          />

          <Group gap="sm">
            <Select
              value={statusId}
              onChange={(value) => setStatusId(value || '')}
              data={statuses.map((status) => ({
                value: status.id,
                label: displayStatus(status).label,
              }))}
              className={classes.compactField}
            />
            <MultiSelect
              placeholder="Assignee"
              leftSection={<IconUsers size="1rem" />}
              value={assigneeIds}
              onChange={setAssigneeIds}
              data={users.map((user) => ({ value: user.id, label: user.name }))}
              searchable
              clearable
              className={classes.wideField}
            />
            <TextInput
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.currentTarget.value)}
              leftSection={<IconCalendarDue size="1rem" />}
              className={classes.dateField}
            />
            <Select
              value={priority}
              onChange={(value) => setPriority((value || 'NORMAL') as TaskPriority)}
              data={['LOW', 'NORMAL', 'HIGH', 'URGENT']}
              leftSection={<IconFlag size="1rem" />}
              className={classes.compactField}
            />
            <Tooltip label="Tags are read from ClickUp after task creation">
              <Button variant="default" leftSection={<IconTag size="1rem" />} disabled>
                Tags
              </Button>
            </Tooltip>
          </Group>

          <Stack gap="sm">
            <Text c="dimmed" fw={700}>
              Fields
            </Text>
            <Tooltip label="Custom fields are managed in ClickUp">
              <span>
                <Button variant="light" disabled>
                  + Create new field
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        <Group className={classes.footer} justify="space-between">
          <Tooltip label="Templates are managed in ClickUp">
            <span>
              <Button variant="default" disabled>
                Templates
              </Button>
            </span>
          </Tooltip>
          <Button
            color="teal"
            size="lg"
            loading={saving}
            disabled={!title.trim() || !taskList?.id}
            onClick={submit}
          >
            Create Task
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
