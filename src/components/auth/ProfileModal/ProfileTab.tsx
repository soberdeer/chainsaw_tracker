import { Avatar, Badge, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import type { CurrentUser, UserProfile } from '@/lib';
import classes from './ProfileModal.module.css';

interface ProfileFormValues {
  name: string;
  avatarUrl: string;
}

interface ProfileTabProps {
  profile: UserProfile | null;
  user: CurrentUser;
  role?: string;
  form: UseFormReturnType<ProfileFormValues>;
  saving: boolean;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export function ProfileTab({
  profile,
  user,
  role,
  form,
  saving,
  onSave,
  onClose,
}: ProfileTabProps) {
  return (
    <form onSubmit={onSave}>
      <Stack>
        <Group align="flex-start">
          <Avatar
            src={form.values.avatarUrl || undefined}
            name={form.values.name || undefined}
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
          {...form.getInputProps('name')}
        />
        <TextInput label="Email" value={profile?.email || user.email} readOnly />
        <TextInput
          label="Avatar URL"
          placeholder="https://..."
          {...form.getInputProps('avatarUrl')}
        />
        <TextInput label="Source" value={profile?.source || 'LOCAL'} readOnly />
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
            This edits the local tracker profile only. OpenProject account details and project
            memberships are managed separately.
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
  );
}
