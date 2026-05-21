import { ActionIcon, Badge, Checkbox, Text, Tooltip } from '@mantine/core';
import { IconCalendarDue, IconChevronRight, IconFlag, IconList } from '@tabler/icons-react';
import { useState } from 'react';
import { displayStatus, formatDueDate, type Task } from '@/lib';
import { AvatarStack } from '../../../common/AvatarStack';
import { StatusIcon } from '../../StatusIcon/StatusIcon';
import { TaskActionsMenu } from '../TaskActionMenu/TaskActionMenu';
import classes from './CompactTaskRow.module.css';

export interface CompactTaskRowProps {
  task: Task;
  onOpen: (task: Task) => void;
  onMove?: (taskId: string) => void;
  onChanged: () => void;
  onError: (message: string) => void;
  canWriteTasks: boolean;
  selected?: boolean;
  onSelectedChange?: (taskId: string, selected: boolean) => void;
}

export function CompactTaskRow({
  task,
  onOpen,
  onChanged,
  onError,
  canWriteTasks,
  selected,
  onSelectedChange,
}: CompactTaskRowProps) {
  const due = formatDueDate(task.dueDate);
  const isLate = due.includes('ago');
  const status = displayStatus(undefined, task.status);
  const [_, setShowSubtasks] = useState(false);

  const toggleSubtasks = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setShowSubtasks((s) => !s);
  };

  return (
    <div className={classes.taskRow}>
      <div className={classes.nameCell}>
        {onSelectedChange && (
          <Checkbox
            aria-label={`Select ${task.title}`}
            checked={Boolean(selected)}
            onChange={(event) => onSelectedChange(task.id, event.currentTarget.checked)}
          />
        )}
        {(task.subtasks?.length || 0) > 0 && (
          <Tooltip label="Expand subtasks">
            <ActionIcon onClick={toggleSubtasks}>
              <IconChevronRight size="0.875rem" className={classes.mutedIcon} />
            </ActionIcon>
          </Tooltip>
        )}

        <Tooltip label={`Status: ${status.label}`}>
          <StatusIcon statusId={task.status} color={status.color} />
        </Tooltip>
        <Text
          component="button"
          type="button"
          className={classes.taskTitle}
          fz="sm"
          fw="bold"
          onClick={() => onOpen(task)}
        >
          {task.title}
        </Text>
        {task.taskKey && (
          <Tooltip label={task.taskKey}>
            <Badge color="gray">{task.taskKey}</Badge>
          </Tooltip>
        )}
        <Tooltip label="Task list">
          <IconList size="1rem" className={classes.mutedIcon} />
        </Tooltip>
        {task.taskList?.name && (
          <Tooltip label={task.taskList.name}>
            <Badge color="blue">{task.taskList.name}</Badge>
          </Tooltip>
        )}
        {task.milestone?.title && (
          <Tooltip label={task.milestone.title}>
            <Badge color="grape">{task.milestone.title}</Badge>
          </Tooltip>
        )}
        {task.tags.map(({ tag }) => (
          <Tooltip key={tag.id} label={tag.name}>
            <Badge>{tag.name}</Badge>
          </Tooltip>
        ))}
      </div>
      <div className={classes.assigneeCell}>
        {task.assignees?.length ? (
          <AvatarStack users={task.assignees} />
        ) : (
          <Text c="dimmed">-</Text>
        )}
      </div>
      <Text className={isLate ? `${classes.dueCell} ${classes.lateDue}` : classes.dueCell}>
        {due || (
          <Tooltip label="No due date">
            <IconCalendarDue size="1.125rem" />
          </Tooltip>
        )}
      </Text>
      <div className={classes.priorityCell}>
        {task.priority === 'LOW' ? (
          <Tooltip label="Priority: LOW">
            <IconFlag size="1.1875rem" className={classes.mutedIcon} />
          </Tooltip>
        ) : (
          <>
            <Tooltip label={`Priority: ${task.priority}`}>
              <IconFlag size="1.1875rem" fill="#ff8787" color="#ff8787" />
            </Tooltip>{' '}
            {task.priority[0] + task.priority.slice(1).toLowerCase()}
          </>
        )}
      </div>
      <Text size="sm" c="dimmed">
        {task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : ''}
      </Text>
      <TaskActionsMenu
        task={task}
        onChanged={onChanged}
        onError={onError}
        canWriteTasks={canWriteTasks}
      />
    </div>
  );
}
