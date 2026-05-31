import { BadgeProps, Text, Group, ActionIcon } from '@mantine/core';
import { IconFlagFilled } from '@tabler/icons-react';
import { useMemo } from 'react';
import classes from './Priority.module.css';

export interface PriorityProps extends BadgeProps {
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | null;
}

const colorsMap = {
  LOW: 'green',
  NORMAL: 'lime',
  HIGH: 'yellow',
  URGENT: 'red',
};

export function Priority({ priority }: PriorityProps) {
  const color = useMemo(() => (priority ? colorsMap[priority] : 'var(--app-muted)'), [priority]);
  return (
    <Group gap={4}>
      <ActionIcon variant="outline" color={color} className={classes.icon}>
        <IconFlagFilled size="1.1875rem" />
      </ActionIcon>
      {priority && <Text>{priority[0] + priority.slice(1).toLowerCase()}</Text>}
    </Group>
  );
}
