import {
  Alert,
  Badge,
  Button,
  Checkbox,
  ColorInput,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import {
  getErrorMessage,
  getWorkspaceImportReports,
  getWorkspaceMembers,
  getWorkspaceOpenProjectStatus,
  getWorkspacePermissionSets,
  getWorkspaceSettings,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  summarizeImportRun,
  updateWorkspaceMemberRole,
  updateWorkspaceSettings,
  type MigrationRun,
  type OpenProjectConnectionStatus,
  type PermissionSet,
  type WorkspaceMemberItem,
  type WorkspaceRole,
  type WorkspaceSettings,
} from '@/lib';

const roleOptions: WorkspaceRole[] = ['OWNER', 'ADMIN', 'LEAD', 'MEMBER', 'VIEWER'];

export interface WorkspaceSettingsModalProps {
  opened: boolean;
  workspaceId: string;
  currentRole?: WorkspaceRole;
  canManageWorkspace: boolean;
  initialTab?: string;
  onClose: () => void;
  onUpdated: (settings: WorkspaceSettings) => void;
  onOpenImportReport?: (report: MigrationRun) => void;
}

export function WorkspaceSettingsModal({
  opened,
  workspaceId,
  currentRole,
  canManageWorkspace,
  initialTab,
  onClose,
  onUpdated,
  onOpenImportReport,
}: WorkspaceSettingsModalProps) {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [permissionSets, setPermissionSets] = useState<PermissionSet[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<OpenProjectConnectionStatus | null>(
    null
  );
  const [imports, setImports] = useState<MigrationRun[]>([]);
  const [activeTab, setActiveTab] = useState(initialTab || 'general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('MEMBER');
  const [createOpenProjectUser, setCreateOpenProjectUser] = useState(true);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setInviteResult(null);
    setActiveTab(initialTab || 'general');
    Promise.all([
      getWorkspaceSettings(workspaceId).then(setSettings),
      getWorkspaceMembers(workspaceId).then((payload) => setMembers(payload.items)),
      getWorkspacePermissionSets(workspaceId).then((payload) => setPermissionSets(payload.items)),
      getWorkspaceOpenProjectStatus(workspaceId).then(setConnectionStatus),
      getWorkspaceImportReports(workspaceId).then((payload) => setImports(payload.items)),
    ])
      .catch((caughtError) => setError(getErrorMessage(caughtError)))
      .finally(() => setLoading(false));
  }, [opened, workspaceId, initialTab]);

  const saveGeneral = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const updated = await updateWorkspaceSettings(workspaceId, {
        name: settings.name,
        slug: settings.slug,
        description: settings.description || null,
        avatarUrl: settings.avatarUrl || null,
        color: settings.color || null,
      });
      setSettings(updated);
      onUpdated(updated);
      setSuccess('Workspace settings saved.');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  };

  const submitInvite = async () => {
    try {
      setError(null);
      setSuccess(null);
      setInviteResult(null);
      const result = await inviteWorkspaceMember(workspaceId, {
        email: inviteEmail,
        name: inviteName || undefined,
        role: inviteRole,
        createOpenProjectUser,
      });
      setMembers((current) =>
        [
          ...current.filter((item) => item.user.id !== result.membership.user.id),
          result.membership,
        ].sort((left, right) => left.user.email.localeCompare(right.user.email))
      );
      setInviteEmail('');
      setInviteName('');
      setInviteRole('MEMBER');
      setCreateOpenProjectUser(true);
      setInviteResult(
        [
          result.temporaryPassword
            ? `Local temporary password: ${result.temporaryPassword}`
            : 'Local account reused.',
          result.openProjectTemporaryPassword
            ? `OpenProject temporary password: ${result.openProjectTemporaryPassword}`
            : null,
        ]
          .filter(Boolean)
          .join(' ')
      );
      setSuccess('Workspace member access updated.');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Workspace settings" size="72rem" centered>
      <Stack>
        {error && (
          <Alert color="red" title="Could not update workspace settings">
            {error}
          </Alert>
        )}
        {success && (
          <Alert color="green" title="Saved">
            {success}
          </Alert>
        )}
        {inviteResult && (
          <Alert color="green" title="Member updated">
            {inviteResult}
          </Alert>
        )}
        {loading || !settings ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : (
          <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'general')}>
            <Tabs.List>
              <Tabs.Tab value="general">General</Tabs.Tab>
              <Tabs.Tab value="members">Members</Tabs.Tab>
              <Tabs.Tab value="permissions">Roles & Permissions</Tabs.Tab>
              <Tabs.Tab value="openproject">OpenProject</Tabs.Tab>
              <Tabs.Tab value="imports">Imports</Tabs.Tab>
              {currentRole === 'OWNER' && <Tabs.Tab value="danger">Danger Zone</Tabs.Tab>}
            </Tabs.List>

            <Tabs.Panel value="general" pt="md">
              <Stack>
                <TextInput
                  label="Workspace name"
                  value={settings.name}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, name: event.currentTarget.value } : current
                    )
                  }
                  disabled={!canManageWorkspace}
                />
                <TextInput
                  label="Workspace slug"
                  value={settings.slug}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, slug: event.currentTarget.value } : current
                    )
                  }
                  disabled={!canManageWorkspace}
                />
                <Textarea
                  label="Description"
                  value={settings.description || ''}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, description: event.currentTarget.value } : current
                    )
                  }
                  disabled={!canManageWorkspace}
                />
                <TextInput
                  label="Avatar URL"
                  value={settings.avatarUrl || ''}
                  onChange={(event) =>
                    setSettings((current) =>
                      current ? { ...current, avatarUrl: event.currentTarget.value } : current
                    )
                  }
                  disabled={!canManageWorkspace}
                />
                <ColorInput
                  label="Accent color"
                  value={settings.color || '#228be6'}
                  onChange={(value) =>
                    setSettings((current) => (current ? { ...current, color: value } : current))
                  }
                  disabled={!canManageWorkspace}
                />
                <Group justify="flex-end">
                  <Button onClick={saveGeneral} loading={saving} disabled={!canManageWorkspace}>
                    Save workspace
                  </Button>
                </Group>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="members" pt="md">
              <Stack>
                <Alert color="blue" title="Access model">
                  Local role controls access to the custom tracker UI. OpenProject access is linked
                  separately through the OpenProject user connection.
                </Alert>
                {!members.length && (
                  <Text size="sm" c="dimmed">
                    Only the owner is in this workspace so far.
                  </Text>
                )}
                {canManageWorkspace && (
                  <Group align="flex-end" grow>
                    <TextInput
                      label="Email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.currentTarget.value)}
                    />
                    <TextInput
                      label="Name"
                      value={inviteName}
                      onChange={(event) => setInviteName(event.currentTarget.value)}
                    />
                    <Select
                      label="Role"
                      value={inviteRole}
                      onChange={(value) => setInviteRole((value as WorkspaceRole) || 'MEMBER')}
                      data={roleOptions}
                    />
                    <Checkbox
                      label="Create linked OpenProject user"
                      checked={createOpenProjectUser}
                      onChange={(event) => setCreateOpenProjectUser(event.currentTarget.checked)}
                    />
                    <Button onClick={submitInvite}>Invite user</Button>
                  </Group>
                )}
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Email</Table.Th>
                      <Table.Th>Local role</Table.Th>
                      <Table.Th>OpenProject access</Table.Th>
                      <Table.Th>Source</Table.Th>
                      <Table.Th>Last login</Table.Th>
                      {canManageWorkspace && <Table.Th>Actions</Table.Th>}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {members.map((member) => (
                      <Table.Tr key={member.id}>
                        <Table.Td>{member.user.name}</Table.Td>
                        <Table.Td>{member.user.email}</Table.Td>
                        <Table.Td>
                          {canManageWorkspace ? (
                            <Select
                              value={member.role}
                              onChange={async (value) => {
                                if (!value) return;
                                try {
                                  const updated = await updateWorkspaceMemberRole(
                                    workspaceId,
                                    member.user.id,
                                    value as WorkspaceRole
                                  );
                                  setMembers((current) =>
                                    current.map((item) => (item.id === updated.id ? updated : item))
                                  );
                                  setSuccess('Workspace role updated.');
                                } catch (caughtError) {
                                  setError(getErrorMessage(caughtError));
                                }
                              }}
                              data={roleOptions}
                            />
                          ) : (
                            member.role
                          )}
                        </Table.Td>
                        <Table.Td>
                          {member.user.openProjectUserId ? (
                            <Stack gap={2}>
                              <Text size="sm">
                                {member.user.openProjectLogin || member.user.openProjectUserId}
                              </Text>
                              <Badge size="xs" variant="light" color="green">
                                Linked
                              </Badge>
                            </Stack>
                          ) : (
                            <Badge size="xs" variant="light" color="yellow">
                              Not linked
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>{member.user.source || 'LOCAL'}</Table.Td>
                        <Table.Td>{member.user.lastLoginAt || 'Never'}</Table.Td>
                        {canManageWorkspace && (
                          <Table.Td>
                            <Button
                              color="red"
                              variant="light"
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    `Remove ${member.user.email} from this workspace?`
                                  )
                                ) {
                                  return;
                                }
                                try {
                                  await removeWorkspaceMember(workspaceId, member.user.id);
                                  setMembers((current) =>
                                    current.filter((item) => item.user.id !== member.user.id)
                                  );
                                  setSuccess('Workspace member removed.');
                                } catch (caughtError) {
                                  setError(getErrorMessage(caughtError));
                                }
                              }}
                            >
                              Remove
                            </Button>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="permissions" pt="md">
              <Stack>
                <Alert color="blue" title="Roles and permissions">
                  This controls access to the custom tracker UI. OpenProject project memberships
                  still control OpenProject tasks, comments, files, and workflow actions.
                </Alert>
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
            </Tabs.Panel>

            <Tabs.Panel value="openproject" pt="md">
              <Stack>
                <Group justify="space-between">
                  <Text fw={700}>Runtime connection</Text>
                  <Button
                    variant="light"
                    onClick={async () => {
                      try {
                        setError(null);
                        setConnectionStatus(await getWorkspaceOpenProjectStatus(workspaceId));
                      } catch (caughtError) {
                        setError(getErrorMessage(caughtError));
                      }
                    }}
                  >
                    Test connection
                  </Button>
                </Group>
                <Text>Base URL: {connectionStatus?.baseUrl}</Text>
                <Text>Auth mode: {connectionStatus?.authMode}</Text>
                <Group gap="xs">
                  <Badge color={connectionStatus?.ok ? 'green' : 'red'}>
                    {connectionStatus?.ok ? 'Connected' : 'Connection failed'}
                  </Badge>
                  {connectionStatus?.error && <Text c="red">{connectionStatus.error}</Text>}
                </Group>
                <Text size="sm" c="dimmed">
                  The OpenProject token stays on the backend. This screen only shows connection
                  metadata and runtime visibility.
                </Text>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="imports" pt="md">
              <Stack>
                {imports.length ? (
                  <Table withTableBorder striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Started</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Source</Table.Th>
                        <Table.Th>Imported</Table.Th>
                        <Table.Th>Warnings</Table.Th>
                        <Table.Th>Errors</Table.Th>
                        {onOpenImportReport && <Table.Th>Details</Table.Th>}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {imports.map((item) => {
                        const summary = summarizeImportRun(item);
                        return (
                          <Table.Tr key={item.id}>
                            <Table.Td>{new Date(item.startedAt).toLocaleString()}</Table.Td>
                            <Table.Td>{item.status}</Table.Td>
                            <Table.Td>{item.source}</Table.Td>
                            <Table.Td>{summary.tasksImported} tasks</Table.Td>
                            <Table.Td>{summary.warningsCount}</Table.Td>
                            <Table.Td>{summary.errorsCount}</Table.Td>
                            {onOpenImportReport && (
                              <Table.Td>
                                <Button
                                  variant="light"
                                  size="xs"
                                  onClick={() => onOpenImportReport(item)}
                                >
                                  Open
                                </Button>
                              </Table.Td>
                            )}
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text size="sm" c="dimmed">
                    Import has not been run yet for this workspace.
                  </Text>
                )}
              </Stack>
            </Tabs.Panel>

            {currentRole === 'OWNER' && (
              <Tabs.Panel value="danger" pt="md">
                <Stack>
                  <Alert color="red" title="Danger Zone">
                    Resetting OpenProject projects and work packages remains a guarded CLI action in
                    this MVP. It is intentionally not executable from the browser.
                  </Alert>
                  <Text ff="monospace">
                    npm run reset:openproject -- --yes --confirm{' '}
                    DELETE_ALL_OPENPROJECT_PROJECTS_AND_WORK_PACKAGES
                  </Text>
                </Stack>
              </Tabs.Panel>
            )}
          </Tabs>
        )}
      </Stack>
    </Modal>
  );
}
