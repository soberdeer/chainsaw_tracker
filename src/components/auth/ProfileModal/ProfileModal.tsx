import {
  Alert,
  Avatar,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  PasswordInput,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import {
  changePassword,
  getErrorMessage,
  getMyWorkSummary,
  getUserProfile,
  showToast,
  updateUserProfile,
  type CurrentUser,
  type MyWorkSummary,
  type UserProfile,
} from '@/lib';
import classes from './ProfileModal.module.css';

export interface ProfileModalProps {
  opened: boolean;
  user: CurrentUser;
  role?: string;
  onClose: () => void;
  onSaved: (user: CurrentUser) => void;
  onOpenAssignedToMe: () => void;
}

export function ProfileModal({
  opened,
  user,
  role,
  onClose,
  onSaved,
  onOpenAssignedToMe,
}: ProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myWork, setMyWork] = useState<MyWorkSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [myWorkError, setMyWorkError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const profileForm = useForm({
    initialValues: {
      name: user.name || '',
      avatarUrl: user.avatarUrl || '',
    },
  });
  const passwordForm = useForm({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      currentPassword: (value) => (value.trim().length ? null : 'Current password is required'),
      newPassword: (value) =>
        value.trim().length >= 8 ? null : 'New password must be at least 8 characters long',
      confirmPassword: (value, values) =>
        value === values.newPassword ? null : 'Password confirmation does not match',
    },
  });

  useEffect(() => {
    if (!opened) return;
    profileForm.setValues({
      name: user.name || '',
      avatarUrl: user.avatarUrl || '',
    });
    passwordForm.reset();
    setPasswordMessage(null);
    setSuccess(null);
    setError(null);
    setMyWorkError(null);
    setLoading(true);

    Promise.all([
      getUserProfile().then(setProfile),
      getMyWorkSummary()
        .then(setMyWork)
        .catch((caughtError) => {
          setMyWork(null);
          setMyWorkError(getErrorMessage(caughtError));
        }),
    ])
      .catch((caughtError) => setError(getErrorMessage(caughtError)))
      .finally(() => setLoading(false));
  }, [opened, user, profileForm, passwordForm]);

  const save = profileForm.onSubmit(async (values) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const updated = await updateUserProfile({
        name: values.name,
        avatarUrl: values.avatarUrl || null,
      });
      onSaved(updated);
      setProfile((current) =>
        current
          ? {
              ...current,
              name: updated.name,
              avatarUrl: updated.avatarUrl || undefined,
            }
          : current
      );
      setSuccess('Profile saved.');
      showToast({
        tone: 'success',
        title: 'Profile saved',
        message: 'Your local tracker profile was updated.',
      });
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      showToast({
        tone: 'error',
        title: 'Could not save profile',
        message,
      });
    } finally {
      setSaving(false);
    }
  });

  const submitPassword = passwordForm.onSubmit(async (values) => {
    try {
      setChangingPassword(true);
      setPasswordMessage(null);
      setError(null);
      setSuccess(null);
      await changePassword(values);
      setPasswordMessage('Password changed successfully.');
      showToast({
        tone: 'success',
        title: 'Password changed',
        message: 'Your local tracker password was updated.',
      });
      passwordForm.reset();
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      showToast({
        tone: 'error',
        title: 'Could not change password',
        message,
      });
    } finally {
      setChangingPassword(false);
    }
  });

  const permissionSummary = (permissions?: UserProfile['memberships'][number]['permissions']) =>
    permissions
      ? [
          permissions.manageWorkspace && 'Workspace',
          permissions.manageSpaces && 'Spaces',
          permissions.manageTasks && 'Tasks',
          permissions.manageDocs && 'Local Docs',
          permissions.inviteMembers && 'Members',
          permissions.viewReports && 'Reports',
        ]
          .filter(Boolean)
          .join(', ') || 'Read-only'
      : 'Inherited from the workspace role';

  return (
    <Modal opened={opened} onClose={onClose} title="Account" centered size="56rem">
      <Stack>
        {error && (
          <Alert color="red" title="Something needs attention">
            {error}
          </Alert>
        )}
        {success && (
          <Alert color="green" title="Saved">
            {success}
          </Alert>
        )}
        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : (
          <Tabs defaultValue="profile">
            <Tabs.List>
              <Tabs.Tab value="profile">Profile</Tabs.Tab>
              <Tabs.Tab value="security">Security</Tabs.Tab>
              <Tabs.Tab value="my-work">My work</Tabs.Tab>
              <Tabs.Tab value="access">Access</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="profile" pt="md">
              <form onSubmit={save}>
                <Stack>
                  <Group align="flex-start">
                    <Avatar
                      src={profileForm.values.avatarUrl || undefined}
                      name={profileForm.values.name || undefined}
                      size="lg"
                    />
                    <div>
                      <Text fw={700}>{profile?.email || user.email}</Text>
                      <Group gap="xs" mt={4}>
                        <Badge variant="light">{role || 'No role'}</Badge>
                        {profile?.source && <Badge variant="default">{profile.source}</Badge>}
                      </Group>
                    </div>
                  </Group>
                  <TextInput
                    label="Display name"
                    placeholder="Leave blank if you do not want a display name"
                    {...profileForm.getInputProps('name')}
                  />
                  <TextInput label="Email" value={profile?.email || user.email} readOnly />
                  <TextInput
                    label="Avatar URL"
                    placeholder="https://..."
                    {...profileForm.getInputProps('avatarUrl')}
                  />
                  <TextInput label="Source" value={profile?.source || 'LOCAL'} readOnly />
                  <TextInput
                    label="Linked OpenProject user"
                    value={
                      profile?.openProjectUserId
                        ? `${profile.openProjectLogin || profile.openProjectUserId} (${profile.openProjectUserId})`
                        : 'Not linked yet'
                    }
                    readOnly
                  />
                  <Stack gap={4}>
                    <Text size="sm" fw={600}>
                      Linked OpenProject user
                    </Text>
                    <Text size="sm" c="dimmed">
                      {profile?.openProjectUserId
                        ? `${profile.openProjectLogin || profile.openProjectUserId} (${profile.openProjectUserId})`
                        : 'Not linked yet'}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {profile?.openProjectUserId
                        ? 'This local tracker account is linked to a real OpenProject user.'
                        : 'Ask an owner or admin to link this local tracker account to an OpenProject user if you need assignee-based task filters.'}
                    </Text>
                    <Text size="sm" c="dimmed" className={classes.note}>
                      This edits the local tracker profile only. OpenProject account details and
                      project memberships are managed separately.
                    </Text>
                  </Stack>
                  <Group justify="flex-end">
                    <Button variant="light" onClick={onClose}>
                      Close
                    </Button>
                    <Button loading={saving} type="submit">
                      Save profile
                    </Button>
                  </Group>
                </Stack>
              </form>
            </Tabs.Panel>

            <Tabs.Panel value="security" pt="md">
              <form onSubmit={submitPassword}>
                <Stack>
                  {passwordMessage && (
                    <Alert color="green" title="Password updated">
                      {passwordMessage}
                    </Alert>
                  )}
                  <PasswordInput
                    label="Current password"
                    {...passwordForm.getInputProps('currentPassword')}
                  />
                  <PasswordInput
                    label="New password"
                    {...passwordForm.getInputProps('newPassword')}
                  />
                  <PasswordInput
                    label="Confirm new password"
                    {...passwordForm.getInputProps('confirmPassword')}
                  />
                  <Group justify="flex-end">
                    <Button loading={changingPassword} type="submit">
                      Change password
                    </Button>
                  </Group>
                </Stack>
              </form>
            </Tabs.Panel>

            <Tabs.Panel value="my-work" pt="md">
              <Stack>
                {myWorkError ? (
                  <Alert color="yellow" title="Assigned work is not linked yet">
                    {myWorkError}
                  </Alert>
                ) : myWork ? (
                  <>
                    <Group grow>
                      <Alert title="Assigned">{myWork.assignedCount}</Alert>
                      <Alert title="Overdue" color="red">
                        {myWork.overdueCount}
                      </Alert>
                      <Alert title="Due this week" color="blue">
                        {myWork.dueThisWeekCount}
                      </Alert>
                    </Group>
                    <Button variant="light" onClick={onOpenAssignedToMe}>
                      Open Assigned to me
                    </Button>
                    <Stack gap="xs">
                      <Text fw={600}>Recently updated assigned tasks</Text>
                      {myWork.recentlyUpdated.length ? (
                        myWork.recentlyUpdated.map((task) => (
                          <Text size="sm" key={task.id}>
                            {task.title}
                          </Text>
                        ))
                      ) : (
                        <Text size="sm" c="dimmed">
                          No assigned work found yet.
                        </Text>
                      )}
                    </Stack>
                  </>
                ) : (
                  <Text size="sm" c="dimmed">
                    No my work summary available.
                  </Text>
                )}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="access" pt="md">
              <Stack>
                <Alert title="Access model" color="blue">
                  Local tracker role controls the custom UI. OpenProject memberships control access
                  to OpenProject projects and work packages.
                </Alert>
                {!profile?.openProjectUserId && (
                  <Alert title="OpenProject link missing" color="yellow">
                    This local tracker account is not linked to an OpenProject user yet. You can
                    still use local settings, but OpenProject assignee-based views will not resolve
                    your work until the link exists.
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
            </Tabs.Panel>
          </Tabs>
        )}
      </Stack>
    </Modal>
  );
}
