import { Avatar, Tooltip } from '@mantine/core';
import type { User } from '@/lib';

export interface AvatarStackProps {
  users: User[];
  size?: string;
  max?: number;
}

export function AvatarStack({ users, size = 'md', max = 4 }: AvatarStackProps) {
  const visible = users.slice(0, max);
  const rest = users.length - visible.length;

  if (!users.length) {
    return null;
  }

  return (
    <Avatar.Group>
      {visible.map((a, i) => (
        <Avatar key={i} src={a.avatarUrl} size={size} radius="xl" color="initials" name={a.name} />
      ))}
      {rest > 0 && (
        <Tooltip label={`${rest} more assignees`}>
          <Avatar size={size} radius="xl" color="initials" name={`+${rest}`} />
        </Tooltip>
      )}
    </Avatar.Group>
  );
}
