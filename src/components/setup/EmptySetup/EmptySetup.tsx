import { Box, Paper, Stack, Text, Title } from '@mantine/core';
import type { Workspace } from '@/lib';
import classes from './EmptySetup.module.css';

export interface EmptySetupProps {
  onCreated: (workspace: Workspace) => void;
}

export function EmptySetup({ onCreated }: EmptySetupProps) {
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
