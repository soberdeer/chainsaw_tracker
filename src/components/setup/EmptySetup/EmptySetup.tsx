import { Box, Paper, Stack, Text, Title } from '@mantine/core';
import type { Workspace } from '../../../lib/types';
import classes from './EmptySetup.module.css';

export function EmptySetup({ onCreated }: { onCreated: (workspace: Workspace) => void }) {
  void onCreated;

  return (
    <Box className={`${classes.center} ${classes.setupScreen}`}>
      <Paper withBorder p="xl" maw="32.5rem">
        <Stack>
          <Title order={2}>No ClickUp workspace found</Title>
          <Text c="dimmed">
            Set `CLICKUP_TOKEN` to a personal token that can access at least one ClickUp Workspace.
          </Text>
        </Stack>
      </Paper>
    </Box>
  );
}
