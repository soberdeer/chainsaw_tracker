import { Button, Stack, Table, Text } from '@mantine/core';
import { summarizeImportRun, type MigrationRun } from '@/lib';

interface ImportsTabProps {
  imports: MigrationRun[];
  onOpenImportReport?: (report: MigrationRun) => void;
}

export function ImportsTab({ imports, onOpenImportReport }: ImportsTabProps) {
  if (!imports.length) {
    return (
      <Text size="sm" c="dimmed">
        Import has not been run yet for this workspace.
      </Text>
    );
  }

  return (
    <Stack>
      <Table withTableBorder striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Started</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Source</Table.Th>
            <Table.Th>Imported</Table.Th>
            <Table.Th>Warnings</Table.Th>
            <Table.Th>Errors</Table.Th>
            {onOpenImportReport && <Table.Th>Details</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {imports.map((item) => {
            const summary = summarizeImportRun(item);
            return (
              <Table.Tr key={item.id}>
                <Table.Td>{new Date(item.startedAt).toLocaleString()}</Table.Td>
                <Table.Td>{item.status}</Table.Td>
                <Table.Td>{item.source}</Table.Td>
                <Table.Td>{summary.tasksImported} tasks</Table.Td>
                <Table.Td>{summary.warningsCount}</Table.Td>
                <Table.Td>{summary.errorsCount}</Table.Td>
                {onOpenImportReport && (
                  <Table.Td>
                    <Button variant="light" size="xs" onClick={() => onOpenImportReport(item)}>
                      Open
                    </Button>
                  </Table.Td>
                )}
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
