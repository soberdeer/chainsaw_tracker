import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  UnstyledButton,
  Tooltip,
} from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { IconChevronDown, IconChevronUp, IconSelector, IconTrash } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { WorkspaceMemberItem, WorkspaceRole } from '@/lib';

interface InviteFormValues {
  email: string;
  name: string;
  role: WorkspaceRole;
}

interface MembersTabProps {
  members: WorkspaceMemberItem[];
  canManageWorkspace: boolean;
  inviteForm: UseFormReturnType<InviteFormValues>;
  onInviteSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
  onRoleChange?: (userId: string, role: WorkspaceRole) => Promise<void>;
  onMemberRemove?: (userId: string) => Promise<void>;
}

type SortCol = 'name' | 'email' | 'role' | 'teams';

export function MembersTab({
  members,
  canManageWorkspace,
  inviteForm,
  onInviteSubmit,
  onRoleChange,
  onMemberRemove,
}: MembersTabProps) {
  const [sortCol, setSortCol] = useState<SortCol>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [confirmRemoveUser, setConfirmRemoveUser] = useState<WorkspaceMemberItem | null>(null);

  const handleSort = (col: SortCol) => {
    if (col === sortCol) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedMembers = useMemo(() => {
    const factor = sortDir === 'asc' ? 1 : -1;
    return [...members].sort((a, b) => {
      switch (sortCol) {
        case 'name':
          return factor * a.user.name.localeCompare(b.user.name);
        case 'email':
          return factor * a.user.email.localeCompare(b.user.email);
        case 'role':
          return factor * ((a.role === 'ADMIN' ? 0 : 1) - (b.role === 'ADMIN' ? 0 : 1));
        case 'teams':
          return factor * ((a.teams?.length ?? 0) - (b.teams?.length ?? 0));
        default:
          return 0;
      }
    });
  }, [members, sortCol, sortDir]);

  const columns: { key: SortCol; label: string }[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'teams', label: 'Teams' },
  ];

  return (
    <Stack>
      {!members.length && (
        <Text size="sm" c="dimmed">
          Only the owner is in this workspace so far.
        </Text>
      )}
      {canManageWorkspace && (
        <form onSubmit={onInviteSubmit} data-testid="workspace-invite-form">
          <Group align="flex-end">
            <TextInput
              label="Email"
              data-testid="workspace-invite-email"
              {...inviteForm.getInputProps('email')}
            />
            <TextInput
              label="Name"
              data-testid="workspace-invite-name"
              {...inviteForm.getInputProps('name')}
            />
            <Select
              label="Role"
              data-testid="workspace-invite-role"
              data={[
                { value: 'ADMIN', label: 'ADMIN' },
                { value: 'MEMBER', label: 'MEMBER' },
              ]}
              {...inviteForm.getInputProps('role')}
            />
            <Button type="submit" data-testid="workspace-invite-submit">
              Invite user
            </Button>
          </Group>
        </form>
      )}
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            {columns.map(({ key, label }) => {
              const active = sortCol === key;
              const Icon = active
                ? sortDir === 'asc'
                  ? IconChevronUp
                  : IconChevronDown
                : IconSelector;
              return (
                <Table.Th key={key} style={{ whiteSpace: 'nowrap' }}>
                  <UnstyledButton
                    onClick={() => handleSort(key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontWeight: active ? 700 : undefined,
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                    <Icon size={14} style={{ opacity: active ? 1 : 0.4 }} />
                  </UnstyledButton>
                </Table.Th>
              );
            })}
            {canManageWorkspace && onMemberRemove && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sortedMembers.map((member) => (
            <Table.Tr
              key={member.id}
              data-testid="workspace-member-row"
              data-user-id={member.user.id}
            >
              <Table.Td>{member.user.name}</Table.Td>
              <Table.Td>{member.user.email}</Table.Td>
              <Table.Td>
                {canManageWorkspace && onRoleChange ? (
                  <Group gap={6} wrap="nowrap">
                    <Select
                      size="xs"
                      value={member.role}
                      data={[
                        { value: 'ADMIN', label: 'ADMIN' },
                        { value: 'MEMBER', label: 'MEMBER' },
                      ]}
                      disabled={changingRole === member.user.id}
                      data-testid={`workspace-member-role-${member.user.id}`}
                      onChange={async (value) => {
                        if (!value || value === member.role) return;
                        setChangingRole(member.user.id);
                        try {
                          await onRoleChange(member.user.id, value as WorkspaceRole);
                        } finally {
                          setChangingRole(null);
                        }
                      }}
                      styles={{ input: { minWidth: 130 } }}
                    />
                    {changingRole === member.user.id && <Loader size="xs" />}
                  </Group>
                ) : (
                  <Badge
                    size="sm"
                    variant="outline"
                    color={member.role === 'ADMIN' ? 'red' : 'blue'}
                  >
                    {member.role === 'ADMIN' ? 'Administrator' : 'Member'}
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>
                {(() => {
                  const teams = member.teams ?? [];
                  if (!teams.length)
                    return (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    );
                  const visible = teams.slice(0, 3);
                  const hidden = teams.slice(3);
                  return (
                    <Group gap={4} wrap="wrap">
                      {visible.map((t) => (
                        <Badge key={t} size="xs" variant="light" color="gray">
                          {t}
                        </Badge>
                      ))}
                      {hidden.length > 0 && (
                        <Tooltip label={hidden.join(', ')} withArrow>
                          <Badge
                            size="xs"
                            variant="light"
                            color="gray"
                            style={{ cursor: 'default' }}
                          >
                            +{hidden.length}
                          </Badge>
                        </Tooltip>
                      )}
                    </Group>
                  );
                })()}
              </Table.Td>
              {canManageWorkspace && onMemberRemove && (
                <Table.Td>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    size="sm"
                    data-testid={`workspace-member-remove-${member.user.id}`}
                    disabled={removingUserId === member.user.id}
                    onClick={() => setConfirmRemoveUser(member)}
                  >
                    <IconTrash size="0.9rem" />
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal
        opened={confirmRemoveUser !== null}
        onClose={() => setConfirmRemoveUser(null)}
        title="Remove member"
        size="sm"
        centered
      >
        <Stack>
          <Text size="sm">
            Remove <strong>{confirmRemoveUser?.user.name || confirmRemoveUser?.user.email}</strong>{' '}
            from the workspace?
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmRemoveUser(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={removingUserId === confirmRemoveUser?.user.id}
              onClick={async () => {
                if (!confirmRemoveUser || !onMemberRemove) return;
                setRemovingUserId(confirmRemoveUser.user.id);
                try {
                  await onMemberRemove(confirmRemoveUser.user.id);
                  setConfirmRemoveUser(null);
                } finally {
                  setRemovingUserId(null);
                }
              }}
            >
              Remove member
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
