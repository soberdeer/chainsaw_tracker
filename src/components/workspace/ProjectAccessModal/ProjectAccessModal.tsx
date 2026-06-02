import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconTrash, IconUserPlus } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import {
  addOpenProjectProjectMember,
  getErrorMessage,
  getOpenProjectProjectMembers,
  getOpenProjectRoles,
  removeOpenProjectProjectMember,
  updateOpenProjectMembershipRoles,
  type OpenProjectProjectMember,
  type OpenProjectRole,
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
  const [roles, setRoles] = useState<OpenProjectRole[]>([]);
  const [settingsUrl, setSettingsUrl] = useState<string>('');
  const [updatingMembership, setUpdatingMembership] = useState<string | null>(null);
  const [removingMembership, setRemovingMembership] = useState<string | null>(null);
  const [addUserId, setAddUserId] = useState<string>('');
  const [addRoleIds, setAddRoleIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (!opened || !projectId) return;
    setLoading(true);
    setError(null);
    setShowAddForm(false);
    setAddUserId('');
    setAddRoleIds([]);
    Promise.all([getOpenProjectProjectMembers(workspaceId, projectId), getOpenProjectRoles()])
      .then(([payload, availableRoles]) => {
        setMembers(payload.items);
        setSettingsUrl(payload.settingsUrl);
        setRoles(availableRoles);
      })
      .catch((caughtError) => setError(getErrorMessage(caughtError)))
      .finally(() => setLoading(false));
  }, [opened, workspaceId, projectId]);

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));

  const handleRoleChange = async (membershipId: string, selectedRoleIds: string[]) => {
    if (!selectedRoleIds.length) return;
    setUpdatingMembership(membershipId);
    try {
      await updateOpenProjectMembershipRoles(membershipId, selectedRoleIds);
      setMembers((current) =>
        current.map((m) =>
          m.membershipId === membershipId
            ? {
                ...m,
                roles: roles.filter((r) => selectedRoleIds.includes(r.id)).map((r) => r.name),
              }
            : m
        )
      );
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setUpdatingMembership(null);
    }
  };

  const handleRemove = async (membershipId: string) => {
    setRemovingMembership(membershipId);
    try {
      await removeOpenProjectProjectMember(membershipId);
      setMembers((current) => current.filter((m) => m.membershipId !== membershipId));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setRemovingMembership(null);
    }
  };

  const handleAdd = async () => {
    if (!projectId || !addUserId || !addRoleIds.length) return;
    setAdding(true);
    setError(null);
    try {
      const result = await addOpenProjectProjectMember(projectId, {
        userId: addUserId,
        roleIds: addRoleIds,
      });
      setMembers(result.items);
      setSettingsUrl(result.settingsUrl);
      setShowAddForm(false);
      setAddUserId('');
      setAddRoleIds([]);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Project access${projectName ? `: ${projectName}` : ''}`}
      size="60rem"
      centered
    >
      <Stack>
        {error && (
          <Alert color="red" title="Error" onClose={() => setError(null)} withCloseButton>
            {error}
          </Alert>
        )}

        {!loading && !members.length && (
          <Alert color="yellow" title="No visible project memberships">
            OpenProject did not return any memberships for this project. Check the project access in
            OpenProject if this looks unexpected.
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
                  <Table.Th>Project roles</Table.Th>
                  <Table.Th style={{ width: 48 }} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {members.map((member) => {
                  const currentRoleIds = roles
                    .filter((r) => member.roles.includes(r.name))
                    .map((r) => r.id);
                  return (
                    <Table.Tr key={member.membershipId}>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text size="sm">{member.openProjectName}</Text>
                          <Text size="xs" c="dimmed">
                            {member.openProjectEmail ||
                              member.openProjectLogin ||
                              member.openProjectUserId}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={6} wrap="nowrap">
                          <MultiSelect
                            size="xs"
                            data={roleOptions}
                            value={currentRoleIds}
                            disabled={updatingMembership === member.membershipId}
                            onChange={(ids) => handleRoleChange(member.membershipId, ids)}
                            placeholder="Select roles"
                            styles={{ input: { minWidth: 200 } }}
                          />
                          {updatingMembership === member.membershipId && <Loader size="xs" />}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label="Remove from project">
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            loading={removingMembership === member.membershipId}
                            onClick={() => handleRemove(member.membershipId)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>

            {showAddForm ? (
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Add member
                </Text>
                <Group align="flex-end">
                  <Select
                    label="OpenProject user ID"
                    placeholder="User ID (numeric)"
                    value={addUserId}
                    onChange={(v) => setAddUserId(v || '')}
                    data={members.map((m) => ({
                      value: m.openProjectUserId,
                      label: `${m.openProjectName} (${m.openProjectUserId})`,
                    }))}
                    searchable
                    clearable
                    style={{ flex: 1 }}
                  />
                  <MultiSelect
                    label="Roles"
                    data={roleOptions}
                    value={addRoleIds}
                    onChange={setAddRoleIds}
                    placeholder="Select roles"
                    style={{ flex: 1 }}
                  />
                  <Button
                    onClick={handleAdd}
                    loading={adding}
                    disabled={!addUserId || !addRoleIds.length}
                  >
                    Add
                  </Button>
                  <Button variant="subtle" color="gray" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Group justify="space-between">
                <Button
                  leftSection={<IconUserPlus size={16} />}
                  variant="light"
                  onClick={() => setShowAddForm(true)}
                >
                  Add member
                </Button>
                <Button
                  component="a"
                  href={settingsUrl}
                  target="_blank"
                  rel="noreferrer"
                  variant="subtle"
                >
                  OpenProject settings
                </Button>
              </Group>
            )}
          </>
        )}
      </Stack>
    </Modal>
  );
}
