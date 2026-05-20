import {
  Alert,
  Box,
  Button,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
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
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (!token) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await acceptInvite(token, {
        name,
        password,
        confirmPassword,
      });
      setAcceptedWorkspace({ id: result.workspaceId, name: result.workspaceName });
      onAccepted(result.user);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className={`${classes.center} ${classes.setupScreen}`}>
      <Paper withBorder className={classes.inviteCard}>
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
              <TextInput
                label="Name"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                placeholder="Your name"
              />
              <PasswordInput
                label="Password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
              />
              <PasswordInput
                label="Confirm password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.currentTarget.value)}
              />
              <Button loading={loading} disabled={!token} onClick={accept}>
                {loading ? <Loader size="xs" /> : 'Accept invite'}
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
