import { Button, Group, Modal, Select, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useRef, useState } from 'react';
import { searchAll, type SearchResult } from '@/lib';

interface AddRelationModalProps {
  taskId: string;
  opened: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (targetTaskId: string, type: string) => Promise<void>;
}

export function AddRelationModal({
  taskId,
  opened,
  saving,
  onClose,
  onSubmit,
}: AddRelationModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const form = useForm({
    initialValues: { targetTaskId: '', type: 'relates' },
    validate: {
      targetTaskId: (value) => (value ? null : 'Выберите задачу'),
    },
  });
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    if (!opened || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    void searchAll(searchQuery.trim())
      .then((items) => {
        const filtered = items.filter((item) => item.type === 'task' && item.id !== taskId);
        setSearchResults(filtered);
        if (filtered.length === 1) {
          formRef.current.setFieldValue('targetTaskId', filtered[0].id);
        }
      })
      .catch(() => setSearchResults([]));
  }, [opened, searchQuery, taskId]);

  const handleClose = () => {
    form.reset();
    setSearchQuery('');
    setSearchResults([]);
    onClose();
  };

  const handleSubmit = form.onSubmit(async (values) => {
    const targetTaskId =
      values.targetTaskId || (searchResults.length === 1 ? searchResults[0].id : '');
    if (!targetTaskId) {
      form.setFieldError('targetTaskId', 'Выберите задачу');
      return;
    }
    await onSubmit(targetTaskId, values.type);
    form.reset();
    setSearchQuery('');
    setSearchResults([]);
  });

  return (
    <Modal opened={opened} onClose={handleClose} title="Добавить связь" centered zIndex={300}>
      <form onSubmit={handleSubmit}>
        <Stack>
          <Select
            data-testid="task-relation-type-select"
            label="Тип связи"
            value={form.values.type}
            onChange={(value) => form.setFieldValue('type', value || 'relates')}
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
            value={form.values.targetTaskId}
            onChange={(event) => form.setFieldValue('targetTaskId', event.currentTarget.value)}
            error={form.errors.targetTaskId}
            placeholder="wp-102"
          />
          <Select
            data-testid="task-relation-target-select"
            label="Задача"
            searchable
            value={form.values.targetTaskId}
            onChange={(value) => form.setFieldValue('targetTaskId', value || '')}
            data={searchResults.map((item) => ({ value: item.id, label: item.title }))}
            nothingFoundMessage={
              searchQuery.trim() ? 'Ничего не найдено' : 'Начните вводить название или ключ'
            }
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>
              Отмена
            </Button>
            <Button type="submit" loading={saving} data-testid="task-relation-submit">
              Добавить
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
