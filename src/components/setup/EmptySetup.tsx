import { useState } from 'react';
import { Alert, Box, Button, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { createWorkspace } from '../../lib/api';
import type { Workspace } from '../../lib/types';
import { getErrorMessage } from '../../lib/taskUi';

export function EmptySetup({ onCreated }: { onCreated: (workspace: Workspace) => void }) {
  const [name, setName] = useState('Chainsaw');
  const [slug, setSlug] = useState('chainsaw');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Box className="center setup-screen">
      <Paper withBorder p="xl" maw="32.5rem">
        <Stack>
          <Title order={2}>Create workspace</Title>
          <Text c="dimmed">Данные будут храниться в Postgres через Prisma.</Text>
          {error && <Alert color="red" title="Could not create workspace" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
          <TextInput label="Workspace name" value={name} onChange={(event) => setName(event.currentTarget.value)} />
          <TextInput label="Slug" value={slug} onChange={(event) => setSlug(event.currentTarget.value)} />
          <Button
            loading={busy}
            onClick={async () => {
              try {
                setError(null);
                setBusy(true);
                onCreated(await createWorkspace({ name, slug }));
              } catch (caughtError) {
                setError(getErrorMessage(caughtError));
              } finally {
                setBusy(false);
              }
            }}
          >
            Create
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
