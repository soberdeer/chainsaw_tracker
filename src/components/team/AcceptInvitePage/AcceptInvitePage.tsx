import {
  Alert,
  Box,
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconMailCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { acceptInvite, getErrorMessage, type CurrentUser } from '@/lib';
import classes from './AcceptInvitePage.module.css';

export function AcceptInvitePage({
  onAccepted,
}: {
  onAccepted: (user: CurrentUser | null) => void;
}) {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [acceptedWorkspace, setAcceptedWorkspace] = useState<{ id: string; name: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    initialValues: {
      name: '',
      password: '',
      confirmPassword: '',
    },
    validate: {
      password: (value) =>
        value.trim().length >= 8 ? null : 'Password must be at least 8 characters long',
      confirmPassword: (value, values) =>
        value === values.password ? null : 'Password confirmation does not match',
    },
  });

  const accept = form.onSubmit(async (values) => {
    if (!token) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await acceptInvite(token, {
        name: values.name,
        password: values.password,
        confirmPassword: values.confirmPassword,
      });
      setAcceptedWorkspace({ id: result.workspaceId, name: result.workspaceName });
      onAccepted(result.user);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  });

  return (
    <Box className={`${classes.center} ${classes.setupScreen}`}>
      <Paper withBorder className={classes.inviteCard} component="form" onSubmit={accept}>
        <Stack gap="md" align="flex-start">
          <Tooltip label="Workspace invite">
            <IconMailCheck size="2rem" />
          </Tooltip>
          <Title order={2}>Accept workspace invite</Title>
          {acceptedWorkspace ? (
            <>
              <Text c="dimmed">You now have access to {acceptedWorkspace.name}.</Text>
              <Button component={Link} to="/" onClick={() => navigate('/')}>
                Open workspace
              </Button>
            </>
          ) : (
            <>
              <Text c="dimmed">
                If you already have an account for this email, log in first and then accept the
                invite. Otherwise create your invited account below.
              </Text>
              {error && (
                <Alert color="red" title="Could not accept invite">
                  {error}
                </Alert>
              )}
              <TextInput label="Name" placeholder="Your name" {...form.getInputProps('name')} />
              <PasswordInput label="Password" {...form.getInputProps('password')} />
              <PasswordInput label="Confirm password" {...form.getInputProps('confirmPassword')} />
              <Button loading={loading} disabled={!token} type="submit">
                Accept invite
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
