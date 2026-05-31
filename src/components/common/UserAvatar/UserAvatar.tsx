import { Avatar, AvatarProps, Tooltip } from '@mantine/core';
import type { User } from '@/lib';

export interface UserAvatarProps extends AvatarProps {
  user: User;
  size?: string | number;
  withTooltip?: boolean;
}

export function UserAvatar({ user, size = 'sm', withTooltip = true, ...others }: UserAvatarProps) {
  const avatar = (
    <Avatar
      src={user.avatarUrl || null}
      size={size}
      radius="xl"
      color="initials"
      name={user.name.replace('ㅤ', '')}
      {...others}
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
