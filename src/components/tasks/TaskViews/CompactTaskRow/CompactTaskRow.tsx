import { ActionIcon, Badge, Box, Group, Text, Tooltip } from '@mantine/core';
import {
  IconChevronRight,
  IconGitPullRequest,
  IconChecklist,
  IconGripVertical,
} from '@tabler/icons-react';
import { useState } from 'react';
import { Priority } from '@/components/common/Priority/Priority';
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
  /** Visual indentation depth for nested subtasks (0 = top-level) */
  depth?: number;
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
  selected: _selected,
  onSelectedChange: _onSelectedChange,
  isDraggable,
  onDragStart,
  onDragEnd,
  depth = 0,
}: CompactTaskRowProps) {
  const due = formatDueDate(task.dueDate);
  const isLate = due.includes('ago');
  const status = displayStatus(undefined, task.status);
  const estimate = formatEstimate(task.estimatedHours);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const hasSubtasks = (task.subtasks?.length ?? 0) > 0;

  const toggleSubtasks = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowSubtasks((s) => !s);
  };

  return (
    <div data-task-id={task.id} data-testid="task-row-wrapper">
      {/* ── Main row ─────────────────────────────────────────────────────── */}
      <div
        className={classes.taskRow}
        data-testid="task-row"
        data-depth={depth}
        style={
          depth > 0
            ? { paddingLeft: `calc(2.375rem * var(--mantine-scale) + ${depth * 2 + 2}rem)` }
            : undefined
        }
        draggable={Boolean(isDraggable)}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className={classes.nameCell}>
          <Group gap={0}>
            {canWriteTasks && !task.parentId && (
              <IconGripVertical size="1rem" className={classes.dragHandle} />
            )}
            <Box style={{ width: 20 }} />
            {/*{onSelectedChange && (*/}
            {/*  <Checkbox*/}
            {/*    aria-label={`Select ${task.title}`}*/}
            {/*    checked={Boolean(selected)}*/}
            {/*    className={classes.checkbox}*/}
            {/*    onChange={(event) => onSelectedChange(task.id, event.currentTarget.checked)}*/}
            {/*  />*/}
            {/*)}*/}
          </Group>

          {hasSubtasks ? (
            <Tooltip label={showSubtasks ? 'Collapse subtasks' : 'Expand subtasks'}>
              <ActionIcon
                onClick={toggleSubtasks}
                variant="transparent"
                aria-label={showSubtasks ? 'Collapse subtasks' : 'Expand subtasks'}
              >
                <IconChevronRight
                  className={classes.mutedIcon}
                  style={{
                    transition: 'transform 150ms ease',
                    transform: showSubtasks ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Box style={{ width: 28, height: 28 }} />
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
            fw={depth === 0 ? 'bold' : 'normal'}
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
          {task.tags.map(({ tag }) =>
            tag.theme ? (
              <Badge key={tag.id} variant="light" size="sm" color={tag.theme}>
                {tag.name}
              </Badge>
            ) : (
              <Badge
                key={tag.id}
                variant="light"
                size="sm"
                style={{
                  backgroundColor: `${tag.color}22`,
                  color: tag.color,
                  borderColor: `${tag.color}55`,
                  border: '1px solid',
                  fontWeight: 500,
                }}
              >
                {tag.name}
              </Badge>
            )
          )}
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
          {due || (
            <Tooltip label="No due date">
              <Text component="span">-</Text>
            </Tooltip>
          )}
        </Text>
        <div className={classes.priorityCell}>
          <Priority priority={task.priority} />
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

      {showSubtasks && hasSubtasks && (
        <div className={classes.subtasksContainer}>
          {task.subtasks!.map((subtask) => (
            <CompactTaskRow
              key={subtask.id}
              task={subtask}
              onOpen={onOpen}
              onChanged={onChanged}
              onError={onError}
              canWriteTasks={canWriteTasks}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
