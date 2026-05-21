import {
  Alert,
  Avatar,
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconLock, IconMailPlus } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import {
  inviteMember,
  getErrorMessage,
  type Space,
  type Workspace,
  type WorkspaceRole,
} from '@/lib';
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
  const [sending, setSending] = useState(false);
  const form = useForm({
    initialValues: {
      email: '',
      role: 'MEMBER' as WorkspaceRole,
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Enter a valid email address'),
    },
  });

  useEffect(() => {
    if (!opened) {
      return;
    }
    form.reset();
  }, [opened, form]);

  const invite = form.onSubmit(async (values) => {
    try {
      setSending(true);
      await inviteMember(workspace.id, { email: values.email, role: values.role });
      form.reset();
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  });

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
        <form onSubmit={invite}>
          <Group align="end">
            <TextInput
              className={classes.grow}
              label="Invite by email"
              {...form.getInputProps('email')}
            />
            <Select
              label="Role"
              data={['ADMIN', 'LEAD', 'MEMBER', 'VIEWER']}
              {...form.getInputProps('role')}
            />
            <Button leftSection={<IconMailPlus size="1rem" />} loading={sending} type="submit">
              Invite
            </Button>
          </Group>
        </form>
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
              <Text size="sm" c="dimmed">
                Managed in workspace settings
              </Text>
            </Group>
          ))}
        </Stack>
        <Alert color="blue" title="Managed in OpenProject">
          Space visibility and project access are managed through workspace members and OpenProject
          project memberships. This dialog only sends workspace invites.
        </Alert>
      </Stack>
    </Modal>
  );
}
