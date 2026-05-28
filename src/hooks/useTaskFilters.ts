import { useState } from 'react';
import type { TaskStatus } from '@/lib';

export interface TaskFiltersInit {
  taskView: string;
  taskSearch: string;
  statusFilter: string | null;
  priorityFilter: string | null;
  assigneeFilter: string[];
  responsibleFilter: string[];
  typeFilter: string[];
  tagFilter: string[];
  dueBeforeFilter: string;
  updatedSinceFilter: string;
  overdueFilter: boolean;
  hasGitHubPrFilter: boolean;
  sortDir: 'asc' | 'desc';
}

export function useTaskFilters(init: TaskFiltersInit) {
  const [taskView, setTaskView] = useState<string | null>(init.taskView);
  const [taskSearch, setTaskSearch] = useState(init.taskSearch);
  const [statusFilter, setStatusFilter] = useState<string | null>(init.statusFilter);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(init.priorityFilter);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>(init.assigneeFilter);
  const [responsibleFilter, setResponsibleFilter] = useState<string[]>(init.responsibleFilter);
  const [typeFilter, setTypeFilter] = useState<string[]>(init.typeFilter);
  const [tagFilter, setTagFilter] = useState<string[]>(init.tagFilter);
  const [dueBeforeFilter, setDueBeforeFilter] = useState(init.dueBeforeFilter);
  const [updatedSinceFilter, setUpdatedSinceFilter] = useState(init.updatedSinceFilter);
  const [overdueFilter, setOverdueFilter] = useState(init.overdueFilter);
  const [hasGitHubPrFilter, setHasGitHubPrFilter] = useState(init.hasGitHubPrFilter);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(init.sortDir);

  const filtersActive = Boolean(
    taskSearch.trim() ||
    statusFilter ||
    priorityFilter ||
    assigneeFilter.length ||
    responsibleFilter.length ||
    typeFilter.length ||
    tagFilter.length ||
    dueBeforeFilter ||
    updatedSinceFilter ||
    overdueFilter ||
    hasGitHubPrFilter
  );

  const clearFilters = () => {
    setTaskSearch('');
    setStatusFilter(null);
    setPriorityFilter(null);
    setAssigneeFilter([]);
    setResponsibleFilter([]);
    setTypeFilter([]);
    setTagFilter([]);
    setDueBeforeFilter('');
    setUpdatedSinceFilter('');
    setOverdueFilter(false);
    setHasGitHubPrFilter(false);
  };

  function buildActiveChips(
    statuses: TaskStatus[],
    taskTypes: { id: string; name: string }[],
    tags: { id: string; name: string }[]
  ) {
    return [
      statusFilter
        ? {
            key: 'status',
            label: `Status: ${statuses.find((item) => item.id === statusFilter)?.name || statusFilter}`,
          }
        : null,
      priorityFilter ? { key: 'priority', label: `Priority: ${priorityFilter}` } : null,
      assigneeFilter.length
        ? { key: 'assignees', label: `Assignees: ${assigneeFilter.length}` }
        : null,
      responsibleFilter.length
        ? { key: 'responsibles', label: `Responsible: ${responsibleFilter.length}` }
        : null,
      typeFilter.length
        ? {
            key: 'types',
            label: `Type: ${typeFilter.map((id) => taskTypes.find((t) => t.id === id)?.name || id).join(', ')}`,
          }
        : null,
      tagFilter.length
        ? {
            key: 'tags',
            label: `Tags: ${tagFilter.map((id) => tags.find((t) => t.id === id)?.name || id).join(', ')}`,
          }
        : null,
      dueBeforeFilter ? { key: 'dueBefore', label: `Due by: ${dueBeforeFilter}` } : null,
      updatedSinceFilter
        ? { key: 'updatedSince', label: `Updated since: ${updatedSinceFilter}` }
        : null,
      overdueFilter ? { key: 'overdue', label: 'Overdue' } : null,
      hasGitHubPrFilter ? { key: 'github', label: 'Has GitHub PR' } : null,
    ].filter(Boolean) as Array<{ key: string; label: string }>;
  }

  return {
    taskView,
    setTaskView,
    taskSearch,
    setTaskSearch,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    assigneeFilter,
    setAssigneeFilter,
    responsibleFilter,
    setResponsibleFilter,
    typeFilter,
    setTypeFilter,
    tagFilter,
    setTagFilter,
    dueBeforeFilter,
    setDueBeforeFilter,
    updatedSinceFilter,
    setUpdatedSinceFilter,
    overdueFilter,
    setOverdueFilter,
    hasGitHubPrFilter,
    setHasGitHubPrFilter,
    sortDir,
    setSortDir,
    filtersActive,
    clearFilters,
    buildActiveChips,
  };
}
