import { Alert, Button, Group, Modal, SimpleGrid, Stack, Text } from '@mantine/core';
import { summarizeImportRun, type MigrationRun } from '@/lib';

interface ImportReportModalProps {
  report: MigrationRun | null;
  onClose: () => void;
  onCopied: (message: string) => void;
}

export function ImportReportModal({ report, onClose, onCopied }: ImportReportModalProps) {
  return (
    <Modal opened={Boolean(report)} onClose={onClose} title="Import report" size="lg">
      {report && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }}>
            {(() => {
              const summary = summarizeImportRun(report);
              return (
                <>
                  <Alert variant="light" color="blue" title="Tasks imported">
                    {summary.tasksImported}
                  </Alert>
                  <Alert variant="light" color="teal" title="Users imported">
                    {summary.usersImported}
                  </Alert>
                  <Alert variant="light" color="grape" title="Assignees mapped">
                    {summary.assigneesMapped}
                  </Alert>
                  <Alert
                    variant="light"
                    color={summary.errorsCount > 0 ? 'red' : 'yellow'}
                    title="Warnings / errors"
                  >
                    {summary.warningsCount} / {summary.errorsCount}
                  </Alert>
                  <Alert variant="light" color="indigo" title="Responsible mapped">
                    {summary.responsibleMapped}
                  </Alert>
                  <Alert variant="light" color="cyan" title="Additional assignees stored">
                    {summary.additionalAssigneesStored}
                  </Alert>
                </>
              );
            })()}
          </SimpleGrid>
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>
                {report.source} • {report.status}
              </Text>
              <Text size="sm" c="dimmed">
                Started {new Date(report.startedAt).toLocaleString()}
              </Text>
              {report.finishedAt && (
                <Text size="sm" c="dimmed">
                  Finished {new Date(report.finishedAt).toLocaleString()}
                </Text>
              )}
            </Stack>
            <Button
              component="a"
              href={`/api/import-reports/${report.id}/json`}
              target="_blank"
              variant="light"
            >
              Download JSON
            </Button>
          </Group>
          <Group>
            <Button
              variant="subtle"
              onClick={() => {
                navigator.clipboard?.writeText(JSON.stringify(report, null, 2));
                onCopied('Import report JSON copied.');
              }}
            >
              Copy JSON
            </Button>
          </Group>
          <Text size="sm" fw={700}>
            Summary
          </Text>
          <Text component="pre" size="xs" style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(report.summary || {}, null, 2)}
          </Text>
          <Text size="sm" fw={700}>
            Warnings
          </Text>
          <Text component="pre" size="xs" style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(report.warnings || [], null, 2)}
          </Text>
          <Text size="sm" fw={700}>
            Errors
          </Text>
          <Text component="pre" size="xs" style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(report.errors || [], null, 2)}
          </Text>
        </Stack>
      )}
    </Modal>
  );
}
