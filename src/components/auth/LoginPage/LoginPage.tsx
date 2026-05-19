import { Alert, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { getErrorMessage, login, type CurrentUser } from '@/lib';
import classes from './LoginPage.module.css';

export interface LoginPageProps {
  onLoggedIn: (user: CurrentUser) => void;
}

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const [email, setEmail] = useState('owner@local.app');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);
      setError(null);
      onLoggedIn(await login({ email, password }));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={classes.page}>
      <Paper className={classes.panel} withBorder>
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
          <TextInput
            label="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button loading={loading} onClick={submit}>
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
