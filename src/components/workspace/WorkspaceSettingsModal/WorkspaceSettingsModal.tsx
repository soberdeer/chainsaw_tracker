import { Alert, Group, Loader, Modal, Stack, Tabs } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useRef, useState } from 'react';
import {
  getErrorMessage,
  getWorkspaceImportReports,
  getWorkspaceMembers,
  getWorkspaceOpenProjectStatus,
  getWorkspacePermissionSets,
  getWorkspaceSettings,
  inviteWorkspaceMember,
  showToast,
  updateWorkspaceSettings,
  updateWorkspaceMemberRole,
  type MigrationRun,
  type OpenProjectConnectionStatus,
  type PermissionSet,
  type WorkspaceMemberItem,
  type WorkspaceSettings,
  WorkspaceRole,
} from '@/lib';
import { DangerZoneTab } from './DangerZoneTab';
import { GeneralSettingsTab } from './GeneralSettingsTab';
import { ImportsTab } from './ImportsTab';
import { MembersTab } from './MembersTab';
import { OpenProjectTab } from './OpenProjectTab';
import { PermissionsTab } from './PermissionsTab';

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
    initialValues: { email: '', name: '' },
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
      showToast({ tone: 'error', title: 'Could not save workspace', message });
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
      showToast({ tone: 'error', title: 'Could not invite member', message });
    }
  });

  const handleRoleChange = async (userId: string, role: WorkspaceRole) => {
    try {
      const updated = await updateWorkspaceMemberRole(workspaceId, userId, role);
      setMembers((current) => current.map((m) => (m.user.id === userId ? updated : m)));
      showToast({ tone: 'success', title: 'Role updated', message: `Role changed to ${role}.` });
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      showToast({ tone: 'error', title: 'Could not update role', message });
    }
  };

  const handleRefreshConnection = async () => {
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
      showToast({ tone: 'error', title: 'Could not reach OpenProject', message });
    }
  };

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
              <GeneralSettingsTab
                form={generalForm}
                canManageWorkspace={canManageWorkspace}
                saving={saving}
                onSave={saveGeneral}
              />
            </Tabs.Panel>

            <Tabs.Panel value="members" pt="md">
              <MembersTab
                members={members}
                canManageWorkspace={canManageWorkspace}
                inviteForm={inviteForm}
                onInviteSubmit={submitInvite}
                onRoleChange={handleRoleChange}
              />
            </Tabs.Panel>

            <Tabs.Panel value="permissions" pt="md">
              <PermissionsTab permissionSets={permissionSets} />
            </Tabs.Panel>

            <Tabs.Panel value="openproject" pt="md">
              <OpenProjectTab
                connectionStatus={connectionStatus}
                onRefresh={handleRefreshConnection}
              />
            </Tabs.Panel>

            <Tabs.Panel value="imports" pt="md">
              <ImportsTab imports={imports} onOpenImportReport={onOpenImportReport} />
            </Tabs.Panel>

            {currentRole === 'ADMIN' && (
              <Tabs.Panel value="danger" pt="md">
                <DangerZoneTab />
              </Tabs.Panel>
            )}
          </Tabs>
        )}
      </Stack>
    </Modal>
  );
}
