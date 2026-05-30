import { Avatar, Tooltip } from '@mantine/core';
import type { User } from '@/lib';

export interface UserAvatarProps {
  user: User;
  size?: string | number;
  withTooltip?: boolean;
}

export function UserAvatar({ user, size = 'sm', withTooltip = true }: UserAvatarProps) {
  const avatar = (
    <Avatar
      src={user.avatarUrl || null}
      size={size}
      radius="xl"
      color="initials"
      name={user.name.replace('ㅤ', '')}
    />
  );

  if (!withTooltip) {
    return avatar;
  }

  return (
    <Tooltip
      label={
        user.email ? `${user.name.replace('ㅤ', '')} (${user.email})` : user.name.replace('ㅤ', '')
      }
      withArrow
    >
      {avatar}
    </Tooltip>
  );
}
