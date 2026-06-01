import { Alert, Button, Group, MultiSelect, Select } from '@mantine/core';
import { useWorkspaceShellContext } from './WorkspaceShellContext';

export function BulkUpdateBar() {
  const state = useWorkspaceShellContext();

  return (
    <Alert color="blue" title={`${state.selectedTaskIds.size} selected`}>
      <Group gap="xs">
        <Select
          data-testid="bulk-status-select"
          placeholder="Bulk status"
          data={state.statuses.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(value) => value && void state.runBulkUpdate({ statusId: value })}
          w="12rem"
        />
        <Select
          data-testid="bulk-priority-select"
          placeholder="Bulk priority"
          data={['LOW', 'NORMAL', 'HIGH', 'URGENT']}
          onChange={(value) => value && void state.runBulkUpdate({ priority: value })}
          w="12rem"
        />
        <MultiSelect
          data-testid="bulk-assignee-select"
          placeholder="Bulk assignee/responsible"
          data={state.availableAssignees.map((user) => ({ value: user.id, label: user.name }))}
          maxValues={2}
          onChange={(assigneeIds) => void state.runBulkUpdate({ assigneeIds })}
          w="16rem"
        />
        <Button variant="subtle" onClick={state.clearTaskSelection}>
          Clear selection
        </Button>
      </Group>
    </Alert>
  );
}
