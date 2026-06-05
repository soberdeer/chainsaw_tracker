import { Badge, Button, Group, List, Modal, Stack, Table, Text, Title } from '@mantine/core';
import { summarizeImportRun, type MigrationRun } from '@/lib';

interface ImportReportModalProps {
  report: MigrationRun | null;
  onClose: () => void;
}

export function ImportReportModal({ report, onClose }: ImportReportModalProps) {
  if (!report) return null;

  const summary = summarizeImportRun(report);
  const warnings = Array.isArray(report.warnings) ? (report.warnings as string[]) : [];
  const errors = Array.isArray(report.errors) ? (report.errors as string[]) : [];

  const metrics: Array<{ label: string; value: number | string }> = [
    { label: 'Projects imported', value: summary.projectsImported },
    { label: 'Tasks imported', value: summary.tasksImported },
    { label: 'Users imported', value: summary.usersImported },
    { label: 'Memberships', value: summary.membershipsImported },
    { label: 'Assignees mapped', value: summary.assigneesMapped },
    { label: 'Responsible mapped', value: summary.responsibleMapped },
    { label: 'Additional assignees stored', value: summary.additionalAssigneesStored },
    { label: 'Warnings', value: summary.warningsCount },
    { label: 'Errors', value: summary.errorsCount },
  ];

  return (
    <Modal opened={report !== null} onClose={onClose} title="Import report" size="lg" centered>
      <Stack>
        <Group>
          <Text size="sm" c="dimmed">
            Source: <strong>{report.source}</strong>
          </Text>
          <Badge
            color={
              report.status === 'SUCCESS' ? 'green' : report.status === 'FAILED' ? 'red' : 'yellow'
            }
          >
            {report.status}
          </Badge>
          <Text size="sm" c="dimmed">
            {new Date(report.startedAt).toLocaleString()}
          </Text>
        </Group>

        <Title order={5}>Summary</Title>
        <Table withTableBorder striped>
          <Table.Tbody>
            {metrics.map(({ label, value }) => (
              <Table.Tr key={label}>
                <Table.Td fw={500}>{label}</Table.Td>
                <Table.Td>{value}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {warnings.length > 0 && (
          <>
            <Title order={5}>Warnings</Title>
            <List size="sm">
              {warnings.map((w, i) => (
                <List.Item key={i}>{w}</List.Item>
              ))}
            </List>
          </>
        )}

        {errors.length > 0 && (
          <>
            <Title order={5}>Errors</Title>
            <List size="sm" c="red">
              {errors.map((e, i) => (
                <List.Item key={i}>{e}</List.Item>
              ))}
            </List>
          </>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
