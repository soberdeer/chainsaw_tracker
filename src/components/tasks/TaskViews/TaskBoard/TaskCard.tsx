import { Badge, Box, Group, Text, Tooltip, UnstyledButton } from '@mantine/core';
import {
  IconCalendar,
  IconChecklist,
  IconGitPullRequest,
  IconGripVertical,
} from '@tabler/icons-react';
import type { Task } from '@/lib';
import { AvatarStack } from '../../../common/AvatarStack';
import classes from './TaskBoard.module.css';

interface TaskCardProps {
  task: Task;
  canWriteTasks: boolean;
  /** Task ID to insert before when dropping on the TOP half of this card. */
  topTarget: string | null;
  /** Task ID to insert before when dropping on the BOTTOM half (= after this card). */
  bottomTarget: string | null;
  statusId: string;
  onOpen: (task: Task) => void;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDrop: (statusId: string, target: string | null) => void;
}

function formatEstimate(hours?: number | null) {
  if (!hours || hours <= 0) return null;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function formatDueDate(dateStr?: string | null): { label: string; overdue: boolean } | null {
  if (!dateStr) return null;
  const due = new Date(dateStr);
  if (isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    label: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    overdue: due < today,
  };
}

function PullRequestBadge({ task }: { task: Task }) {
  const pullRequest = task.githubPullRequests?.[0];
  if (!pullRequest) return null;

  const label = pullRequest.isMerged
    ? 'Merged PR'
    : pullRequest.reviewStatus === 'APPROVED'
      ? 'Approved PR'
      : pullRequest.reviewStatus === 'CHANGES_REQUESTED'
        ? 'Changes requested'
        : pullRequest.draft
          ? 'Draft PR'
          : 'Open PR';
  const color = pullRequest.isMerged
    ? 'teal'
    : pullRequest.reviewStatus === 'APPROVED'
      ? 'green'
      : pullRequest.reviewStatus === 'CHANGES_REQUESTED'
        ? 'red'
        : 'blue';

  return (
    <Tooltip label={`${label}: #${pullRequest.number}`}>
      <Badge color={color} variant="light" leftSection={<IconGitPullRequest size="0.75rem" />}>
        PR
      </Badge>
    </Tooltip>
  );
}

export function TaskCard({
  task,
  canWriteTasks,
  topTarget,
  bottomTarget,
  statusId,
  onOpen,
  onDragStart,
  onDragEnd,
  onDrop,
}: TaskCardProps) {
  const estimate = formatEstimate(task.estimatedHours);
  const due = formatDueDate(task.dueDate);

  return (
    <UnstyledButton
      data-testid="task-card"
      data-task-id={task.id}
      className={classes.card}
      draggable={canWriteTasks}
      onDragStart={() => onDragStart(task.id)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (!canWriteTasks) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const isTop = event.clientY < rect.top + rect.height / 2;
        event.currentTarget.setAttribute('data-drop-half', isTop ? 'top' : 'bottom');
      }}
      onDragLeave={(event) => {
        event.currentTarget.removeAttribute('data-drop-half');
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!canWriteTasks) return;
        event.currentTarget.removeAttribute('data-drop-half');
        const rect = event.currentTarget.getBoundingClientRect();
        const isTop = event.clientY < rect.top + rect.height / 2;
        onDrop(statusId, isTop ? topTarget : bottomTarget);
      }}
      onClick={() => onOpen(task)}
    >
      <Group gap="xs" wrap="nowrap" align="flex-start">
        {canWriteTasks && (
          <Tooltip label="Drag to another status">
            <IconGripVertical size="1rem" className={classes.dragIcon} />
          </Tooltip>
        )}
        <Box className={classes.cardBody}>
          {task.taskKey && (
            <Text size="xs" c="dimmed" fw={700}>
              {task.taskKey}
            </Text>
          )}
          <Text size="sm" fw={700} lineClamp={3}>
            {task.title}
          </Text>
          {due && (
            <Tooltip label={`Due: ${task.dueDate}`}>
              <Group gap={4} mt={4}>
                <IconCalendar
                  size="0.75rem"
                  color={due.overdue ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-dimmed)'}
                />
                <Text size="xs" c={due.overdue ? 'red' : 'dimmed'} fw={due.overdue ? 700 : 400}>
                  {due.label}
                </Text>
              </Group>
            </Tooltip>
          )}
          <Group gap="xs" mt="xs" justify="space-between" wrap="nowrap">
            <Group gap="xs" style={{ flex: 1, flexWrap: 'wrap' }}>
              <Tooltip label={`Priority: ${task.priority}`}>
                <Badge variant="light">{task.priority}</Badge>
              </Tooltip>
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
                  <Badge
                    color="lime"
                    variant="light"
                    leftSection={<IconChecklist size="0.75rem" />}
                  >
                    {task.checklistSummary.completed}/{task.checklistSummary.total}
                  </Badge>
                </Tooltip>
              ) : null}
              {task.tags.slice(0, 2).map(({ tag }) => (
                <Tooltip key={tag.id} label={tag.name}>
                  <Badge variant="outline">{tag.name}</Badge>
                </Tooltip>
              ))}
              <PullRequestBadge task={task} />
            </Group>
            {task.assignees?.length ? (
              <AvatarStack users={task.assignees} size="1.5rem" max={3} />
            ) : null}
          </Group>
        </Box>
      </Group>
    </UnstyledButton>
  );
}
