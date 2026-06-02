import { Stack, Table } from '@mantine/core';
import type { PermissionSet } from '@/lib';

interface PermissionsTabProps {
  permissionSets: PermissionSet[];
}

export function PermissionsTab({ permissionSets }: PermissionsTabProps) {
  return (
    <Stack>
      <Table withTableBorder striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Role</Table.Th>
            <Table.Th>Workspace</Table.Th>
            <Table.Th>Spaces</Table.Th>
            <Table.Th>Tasks</Table.Th>
            <Table.Th>Docs</Table.Th>
            <Table.Th>Invite</Table.Th>
            <Table.Th>Reports</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {permissionSets.map((set) => (
            <Table.Tr key={set.role}>
              <Table.Td>{set.role}</Table.Td>
              <Table.Td>{set.manageWorkspace ? 'Yes' : 'No'}</Table.Td>
              <Table.Td>{set.manageSpaces ? 'Yes' : 'No'}</Table.Td>
              <Table.Td>{set.manageTasks ? 'Yes' : 'No'}</Table.Td>
              <Table.Td>{set.manageDocs ? 'Yes' : 'No'}</Table.Td>
              <Table.Td>{set.inviteMembers ? 'Yes' : 'No'}</Table.Td>
              <Table.Td>{set.viewReports ? 'Yes' : 'No'}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
