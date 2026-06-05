import { expect, openApp, test } from './fixtures.js';
import { chooseMultiOption, chooseOption } from './support/ui.js';

test.describe('tags, filters, local-filter pagination, and saved views', () => {
  test('creates a tag for an OpenProject-backed task and shows it in detail, list, and board', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('MEMBER');

    await openApp(page, '/space/space-alpha/folder/folder-alpha/task/wp-101');
    await page.getByLabel('Create tag').fill('telemetry');
    await page.getByRole('button', { name: 'Create and add' }).click();
    await expect(page.getByTestId('task-detail-page')).toContainText('telemetry');
    await page.getByRole('button', { name: 'Close' }).click();

    await expect(page.getByTestId('task-list')).toContainText('telemetry');
    await page.goto('/space/space-alpha/folder/folder-alpha?view=board');
    await expect(
      page.locator('[data-testid="task-card"][data-task-id="wp-101"]').first()
    ).toContainText('telemetry');

    await page.reload();
    await page.goto('/space/space-alpha/folder/folder-alpha/task/wp-101');
    await expect(page.getByTestId('task-detail-page')).toBeVisible();
    await expect(page.getByTestId('task-detail-page')).toContainText('telemetry');
  });

  test('finds tag-filtered and GitHub-filtered tasks beyond the first OpenProject page', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('MEMBER');
    const paginationTag = 'pagination-e2e';
    const lateTaggedTaskIds = [
      ...Array.from({ length: 50 }, (_, index) => `wp-${401 + index}`),
      'wp-777',
    ];
    const paginationTagId = mockApi.attachTagToTask(lateTaggedTaskIds[0], paginationTag);
    for (const taskId of lateTaggedTaskIds.slice(1)) {
      mockApi.attachTagToTask(taskId, paginationTag);
    }

    await openApp(page, `/tasks?tags=${paginationTagId}`);
    await expect(page.getByText(`Tags: ${paginationTag}`)).toBeVisible();
    await expect(page.getByTestId('task-list')).toContainText('Backlog task 101');
    await expect(page.locator('[data-testid="task-row"][data-task-id="wp-777"]')).toHaveCount(0);
    const loadMoreButton = page.getByTestId('load-more-tasks');
    await expect(loadMoreButton).toBeVisible();
    await expect(loadMoreButton).toBeEnabled();
    await expect(loadMoreButton).toHaveAttribute('data-next-cursor', '201');
    await page.goto(`/tasks?tags=${paginationTagId}&cursor=201`);
    await expect
      .poll(() => mockApi.state.taskRequests.some((request) => request.cursor === '201'))
      .toBe(true);
    await expect(page.locator('[data-testid="task-row"][data-task-id="wp-777"]')).toBeVisible();

    await page.goto(`/my-tasks?tags=${paginationTagId}`);
    await expect(page.getByTestId('task-list')).toContainText('Late-page tagged task');

    await page.goto('/tasks?hasGitHubPr=true');
    await expect(page.getByTestId('task-list')).toContainText('Late-page PR task');
  });

  test('saves and restores filters through a saved view', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');

    await openApp(page, '/tasks');
    await chooseMultiOption(page, 'filter-type', 'Bug');
    await chooseMultiOption(page, 'filter-tags', 'blocker');
    await page.getByTestId('saved-view-name-input').fill('Critical blockers');
    await chooseOption(page, 'saved-view-visibility-select', 'Private');
    await page.getByTestId('saved-view-save-button').click();

    await page.getByTestId('clear-filters-button').click();
    await chooseOption(page, 'saved-view-select', 'Critical blockers');
    await expect(page.getByTestId('task-list')).toContainText('Fix jump bug');
    await expect(page.getByTestId('task-list')).not.toContainText('Hero controller');

    await page.reload();
    await expect(page.getByTestId('task-list')).toContainText('Fix jump bug');
    await expect(page.getByTestId('task-list')).not.toContainText('Hero controller');
  });
});
