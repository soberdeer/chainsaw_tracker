import { Button, Checkbox, Group, MultiSelect, Select, Stack, TextInput } from '@mantine/core';
import { useState } from 'react';
import { useWorkspaceShellContext } from './WorkspaceShellContext';

export function TaskFilterPanel() {
  const state = useWorkspaceShellContext();
  const [savedViewName, setSavedViewName] = useState('');
  const [savedViewVisibility, setSavedViewVisibility] = useState<'PRIVATE' | 'WORKSPACE'>(
    'PRIVATE'
  );
  const [saving, setSaving] = useState(false);

  const handleSaveView = async () => {
    if (!savedViewName.trim()) return;
    setSaving(true);
    try {
      await state.saveCurrentView(savedViewName.trim(), savedViewVisibility);
      setSavedViewName('');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyView = (viewId: string | null) => {
    const view = state.savedViews.find((v) => v.id === viewId);
    if (view) state.applyView(view);
  };

  return (
    <Stack gap="xs">
      <Group gap="xs" align="flex-end" wrap="wrap">
        <MultiSelect
          data-testid="filter-type"
          label="Type"
          value={state.typeFilter}
          onChange={state.setTypeFilter}
          clearable
          placeholder="Any type"
          data={state.taskTypes.map((type) => ({ value: type.id, label: type.name }))}
          searchable
          style={{ minWidth: 160 }}
        />
        <MultiSelect
          data-testid="filter-tags"
          label="Tags"
          value={state.tagFilter}
          onChange={state.setTagFilter}
          clearable
          placeholder="Any tag"
          data={state.openProjectTags.map((tag) => ({ value: tag.id, label: tag.name }))}
          searchable
          style={{ minWidth: 160 }}
        />
        <MultiSelect
          data-testid="filter-assignees"
          label="Assignees"
          value={state.assigneeFilter}
          onChange={state.setAssigneeFilter}
          clearable
          placeholder="Anyone"
          data={state.availableAssignees.map((user) => ({ value: user.id, label: user.name }))}
          searchable
          style={{ minWidth: 160 }}
        />
        <Select
          data-testid="filter-status"
          label="Status"
          value={state.statusFilter}
          onChange={state.setStatusFilter}
          clearable
          placeholder="Any status"
          data={state.statuses.map((item) => ({ value: item.id, label: item.name }))}
          style={{ minWidth: 130 }}
        />
        <Select
          data-testid="filter-priority"
          label="Priority"
          value={state.priorityFilter}
          onChange={state.setPriorityFilter}
          clearable
          placeholder="Any priority"
          data={['LOW', 'NORMAL', 'HIGH', 'URGENT']}
          style={{ minWidth: 120 }}
        />
        <TextInput
          data-testid="filter-due-before"
          label="Due before"
          type="date"
          value={state.dueBeforeFilter}
          onChange={(event) => state.setDueBeforeFilter(event.currentTarget.value)}
          style={{ minWidth: 140 }}
        />
        <Checkbox
          data-testid="filter-has-pr"
          label="Has GitHub PR"
          checked={state.hasGitHubPrFilter}
          onChange={(event) => state.setHasGitHubPrFilter(event.currentTarget.checked)}
          mt="lg"
        />
        {state.filtersActive && (
          <Button
            variant="subtle"
            color="red"
            size="xs"
            mt="lg"
            onClick={() => {
              state.clearFilters();
            }}
            data-testid="clear-filters-button"
          >
            Clear filters
          </Button>
        )}
      </Group>

      <Group gap="xs" align="flex-end" wrap="wrap">
        <Select
          data-testid="saved-view-select"
          label="Load saved view"
          placeholder="Select a view…"
          data={state.savedViews.map((v) => ({ value: v.id, label: v.name }))}
          onChange={handleApplyView}
          clearable
          style={{ minWidth: 180 }}
        />
        <TextInput
          data-testid="saved-view-name-input"
          label="Save current filters as"
          placeholder="View name…"
          value={savedViewName}
          onChange={(e) => setSavedViewName(e.currentTarget.value)}
          style={{ minWidth: 180 }}
        />
        <Select
          data-testid="saved-view-visibility-select"
          label="Visibility"
          value={savedViewVisibility}
          onChange={(v) => setSavedViewVisibility((v as 'PRIVATE' | 'WORKSPACE') || 'PRIVATE')}
          data={[
            { value: 'PRIVATE', label: 'Private' },
            { value: 'WORKSPACE', label: 'Workspace' },
          ]}
          style={{ minWidth: 120 }}
        />
        <Button
          data-testid="saved-view-save-button"
          size="xs"
          mt="lg"
          disabled={!savedViewName.trim()}
          loading={saving}
          onClick={handleSaveView}
        >
          Save view
        </Button>
      </Group>
    </Stack>
  );
}
