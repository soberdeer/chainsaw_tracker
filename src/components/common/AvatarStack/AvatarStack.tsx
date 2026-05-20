import { Avatar, Group, Tooltip } from '@mantine/core';
import type { User } from '@/lib';
import classes from './AvatarStack.module.css';

function initialsFor(user: User) {
  const parts = user.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (parts[0] || user.email || '?').slice(0, 2).toUpperCase();
}

export interface AvatarStackProps {
  users: User[];
  size?: string;
  max?: number;
}

export function AvatarStack({ users, size = '2.125rem', max = 4 }: AvatarStackProps) {
  const visible = users.slice(0, max);
  const rest = users.length - visible.length;

  if (!users.length) {
    return null;
  }

  return <Avatar.Group>
    {visible.map((a, i) => <Avatar key={i} src={a.avatarUrl}
                                   size={size}
                                   radius="xl"
                                   className={classes.avatar}
                                   color="initials">{initialsFor(a)}</Avatar>)}
    {rest > 0 && (
      <Tooltip label={`${rest} more assignees`}>
        <Avatar
          size={size}
          radius="xl"
          className={`${classes.avatar} ${classes.rest}`}
          color="initials"
        >
          +{rest}
        </Avatar>
      </Tooltip>
    )}
  </Avatar.Group>

}
