import { Alert, Anchor, Breadcrumbs, Burger, Button, Group, Text } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { NotificationMenu } from './NotificationMenu';
import { useWorkspaceShellContext } from './WorkspaceShellContext';
import classes from './WorkspaceShell.module.css';

export function WorkspaceShellHeader() {
  const state = useWorkspaceShellContext();
  return (
    <>
      {state.actionNotice && (
        <Alert
          color="green"
          title="Saved"
          withCloseButton
          onClose={() => state.setActionNotice(null)}
          m="md"
        >
          {state.actionNotice}
        </Alert>
      )}
      {state.actionError && (
        <Alert
          color="red"
          title="Action failed"
          withCloseButton
          onClose={() => state.setActionError(null)}
          m="md"
        >
          {state.actionError}
        </Alert>
      )}
      <Group className={classes.topBar} justify="space-between">
        <Group gap="xs" wrap="nowrap">
          <Burger
            opened={state.mobileNavOpened}
            onClick={state.toggleMobileNav}
            hiddenFrom="sm"
            size="sm"
            aria-label="Toggle navigation"
          />
          <Breadcrumbs separator="/" separatorMargin="xs" data-testid="breadcrumbs">
            {state.breadcrumbItems.map((item, index) => {
              const isLast = index === state.breadcrumbItems.length - 1;
              const label = (
                <Text fw={isLast ? 800 : 600} c={isLast ? undefined : 'dimmed'}>
                  {item.label}
                </Text>
              );
              return (
                <Group gap="xs" wrap="nowrap" key={`${item.label}:${index}`}>
                  {index === 0 && state.activeSpace ? (
                    <span
                      className={classes.breadcrumbChip}
                      style={{ background: state.activeSpace.color }}
                    >
                      {state.activeSpace.initials || state.activeSpace.name.slice(0, 1)}
                    </span>
                  ) : null}
                  {item.href ? (
                    <Anchor component={Link} to={item.href} underline="never">
                      {label}
                    </Anchor>
                  ) : (
                    label
                  )}
                </Group>
              );
            })}
          </Breadcrumbs>
        </Group>
        <Group gap="md">
          <NotificationMenu />
          <Button
            variant="light"
            leftSection={<IconSearch size="1rem" />}
            onClick={() => state.setSearchOpen(true)}
          >
            Search ⌘K
          </Button>
          <Button variant="light" onClick={state.toggleColorScheme}>
            {state.colorScheme === 'dark' ? 'Light' : 'Dark'}
          </Button>
        </Group>
      </Group>
    </>
  );
}
