import { Alert, Avatar, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';
import { getErrorMessage, updateCurrentUser, type CurrentUser } from '@/lib';
import classes from './ProfileModal.module.css';

export interface ProfileModalProps {
  opened: boolean;
  user: CurrentUser;
  role?: string;
  onClose: () => void;
  onSaved: (user: CurrentUser) => void;
}

export function ProfileModal({ opened, user, role, onClose, onSaved }: ProfileModalProps) {
  const [name, setName] = useState(user.name);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setName(user.name);
    setAvatarUrl(user.avatarUrl || '');
    setError(null);
  }, [opened, user]);

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      onSaved(await updateCurrentUser({ name, avatarUrl: avatarUrl || null }));
      onClose();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Local profile" centered>
      <Stack>
        {error && (
          <Alert color="red" title="Could not save profile">
            {error}
          </Alert>
        )}
        <Group>
          <Avatar src={avatarUrl || undefined} name={name} size="lg" />
          <div>
            <Text fw={700}>{user.email}</Text>
            <Text size="sm" c="dimmed">
              Local role: {role || 'unknown'}
            </Text>
          </div>
        </Group>
        <TextInput
          label="Display name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextInput
          label="Avatar URL"
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
          placeholder="https://..."
        />
        <Text size="sm" c="dimmed" className={classes.note}>
          This edits the local tracker user only. OpenProject users are managed in OpenProject.
          Runtime OpenProject requests use the configured service token.
        </Text>
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Save profile
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
