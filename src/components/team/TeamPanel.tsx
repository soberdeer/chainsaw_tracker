import { useState } from 'react';
import { Avatar, Badge, Button, Checkbox, Group, Modal, Paper, Select, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconMailPlus } from '@tabler/icons-react';
import { inviteMember, updateMembership, updateWorkspacePermissions } from '../../lib/api';
import type { PermissionSet, Workspace, WorkspaceRole } from '../../lib/types';
import { getErrorMessage } from '../../lib/taskUi';

const roles: WorkspaceRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
const permissionKeys: Array<keyof Omit<PermissionSet, 'role'>> = ['manageWorkspace', 'manageSpaces', 'manageDocs', 'manageTasks', 'inviteMembers'];

export function TeamPanel({
  workspace,
  onChanged,
  onError
}: {
  workspace: Workspace;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('MEMBER');
  const [inviteUrl, setInviteUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    try {
      setSaving(true);
      await action();
      onChanged();
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async () => {
    if (!email.trim()) return;
    await run(async () => {
      const invite = await inviteMember(workspace.id, { email, role });
      setInviteUrl(invite.inviteUrl);
      setEmail('');
    });
  };

  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
      <Modal opened={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite by email" centered classNames={{ content: 'clickup-modal' }}>
        <Stack>
          <TextInput label="Email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} autoFocus />
          <Select label="Role" value={role} onChange={(value) => setRole((value || 'MEMBER') as WorkspaceRole)} data={roles} />
          {inviteUrl && (
            <Paper withBorder p="sm">
              <Text size="sm" c="dimmed">Invite link</Text>
              <Text size="sm">{inviteUrl}</Text>
            </Paper>
          )}
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setInviteOpen(false)}>Close</Button>
            <Button loading={saving} leftSection={<IconMailPlus size="1rem" />} onClick={sendInvite}>Invite</Button>
          </Group>
        </Stack>
      </Modal>
      <Stack>
        <Group justify="space-between">
          <Title order={3}>Team</Title>
          <Button leftSection={<IconMailPlus size="1rem" />} onClick={() => setInviteOpen(true)}>Invite by email</Button>
        </Group>
        <Paper withBorder>
          <Table verticalSpacing="md">
            <Table.Thead>
              <Table.Tr><Table.Th>Member</Table.Th><Table.Th>Role</Table.Th><Table.Th>Email</Table.Th></Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {workspace.memberships.map((membership) => (
                <Table.Tr key={membership.id}>
                  <Table.Td>
                    <Group gap="sm">
                      <Avatar radius="xl">{membership.user.name.slice(0, 1)}</Avatar>
                      <Text fw={650}>{membership.user.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      value={membership.role}
                      data={roles}
                      onChange={(value) => value && void run(() => updateMembership(workspace.id, membership.id, value as WorkspaceRole))}
                      disabled={saving}
                    />
                  </Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">{membership.user.email}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      </Stack>
      <Stack>
        <Title order={3}>Permissions</Title>
        <Paper withBorder>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Role</Table.Th>
                <Table.Th>Workspace</Table.Th>
                <Table.Th>Spaces</Table.Th>
                <Table.Th>Docs</Table.Th>
                <Table.Th>Tasks</Table.Th>
                <Table.Th>Invites</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {workspace.permissionSets.map((set) => (
                <Table.Tr key={set.role}>
                  <Table.Td><Text fw={700}>{set.role}</Text></Table.Td>
                  {permissionKeys.map((key) => (
                    <Table.Td key={key}>
                      <Checkbox
                        checked={set[key]}
                        disabled={set.role === 'OWNER' || saving}
                        onChange={(event) => {
                          void run(() => updateWorkspacePermissions(workspace.id, set.role, {
                            manageWorkspace: set.manageWorkspace,
                            manageSpaces: set.manageSpaces,
                            manageDocs: set.manageDocs,
                            manageTasks: set.manageTasks,
                            inviteMembers: set.inviteMembers,
                            [key]: event.currentTarget.checked
                          }));
                        }}
                      />
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      </Stack>
    </SimpleGrid>
  );
}
