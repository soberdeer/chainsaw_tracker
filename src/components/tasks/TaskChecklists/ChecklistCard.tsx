import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Paper,
  Stack,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import {
  addChecklistItem,
  deleteChecklistItem,
  deleteTaskChecklist,
  getErrorMessage,
  updateChecklistItem,
  updateTaskChecklist,
  type Checklist,
} from '@/lib';
import classes from './TaskChecklists.module.css';

interface ChecklistCardProps {
  checklist: Checklist;
  canWriteTasks: boolean;
  onRefresh: () => Promise<void>;
  onUpdated: (updated: Checklist) => void;
  onDeleted: (checklistId: string) => void;
  onChanged?: () => void;
  onError: (message: string) => void;
}

export function ChecklistCard({
  checklist,
  canWriteTasks,
  onRefresh,
  onUpdated,
  onDeleted,
  onChanged,
  onError,
}: ChecklistCardProps) {
  const [draftText, setDraftText] = useState('');

  const handleCheckItem = async (itemId: string, completed: boolean) => {
    try {
      onUpdated(await updateChecklistItem(itemId, { completed }));
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  const handleItemTextSave = async (itemId: string, text: string, originalText: string) => {
    if (!canWriteTasks || !text || text === originalText) return;
    try {
      onUpdated(await updateChecklistItem(itemId, { text }));
    } catch (error) {
      onError(getErrorMessage(error));
      await onRefresh();
    }
  };

  const handleMoveUp = async (itemId: string, index: number) => {
    if (index === 0) return;
    try {
      await updateChecklistItem(itemId, { position: index - 1 });
      await updateChecklistItem(checklist.items[index - 1].id, { position: index });
      await onRefresh();
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  const handleMoveDown = async (itemId: string, index: number) => {
    if (index === checklist.items.length - 1) return;
    try {
      await updateChecklistItem(itemId, { position: index + 1 });
      await updateChecklistItem(checklist.items[index + 1].id, { position: index });
      await onRefresh();
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteChecklistItem(itemId);
      await onRefresh();
      onChanged?.();
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  const handleAddItem = async () => {
    const text = draftText.trim();
    if (!text) return;
    try {
      onUpdated(await addChecklistItem(checklist.id, text));
      setDraftText('');
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  const handleTitleSave = async (title: string) => {
    const nextTitle = title.trim();
    if (!canWriteTasks || !nextTitle || nextTitle === checklist.title) return;
    try {
      onUpdated(await updateTaskChecklist(checklist.id, { title: nextTitle }));
    } catch (error) {
      onError(getErrorMessage(error));
      await onRefresh();
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTaskChecklist(checklist.id);
      onDeleted(checklist.id);
      onChanged?.();
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  return (
    <Paper withBorder className={classes.checklist}>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <TextInput
              value={checklist.title}
              readOnly={!canWriteTasks}
              variant={canWriteTasks ? 'default' : 'unstyled'}
              onChange={(event) => onUpdated({ ...checklist, title: event.currentTarget.value })}
              onBlur={(event) => handleTitleSave(event.currentTarget.value)}
            />
            <Badge variant="light">
              {checklist.completedItems}/{checklist.totalItems}
            </Badge>
          </Stack>
          {canWriteTasks && (
            <Tooltip label="Delete checklist">
              <ActionIcon color="red" variant="subtle" onClick={handleDelete}>
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
                onChange={(event) => handleCheckItem(item.id, event.currentTarget.checked)}
              />
              <TextInput
                value={item.text}
                className={item.completed ? classes.completedText : undefined}
                readOnly={!canWriteTasks}
                variant={canWriteTasks ? 'default' : 'unstyled'}
                onChange={(event) =>
                  onUpdated({
                    ...checklist,
                    items: checklist.items.map((checklistItem) =>
                      checklistItem.id === item.id
                        ? { ...checklistItem, text: event.currentTarget.value }
                        : checklistItem
                    ),
                  })
                }
                onBlur={(event) =>
                  handleItemTextSave(item.id, event.currentTarget.value.trim(), item.text)
                }
              />
              {canWriteTasks && (
                <Group gap={4} wrap="nowrap">
                  <ActionIcon
                    variant="subtle"
                    disabled={index === 0}
                    onClick={() => handleMoveUp(item.id, index)}
                  >
                    <IconArrowUp size="0.875rem" />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    disabled={index === checklist.items.length - 1}
                    onClick={() => handleMoveDown(item.id, index)}
                  >
                    <IconArrowDown size="0.875rem" />
                  </ActionIcon>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => handleDeleteItem(item.id)}
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
              value={draftText}
              onChange={(event) => setDraftText(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleAddItem();
                }
              }}
            />
            <Button variant="light" onClick={handleAddItem}>
              Add item
            </Button>
          </div>
        )}
      </Stack>
    </Paper>
  );
}
