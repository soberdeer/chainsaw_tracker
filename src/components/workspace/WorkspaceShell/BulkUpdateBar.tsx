import { Alert, Button, Group, MultiSelect, Select } from '@mantine/core';
import type { TaskStatus, User } from '@/lib';

interface BulkUpdateBarProps {
  selectedCount: number;
  statuses: TaskStatus[];
  assignees: User[];
  onBulkStatus: (statusId: string) => void;
  onBulkPriority: (priority: string) => void;
  onBulkAssignees: (assigneeIds: string[]) => void;
  onClearSelection: () => void;
}

export function BulkUpdateBar({
  selectedCount,
  statuses,
  assignees,
  onBulkStatus,
  onBulkPriority,
  onBulkAssignees,
  onClearSelection,
}: BulkUpdateBarProps) {
  return (
    <Alert color="blue" title={`${selectedCount} selected`}>
      <Group gap="xs">
        <Select
          data-testid="bulk-status-select"
          placeholder="Bulk status"
          data={statuses.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(value) => value && onBulkStatus(value)}
          w="12rem"
        />
        <Select
          data-testid="bulk-priority-select"
          placeholder="Bulk priority"
          data={['LOW', 'NORMAL', 'HIGH', 'URGENT']}
          onChange={(value) => value && onBulkPriority(value)}
          w="12rem"
        />
        <MultiSelect
          data-testid="bulk-assignee-select"
          placeholder="Bulk assignee/responsible"
          data={assignees.map((user) => ({ value: user.id, label: user.name }))}
          maxValues={2}
          onChange={onBulkAssignees}
          w="16rem"
        />
        <Button variant="subtle" onClick={onClearSelection}>
          Clear selection
        </Button>
      </Group>
    </Alert>
  );
}
