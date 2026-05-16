import { Badge, Box, Group, Paper, Text, Tooltip } from '@mantine/core';
import { priorityColor, type Task } from '@/lib';
import { AvatarStack } from '../../../common/AvatarStack';
import { TaskActionsMenu } from '../TaskActionMenu/TaskActionMenu';
import classes from './KanbanCard.module.css';

export interface KanbanCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onDragStart: (taskId: string) => void;
  onDropOnTask: (targetTaskId: string) => void;
  onChanged: () => void;
  onError: (message: string) => void;
}

export function KanbanCard({
  task,
  onOpen,
  onDragStart,
  onDropOnTask,
  onChanged,
  onError,
}: KanbanCardProps) {
  return (
    <Paper
      className={classes.taskCard}
      withBorder
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/task-id', task.id);
        onDragStart(task.id);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDropOnTask(task.id);
      }}
      onClick={() => onOpen(task)}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text fw={650} size="sm">
          {task.title}
        </Text>
        <Group gap={4}>
          <Tooltip label={`Priority: ${task.priority}`}>
            <Badge size="xs" color={priorityColor[task.priority]}>
              {task.priority}
            </Badge>
          </Tooltip>
          <TaskActionsMenu task={task} onChanged={onChanged} onError={onError} />
        </Group>
      </Group>
      {task.description && (
        <Text size="xs" c="dimmed" lineClamp={2}>
          {task.description}
        </Text>
      )}
      <Group gap="xs">
        {task.taskKey && (
          <Tooltip label={`Task key: ${task.taskKey}`}>
            <Badge size="xs" variant="light">
              {task.taskKey}
            </Badge>
          </Tooltip>
        )}
        <Tooltip label={`Source: ${task.externalSource || 'LOCAL'}`}>
          <Badge size="xs" variant="light">
            {task.externalSource || 'LOCAL'}
          </Badge>
        </Tooltip>
      </Group>
      <Group justify="space-between" mt="sm">
        <Group gap={5}>
          {task.tags.map(({ tag }) => (
            <Tooltip key={tag.id} label={`Tag: ${tag.name}`}>
              <Box className={classes.tagDot} style={{ background: tag.color }} />
            </Tooltip>
          ))}
        </Group>
        {task.assignees?.length ? <AvatarStack users={task.assignees} size="1.5rem" /> : null}
      </Group>
    </Paper>
  );
}
