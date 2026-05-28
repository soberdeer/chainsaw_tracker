import { IconProps } from '@tabler/icons-react';
import { statusIcons } from './status-icons';

export interface StatusIconProps extends IconProps {
  type?: string;
  tone?: string;
}

export function StatusIcon({ type, tone, color, ...others }: StatusIconProps) {
  const Icon = (statusIcons[type?.toLowerCase() as keyof typeof statusIcons] || statusIcons.open)
    .icon;
  return <Icon {...others} color={tone ? `var(--mantine-color-${tone}-6)` : color} />;
}
