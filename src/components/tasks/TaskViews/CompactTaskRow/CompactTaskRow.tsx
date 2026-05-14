import type { Task } from "../../../../lib/types";
import { displayStatus, formatDueDate } from "../../../../lib/taskUi";
import { Avatar, Badge, Text } from "@mantine/core";
import { IconCalendarDue, IconChevronRight, IconFlag, IconList } from "@tabler/icons-react";
import { TaskActionsMenu } from "../TaskActionMenu/TaskActionMenu";
import classes from './CompactTaskRow.module.css';

export function CompactTaskRow({
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
  const due = formatDueDate(task.dueDate);
  const isLate = due.includes('ago');
  const status = displayStatus(undefined, task.status);

  return (
    <div
      className={classes.taskRow}
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
      <div className={classes.nameCell}>
        <IconChevronRight size="0.875rem" className={classes.mutedIcon} />
        <span className={classes.statusRing} style={{ borderColor: status.color }} />
        <Text className={classes.taskTitle}>{task.title}</Text>
        {task.taskKey && <Badge className={classes.tagBadge} color="gray">{task.taskKey}</Badge>}
        <Badge size="xs" variant="light">{task.externalSource || 'LOCAL'}</Badge>
        <IconList size="1rem" className={classes.mutedIcon} />
        {task.taskList?.name && <Badge className={classes.tagBadge} color="blue">{task.taskList.name}</Badge>}
        {task.milestone?.title && <Badge className={classes.tagBadge} color="grape">{task.milestone.title}</Badge>}
        {task.tags.map(({ tag }) => (
          <Badge key={tag.id} className={classes.tagBadge} style={{ background: tag.color }}>{tag.name}</Badge>
        ))}
      </div>
      <div className={classes.assigneeCell}>
        {task.assignee ? <Avatar size="2.125rem" radius="xl" color="brown">{task.assignee.name.slice(0, 1)}</Avatar> : <Text c="dimmed">-</Text>}
      </div>
      <div className={isLate ? `${classes.dueCell} ${classes.lateDue}` : classes.dueCell}>{due || <IconCalendarDue size="1.125rem" />}</div>
      <div className={classes.priorityCell}>
        {task.priority === 'LOW' ? <IconFlag size="1.1875rem" className={classes.mutedIcon} /> : <><IconFlag size="1.1875rem" fill="#ff8787" color="#ff8787" /> {task.priority[0] + task.priority.slice(1).toLowerCase()}</>}
      </div>
      <Text size="xs" c="dimmed">{task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : ''}</Text>
      <TaskActionsMenu task={task} onChanged={onChanged} onError={onError} />
    </div>
  );
}
