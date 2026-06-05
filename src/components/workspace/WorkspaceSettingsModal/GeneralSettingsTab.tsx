import { Button, ColorInput, Group, Stack, TextInput, Textarea } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';

interface GeneralFormValues {
  name: string;
  slug: string;
  description: string;
  avatarUrl: string;
  color: string;
}

interface GeneralSettingsTabProps {
  form: UseFormReturnType<GeneralFormValues>;
  canManageWorkspace: boolean;
  saving: boolean;
  onSave: (event: React.SubmitEvent<HTMLFormElement>) => void;
}

export function GeneralSettingsTab({
  form,
  canManageWorkspace,
  saving,
  onSave,
}: GeneralSettingsTabProps) {
  return (
    <form onSubmit={onSave}>
      <Stack>
        <TextInput
          label="Workspace name"
          disabled={!canManageWorkspace}
          {...form.getInputProps('name')}
        />
        <TextInput
          label="Workspace slug"
          disabled={!canManageWorkspace}
          {...form.getInputProps('slug')}
        />
        <Textarea
          label="Description"
          disabled={!canManageWorkspace}
          {...form.getInputProps('description')}
        />
        <TextInput
          label="Avatar URL"
          disabled={!canManageWorkspace}
          {...form.getInputProps('avatarUrl')}
        />
        <ColorInput
          label="Accent color"
          disabled={!canManageWorkspace}
          {...form.getInputProps('color')}
        />
        <Group justify="flex-end">
          <Button type="submit" loading={saving} disabled={!canManageWorkspace}>
            Save workspace
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
