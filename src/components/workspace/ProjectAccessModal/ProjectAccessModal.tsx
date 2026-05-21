import { Alert, Button, Group, Loader, Modal, Stack, Table, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import {
  getErrorMessage,
  getOpenProjectProjectMembers,
  type OpenProjectProjectMember,
} from '@/lib';

export interface ProjectAccessModalProps {
  opened: boolean;
  workspaceId: string;
  projectId?: string;
  projectName?: string;
  onClose: () => void;
}

export function ProjectAccessModal({
  opened,
  workspaceId,
  projectId,
  projectName,
  onClose,
}: ProjectAccessModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<OpenProjectProjectMember[]>([]);
  const [settingsUrl, setSettingsUrl] = useState<string>('');

  useEffect(() => {
    if (!opened || !projectId) return;
    setLoading(true);
    setError(null);
    getOpenProjectProjectMembers(workspaceId, projectId)
      .then((payload) => {
        setMembers(payload.items);
        setSettingsUrl(payload.settingsUrl);
      })
      .catch((caughtError) => setError(getErrorMessage(caughtError)))
      .finally(() => setLoading(false));
  }, [opened, workspaceId, projectId]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Project access${projectName ? `: ${projectName}` : ''}`}
      size="56rem"
      centered
    >
      <Stack>
        {error && (
          <Alert color="red" title="Could not load OpenProject access">
            {error}
          </Alert>
        )}
        <Alert color="blue" title="Managed in OpenProject">
          This table shows real OpenProject project memberships. Role changes for project access are
          still managed in OpenProject settings in this MVP.
        </Alert>
        {!loading && !members.length && (
          <Alert color="yellow" title="No visible project memberships">
            OpenProject did not return any memberships for this project and token. Check the project
            access in OpenProject if this looks unexpected.
          </Alert>
        )}
        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : (
          <>
            <Table withTableBorder striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>OpenProject user</Table.Th>
                  <Table.Th>Project membership</Table.Th>
                  <Table.Th>Linked local user</Table.Th>
                  <Table.Th>Source</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {members.map((member) => (
                  <Table.Tr key={member.membershipId}>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text>{member.openProjectName}</Text>
                        <Text size="xs" c="dimmed">
                          {member.openProjectLogin ||
                            member.openProjectEmail ||
                            member.openProjectUserId}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>{member.roles.join(', ')}</Table.Td>
                    <Table.Td>
                      {member.linkedLocalUser?.email || (
                        <Text size="sm" c="dimmed">
                          Not linked to a local tracker user
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>{member.source || 'manual OpenProject membership'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group justify="flex-end">
              <Button component="a" href={settingsUrl} target="_blank" rel="noreferrer">
                OpenProject settings
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
