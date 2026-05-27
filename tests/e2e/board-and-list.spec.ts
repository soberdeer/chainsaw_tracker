import { expect, openApp, test } from './fixtures.js';
import { chooseOption, dragAndDrop } from './support/ui.js';

test.describe('board and grouped list views', () => {
  test('moves cards across columns and persists targeted order inside a concrete project scope', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('LEAD');

    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    await page.getByRole('tab', { name: 'Board' }).click();

    const todoColumn = page
      .locator('[data-testid="board-column"][data-status-id="status-todo"]')
      .first();
    const reviewColumn = page
      .locator('[data-testid="board-column"][data-status-id="status-review"]')
      .first();
    const heroCard = page.locator('[data-testid="task-card"][data-task-id="wp-101"]').first();
    const todoCards = todoColumn.locator('[data-testid="task-card"]');
    const reviewCards = reviewColumn.locator('[data-testid="task-card"]');
    const menuDropZone = page
      .locator('[data-testid="board-dropzone"][data-target-task-id="wp-103"]')
      .first();

    await dragAndDrop(page, heroCard, menuDropZone);
    await expect(todoCards.nth(0)).toContainText('Unmergeable test task');
    await expect(reviewCards.nth(0)).toContainText('Hero controller');
    await expect(reviewCards.nth(1)).toContainText('Menu polish');

    await page.reload();
    await page.getByRole('tab', { name: 'Board' }).click();
    await expect(todoCards.nth(0)).toContainText('Unmergeable test task');
    await expect(reviewCards.nth(0)).toContainText('Hero controller');
    await expect(reviewCards.nth(1)).toContainText('Menu polish');
    await expect(todoColumn).toContainText('Unmergeable test task');
  });

  test('shows rollback feedback when board move persistence fails and aggregate boards stay read-only', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('LEAD');
    mockApi.setFailure('boardOrder');

    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    await page.getByRole('tab', { name: 'Board' }).click();
    const heroCard = page.locator('[data-testid="task-card"][data-task-id="wp-101"]').first();
    const reviewTarget = page
      .locator('[data-testid="board-dropzone"][data-target-task-id="wp-103"]')
      .first();
    const todoColumn = page
      .locator('[data-testid="board-column"][data-status-id="status-todo"]')
      .first();

    await dragAndDrop(page, heroCard, reviewTarget);
    await expect(page.getByText('Action failed')).toBeVisible();
    await expect(todoColumn).toContainText('Hero controller');

    await page.goto('/tasks');
    await page.getByRole('tab', { name: 'Board' }).click();
    await expect(page.getByText('Read-only')).toBeVisible();
  });

  test('bulk updates from the grouped list apply partial results and stay hidden from viewers', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('LEAD');

    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    await page.getByLabel('Select Hero controller').check();
    await page.getByLabel('Select Unmergeable test task').check();
    await chooseOption(page, 'bulk-status-select', 'Done');

    await expect(
      page
        .getByTestId('workspace-shell')
        .getByText('Bulk update finished: 1 updated, 1 failed, 0 skipped.')
    ).toBeVisible();
    await expect(
      page.getByTestId('workspace-shell').getByText('wp-104: OpenProject rejected the update')
    ).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('task-list')).toContainText('Hero controller');

    mockApi.setCurrentUser('VIEWER');
    await page.goto('/space/space-alpha/folder/folder-alpha');
    await expect(page.getByTestId('bulk-status-select')).toHaveCount(0);
  });
});
