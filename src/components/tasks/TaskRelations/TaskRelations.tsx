import { Button, Group, Stack, Text } from '@mantine/core';
import { IconLink, IconPlus } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addTaskRelation,
  getErrorMessage,
  getTaskRelations,
  showToast,
  type OpenProjectRelationItem,
} from '@/lib';
import { AddRelationModal } from './AddRelationModal';
import { RelationGroup } from './RelationGroup';
import classes from './TaskRelations.module.css';

export interface TaskRelationsProps {
  taskId: string;
  canWriteTasks: boolean;
  onError: (message: string) => void;
  onOpenTask: (taskId: string) => void;
}

function groupLabel(key: string) {
  if (key === 'blocks') return 'Блокирует';
  if (key === 'blocked') return 'Заблокировано';
  if (key === 'duplicates') return 'Дублирует';
  return 'Связано с';
}

function relationGroup(relation: OpenProjectRelationItem, currentTaskId: string) {
  if (relation.type === 'blocks') {
    return relation.fromId === currentTaskId ? 'blocks' : 'blocked';
  }
  if (relation.type === 'blockedBy') {
    return relation.fromId === currentTaskId ? 'blocked' : 'blocks';
  }
  if (relation.type === 'duplicates') return 'duplicates';
  return 'relates';
}

export function TaskRelations({ taskId, canWriteTasks, onError, onOpenTask }: TaskRelationsProps) {
  const [relations, setRelations] = useState<OpenProjectRelationItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadRelations = useCallback(async () => {
    try {
      const page = await getTaskRelations(taskId);
      setRelations(page.items);
    } catch (error) {
      onError(getErrorMessage(error));
      setRelations([]);
    }
  }, [onError, taskId]);

  useEffect(() => {
    void loadRelations();
  }, [loadRelations]);

  const groups = useMemo(() => {
    const buckets = new Map<string, OpenProjectRelationItem[]>();
    for (const relation of relations) {
      const key = relationGroup(relation, taskId);
      buckets.set(key, [...(buckets.get(key) || []), relation]);
    }
    return ['blocks', 'blocked', 'relates', 'duplicates']
      .map((key) => ({ key, label: groupLabel(key), items: buckets.get(key) || [] }))
      .filter((group) => group.items.length > 0);
  }, [relations, taskId]);

  const handleSubmit = async (targetTaskId: string, type: string) => {
    try {
      setSaving(true);
      await addTaskRelation(taskId, { targetTaskId, type });
      await loadRelations();
      setModalOpen(false);
      showToast({
        tone: 'success',
        title: 'Relation added',
        message: 'The dependency was saved in OpenProject.',
      });
    } catch (error) {
      const message = getErrorMessage(error);
      onError(message);
      showToast({ tone: 'error', title: 'Could not add relation', message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack className={classes.section} gap="md" data-testid="task-relations">
      <Group justify="space-between">
        <Group gap="xs">
          <IconLink size="1rem" />
          <Text fw={700}>Зависимости</Text>
        </Group>
        {canWriteTasks && (
          <Button
            variant="light"
            leftSection={<IconPlus size="0.875rem" />}
            data-testid="task-relation-open-modal"
            onClick={() => setModalOpen(true)}
          >
            Добавить связь
          </Button>
        )}
      </Group>

      {groups.map((group) => (
        <RelationGroup
          key={group.key}
          label={group.label}
          items={group.items}
          taskId={taskId}
          canWriteTasks={canWriteTasks}
          onDeleted={loadRelations}
          onError={onError}
          onOpenTask={onOpenTask}
        />
      ))}

      {!groups.length && (
        <Text c="dimmed">
          Связей пока нет. Здесь можно хранить блокеры, зависимости и связанные work packages из
          OpenProject.
        </Text>
      )}

      <AddRelationModal
        taskId={taskId}
        opened={modalOpen}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </Stack>
  );
}
