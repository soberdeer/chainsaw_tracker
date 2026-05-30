import { Alert, Button, Group, PasswordInput, Stack } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface SecurityTabProps {
  form: UseFormReturnType<PasswordFormValues>;
  changingPassword: boolean;
  passwordMessage: string | null;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function SecurityTab({
  form,
  changingPassword,
  passwordMessage,
  onSubmit,
}: SecurityTabProps) {
  return (
    <form onSubmit={onSubmit}>
      <Stack>
        {passwordMessage && (
          <Alert color="green" title="Password updated">
            {passwordMessage}
          </Alert>
        )}
        <PasswordInput label="Current password" {...form.getInputProps('currentPassword')} />
        <PasswordInput label="New password" {...form.getInputProps('newPassword')} />
        <PasswordInput label="Confirm new password" {...form.getInputProps('confirmPassword')} />
        <Group justify="flex-end">
          <Button loading={changingPassword} type="submit">
            Change password
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
