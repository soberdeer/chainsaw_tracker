import {
  ActionIcon,
  Badge,
  Group,
  Paper,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconArrowRight, IconTrash } from '@tabler/icons-react';
import { deleteTaskRelation, getErrorMessage, type OpenProjectRelationItem } from '@/lib';
import { confirmAction } from '@/lib/modals';
import classes from './TaskRelations.module.css';

interface RelationGroupProps {
  label: string;
  items: OpenProjectRelationItem[];
  taskId: string;
  canWriteTasks: boolean;
  onDeleted: () => void;
  onError: (message: string) => void;
  onOpenTask: (taskId: string) => void;
}

function relationTarget(relation: OpenProjectRelationItem, currentTaskId: string) {
  if (relation.fromId === currentTaskId) {
    return {
      id: relation.toId || '',
      title: relation.toTitle || relation.toId || 'OpenProject task',
    };
  }
  return {
    id: relation.fromId || '',
    title: relation.fromTitle || relation.fromId || 'OpenProject task',
  };
}

export function RelationGroup({
  label,
  items,
  taskId,
  canWriteTasks,
  onDeleted,
  onError,
  onOpenTask,
}: RelationGroupProps) {
  const handleDelete = async (relation: OpenProjectRelationItem) => {
    const confirmed = await confirmAction({
      title: 'Удалить связь',
      message: 'Эта зависимость будет удалена из OpenProject.',
      confirmLabel: 'Удалить',
      confirmColor: 'red',
    });
    if (!confirmed) return;
    try {
      await deleteTaskRelation(taskId, relation.id);
      onDeleted();
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  return (
    <Paper withBorder className={classes.group}>
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={700}>{label}</Text>
          <Badge variant="light">{items.length}</Badge>
        </Group>
        {items.map((relation) => {
          const target = relationTarget(relation, taskId);
          return (
            <Group
              key={relation.id}
              className={classes.row}
              wrap="nowrap"
              data-testid="relation-row"
            >
              <UnstyledButton
                className={classes.targetButton}
                onClick={() => target.id && onOpenTask(target.id)}
              >
                <Group gap="xs" wrap="nowrap">
                  <Badge variant="outline">{target.id}</Badge>
                  <IconArrowRight size="0.875rem" />
                  <Text fw={600}>{target.title}</Text>
                </Group>
              </UnstyledButton>
              {canWriteTasks && (
                <Tooltip label="Удалить связь">
                  <ActionIcon color="red" variant="subtle" onClick={() => handleDelete(relation)}>
                    <IconTrash size="1rem" />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          );
        })}
      </Stack>
    </Paper>
  );
}
