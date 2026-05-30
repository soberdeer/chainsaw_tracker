import {
  Alert,
  Anchor,
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import { getErrorMessage, getOpenProjectUrl, login, type CurrentUser } from '@/lib';
import classes from './LoginPage.module.css';

export interface LoginPageProps {
  onLoggedIn: (user: CurrentUser) => void;
}

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [opUrl, setOpUrl] = useState('http://localhost:8080');

  useEffect(() => {
    getOpenProjectUrl()
      .then(({ url }) => setOpUrl(url))
      .catch(() => {});
  }, []);

  const form = useForm({
    initialValues: {
      login: '',
      password: '',
    },
    validate: {
      login: (value) => (value.trim().length ? null : 'Username or email is required'),
      password: (value) => (value.trim().length ? null : 'Password is required'),
    },
  });

  const submit = form.onSubmit(async (values) => {
    try {
      setLoading(true);
      setError(null);
      setMustChangePassword(null);
      onLoggedIn(await login(values));
    } catch (caughtError) {
      const raw = getErrorMessage(caughtError);
      if (raw.includes('MUST_CHANGE_PASSWORD')) {
        setMustChangePassword(opUrl);
      } else {
        setError(raw);
      }
    } finally {
      setLoading(false);
    }
  });

  return (
    <main className={classes.page} data-testid="login-form">
      <Paper className={classes.panel} withBorder component="form" onSubmit={submit}>
        <Stack gap="md">
          <div>
            <Title order={2}>OpenProject Tracker</Title>
            <Text c="dimmed">Sign in with your OpenProject credentials.</Text>
          </div>

          {mustChangePassword && (
            <Alert color="yellow" title="Password change required">
              Your OpenProject account requires a password change before you can log in. Please{' '}
              <Anchor href={`${mustChangePassword}/account/change_password`} target="_blank">
                change your password in OpenProject
              </Anchor>
              , then return here to sign in.
            </Alert>
          )}

          {error && !mustChangePassword && (
            <Alert color="red" title="Could not sign in">
              {error}
            </Alert>
          )}

          <TextInput
            label="Username or email"
            autoComplete="username"
            {...form.getInputProps('login')}
          />
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            {...form.getInputProps('password')}
          />
          <Button loading={loading} type="submit">
            Sign in
          </Button>
        </Stack>
      </Paper>
    </main>
  );
}
