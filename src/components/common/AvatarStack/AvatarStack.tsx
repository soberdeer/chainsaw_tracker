import { Avatar, Group, Tooltip } from '@mantine/core';
import type { User } from '../../../lib/types';
import classes from './AvatarStack.module.css';

const colors = ['#a98a7a', '#4263eb', '#5f3dc4', '#0b7285', '#d6336c', '#2f9e44'];

function initialsFor(user: User) {
  const parts = user.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0] || user.email || '?').slice(0, 2).toUpperCase();
}

export function AvatarStack({
  users,
  size = '2.125rem',
  max = 4,
}: {
  users: User[];
  size?: string;
  max?: number;
}) {
  const visible = users.slice(0, max);
  const rest = users.length - visible.length;

  if (!users.length) return null;

  return (
    <Group gap={0} wrap="nowrap" className={classes.stack}>
      {visible.map((user, index) => (
        <Tooltip key={user.id} label={user.name}>
          <Avatar
            src={user.avatarUrl}
            size={size}
            radius="xl"
            className={classes.avatar}
            style={{ background: colors[index % colors.length], zIndex: visible.length - index }}
          >
            {initialsFor(user)}
          </Avatar>
        </Tooltip>
      ))}
      {rest > 0 && (
        <Tooltip label={`${rest} more assignees`}>
          <Avatar size={size} radius="xl" className={`${classes.avatar} ${classes.rest}`}>
            +{rest}
          </Avatar>
        </Tooltip>
      )}
    </Group>
  );
}
