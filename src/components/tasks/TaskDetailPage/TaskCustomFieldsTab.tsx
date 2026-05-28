import { Checkbox, NumberInput, SimpleGrid, Textarea, TextInput } from '@mantine/core';
import { getErrorMessage, updateTaskCustomField, type OpenProjectCustomFieldItem } from '@/lib';

interface TaskCustomFieldsTabProps {
  taskId: string;
  customFields: OpenProjectCustomFieldItem[];
  canWriteTasks: boolean;
  onFieldsChange: (fields: OpenProjectCustomFieldItem[]) => void;
  onError: (msg: string) => void;
}

export function TaskCustomFieldsTab({
  taskId,
  customFields,
  canWriteTasks,
  onFieldsChange,
  onError,
}: TaskCustomFieldsTabProps) {
  const update = async (key: string, value: unknown) => {
    try {
      const page = await updateTaskCustomField(taskId, key, value);
      onFieldsChange(page.items);
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  const renderField = (field: OpenProjectCustomFieldItem) => {
    const commonDescription = field.editable
      ? 'Saved through OpenProject custom field PATCH'
      : 'Read-only OpenProject custom field';

    if (field.kind === 'boolean') {
      return (
        <Checkbox
          label={field.label}
          checked={Boolean(field.rawValue)}
          disabled={!canWriteTasks || !field.editable}
          description={commonDescription}
          onChange={async (event) => {
            if (!canWriteTasks || !field.editable) return;
            await update(field.key, event.currentTarget.checked);
          }}
        />
      );
    }

    if (field.kind === 'integer' || field.kind === 'float') {
      return (
        <NumberInput
          label={field.label}
          value={typeof field.rawValue === 'number' ? field.rawValue : undefined}
          decimalScale={field.kind === 'integer' ? 0 : 2}
          allowDecimal={field.kind === 'float'}
          allowNegative
          disabled={!canWriteTasks || !field.editable}
          description={commonDescription}
          onBlur={async (event) => {
            if (!canWriteTasks || !field.editable) return;
            const value = event.currentTarget.value.trim();
            if (!value || value === String(field.rawValue ?? '')) return;
            await update(
              field.key,
              field.kind === 'integer' ? Number.parseInt(value, 10) : Number.parseFloat(value)
            );
          }}
        />
      );
    }

    if (field.kind === 'textarea') {
      return (
        <Textarea
          label={field.label}
          defaultValue={field.value}
          readOnly={!canWriteTasks || !field.editable}
          description={commonDescription}
          autosize
          minRows={3}
          onBlur={async (event) => {
            if (!canWriteTasks || !field.editable || event.currentTarget.value === field.value)
              return;
            await update(field.key, event.currentTarget.value);
          }}
        />
      );
    }

    if (field.kind === 'date') {
      return (
        <TextInput
          label={field.label}
          type="date"
          defaultValue={typeof field.rawValue === 'string' ? field.rawValue : field.value}
          readOnly={!canWriteTasks || !field.editable}
          description={commonDescription}
          onBlur={async (event) => {
            if (!canWriteTasks || !field.editable || event.currentTarget.value === field.value)
              return;
            await update(field.key, event.currentTarget.value);
          }}
        />
      );
    }

    return (
      <TextInput
        label={field.label}
        defaultValue={field.value}
        readOnly={!canWriteTasks || !field.editable}
        description={commonDescription}
        onBlur={async (event) => {
          if (!canWriteTasks || !field.editable || event.currentTarget.value === field.value)
            return;
          await update(field.key, event.currentTarget.value);
        }}
      />
    );
  };

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      {customFields.map((field) => (
        <div key={field.key}>{renderField(field)}</div>
      ))}
    </SimpleGrid>
  );
}
