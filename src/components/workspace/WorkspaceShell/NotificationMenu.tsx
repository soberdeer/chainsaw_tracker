import { ActionIcon, Badge, Menu, Stack, Text, Tooltip } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';
import { useWorkspaceShellContext } from './WorkspaceShellContext';

export function NotificationMenu() {
  const state = useWorkspaceShellContext();

  return (
    <Menu width="22rem" position="bottom-end">
      <Menu.Target>
        <Tooltip label="Notifications">
          <ActionIcon variant="light" aria-label="Notifications" data-testid="notification-center">
            <IconBell size="1.125rem" />
            {state.notificationUnread > 0 && (
              <Badge size="xs" color="red">
                {state.notificationUnread}
              </Badge>
            )}
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Notifications</Menu.Label>
        {state.notifications.slice(0, 8).map((notification) => (
          <Menu.Item
            key={notification.id}
            fw={notification.readAt ? 400 : 700}
            onClick={() => {
              void state.markNotificationAsRead(notification.id);
              if (notification.workPackageId) {
                state.navigateToNotificationTask(notification.workPackageId);
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
        {!state.notifications.length && <Menu.Item disabled>No notifications yet.</Menu.Item>}
        <Menu.Divider />
        <Menu.Item onClick={() => void state.markAllNotificationsAsRead()}>
          Mark all as read
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
