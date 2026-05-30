import { Alert, Stack, Table, Text } from '@mantine/core';
import type { UserProfile } from '@/lib';

interface AccessTabProps {
  profile: UserProfile | null;
}

function permissionSummary(
  permissions?: UserProfile['memberships'][number]['permissions']
): string {
  if (!permissions) return 'Inherited from the workspace role';
  return (
    [
      permissions.manageWorkspace && 'Workspace',
      permissions.manageSpaces && 'Spaces',
      permissions.manageTasks && 'Tasks',
      permissions.manageDocs && 'Local Docs',
      permissions.inviteMembers && 'Members',
      permissions.viewReports && 'Reports',
    ]
      .filter(Boolean)
      .join(', ') || 'Read-only'
  );
}

export function AccessTab({ profile }: AccessTabProps) {
  return (
    <Stack>
      <Alert title="Access model" color="blue">
        Local tracker role controls the custom UI. OpenProject memberships control access to
        OpenProject projects and work packages.
      </Alert>
      {!profile?.openProjectUserId && (
        <Alert title="OpenProject link missing" color="yellow">
          This local tracker account is not linked to an OpenProject user yet. You can still use
          local settings, but OpenProject assignee-based views will not resolve your work until the
          link exists.
        </Alert>
      )}

      <Stack gap="xs">
        <Text fw={600}>Local workspace access</Text>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Workspace</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Permission set</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(profile?.memberships || []).map((membership) => (
              <Table.Tr key={membership.id}>
                <Table.Td>{membership.workspaceName}</Table.Td>
                <Table.Td>{membership.role}</Table.Td>
                <Table.Td>{permissionSummary(membership.permissions)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>

      <Stack gap="xs">
        <Text fw={600}>OpenProject project memberships</Text>
        {(profile?.openProjectMemberships || []).length ? (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Project</Table.Th>
                <Table.Th>Role</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {profile?.openProjectMemberships.map((membership) => (
                <Table.Tr key={membership.membershipId}>
                  <Table.Td>{membership.projectName}</Table.Td>
                  <Table.Td>{membership.roles.join(', ')}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text size="sm" c="dimmed">
            No linked OpenProject memberships found for this account yet.
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
