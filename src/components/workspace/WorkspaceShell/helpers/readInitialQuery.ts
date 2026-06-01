export function readInitialQuery(
  search = typeof window === 'undefined' ? '' : window.location.search
) {
  const params = new URLSearchParams(search);
  return {
    taskView: params.get('view') || 'tasks',
    taskSearch: params.get('search') || '',
    statusFilter: params.get('status') || null,
    priorityFilter: params.get('priority') || null,
    assigneeFilter: params.get('assignees')?.split(',').filter(Boolean) || [],
    responsibleFilter: params.get('responsibles')?.split(',').filter(Boolean) || [],
    typeFilter: params.get('types')?.split(',').filter(Boolean) || [],
    tagFilter: params.get('tags')?.split(',').filter(Boolean) || [],
    dueBeforeFilter: params.get('dueBefore') || '',
    updatedSinceFilter: params.get('updatedSince') || '',
    overdueFilter: params.get('overdue') === 'true',
    hasGitHubPrFilter: params.get('hasGitHubPr') === 'true',
    cursor: params.get('cursor') || null,
    sortDir: (params.get('sort') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc',
  };
}
