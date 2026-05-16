import { IconProps } from '@tabler/icons-react';
import type { Task, TaskStatus } from '../../../lib/types';
import { statusIcons } from './status-icons';
import classes from './StatusIcon.module.css';

export interface StatusIconProps extends IconProps {
  statusId: string;
}

export function StatusIcon({ statusId, ...others }: StatusIconProps) {
  const Icon = statusIcons[statusId as keyof typeof statusIcons] || statusIcons.backlog;
  return <Icon {...others} />;
}
