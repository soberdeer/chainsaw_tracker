import { Badge, Button, Group, Stack, Text } from '@mantine/core';
import type { OpenProjectConnectionStatus } from '@/lib';

interface OpenProjectTabProps {
  connectionStatus: OpenProjectConnectionStatus | null;
  onRefresh: () => Promise<void>;
}

export function OpenProjectTab({ connectionStatus, onRefresh }: OpenProjectTabProps) {
  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={700}>Runtime connection</Text>
        <Button variant="light" onClick={onRefresh}>
          Test connection
        </Button>
      </Group>
      <Text>Base URL: {connectionStatus?.baseUrl}</Text>
      <Text>Auth mode: {connectionStatus?.authMode}</Text>
      <Group gap="xs">
        <Badge color={connectionStatus?.ok ? 'green' : 'red'}>
          {connectionStatus?.ok ? 'Connected' : 'Connection failed'}
        </Badge>
        {connectionStatus?.error && <Text c="red">{connectionStatus.error}</Text>}
      </Group>
      <Text size="sm" c="dimmed">
        The OpenProject token stays on the backend. This screen only shows connection metadata and
        runtime visibility.
      </Text>
    </Stack>
  );
}
