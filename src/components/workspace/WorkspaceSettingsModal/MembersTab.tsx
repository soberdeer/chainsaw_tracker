import { Badge, Button, Group, Stack, Table, Text, TextInput, UnstyledButton } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { IconChevronDown, IconChevronUp, IconSelector } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { WorkspaceMemberItem } from '@/lib';

interface InviteFormValues {
  email: string;
  name: string;
}

interface MembersTabProps {
  members: WorkspaceMemberItem[];
  canManageWorkspace: boolean;
  inviteForm: UseFormReturnType<InviteFormValues>;
  onInviteSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

type SortCol = 'name' | 'email' | 'role' | 'lastLogin';

export function MembersTab({
  members,
  canManageWorkspace,
  inviteForm,
  onInviteSubmit,
}: MembersTabProps) {
  const [sortCol, setSortCol] = useState<SortCol>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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
          return factor * ((a.user.opAdmin ? 0 : 1) - (b.user.opAdmin ? 0 : 1));
        case 'lastLogin': {
          const la = a.user.lastLoginAt ?? '';
          const lb = b.user.lastLoginAt ?? '';
          if (!la && !lb) return 0;
          if (!la) return factor;
          if (!lb) return -factor;
          return factor * la.localeCompare(lb);
        }
        default:
          return 0;
      }
    });
  }, [members, sortCol, sortDir]);

  const columns: { key: SortCol; label: string }[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'lastLogin', label: 'Last login' },
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
                <Badge size="sm" variant="outline" color={member.user.opAdmin ? 'red' : 'blue'}>
                  {member.user.opAdmin ? 'Administrator' : 'Member'}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {member.user.lastLoginAt
                    ? new Date(member.user.lastLoginAt).toLocaleString()
                    : 'Never'}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
