import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconArrowRight, IconLink, IconPlus, IconTrash } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addTaskRelation,
  deleteTaskRelation,
  getErrorMessage,
  getTaskRelations,
  searchAll,
  showToast,
  type OpenProjectRelationItem,
  type SearchResult,
} from '@/lib';
import { confirmAction } from '@/lib/modals';
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
  if (relation.type === 'duplicates') {
    return 'duplicates';
  }
  return 'relates';
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

export function TaskRelations({ taskId, canWriteTasks, onError, onOpenTask }: TaskRelationsProps) {
  const [relations, setRelations] = useState<OpenProjectRelationItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [saving, setSaving] = useState(false);
  const relationForm = useForm({
    initialValues: {
      targetTaskId: '',
      type: 'relates',
    },
    validate: {
      targetTaskId: (value) => (value ? null : 'Выберите задачу'),
    },
  });
  const relationFormRef = useRef(relationForm);
  relationFormRef.current = relationForm;

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

  useEffect(() => {
    if (!modalOpen || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    void searchAll(searchQuery.trim())
      .then((items) => {
        const filtered = items.filter((item) => item.type === 'task' && item.id !== taskId);
        setSearchResults(filtered);
        if (filtered.length === 1) {
          relationFormRef.current.setFieldValue('targetTaskId', filtered[0].id);
        }
      })
      .catch(() => setSearchResults([]));
  }, [modalOpen, searchQuery, taskId]);

  const groups = useMemo(() => {
    const buckets = new Map<string, OpenProjectRelationItem[]>();
    for (const relation of relations) {
      const key = relationGroup(relation, taskId);
      buckets.set(key, [...(buckets.get(key) || []), relation]);
    }
    return ['blocks', 'blocked', 'relates', 'duplicates']
      .map((key) => ({
        key,
        label: groupLabel(key),
        items: buckets.get(key) || [],
      }))
      .filter((group) => group.items.length > 0);
  }, [relations, taskId]);

  const submit = relationForm.onSubmit(async (values) => {
    try {
      setSaving(true);
      const targetTaskId =
        values.targetTaskId || (searchResults.length === 1 ? searchResults[0].id : '');
      if (!targetTaskId) {
        relationForm.setFieldError('targetTaskId', 'Выберите задачу');
        setSaving(false);
        return;
      }
      await addTaskRelation(taskId, {
        targetTaskId,
        type: values.type,
      });
      await loadRelations();
      setModalOpen(false);
      relationForm.reset();
      setSearchQuery('');
      setSearchResults([]);
      showToast({
        tone: 'success',
        title: 'Relation added',
        message: 'The dependency was saved in OpenProject.',
      });
    } catch (error) {
      const message = getErrorMessage(error);
      onError(message);
      showToast({
        tone: 'error',
        title: 'Could not add relation',
        message,
      });
    } finally {
      setSaving(false);
    }
  });

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
        <Paper key={group.key} withBorder className={classes.group}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={700}>{group.label}</Text>
              <Badge variant="light">{group.items.length}</Badge>
            </Group>
            {group.items.map((relation) => {
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
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={async () => {
                          const confirmed = await confirmAction({
                            title: 'Удалить связь',
                            message: 'Эта зависимость будет удалена из OpenProject.',
                            confirmLabel: 'Удалить',
                            confirmColor: 'red',
                          });
                          if (!confirmed) return;
                          try {
                            await deleteTaskRelation(taskId, relation.id);
                            await loadRelations();
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
              );
            })}
          </Stack>
        </Paper>
      ))}

      {!groups.length && (
        <Text c="dimmed">
          Связей пока нет. Здесь можно хранить блокеры, зависимости и связанные work packages из
          OpenProject.
        </Text>
      )}

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Добавить связь" centered>
        <form onSubmit={submit}>
          <Stack>
            <Select
              data-testid="task-relation-type-select"
              label="Тип связи"
              value={relationForm.values.type}
              onChange={(value) => relationForm.setFieldValue('type', value || 'relates')}
              data={[
                { value: 'blocks', label: 'Блокирует' },
                { value: 'blockedBy', label: 'Заблокировано этой задачей' },
                { value: 'relates', label: 'Связано с' },
                { value: 'duplicates', label: 'Дублирует' },
              ]}
            />
            <TextInput
              data-testid="task-relation-search-input"
              label="Найти задачу"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              placeholder="TASK-123 or task title"
            />
            <TextInput
              data-testid="task-relation-target-input"
              label="Или укажите ID задачи"
              value={relationForm.values.targetTaskId}
              onChange={(event) =>
                relationForm.setFieldValue('targetTaskId', event.currentTarget.value)
              }
              error={relationForm.errors.targetTaskId}
              placeholder="wp-102"
            />
            <Select
              data-testid="task-relation-target-select"
              label="Задача"
              searchable
              value={relationForm.values.targetTaskId}
              onChange={(value) => relationForm.setFieldValue('targetTaskId', value || '')}
              data={searchResults.map((item) => ({
                value: item.id,
                label: item.title,
              }))}
              nothingFoundMessage={
                searchQuery.trim() ? 'Ничего не найдено' : 'Начните вводить название или ключ'
              }
            />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setModalOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" loading={saving} data-testid="task-relation-submit">
                Добавить
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
