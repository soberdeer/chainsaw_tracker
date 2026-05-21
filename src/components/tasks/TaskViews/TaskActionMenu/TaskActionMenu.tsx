import { ActionIcon, Divider, Menu, Tooltip } from '@mantine/core';
import { IconDots } from '@tabler/icons-react';
import {
  createTask,
  deleteTask,
  duplicateTask,
  updateTask,
  getErrorMessage,
  type Task,
} from '@/lib';
import { confirmAction, promptForText } from '@/lib/modals';
import classes from './TaskActionMenu.module.css';

export interface TaskActionMenuProps {
  task: Task;
  onChanged: () => void;
  onError: (message: string) => void;
  canWriteTasks: boolean;
}

export function TaskActionsMenu({ task, onChanged, onError, canWriteTasks }: TaskActionMenuProps) {
  const copyLink = async () =>
    navigator.clipboard
      ?.writeText(`${window.location.origin}/space/${task.folderId}/task/${task.id}`)
      .catch(() => undefined);
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
        <Tooltip label="Task actions">
          <ActionIcon
            variant="subtle"
            aria-label="Task actions"
            className={classes.menuButton}
            onClick={(event) => event.stopPropagation()}
          >
            <IconDots size="1rem" />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown className={classes.menuDropdown} onClick={(event) => event.stopPropagation()}>
        <Menu.Item onClick={copyLink}>Copy link</Menu.Item>
        <Menu.Item onClick={() => navigator.clipboard?.writeText(task.id)}>Copy ID</Menu.Item>
        <Menu.Item onClick={() => window.open(window.location.href, '_blank')}>New tab</Menu.Item>
        {canWriteTasks && (
          <>
            <Divider />
            <Menu.Item
              onClick={() => {
                void (async () => {
                  const title = await promptForText({
                    title: 'Rename task',
                    label: 'Task name',
                    initialValue: task.title,
                    confirmLabel: 'Rename',
                  });
                  if (!title) {
                    return;
                  }
                  await run(() => updateTask(task.id, { title }));
                })();
              }}
            >
              Rename
            </Menu.Item>
            <Menu.Item onClick={() => void run(() => duplicateTask(task.id))}>Duplicate</Menu.Item>
            <Menu.Item
              onClick={() =>
                void run(() =>
                  createTask({
                    taskListId: task.taskListId || '',
                    parentId: task.id,
                    title: `${task.title}.01`,
                    statusId: task.statusId,
                    priority: task.priority,
                  })
                )
              }
            >
              Add subtask
            </Menu.Item>
            <Divider />
            <Menu.Item
              color="red"
              onClick={() => {
                void (async () => {
                  const confirmed = await confirmAction({
                    title: 'Delete task',
                    message: `Delete "${task.title}"? This cannot be undone.`,
                    confirmLabel: 'Delete task',
                    confirmColor: 'red',
                  });
                  if (!confirmed) {
                    return;
                  }
                  await run(() => deleteTask(task.id));
                })();
              }}
            >
              Delete
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
