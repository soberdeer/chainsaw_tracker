import type { Task } from "../../../../lib/types";
import { priorityColor } from "../../../../lib/taskUi";
import { Avatar, Badge, Box, Group, Paper, Text } from "@mantine/core";
import { TaskActionsMenu } from "../TaskActionMenu/TaskActionMenu";
import classes from './KanbanCard.module.css';

export function KanbanCard({
  task,
  onOpen,
  onDragStart,
  onDropOnTask,
  onChanged,
  onError
}: {
  task: Task;
  onOpen: (task: Task) => void;
  onDragStart: (taskId: string) => void;
  onDropOnTask: (targetTaskId: string) => void;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
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
        <Text fw={650} size="sm">{task.title}</Text>
        <Group gap={4}>
          <Badge size="xs" color={priorityColor[task.priority]}>{task.priority}</Badge>
          <TaskActionsMenu task={task} onChanged={onChanged} onError={onError}/>
        </Group>
      </Group>
      {task.description && <Text size="xs" c="dimmed" lineClamp={2}>{task.description}</Text>}
      <Group gap="xs">
        {task.taskKey && <Badge size="xs" variant="light">{task.taskKey}</Badge>}
        <Badge size="xs" variant="light">{task.externalSource || 'LOCAL'}</Badge>
      </Group>
      <Group justify="space-between" mt="sm">
        <Group gap={5}>
          {task.tags.map(({ tag }) => <Box key={tag.id} className={classes.tagDot} style={{ background: tag.color }}/>)}
        </Group>
        {task.assignee && <Avatar size="1.5rem" radius="xl">{task.assignee.name.slice(0, 1)}</Avatar>}
      </Group>
    </Paper>
  );
}
