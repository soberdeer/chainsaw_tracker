import { useState } from "react";
import type { Task, TaskStatus } from "../../../../lib/types";
import { displayStatus } from "../../../../lib/taskUi";
import { ActionIcon, Badge, Box, Group, Text } from "@mantine/core";
import { IconChevronDown,  IconPlus } from "@tabler/icons-react";
import { CompactTaskRow } from "../CompactTaskRow/CompactTaskRow";
import classes from './GroupedTaskList.module.css';

export function GroupedTaskList({
  tasks,
  statuses,
  onAddTask,
  onOpenTask,
  // onMoveTask,
  onReorderTasks,
  onChanged,
  onError
}: {
  tasks: Task[];
  statuses: TaskStatus[];
  onAddTask: (statusId: string) => void;
  onOpenTask: (task: Task) => void;
  onMoveTask: (taskId: string, statusId: string) => void;
  onReorderTasks: (taskId: string, statusId: string, orderedTaskIds: string[]) => void;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  return (
    <Box className={classes.taskList}>
      {statuses.map((status) => {
        const meta = displayStatus(status);
        const groupTasks = tasks
          .filter((task) => task.statusId === status.id || task.status === status.name)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

        const reorderIntoGroup = (taskId: string, targetTaskId?: string) => {
          const withoutDragged = groupTasks.filter((task) => task.id !== taskId).map((task) => task.id);
          const targetIndex = targetTaskId ? withoutDragged.indexOf(targetTaskId) : -1;
          const nextIds = [...withoutDragged];
          nextIds.splice(targetIndex >= 0 ? targetIndex : nextIds.length, 0, taskId);
          onReorderTasks(taskId, status.id, nextIds);
        };

        return (
          <section
            className={classes.statusSection}
            key={status.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = draggedTaskId || event.dataTransfer.getData('text/task-id');
              if (taskId) reorderIntoGroup(taskId);
              setDraggedTaskId(null);
            }}
          >
            <Group gap="sm" className={classes.statusHeading}>
              <IconChevronDown size="1rem" className={classes.mutedIcon} />
              <Badge className={`${classes.statusBadge} ${classes[meta.tone as 'mint' | 'pink' | 'gray' | 'blue']}`}>{meta.label}</Badge>
              <Text c="dimmed" fw={700}>{groupTasks.length}</Text>
            </Group>
            <div className={classes.tableHead}>
              <Text>Name</Text>
              <Text>Assignee</Text>
              <Text>Due date</Text>
              <Text>Priority</Text>
              <Text>Updated</Text>
              <ActionIcon variant="subtle" className={classes.addColumn} aria-label="Add column"><IconPlus size="1.0625rem" /></ActionIcon>
            </div>
            {groupTasks.map((task) => (
              <CompactTaskRow
                key={task.id}
                task={task}
                onOpen={onOpenTask}
                onDragStart={(taskId) => setDraggedTaskId(taskId)}
                onDropOnTask={(targetTaskId) => {
                  const taskId = draggedTaskId;
                  if (taskId && taskId !== targetTaskId) reorderIntoGroup(taskId, targetTaskId);
                  setDraggedTaskId(null);
                }}
                onChanged={onChanged}
                onError={onError}
              />
            ))}
            <button className={classes.addTask} type="button" onClick={() => onAddTask(status.id)}><IconPlus size="1.125rem" />Add Task</button>
          </section>
        );
      })}
      <button className={classes.newStatus} type="button"><IconPlus size="1.125rem" />New status</button>
    </Box>
  );
}
