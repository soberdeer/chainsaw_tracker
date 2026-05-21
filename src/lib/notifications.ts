import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCheck, IconInfoCircle } from '@tabler/icons-react';
import { createElement, type ReactNode } from 'react';

export type AppNotificationTone = 'success' | 'error' | 'info' | 'warning';

export type AppNotificationInput = {
  title?: string;
  message: string;
  tone?: AppNotificationTone;
  autoCloseMs?: number;
};

function notificationIcon(tone: AppNotificationTone): ReactNode {
  if (tone === 'success') {
    return createElement(IconCheck, { size: '1rem' });
  }
  if (tone === 'error') {
    return createElement(IconAlertCircle, { size: '1rem' });
  }
  return createElement(IconInfoCircle, { size: '1rem' });
}

function notificationColor(tone: AppNotificationTone) {
  if (tone === 'success') return 'green';
  if (tone === 'error') return 'red';
  if (tone === 'warning') return 'yellow';
  return 'blue';
}

export function showToast(input: AppNotificationInput) {
  const tone = input.tone || 'info';
  notifications.show({
    title: input.title || 'Update',
    message: input.message,
    color: notificationColor(tone),
    autoClose: input.autoCloseMs || (tone === 'error' ? 5600 : 3400),
    withCloseButton: true,
    icon: notificationIcon(tone),
    styles: {
      description: {
        whiteSpace: 'pre-wrap',
      },
    },
  });
}
