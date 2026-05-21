import { Alert, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import { getErrorMessage, login, type CurrentUser } from '@/lib';
import classes from './LoginPage.module.css';

export interface LoginPageProps {
  onLoggedIn: (user: CurrentUser) => void;
}

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const form = useForm({
    initialValues: {
      email: 'owner@local.app',
      password: 'admin123',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Enter a valid email address'),
      password: (value) => (value.trim().length ? null : 'Password is required'),
    },
  });

  const submit = form.onSubmit(async (values) => {
    try {
      setLoading(true);
      setError(null);
      onLoggedIn(await login(values));
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
            <Title order={2}>OpenProject Tracker</Title>
            <Text c="dimmed">Sign in with your local tracker account.</Text>
          </div>
          {error && (
            <Alert color="red" title="Could not sign in">
              {error}
            </Alert>
          )}
          <TextInput label="Email" {...form.getInputProps('email')} />
          <PasswordInput label="Password" {...form.getInputProps('password')} />
          <Button loading={loading} type="submit">
            Sign in
          </Button>
          <Text size="xs" c="dimmed">
            Development default: owner@local.app / admin123. OpenProject access still uses the
            backend service token.
          </Text>
        </Stack>
      </Paper>
    </main>
  );
}
