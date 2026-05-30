import { ActionIcon, Badge, Checkbox, Text, Tooltip } from '@mantine/core';
import {
  IconChevronRight,
  IconFlag,
  IconGitPullRequest,
  IconChecklist,
  IconGripVertical,
} from '@tabler/icons-react';
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
  isDraggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

function formatEstimate(hours?: number | null) {
  if (!hours || hours <= 0) {
    return null;
  }
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

export function CompactTaskRow({
  task,
  onOpen,
  onChanged,
  onError,
  canWriteTasks,
  selected,
  onSelectedChange,
  isDraggable,
  onDragStart,
  onDragEnd,
}: CompactTaskRowProps) {
  const due = formatDueDate(task.dueDate);
  const isLate = due.includes('ago');
  const status = displayStatus(undefined, task.status);
  const estimate = formatEstimate(task.estimatedHours);
  const [_, setShowSubtasks] = useState(false);

  const toggleSubtasks = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setShowSubtasks((s) => !s);
  };

  return (
    <div
      className={classes.taskRow}
      data-testid="task-row"
      data-task-id={task.id}
      draggable={Boolean(isDraggable)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className={classes.nameCell}>
        {canWriteTasks && <IconGripVertical size="1rem" className={classes.dragHandle} />}
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
          <StatusIcon type={status.type} tone={status.tone} />
        </Tooltip>
        <Text
          data-testid="task-row-open"
          component="button"
          type="button"
          className={classes.taskTitle}
          fz="sm"
          fw="bold"
          onClick={() => onOpen(task)}
        >
          {task.title}
        </Text>
        {task.milestone?.title && (
          <Tooltip label={task.milestone.title}>
            <Badge color="grape">{task.milestone.title}</Badge>
          </Tooltip>
        )}
        {estimate && (
          <Tooltip label={`Estimate: ${estimate}`}>
            <Badge color="cyan" variant="light">
              {estimate}
            </Badge>
          </Tooltip>
        )}
        {task.checklistSummary?.total ? (
          <Tooltip
            label={`Checklist progress: ${task.checklistSummary.completed}/${task.checklistSummary.total}`}
          >
            <Badge color="lime" variant="light" leftSection={<IconChecklist size="0.75rem" />}>
              {task.checklistSummary.completed}/{task.checklistSummary.total}
            </Badge>
          </Tooltip>
        ) : null}
        {task.tags.map(({ tag }) => (
          <Tooltip key={tag.id} label={tag.name}>
            <Badge>{tag.name}</Badge>
          </Tooltip>
        ))}
        {task.githubPullRequests?.[0] && (
          <Tooltip
            label={`GitHub PR #${task.githubPullRequests[0].number}: ${task.githubPullRequests[0].reviewStatus}`}
          >
            <Badge
              color={
                task.githubPullRequests[0].isMerged
                  ? 'teal'
                  : task.githubPullRequests[0].reviewStatus === 'APPROVED'
                    ? 'green'
                    : task.githubPullRequests[0].reviewStatus === 'CHANGES_REQUESTED'
                      ? 'red'
                      : 'blue'
              }
              leftSection={<IconGitPullRequest size="0.75rem" />}
            >
              PR
            </Badge>
          </Tooltip>
        )}
      </div>
      <div className={classes.assigneeCell}>
        {task.assignees?.length ? (
          <AvatarStack users={task.assignees} />
        ) : (
          <Text c="dimmed">-</Text>
        )}
      </div>
      <Text className={isLate ? `${classes.dueCell} ${classes.lateDue}` : classes.dueCell}>
        {due || <Tooltip label="No due date">-</Tooltip>}
      </Text>
      <div className={classes.priorityCell}>
        {!task.priority ? (
          <Tooltip label="No priority">
            <IconFlag size="1.1875rem" className={classes.mutedIcon} />
          </Tooltip>
        ) : task.priority === 'LOW' ? (
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
