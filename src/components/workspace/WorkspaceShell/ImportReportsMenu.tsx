import { ActionIcon, Menu, Stack, Text, Tooltip } from '@mantine/core';
import { IconReport } from '@tabler/icons-react';
import { useWorkspaceShellContext } from './WorkspaceShellContext';

export function ImportReportsMenu() {
  const state = useWorkspaceShellContext();

  return (
    <Menu width="24rem" position="bottom-end">
      <Menu.Target>
        <Tooltip label="Import reports">
          <ActionIcon variant="light" aria-label="Import reports">
            <IconReport size="1.125rem" />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Latest import reports</Menu.Label>
        {state.importReports.slice(0, 8).map((report) => (
          <Menu.Item key={report.id} onClick={() => state.openImportReport(report)}>
            <Stack gap={2}>
              <Text size="sm" fw={700}>
                {report.source} • {report.status}
              </Text>
              <Text size="xs" c="dimmed">
                {new Date(report.startedAt).toLocaleString()}
              </Text>
            </Stack>
          </Menu.Item>
        ))}
        {!state.importReports.length && <Menu.Item disabled>No import reports yet</Menu.Item>}
      </Menu.Dropdown>
    </Menu>
  );
}
