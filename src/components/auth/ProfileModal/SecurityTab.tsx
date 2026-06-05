import { Alert, Anchor, Stack, Text } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';

interface SecurityTabProps {
  openProjectUrl: string | null;
}

export function SecurityTab({ openProjectUrl }: SecurityTabProps) {
  const href = openProjectUrl ? `${openProjectUrl}/my/password` : undefined;

  return (
    <Stack>
      <Alert color="blue" title="Password management">
        <Text size="sm">
          Passwords are managed by OpenProject.{' '}
          {href ? (
            <Anchor href={href} target="_blank" rel="noreferrer">
              Change password in OpenProject <IconExternalLink size="0.75rem" />
            </Anchor>
          ) : (
            'Open OpenProject in your browser to change your password.'
          )}
        </Text>
      </Alert>
    </Stack>
  );
}
