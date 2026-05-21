import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { useEffect, type ReactNode } from 'react';

export type ConfirmActionInput = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
};

export async function confirmAction(input: ConfirmActionInput): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    modals.openConfirmModal({
      centered: true,
      title: input.title,
      children:
        typeof input.message === 'string' ? <Text size="sm">{input.message}</Text> : input.message,
      labels: {
        confirm: input.confirmLabel || 'Confirm',
        cancel: input.cancelLabel || 'Cancel',
      },
      confirmProps: input.confirmColor ? { color: input.confirmColor } : undefined,
      onCancel: () => settle(false),
      onClose: () => settle(false),
      onConfirm: () => settle(true),
    });
  });
}

export type PromptForTextInput = {
  title: string;
  label: string;
  description?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
  validate?: (value: string) => string | null;
};

type TextPromptModalProps = PromptForTextInput & {
  onCancel: () => void;
  onSubmit: (value: string) => void;
};

function TextPromptModal({
  label,
  description,
  initialValue = '',
  placeholder,
  confirmLabel,
  cancelLabel,
  required = true,
  validate,
  onCancel,
  onSubmit,
}: TextPromptModalProps) {
  const form = useForm({
    initialValues: {
      value: initialValue,
    },
    validate: {
      value: (value) => {
        const trimmed = value.trim();
        if (required && !trimmed.length) {
          return `${label} is required`;
        }
        return validate?.(trimmed) || null;
      },
    },
  });

  useEffect(() => {
    form.setValues({ value: initialValue });
  }, [form, initialValue]);

  return (
    <form
      onSubmit={form.onSubmit((values) => {
        onSubmit(values.value.trim());
      })}
    >
      <Stack>
        {description && (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        )}
        <TextInput
          label={label}
          placeholder={placeholder}
          data-autofocus
          {...form.getInputProps('value')}
        />
        <Group justify="flex-end">
          <Button type="button" variant="light" onClick={onCancel}>
            {cancelLabel || 'Cancel'}
          </Button>
          <Button type="submit">{confirmLabel || 'Save'}</Button>
        </Group>
      </Stack>
    </form>
  );
}

export async function promptForText(input: PromptForTextInput): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    let settled = false;
    const modalId = `text-prompt-${Math.random().toString(36).slice(2)}`;
    const settle = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const closeModal = () => modals.close(modalId);
    const handleCancel = () => {
      settle(null);
      closeModal();
    };
    const handleSubmit = (value: string) => {
      settle(value);
      closeModal();
    };

    modals.open({
      modalId,
      centered: true,
      title: input.title,
      onClose: () => settle(null),
      children: <TextPromptModal {...input} onCancel={handleCancel} onSubmit={handleSubmit} />,
    });
  });
}
