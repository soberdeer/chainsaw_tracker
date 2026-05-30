import { Badge, Button, Group, Paper, Text, Title, Tooltip, UnstyledButton } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import {
  displayStatus,
  formatDueDate,
  priorityColor,
  type Task,
  type TaskStatus,
  type User,
} from '@/lib';
import { AvatarStack } from '../../common/AvatarStack';
import { SubtaskModal } from './SubtaskModal/SubtaskModal';
import classes from './TaskDetailPage.module.css';

interface TaskSubtasksTabProps {
  task: Task;
  statuses: TaskStatus[];
  users: User[];
  usersLoading: boolean;
  canWriteTasks: boolean;
  onSaved: (task: Task) => void;
  onOpenSubtask: (task: Task) => void;
  onError: (msg: string) => void;
}

export function TaskSubtasksTab({
  task,
  statuses,
  users,
  usersLoading,
  canWriteTasks,
  onSaved,
  onOpenSubtask,
  onError,
}: TaskSubtasksTabProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <Paper withBorder className={classes.subtaskTable}>
      <SubtaskModal
        opened={modalOpen}
        parentTask={task}
        statuses={statuses}
        users={users}
        usersLoading={usersLoading}
        onClose={() => setModalOpen(false)}
        onCreated={onSaved}
        onError={onError}
      />

      <Group justify="space-between" p="md">
        <Group>
          <Title order={4}>Subtasks</Title>
          <Tooltip label={`${task.subtasks?.length || 0} subtasks`}>
            <Badge variant="light">{task.subtasks?.length || 0}</Badge>
          </Tooltip>
        </Group>
        {canWriteTasks && (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size="0.875rem" />}
            onClick={() => setModalOpen(true)}
          >
            Add subtask
          </Button>
        )}
      </Group>

      <div className={classes.subtaskHead}>
        <Text>Name</Text>
        <Text>Assignee</Text>
        <Text>Priority</Text>
        <Text>Due date</Text>
      </div>

      {(task.subtasks || []).map((subtask) => (
        <UnstyledButton
          key={subtask.id}
          className={classes.subtaskRow}
          data-testid="subtask-row"
          data-task-id={subtask.id}
          onClick={() => onOpenSubtask(subtask)}
        >
          <Group gap="sm" wrap="nowrap">
            <span
              className={classes.statusRing}
              style={{ borderColor: displayStatus(undefined, subtask.status).color }}
            />
            <Text fw={700}>{subtask.title}</Text>
          </Group>
          <span>
            {subtask.assignees?.length ? (
              <AvatarStack users={subtask.assignees} size="1.625rem" max={3} />
            ) : (
              <Text c="dimmed">-</Text>
            )}
          </span>
          <Tooltip label={subtask.priority ? `Priority: ${subtask.priority}` : 'No priority'}>
            <Badge color={priorityColor(subtask.priority)} variant="light">
              {subtask.priority ?? '–'}
            </Badge>
          </Tooltip>
          <Text c={formatDueDate(subtask.dueDate).includes('ago') ? 'red' : 'dimmed'}>
            {formatDueDate(subtask.dueDate) || '-'}
          </Text>
        </UnstyledButton>
      ))}

      {!task.subtasks?.length && (
        <UnstyledButton className={classes.addTask} onClick={() => setModalOpen(true)}>
          <IconPlus size="1.125rem" />
          Add Task
        </UnstyledButton>
      )}
    </Paper>
  );
}
