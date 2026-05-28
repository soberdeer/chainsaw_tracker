import {
  Alert,
  Badge,
  Button,
  ColorInput,
  Group,
  Loader,
  Modal,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  UnstyledButton,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconChevronDown, IconChevronUp, IconSelector } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getErrorMessage,
  getWorkspaceImportReports,
  getWorkspaceMembers,
  getWorkspaceOpenProjectStatus,
  getWorkspacePermissionSets,
  getWorkspaceSettings,
  inviteWorkspaceMember,
  showToast,
  summarizeImportRun,
  updateWorkspaceSettings,
  type MigrationRun,
  type OpenProjectConnectionStatus,
  type PermissionSet,
  type WorkspaceMemberItem,
  type WorkspaceSettings,
  WorkspaceRole,
} from '@/lib';

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
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<'name' | 'email' | 'role' | 'lastLogin'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (col: typeof sortCol) => {
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
          // Admins first when asc
          return factor * ((a.user.opAdmin ? 0 : 1) - (b.user.opAdmin ? 0 : 1));
        case 'lastLogin': {
          const la = a.user.lastLoginAt ?? '';
          const lb = b.user.lastLoginAt ?? '';
          if (!la && !lb) return 0;
          if (!la) return factor; // nulls last in asc
          if (!lb) return -factor;
          return factor * la.localeCompare(lb);
        }
      }
    });
  }, [members, sortCol, sortDir]);
  const generalForm = useForm({
    initialValues: {
      name: '',
      slug: '',
      description: '',
      avatarUrl: '',
      color: '#228be6',
    },
    validate: {
      name: (value) => (value.trim().length ? null : 'Workspace name is required'),
      slug: (value) => (value.trim().length ? null : 'Workspace slug is required'),
    },
  });
  const generalFormRef = useRef(generalForm);
  generalFormRef.current = generalForm;
  const inviteForm = useForm({
    initialValues: {
      email: '',
      name: '',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Enter a valid email address'),
    },
  });

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setInviteResult(null);
    setActiveTab(initialTab || 'general');
    Promise.all([
      getWorkspaceSettings(workspaceId).then((workspaceSettings) => {
        setSettings(workspaceSettings);
        generalFormRef.current.setValues({
          name: workspaceSettings.name,
          slug: workspaceSettings.slug,
          description: workspaceSettings.description || '',
          avatarUrl: workspaceSettings.avatarUrl || '',
          color: workspaceSettings.color || '#228be6',
        });
      }),
      getWorkspaceMembers(workspaceId).then((payload) => setMembers(payload.items)),
      getWorkspacePermissionSets(workspaceId).then((payload) => setPermissionSets(payload.items)),
      getWorkspaceOpenProjectStatus(workspaceId).then(setConnectionStatus),
      getWorkspaceImportReports(workspaceId).then((payload) => setImports(payload.items)),
    ])
      .catch((caughtError) => setError(getErrorMessage(caughtError)))
      .finally(() => setLoading(false));
  }, [opened, workspaceId, initialTab]);

  const saveGeneral = generalForm.onSubmit(async (values) => {
    if (!settings) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const updated = await updateWorkspaceSettings(workspaceId, {
        name: values.name,
        slug: values.slug,
        description: values.description || null,
        avatarUrl: values.avatarUrl || null,
        color: values.color || null,
      });
      setSettings(updated);
      generalForm.setValues({
        name: updated.name,
        slug: updated.slug,
        description: updated.description || '',
        avatarUrl: updated.avatarUrl || '',
        color: updated.color || '#228be6',
      });
      onUpdated(updated);
      setSuccess('Workspace settings saved.');
      showToast({
        tone: 'success',
        title: 'Workspace updated',
        message: 'General workspace settings were saved.',
      });
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      showToast({
        tone: 'error',
        title: 'Could not save workspace',
        message,
      });
    } finally {
      setSaving(false);
    }
  });

  const submitInvite = inviteForm.onSubmit(async (values) => {
    try {
      setError(null);
      setSuccess(null);
      setInviteResult(null);
      const result = await inviteWorkspaceMember(workspaceId, {
        email: values.email,
        name: values.name || undefined,
        role: 'MEMBER',
        createOpenProjectUser: true,
      });
      setMembers((current) =>
        [
          ...current.filter((item) => item.user.id !== result.membership.user.id),
          result.membership,
        ].sort((left, right) => left.user.email.localeCompare(right.user.email))
      );
      inviteForm.reset();
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
      showToast({
        tone: 'success',
        title: 'Member invited',
        message:
          result.temporaryPassword || result.openProjectTemporaryPassword
            ? 'The workspace member was invited and temporary credentials were generated.'
            : 'The workspace member already existed and access was updated.',
      });
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      showToast({
        tone: 'error',
        title: 'Could not invite member',
        message,
      });
    }
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Workspace settings"
      size="72rem"
      centered
      data-testid="workspace-settings"
    >
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
              {currentRole === 'ADMIN' && <Tabs.Tab value="danger">Danger Zone</Tabs.Tab>}
            </Tabs.List>

            <Tabs.Panel value="general" pt="md">
              <form onSubmit={saveGeneral}>
                <Stack>
                  <TextInput
                    label="Workspace name"
                    disabled={!canManageWorkspace}
                    {...generalForm.getInputProps('name')}
                  />
                  <TextInput
                    label="Workspace slug"
                    disabled={!canManageWorkspace}
                    {...generalForm.getInputProps('slug')}
                  />
                  <Textarea
                    label="Description"
                    disabled={!canManageWorkspace}
                    {...generalForm.getInputProps('description')}
                  />
                  <TextInput
                    label="Avatar URL"
                    disabled={!canManageWorkspace}
                    {...generalForm.getInputProps('avatarUrl')}
                  />
                  <ColorInput
                    label="Accent color"
                    disabled={!canManageWorkspace}
                    {...generalForm.getInputProps('color')}
                  />
                  <Group justify="flex-end">
                    <Button type="submit" loading={saving} disabled={!canManageWorkspace}>
                      Save workspace
                    </Button>
                  </Group>
                </Stack>
              </form>
            </Tabs.Panel>

            <Tabs.Panel value="members" pt="md">
              <Stack>
                {!members.length && (
                  <Text size="sm" c="dimmed">
                    Only the owner is in this workspace so far.
                  </Text>
                )}
                {canManageWorkspace && (
                  <form onSubmit={submitInvite} data-testid="workspace-invite-form">
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
                      {(
                        [
                          { key: 'name', label: 'Name' },
                          { key: 'email', label: 'Email' },
                          { key: 'role', label: 'Role' },
                          { key: 'lastLogin', label: 'Last login' },
                        ] as const
                      ).map(({ key, label }) => {
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
                          <Badge
                            size="sm"
                            variant="outline"
                            color={member.user.opAdmin ? 'red' : 'blue'}
                          >
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
                        showToast({
                          tone: 'success',
                          title: 'Connection checked',
                          message: 'OpenProject connection status was refreshed.',
                        });
                      } catch (caughtError) {
                        const message = getErrorMessage(caughtError);
                        setError(message);
                        showToast({
                          tone: 'error',
                          title: 'Could not reach OpenProject',
                          message,
                        });
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

            {currentRole === 'ADMIN' && (
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
