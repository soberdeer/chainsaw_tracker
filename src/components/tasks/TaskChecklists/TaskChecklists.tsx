import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconChecklist, IconPlus } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import {
  createTaskChecklist,
  getErrorMessage,
  getTaskChecklists,
  showToast,
  type Checklist,
} from '@/lib';
import { ChecklistCard } from './ChecklistCard';
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

  const checklistForm = useForm({ initialValues: { title: '' } });

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

  const handleDeleted = (checklistId: string) => {
    setChecklists((current) => current.filter((item) => item.id !== checklistId));
  };

  const createChecklist = checklistForm.onSubmit(async (values) => {
    if (!canWriteTasks || !values.title.trim()) return;
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
      showToast({ tone: 'error', title: 'Could not create checklist', message });
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
          <ChecklistCard
            key={checklist.id}
            checklist={checklist}
            canWriteTasks={canWriteTasks}
            onRefresh={loadChecklists}
            onUpdated={refreshChecklist}
            onDeleted={handleDeleted}
            onChanged={onChanged}
            onError={onError}
          />
        ))}

      {!loading && !checklists.length && (
        <Text c="dimmed">
          No checklists yet. Keep release steps, QA notes, or acceptance criteria here.
        </Text>
      )}
    </Stack>
  );
}
