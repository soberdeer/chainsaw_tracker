import {
  Avatar,
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconLock, IconMailPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { inviteMember, getErrorMessage, type Space, type Workspace } from '@/lib';
import classes from './ShareSpaceModal.module.css';

export interface ShareSpaceModalProps {
  opened: boolean;
  workspace: Workspace;
  space: Space;
  onClose: () => void;
  onError: (message: string) => void;
}

export function ShareSpaceModal({
  opened,
  workspace,
  space,
  onClose,
  onError,
}: ShareSpaceModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [sending, setSending] = useState(false);

  const invite = async () => {
    if (!email.trim()) {
      return;
    }
    try {
      setSending(true);
      await inviteMember(workspace.id, { email, role });
      setEmail('');
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Share this Space"
      size="42rem"
      centered
      classNames={{ content: classes.modalContent }}
    >
      <Stack gap="lg">
        <Text c="dimmed">
          Sharing Space with all views{' '}
          <Text span c="white" fw={700}>
            {space.name}
          </Text>{' '}
          {space.locked && (
            <Tooltip label={`${space.name} is private`}>
              <IconLock size="1rem" />
            </Tooltip>
          )}
        </Text>
        <Group align="end">
          <TextInput
            className={classes.grow}
            label="Invite by name or email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <Select
            label="Role"
            value={role}
            onChange={(value) => setRole(value || 'MEMBER')}
            data={['ADMIN', 'MEMBER', 'VIEWER']}
          />
          <Button leftSection={<IconMailPlus size="1rem" />} loading={sending} onClick={invite}>
            Invite
          </Button>
        </Group>
        <Group justify="space-between">
          <div>
            <Text fw={700}>Private link</Text>
            <Text size="sm" c="dimmed">
              Only invited members can open this space.
            </Text>
          </div>
          <Button
            variant="light"
            onClick={() =>
              navigator.clipboard?.writeText(`${window.location.origin}/space/${space.id}`)
            }
          >
            Copy link
          </Button>
        </Group>
        <Stack gap="sm">
          <Text c="dimmed" fw={700}>
            People
          </Text>
          {workspace.memberships.map((membership) => (
            <Group key={membership.id} justify="space-between" className={classes.personRow}>
              <Group>
                <Avatar>{membership.user.name.slice(0, 1)}</Avatar>
                <Text fw={650}>{membership.user.name}</Text>
                <Tooltip label={`Role: ${membership.role}`}>
                  <Badge variant="light">{membership.role}</Badge>
                </Tooltip>
              </Group>
              <Group>
                <Select
                  size="xs"
                  value={membership.role === 'VIEWER' ? 'View only' : 'Full edit'}
                  data={['Full edit', 'View only']}
                />
                <Switch defaultChecked={membership.role !== 'VIEWER'} />
              </Group>
            </Group>
          ))}
        </Stack>
        <Button variant="light" leftSection={<IconLock size="1rem" />}>
          Make Public
        </Button>
      </Stack>
    </Modal>
  );
}
