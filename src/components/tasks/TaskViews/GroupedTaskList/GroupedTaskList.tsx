import { ActionIcon, Box, Group, Text, Tooltip } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconPlus } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { displayStatus, type Task, type TaskStatus } from '@/lib';
import { StatusIcon } from '../../StatusIcon/StatusIcon';
import { CompactTaskRow } from '../CompactTaskRow/CompactTaskRow';
import classes from './GroupedTaskList.module.css';

export interface GroupedTaskListProps {
  tasks: Task[];
  statuses: TaskStatus[];
  onAddTask: (statusId: string) => void;
  onOpenTask: (task: Task) => void;
  onMoveTask: (taskId: string, statusId: string) => void;
  onChanged: () => void;
  onError: (message: string) => void;
  canWriteTasks: boolean;
}

export function GroupedTaskList({
  tasks,
  statuses,
  onAddTask,
  onOpenTask,
  onMoveTask,
  onChanged,
  onError,
  canWriteTasks,
}: GroupedTaskListProps) {
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<string>>(() => new Set());
  const orderedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.position - b.position),
    [statuses]
  );

  const toggleStatus = (statusId: string) => {
    setCollapsedStatuses((current) => {
      const next = new Set(current);
      if (next.has(statusId)) {
        next.delete(statusId);
      } else {
        next.add(statusId);
      }
      return next;
    });
  };

  return (
    <Box className={classes.taskList}>
      {orderedStatuses.map((status) => {
        const meta = displayStatus(status);
        const groupTasks = tasks
          .filter((task) => task.statusId === status.id || task.status === status.name)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        const isCollapsed = collapsedStatuses.has(status.id);

        return (
          <section className={classes.statusSection} key={status.id}>
            <Group gap="sm" className={classes.statusHeading}>
              <Tooltip label={isCollapsed ? `Expand ${meta.label}` : `Collapse ${meta.label}`}>
                <ActionIcon
                  variant="subtle"
                  aria-label={isCollapsed ? `Expand ${meta.label}` : `Collapse ${meta.label}`}
                  onClick={() => toggleStatus(status.id)}
                >
                  {isCollapsed ? <IconChevronRight size="1rem" /> : <IconChevronDown size="1rem" />}
                </ActionIcon>
              </Tooltip>
              <Tooltip label={`Status: ${meta.label}`}>
                <Box
                  className={classes.statusPill}
                  style={{
                    background: meta.color,
                    color: meta.tone === 'mint' ? '#07110f' : '#fff',
                  }}
                >
                  <StatusIcon statusId={status.id} />
                  <span className={classes.statusPillName}>{meta.label}</span>
                </Box>
              </Tooltip>
              <Text c="dimmed" fw={700}>
                {groupTasks.length}
              </Text>
              {canWriteTasks && (
                <Tooltip label={`Create task in ${meta.label}`}>
                  <ActionIcon
                    variant="subtle"
                    aria-label={`Create task in ${meta.label}`}
                    onClick={() => onAddTask(status.id)}
                  >
                    <IconPlus size="1.25rem" />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
            {!isCollapsed && (
              <>
                <div className={classes.tableHead}>
                  {/*<Group gap="xs">*/}
                  <Text>Name</Text>
                  {/*<IconChevronDown size="1rem" className={classes.mutedIcon} />*/}
                  {/*</Group>*/}
                  <Text>Assignee</Text>
                  <Text>Due date</Text>
                  <Text>Priority</Text>
                  <Text>Updated</Text>
                </div>
                {groupTasks.map((task) => (
                  <CompactTaskRow
                    key={task.id}
                    task={task}
                    onOpen={onOpenTask}
                    onMove={(taskId) => void onMoveTask(taskId, status.id)}
                    onChanged={onChanged}
                    onError={onError}
                    canWriteTasks={canWriteTasks}
                  />
                ))}
                {canWriteTasks && (
                  <button
                    className={classes.addTask}
                    type="button"
                    onClick={() => onAddTask(status.id)}
                  >
                    <IconPlus size="1.125rem" />
                    Add Task
                  </button>
                )}
              </>
            )}
          </section>
        );
      })}
    </Box>
  );
}
