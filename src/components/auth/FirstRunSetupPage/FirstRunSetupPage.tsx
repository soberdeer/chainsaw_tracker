import { Alert, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import {
  completeFirstRunSetup,
  getErrorMessage,
  type AuthSetupStatus,
  type CurrentUser,
} from '@/lib';
import classes from './FirstRunSetupPage.module.css';

export interface FirstRunSetupPageProps {
  status: AuthSetupStatus;
  onCreated: (user: CurrentUser) => void;
}

export function FirstRunSetupPage({ status, onCreated }: FirstRunSetupPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const form = useForm({
    initialValues: {
      workspaceName: status.workspace.name || '',
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    validate: {
      workspaceName: (value) =>
        value.trim().length >= 2 ? null : 'Workspace name must be at least 2 characters long',
      name: (value) => (value.trim().length ? null : 'Name is required'),
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Enter a valid email address'),
      password: (value) =>
        value.trim().length >= 8 ? null : 'Password must be at least 8 characters long',
      confirmPassword: (value, values) =>
        value === values.password ? null : 'Password confirmation does not match',
    },
  });

  const submit = form.onSubmit(async (values) => {
    try {
      setLoading(true);
      setError(null);
      onCreated(await completeFirstRunSetup(values));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  });

  return (
    <main className={classes.page}>
      <Paper className={classes.panel} withBorder component="form" onSubmit={submit}>
        <Stack gap="md">
          <div>
            <Title order={2}>Set up your workspace owner</Title>
            <Text c="dimmed">
              No workspace owner exists yet, so let&apos;s create the first account before anyone
              signs in.
            </Text>
          </div>
          {error && (
            <Alert color="red" title="Could not finish setup">
              {error}
            </Alert>
          )}
          <Alert color="blue" title="What this does">
            Creates the first local tracker owner for <strong>{status.workspace.name}</strong>.
            OpenProject task data will still stay in OpenProject.
          </Alert>
          <TextInput label="Workspace name" {...form.getInputProps('workspaceName')} />
          <TextInput label="Your name" {...form.getInputProps('name')} />
          <TextInput label="Email" {...form.getInputProps('email')} />
          <PasswordInput label="Password" {...form.getInputProps('password')} />
          <PasswordInput label="Confirm password" {...form.getInputProps('confirmPassword')} />
          <Button loading={loading} type="submit">
            Create owner account
          </Button>
        </Stack>
      </Paper>
    </main>
  );
}
