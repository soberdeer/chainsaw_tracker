import { IconProps } from '@tabler/icons-react';
import { statusIcons } from './status-icons';

export interface StatusIconProps extends IconProps {
  statusId: string;
}

export function StatusIcon({ statusId, ...others }: StatusIconProps) {
  const Icon = statusIcons[statusId as keyof typeof statusIcons] || statusIcons.backlog;
  return <Icon {...others} />;
}
