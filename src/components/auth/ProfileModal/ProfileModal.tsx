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
import { useEffect, useState } from 'react';
import {
  changePassword,
  getErrorMessage,
  getMyWorkSummary,
  getUserProfile,
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
  const [name, setName] = useState(user.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [myWorkError, setMyWorkError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setName(user.name || '');
    setAvatarUrl(user.avatarUrl || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage(null);
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
  }, [opened, user]);

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      const updated = await updateUserProfile({ name, avatarUrl: avatarUrl || null });
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
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  };

  const submitPassword = async () => {
    try {
      setChangingPassword(true);
      setPasswordMessage(null);
      setError(null);
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setPasswordMessage('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Account" centered size="56rem">
      <Stack>
        {error && (
          <Alert color="red" title="Something needs attention">
            {error}
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
              <Stack>
                <Group align="flex-start">
                  <Avatar src={avatarUrl || undefined} name={name || undefined} size="lg" />
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
                  value={name}
                  onChange={(event) => setName(event.currentTarget.value)}
                  placeholder="Leave blank if you do not want a display name"
                />
                <TextInput
                  label="Avatar URL"
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.currentTarget.value)}
                  placeholder="https://..."
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
                  <Text size="sm" c="dimmed" className={classes.note}>
                    This edits the local tracker profile only. OpenProject account details and
                    project memberships are managed separately.
                  </Text>
                </Stack>
                <Group justify="flex-end">
                  <Button variant="light" onClick={onClose}>
                    Close
                  </Button>
                  <Button loading={saving} onClick={save}>
                    Save profile
                  </Button>
                </Group>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="security" pt="md">
              <Stack>
                {passwordMessage && (
                  <Alert color="green" title="Password updated">
                    {passwordMessage}
                  </Alert>
                )}
                <PasswordInput
                  label="Current password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.currentTarget.value)}
                />
                <PasswordInput
                  label="New password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.currentTarget.value)}
                />
                <PasswordInput
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                />
                <Group justify="flex-end">
                  <Button loading={changingPassword} onClick={submitPassword}>
                    Change password
                  </Button>
                </Group>
              </Stack>
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
                          No assigned work found.
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

                <Stack gap="xs">
                  <Text fw={600}>Local workspace access</Text>
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Workspace</Table.Th>
                        <Table.Th>Role</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {(profile?.memberships || []).map((membership) => (
                        <Table.Tr key={membership.id}>
                          <Table.Td>{membership.workspaceName}</Table.Td>
                          <Table.Td>{membership.role}</Table.Td>
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
