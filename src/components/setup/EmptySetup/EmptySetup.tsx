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
          <Title order={2}>No OpenProject projects found</Title>
          <Text c="dimmed">
            Check `OPENPROJECT_BASE_URL` and `OPENPROJECT_API_TOKEN`, then create or grant access to
            at least one OpenProject project.
          </Text>
        </Stack>
      </Paper>
    </Box>
  );
}
