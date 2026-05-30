import { Alert, Stack, Text } from '@mantine/core';

export function DangerZoneTab() {
  return (
    <Stack>
      <Alert color="red" title="Danger Zone">
        Resetting OpenProject projects and work packages remains a guarded CLI action in this MVP.
        It is intentionally not executable from the browser.
      </Alert>
      <Text ff="monospace">
        npm run reset:openproject -- --yes --confirm{' '}
        DELETE_ALL_OPENPROJECT_PROJECTS_AND_WORK_PACKAGES
      </Text>
    </Stack>
  );
}
