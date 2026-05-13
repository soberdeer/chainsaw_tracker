import { useState } from 'react';
import { ActionIcon, Avatar, Badge, Box, Button, Divider, Group, Menu, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconCalendarDue, IconChevronDown, IconChevronRight, IconDots, IconFlag, IconList, IconPlus } from '@tabler/icons-react';
import { createTask, deleteTask, duplicateTask, updateTask } from '../../lib/api';
import type { Task, TaskStatus } from '../../lib/types';
import { displayStatus, formatDueDate, getErrorMessage, priorityColor } from '../../lib/taskUi';

function TaskActionsMenu({ task, onChanged, onError }: { task: Task; onChanged: () => void; onError: (message: string) => void }) {
  const copyLink = async () => navigator.clipboard?.writeText(`${window.location.origin}/space/${task.folderId}/task/${task.id}`).catch(() => undefined);
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      onChanged();
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  return (
    <Menu width="22rem" position="bottom-end" shadow="lg">
      <Menu.Target>
        <ActionIcon variant="subtle" aria-label="Task menu" onClick={(event) => event.stopPropagation()} style={{marginLeft: '1.7rem'}}><IconDots size="1rem" /></ActionIcon>
      </Menu.Target>
      <Menu.Dropdown className="clickup-menu" onClick={(event) => event.stopPropagation()}>
        <Menu.Item onClick={copyLink}>Copy link</Menu.Item>
        <Menu.Item onClick={() => navigator.clipboard?.writeText(task.id)}>Copy ID</Menu.Item>
        <Menu.Item onClick={() => window.open(window.location.href, '_blank')}>New tab</Menu.Item>
        <Divider />
        <Menu.Item onClick={() => {
          const title = window.prompt('Task name', task.title);
          if (title) void run(() => updateTask(task.id, { title }));
        }}>Rename</Menu.Item>
        <Menu.Item onClick={() => void run(() => duplicateTask(task.id))}>Duplicate</Menu.Item>
        <Menu.Item onClick={() => void run(() => createTask({
          taskListId: task.taskListId || '',
          parentId: task.id,
          title: `${task.title}.01`,
          statusId: task.statusId,
          priority: task.priority
        }))}>Add subtask</Menu.Item>
        <Divider />
        <Menu.Item color="red" onClick={() => {
          if (window.confirm(`Delete "${task.title}"?`)) void run(() => deleteTask(task.id));
        }}>Delete</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function CompactTaskRow({
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
      className="cu-row"
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
      <div className="cu-name-cell">
        <IconChevronRight size="0.875rem" className="muted-icon" />
        <span className="cu-status-ring" style={{ borderColor: status.color }} />
        <Text className="cu-task-title">{task.title}</Text>
        {task.taskKey && <Badge className="cu-tag" color="gray">{task.taskKey}</Badge>}
        <Badge size="xs" variant="light">{task.externalSource || 'LOCAL'}</Badge>
        <IconList size="1rem" className="muted-icon" />
        {task.taskList?.name && <Badge className="cu-tag" color="blue">{task.taskList.name}</Badge>}
        {task.milestone?.title && <Badge className="cu-tag" color="grape">{task.milestone.title}</Badge>}
        {task.tags.map(({ tag }) => (
          <Badge key={tag.id} className="cu-tag" style={{ background: tag.color }}>{tag.name}</Badge>
        ))}
      </div>
      <div className="cu-assignee-cell">
        {task.assignee ? <Avatar size="2.125rem" radius="xl" color="brown">{task.assignee.name.slice(0, 1)}</Avatar> : <Text c="dimmed">-</Text>}
      </div>
      <div className={isLate ? 'cu-due-cell late' : 'cu-due-cell'}>{due || <IconCalendarDue size="1.125rem" />}</div>
      <div className="cu-priority-cell">
        {task.priority === 'LOW' ? <IconFlag size="1.1875rem" className="muted-icon" /> : <><IconFlag size="1.1875rem" fill="#ff8787" color="#ff8787" /> {task.priority[0] + task.priority.slice(1).toLowerCase()}</>}
      </div>
      <Text size="xs" c="dimmed">{task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : ''}</Text>
      <TaskActionsMenu task={task} onChanged={onChanged} onError={onError} />
    </div>
  );
}

export function GroupedTaskList({
  tasks,
  statuses,
  onAddTask,
  onOpenTask,
  onMoveTask,
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
    <Box className="cu-list">
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
            className="cu-status-section"
            key={status.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = draggedTaskId || event.dataTransfer.getData('text/task-id');
              if (taskId) reorderIntoGroup(taskId);
              setDraggedTaskId(null);
            }}
          >
            <Group gap="sm" className="cu-status-heading">
              <IconChevronDown size="1rem" className="muted-icon" />
              <Badge className={`cu-status-badge ${meta.tone}`}>{meta.label}</Badge>
              <Text c="dimmed" fw={700}>{groupTasks.length}</Text>
            </Group>
            <div className="cu-table-head">
              <Text>Name</Text>
              <Text>Assignee</Text>
              <Text>Due date</Text>
              <Text>Priority</Text>
              <Text>Updated</Text>
              <ActionIcon variant="subtle" className="cu-add-column" aria-label="Add column"><IconPlus size="1.0625rem" /></ActionIcon>
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
            <button className="cu-add-task" type="button" onClick={() => onAddTask(status.id)}><IconPlus size="1.125rem" />Add Task</button>
          </section>
        );
      })}
      <button className="cu-new-status" type="button"><IconPlus size="1.125rem" />New status</button>
    </Box>
  );
}

function KanbanCard({
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
      className="task-card"
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
          <TaskActionsMenu task={task} onChanged={onChanged} onError={onError} />
        </Group>
      </Group>
      {task.description && <Text size="xs" c="dimmed" lineClamp={2}>{task.description}</Text>}
      <Group gap="xs">
        {task.taskKey && <Badge size="xs" variant="light">{task.taskKey}</Badge>}
        <Badge size="xs" variant="light">{task.externalSource || 'LOCAL'}</Badge>
      </Group>
      <Group justify="space-between" mt="sm">
        <Group gap={5}>
          {task.tags.map(({ tag }) => <Box key={tag.id} className="tag-dot" style={{ background: tag.color }} />)}
        </Group>
        {task.assignee && <Avatar size="1.5rem" radius="xl">{task.assignee.name.slice(0, 1)}</Avatar>}
      </Group>
    </Paper>
  );
}

export function TaskBoard({
  tasks,
  statuses,
  onAddTask,
  onOpenTask,
  onMoveTask,
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
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
      {statuses.map((status) => {
        const meta = displayStatus(status);
        const columnTasks = tasks
          .filter((task) => task.statusId === status.id || task.status === status.name)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        const reorderIntoColumn = (taskId: string, targetTaskId?: string) => {
          const withoutDragged = columnTasks.filter((task) => task.id !== taskId).map((task) => task.id);
          const targetIndex = targetTaskId ? withoutDragged.indexOf(targetTaskId) : -1;
          const nextIds = [...withoutDragged];
          nextIds.splice(targetIndex >= 0 ? targetIndex : nextIds.length, 0, taskId);
          onReorderTasks(taskId, status.id, nextIds);
        };
        return (
          <Box
            className="kanban-column"
            key={status.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = draggedTaskId || event.dataTransfer.getData('text/task-id');
              if (taskId) reorderIntoColumn(taskId);
              setDraggedTaskId(null);
            }}
          >
            <Group justify="space-between" mb="sm">
              <Group gap="xs">
                <Box className="status-dot" style={{ background: meta.color }} />
                <Text fw={700}>{meta.label}</Text>
              </Group>
              <Badge variant="light">{columnTasks.length}</Badge>
            </Group>
            <Stack gap="sm">
              {columnTasks.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  onOpen={onOpenTask}
                  onDragStart={(taskId) => setDraggedTaskId(taskId)}
                  onDropOnTask={(targetTaskId) => {
                    const taskId = draggedTaskId;
                    if (taskId && taskId !== targetTaskId) reorderIntoColumn(taskId, targetTaskId);
                    setDraggedTaskId(null);
                  }}
                  onChanged={onChanged}
                  onError={onError}
                />
              ))}
              <Button variant="subtle" leftSection={<IconPlus size="1rem" />} onClick={() => onAddTask(status.id)}>Add Task</Button>
            </Stack>
          </Box>
        );
      })}
    </SimpleGrid>
  );
}
