import { Avatar, Tooltip } from '@mantine/core';
import { UserAvatar } from '@/components/common/UserAvatar';
import type { User } from '@/lib';

export interface AvatarStackProps {
  users: User[];
  size?: string;
  max?: number;
}

export function AvatarStack({ users, size = 'sm', max = 4 }: AvatarStackProps) {
  const visible = users.slice(0, max);
  const rest = users.length - visible.length;

  if (!users.length) {
    return null;
  }

  return (
    <Avatar.Group>
      {visible.map((a, i) => (
        <UserAvatar key={i} user={a} size={size} />
      ))}
      {rest > 0 && (
        <Tooltip label={`${rest} more assignees`}>
          <Avatar size={size} radius="xl" color="initials" name={`+${rest}`} />
        </Tooltip>
      )}
    </Avatar.Group>
  );
}
