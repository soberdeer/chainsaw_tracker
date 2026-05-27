import { expect, openApp, test } from './fixtures.js';
import { chooseMultiOption, chooseOption } from './support/ui.js';

test.describe('task create and detail editing', () => {
  test('creates a task from the grouped list and keeps it after reload', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('LEAD');

    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    await page.getByTestId('list-add-task-status-todo').click();
    await expect(page.getByTestId('task-create-title-input')).toBeVisible();

    await page.getByTestId('task-create-submit').click();
    await expect(page.getByText('Task title is required')).toBeVisible();

    await page.getByTestId('task-create-title-input').fill('Create combat telemetry');
    await page
      .getByTestId('task-create-description-input')
      .fill('Capture encounter metrics for the next playtest.');
    await chooseOption(page, 'task-create-priority-select', 'HIGH');
    await chooseMultiOption(page, 'task-create-assignee-select', 'Lead One');
    await chooseMultiOption(page, 'task-create-assignee-select', 'Member One');
    await page.getByTestId('task-create-start-date-input').fill('2026-05-22');
    await page.getByTestId('task-create-due-date-input').fill('2026-05-25');
    await page.getByTestId('task-create-submit').click();

    await expect(page.getByTestId('task-create-title-input')).toHaveCount(0);
    await expect(page.getByTestId('task-list')).toContainText('Create combat telemetry');

    await page.reload();
    await expect(page.getByTestId('task-list')).toContainText('Create combat telemetry');
  });

  test('creates a task from a board column and keeps its status', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');

    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    await page.getByRole('tab', { name: 'Board' }).click();
    const reviewColumn = page
      .locator('[data-testid="board-column"][data-status-id="status-review"]')
      .first();
    await reviewColumn.getByTestId('board-add-task').click();

    await page.getByTestId('task-create-title-input').fill('Review combat UI copy');
    await chooseMultiOption(page, 'task-create-assignee-select', 'Member One');
    await page.getByTestId('task-create-submit').click();

    await expect(reviewColumn).toContainText('Review combat UI copy');
    await page.goto('/space/space-alpha/folder/folder-alpha?view=board');
    await expect(
      page.locator('[data-testid="board-column"][data-status-id="status-review"]').first()
    ).toContainText('Review combat UI copy');
  });

  test('shows an error and leaves no phantom task when OpenProject rejects create', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('LEAD');
    mockApi.setFailure('taskCreate');

    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    await page.getByTestId('list-add-task-status-todo').click();
    await page.getByTestId('task-create-title-input').fill('Task that should fail');
    await page.getByTestId('task-create-submit').click();

    await expect(page.getByText('Could not create task')).toBeVisible();
    await expect(page.getByTestId('task-list')).not.toContainText('Task that should fail');
  });

  test('edits the main task fields in the drawer and persists them after reload', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('LEAD');

    await openApp(page, '/space/space-alpha/folder/folder-alpha/task/wp-101');
    await expect(page.getByTestId('task-detail-page')).toBeVisible();

    await page.getByTestId('task-title-input').fill('Hero controller v2');
    await page.getByTestId('task-detail-page').getByRole('button', { name: 'Save' }).click();
    await page.getByTestId('task-description-input').fill('Updated description from e2e.');
    await page.getByTestId('task-detail-page').getByRole('button', { name: 'Save' }).click();
    await chooseOption(page, 'task-priority-select', 'URGENT');
    await chooseOption(page, 'task-status-select', 'In progress');
    await page.getByLabel('Due date').fill('2026-05-29');
    await page.getByLabel('Start date').fill('2026-05-21');
    await page.getByLabel('Start date').blur();
    await chooseMultiOption(page, 'task-assignee-select', 'Lead One');
    await chooseMultiOption(page, 'task-assignee-select', 'Member One');
    await page.getByRole('button', { name: 'Close' }).click();

    await expect(page.getByTestId('task-list')).toContainText('Hero controller v2');
    await page.reload();
    await page.goto('/space/space-alpha/folder/folder-alpha/task/wp-101');
    await expect(page.getByTestId('task-detail-page')).toBeVisible();
    await expect(page.getByTestId('task-title-input')).toHaveValue('Hero controller v2');
    await expect(page.getByTestId('task-description-input')).toHaveValue(
      'Updated description from e2e.'
    );
    await expect(page.getByLabel('Due date')).toHaveValue('2026-05-29');
  });

  test('rolls back a failed drawer update instead of leaving fake saved state', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('LEAD');
    mockApi.setFailure('taskUpdate');

    await openApp(page, '/space/space-alpha/folder/folder-alpha/task/wp-101');
    await expect(page.getByTestId('task-detail-page')).toBeVisible();

    await chooseOption(page, 'task-priority-select', 'URGENT');
    await expect(page.getByText('Action failed')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('task-detail-page')).toBeVisible();
    await expect(page.getByTestId('task-priority-select')).toHaveValue('HIGH');
  });
});
