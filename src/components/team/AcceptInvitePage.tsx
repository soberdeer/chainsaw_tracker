import { useState } from 'react';
import { Alert, Box, Button, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { IconMailCheck } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { acceptInvite } from '../../lib/api';
import { getErrorMessage } from '../../lib/taskUi';

export function AcceptInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [acceptedWorkspace, setAcceptedWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const result = await acceptInvite(token);
      setAcceptedWorkspace({ id: result.workspaceId, name: result.workspaceName });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="center setup-screen">
      <Paper withBorder className="invite-card">
        <Stack gap="md" align="flex-start">
          <IconMailCheck size="2rem" />
          <Title order={2}>Accept workspace invite</Title>
          {acceptedWorkspace ? (
            <>
              <Text c="dimmed">You now have access to {acceptedWorkspace.name}.</Text>
              <Button component={Link} to="/" onClick={() => navigate('/')}>Open workspace</Button>
            </>
          ) : (
            <>
              <Text c="dimmed">This invite will add your current local user to the workspace.</Text>
              {error && <Alert color="red" title="Could not accept invite">{error}</Alert>}
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
