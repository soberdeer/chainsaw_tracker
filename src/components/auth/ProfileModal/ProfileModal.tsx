import { Alert, Group, Loader, Modal, Stack, Tabs } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useRef, useState } from 'react';
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
import { AccessTab } from './AccessTab';
import { MyWorkTab } from './MyWorkTab';
import { ProfileTab } from './ProfileTab';
import { SecurityTab } from './SecurityTab';

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
  const profileFormRef = useRef(profileForm);
  profileFormRef.current = profileForm;
  const passwordFormRef = useRef(passwordForm);
  passwordFormRef.current = passwordForm;

  useEffect(() => {
    if (!opened) return;
    profileFormRef.current.setValues({
      name: user.name || '',
      avatarUrl: user.avatarUrl || '',
    });
    passwordFormRef.current.reset();
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
  }, [opened, user]);

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
          ? { ...current, name: updated.name, avatarUrl: updated.avatarUrl || undefined }
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
      showToast({ tone: 'error', title: 'Could not save profile', message });
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
      showToast({ tone: 'error', title: 'Could not change password', message });
    } finally {
      setChangingPassword(false);
    }
  });

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
              <ProfileTab
                profile={profile}
                user={user}
                role={role}
                form={profileForm}
                saving={saving}
                onSave={save}
                onClose={onClose}
              />
            </Tabs.Panel>

            <Tabs.Panel value="security" pt="md">
              <SecurityTab
                form={passwordForm}
                changingPassword={changingPassword}
                passwordMessage={passwordMessage}
                onSubmit={submitPassword}
              />
            </Tabs.Panel>

            <Tabs.Panel value="my-work" pt="md">
              <MyWorkTab
                myWork={myWork}
                myWorkError={myWorkError}
                onOpenAssignedToMe={onOpenAssignedToMe}
              />
            </Tabs.Panel>

            <Tabs.Panel value="access" pt="md">
              <AccessTab profile={profile} />
            </Tabs.Panel>
          </Tabs>
        )}
      </Stack>
    </Modal>
  );
}
