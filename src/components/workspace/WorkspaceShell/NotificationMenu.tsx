import { ActionIcon, Badge, Menu, Stack, Text, Tooltip } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';
import type { NotificationItem } from '@/lib';

interface NotificationMenuProps {
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigateToTask?: (workPackageId: string) => void;
}

export function NotificationMenu({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onNavigateToTask,
}: NotificationMenuProps) {
  return (
    <Menu width="22rem" position="bottom-end">
      <Menu.Target>
        <Tooltip label="Notifications">
          <ActionIcon variant="light" aria-label="Notifications" data-testid="notification-center">
            <IconBell size="1.125rem" />
            {unreadCount > 0 && (
              <Badge size="xs" color="red">
                {unreadCount}
              </Badge>
            )}
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Notifications</Menu.Label>
        {notifications.slice(0, 8).map((notification) => (
          <Menu.Item
            key={notification.id}
            fw={notification.readAt ? 400 : 700}
            onClick={() => {
              onMarkRead(notification.id);
              if (notification.workPackageId && onNavigateToTask) {
                onNavigateToTask(notification.workPackageId);
              }
            }}
          >
            <Stack gap={2}>
              <Text size="sm" fw={notification.readAt ? 500 : 700}>
                {notification.title}
              </Text>
              {notification.message && (
                <Text size="xs" c="dimmed">
                  {notification.message}
                </Text>
              )}
            </Stack>
          </Menu.Item>
        ))}
        {!notifications.length && <Menu.Item disabled>No notifications yet.</Menu.Item>}
        <Menu.Divider />
        <Menu.Item onClick={onMarkAllRead}>Mark all as read</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
