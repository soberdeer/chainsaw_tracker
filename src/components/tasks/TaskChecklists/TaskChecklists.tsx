import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconArrowDown,
  IconArrowUp,
  IconChecklist,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import {
  addChecklistItem,
  createTaskChecklist,
  deleteChecklistItem,
  deleteTaskChecklist,
  getErrorMessage,
  getTaskChecklists,
  showToast,
  updateChecklistItem,
  updateTaskChecklist,
  type Checklist,
} from '@/lib';
import classes from './TaskChecklists.module.css';

export interface TaskChecklistsProps {
  taskId: string;
  canWriteTasks: boolean;
  onError: (message: string) => void;
  onChanged?: () => void;
}

export function TaskChecklists({ taskId, canWriteTasks, onError, onChanged }: TaskChecklistsProps) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const checklistForm = useForm({
    initialValues: {
      title: '',
    },
  });

  const [draftItems, setDraftItems] = useState<Record<string, string>>({});

  const loadChecklists = useCallback(async () => {
    try {
      setLoading(true);
      const page = await getTaskChecklists(taskId);
      setChecklists(page.items);
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [onError, taskId]);

  useEffect(() => {
    void loadChecklists();
  }, [loadChecklists]);

  const refreshChecklist = (updated: Checklist) => {
    setChecklists((current) =>
      current
        .map((item) => (item.id === updated.id ? updated : item))
        .sort((left, right) => left.position - right.position)
    );
    onChanged?.();
  };

  const createChecklist = checklistForm.onSubmit(async (values) => {
    if (!canWriteTasks || !values.title.trim()) {
      return;
    }
    try {
      setSaving(true);
      const created = await createTaskChecklist(taskId, values.title.trim());
      setChecklists((current) => [...current, created].sort((a, b) => a.position - b.position));
      checklistForm.reset();
      onChanged?.();
      showToast({
        tone: 'success',
        title: 'Checklist created',
        message: `Added ${created.title}.`,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      onError(message);
      showToast({
        tone: 'error',
        title: 'Could not create checklist',
        message,
      });
    } finally {
      setSaving(false);
    }
  });

  return (
    <Stack className={classes.section} gap="md">
      <Group justify="space-between">
        <Group gap="xs">
          <IconChecklist size="1rem" />
          <Text fw={700}>Checklists</Text>
        </Group>
        {canWriteTasks && (
          <form onSubmit={createChecklist}>
            <Group gap="xs">
              <TextInput
                placeholder="Release checklist"
                {...checklistForm.getInputProps('title')}
              />
              <Button type="submit" loading={saving} leftSection={<IconPlus size="0.875rem" />}>
                Add checklist
              </Button>
            </Group>
          </form>
        )}
      </Group>

      {loading && <Text c="dimmed">Loading checklists...</Text>}

      {!loading &&
        checklists.map((checklist) => (
          <Paper key={checklist.id} withBorder className={classes.checklist}>
            <Stack gap="sm">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <TextInput
                    value={checklist.title}
                    readOnly={!canWriteTasks}
                    variant={canWriteTasks ? 'default' : 'unstyled'}
                    onChange={(event) =>
                      setChecklists((current) =>
                        current.map((item) =>
                          item.id === checklist.id
                            ? { ...item, title: event.currentTarget.value }
                            : item
                        )
                      )
                    }
                    onBlur={async (event) => {
                      const nextTitle = event.currentTarget.value.trim();
                      if (!canWriteTasks || !nextTitle || nextTitle === checklist.title) {
                        return;
                      }
                      try {
                        refreshChecklist(
                          await updateTaskChecklist(checklist.id, { title: nextTitle })
                        );
                      } catch (error) {
                        onError(getErrorMessage(error));
                        void loadChecklists();
                      }
                    }}
                  />
                  <Badge variant="light">
                    {checklist.completedItems}/{checklist.totalItems}
                  </Badge>
                </Stack>
                {canWriteTasks && (
                  <Tooltip label="Delete checklist">
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={async () => {
                        try {
                          await deleteTaskChecklist(checklist.id);
                          setChecklists((current) =>
                            current.filter((item) => item.id !== checklist.id)
                          );
                          onChanged?.();
                        } catch (error) {
                          onError(getErrorMessage(error));
                        }
                      }}
                    >
                      <IconTrash size="1rem" />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>

              <Stack gap="xs">
                {checklist.items.map((item, index) => (
                  <Group key={item.id} className={classes.itemRow} wrap="nowrap">
                    <Checkbox
                      checked={item.completed}
                      disabled={!canWriteTasks}
                      onChange={async (event) => {
                        try {
                          refreshChecklist(
                            await updateChecklistItem(item.id, {
                              completed: event.currentTarget.checked,
                            })
                          );
                        } catch (error) {
                          onError(getErrorMessage(error));
                        }
                      }}
                    />
                    <TextInput
                      value={item.text}
                      className={item.completed ? classes.completedText : undefined}
                      readOnly={!canWriteTasks}
                      variant={canWriteTasks ? 'default' : 'unstyled'}
                      onChange={(event) =>
                        setChecklists((current) =>
                          current.map((entry) =>
                            entry.id === checklist.id
                              ? {
                                  ...entry,
                                  items: entry.items.map((checklistItem) =>
                                    checklistItem.id === item.id
                                      ? { ...checklistItem, text: event.currentTarget.value }
                                      : checklistItem
                                  ),
                                }
                              : entry
                          )
                        )
                      }
                      onBlur={async (event) => {
                        const nextText = event.currentTarget.value.trim();
                        if (!canWriteTasks || !nextText || nextText === item.text) {
                          return;
                        }
                        try {
                          refreshChecklist(await updateChecklistItem(item.id, { text: nextText }));
                        } catch (error) {
                          onError(getErrorMessage(error));
                          void loadChecklists();
                        }
                      }}
                    />
                    {canWriteTasks && (
                      <Group gap={4} wrap="nowrap">
                        <ActionIcon
                          variant="subtle"
                          disabled={index === 0}
                          onClick={async () => {
                            if (index === 0) return;
                            try {
                              await updateChecklistItem(item.id, { position: index - 1 });
                              await updateChecklistItem(checklist.items[index - 1].id, {
                                position: index,
                              });
                              await loadChecklists();
                            } catch (error) {
                              onError(getErrorMessage(error));
                            }
                          }}
                        >
                          <IconArrowUp size="0.875rem" />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          disabled={index === checklist.items.length - 1}
                          onClick={async () => {
                            if (index === checklist.items.length - 1) return;
                            try {
                              await updateChecklistItem(item.id, { position: index + 1 });
                              await updateChecklistItem(checklist.items[index + 1].id, {
                                position: index,
                              });
                              await loadChecklists();
                            } catch (error) {
                              onError(getErrorMessage(error));
                            }
                          }}
                        >
                          <IconArrowDown size="0.875rem" />
                        </ActionIcon>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={async () => {
                            try {
                              await deleteChecklistItem(item.id);
                              await loadChecklists();
                              onChanged?.();
                            } catch (error) {
                              onError(getErrorMessage(error));
                            }
                          }}
                        >
                          <IconTrash size="0.875rem" />
                        </ActionIcon>
                      </Group>
                    )}
                  </Group>
                ))}
              </Stack>

              {canWriteTasks && (
                <div className={classes.newItemRow}>
                  <TextInput
                    placeholder="Add checklist item"
                    value={draftItems[checklist.id] || ''}
                    onChange={(event) =>
                      setDraftItems((current) => ({
                        ...current,
                        [checklist.id]: event.currentTarget.value,
                      }))
                    }
                  />
                  <Button
                    variant="light"
                    onClick={async () => {
                      const text = (draftItems[checklist.id] || '').trim();
                      if (!text) {
                        return;
                      }
                      try {
                        refreshChecklist(await addChecklistItem(checklist.id, text));
                        setDraftItems((current) => ({ ...current, [checklist.id]: '' }));
                      } catch (error) {
                        onError(getErrorMessage(error));
                      }
                    }}
                  >
                    Add item
                  </Button>
                </div>
              )}
            </Stack>
          </Paper>
        ))}

      {!loading && !checklists.length && (
        <Text c="dimmed">
          No checklists yet. Keep release steps, QA notes, or acceptance criteria here.
        </Text>
      )}
    </Stack>
  );
}
