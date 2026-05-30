import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import type { MyWorkSummary } from '@/lib';

interface MyWorkTabProps {
  myWork: MyWorkSummary | null;
  myWorkError: string | null;
  onOpenAssignedToMe: () => void;
}

export function MyWorkTab({ myWork, myWorkError, onOpenAssignedToMe }: MyWorkTabProps) {
  if (myWorkError) {
    return (
      <Alert color="yellow" title="Assigned work is not linked yet">
        {myWorkError}
      </Alert>
    );
  }

  if (!myWork) {
    return (
      <Text size="sm" c="dimmed">
        No my work summary available.
      </Text>
    );
  }

  return (
    <Stack>
      <Group grow>
        <Alert title="Assigned">{myWork.assignedCount}</Alert>
        <Alert title="Overdue" color="red">
          {myWork.overdueCount}
        </Alert>
        <Alert title="Due this week" color="blue">
          {myWork.dueThisWeekCount}
        </Alert>
      </Group>
      <Button variant="light" onClick={onOpenAssignedToMe}>
        Open Assigned to me
      </Button>
      <Stack gap="xs">
        <Text fw={600}>Recently updated assigned tasks</Text>
        {myWork.recentlyUpdated.length ? (
          myWork.recentlyUpdated.map((task) => (
            <Text size="sm" key={task.id}>
              {task.title}
            </Text>
          ))
        ) : (
          <Text size="sm" c="dimmed">
            No assigned work found yet.
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
