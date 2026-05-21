import {
  Avatar,
  Button,
  Checkbox,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconMailPlus } from '@tabler/icons-react';
import { useState } from 'react';
import {
  inviteMember,
  updateMembership,
  updateWorkspacePermissions,
  getErrorMessage,
  type PermissionSet,
  type Workspace,
  type WorkspaceRole,
} from '@/lib';
import classes from './TeamPanel.module.css';

const roles: WorkspaceRole[] = ['OWNER', 'ADMIN', 'LEAD', 'MEMBER', 'VIEWER'];
const permissionKeys: Array<keyof Omit<PermissionSet, 'role'>> = [
  'manageWorkspace',
  'manageSpaces',
  'manageDocs',
  'manageTasks',
  'inviteMembers',
];

export interface TeamPanelProps {
  workspace: Workspace;
  onChanged: () => void;
  onError: (message: string) => void;
}

export function TeamPanel({ workspace, onChanged, onError }: TeamPanelProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const inviteForm = useForm({
    initialValues: {
      email: '',
      role: 'MEMBER' as WorkspaceRole,
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Enter a valid email address'),
    },
  });

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

  const sendInvite = inviteForm.onSubmit(async (values) => {
    await run(async () => {
      const invite = await inviteMember(workspace.id, { email: values.email, role: values.role });
      setInviteUrl(invite.inviteUrl);
      inviteForm.reset();
    });
  });

  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
      <Modal
        opened={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite by email"
        centered
        classNames={{ content: classes.modalContent }}
      >
        <form onSubmit={sendInvite}>
          <Stack>
            <TextInput label="Email" autoFocus {...inviteForm.getInputProps('email')} />
            <Select label="Role" data={roles} {...inviteForm.getInputProps('role')} />
            {inviteUrl && (
              <Paper withBorder p="sm">
                <Text size="sm" c="dimmed">
                  Invite link
                </Text>
                <Text size="sm">{inviteUrl}</Text>
              </Paper>
            )}
            <Group justify="flex-end">
              <Button type="button" variant="light" onClick={() => setInviteOpen(false)}>
                Close
              </Button>
              <Button loading={saving} leftSection={<IconMailPlus size="1rem" />} type="submit">
                Invite
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <Stack>
        <Group justify="space-between">
          <Title order={3}>Team</Title>
          <Button leftSection={<IconMailPlus size="1rem" />} onClick={() => setInviteOpen(true)}>
            Invite by email
          </Button>
        </Group>
        <Paper withBorder>
          <Table verticalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Member</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Email</Table.Th>
              </Table.Tr>
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
                      onChange={(value) =>
                        value &&
                        void run(() =>
                          updateMembership(workspace.id, membership.id, value as WorkspaceRole)
                        )
                      }
                      disabled={saving}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {membership.user.email}
                    </Text>
                  </Table.Td>
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
                  <Table.Td>
                    <Text fw={700}>{set.role}</Text>
                  </Table.Td>
                  {permissionKeys.map((key) => (
                    <Table.Td key={key}>
                      <Checkbox
                        checked={set[key]}
                        disabled={set.role === 'OWNER' || saving}
                        onChange={(event) => {
                          void run(() =>
                            updateWorkspacePermissions(workspace.id, set.role, {
                              manageWorkspace: set.manageWorkspace,
                              manageSpaces: set.manageSpaces,
                              manageDocs: set.manageDocs,
                              manageTasks: set.manageTasks,
                              inviteMembers: set.inviteMembers,
                              [key]: event.currentTarget.checked,
                            })
                          );
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
