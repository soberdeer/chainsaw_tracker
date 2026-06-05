import { expect, openApp, test } from './fixtures.js';
import { chooseOption, dragAndDrop } from './support/ui.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

async function openListView(page: any) {
  await openApp(page, '/space/space-alpha/folder/folder-alpha');
  // Default tab is Tasks (list) — make sure it is visible
  await expect(page.getByTestId('task-list')).toBeVisible();
}

async function openBoardView(page: any) {
  await openApp(page, '/space/space-alpha/folder/folder-alpha');
  await page.getByRole('tab', { name: 'Board' }).click();
  // Wait for at least one column to appear
  await expect(page.locator('[data-testid="board-column"]').first()).toBeVisible();
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouped list view
// ─────────────────────────────────────────────────────────────────────────────

test.describe('grouped list view', () => {
  test('renders top-level tasks grouped by status', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openListView(page);

    const list = page.getByTestId('task-list');
    await expect(list).toContainText('Hero controller');
    await expect(list).toContainText('Fix jump bug');
    await expect(list).toContainText('Menu polish');
    await expect(list).toContainText('Unmergeable test task');
  });

  test('subtask is NOT shown as a top-level row before expanding', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openListView(page);

    // 'Setup input bindings' is wp-101-sub (child of wp-101)
    // It must not appear at the top level — only after expanding the parent
    const rows = page.locator('[data-testid="task-row"]');
    const titles = await rows.allInnerTexts();
    const topLevelTitles = titles.join('\n');
    expect(topLevelTitles).toContain('Hero controller');
    expect(topLevelTitles).not.toContain('Setup input bindings');
  });

  test('parent row shows chevron toggle when it has subtasks', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openListView(page);

    const heroRow = page.locator('[data-testid="task-row-wrapper"]').filter({
      has: page.locator('[data-testid="task-row-open"]', { hasText: 'Hero controller' }),
    });

    // Chevron ActionIcon should be present on the parent row
    const chevron = heroRow
      .locator('[data-testid="task-row"] button[aria-label*="subtask"]')
      .first();
    await expect(chevron).toBeVisible();
  });

  test('clicking chevron expands subtasks indented under parent', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openListView(page);

    const heroWrapper = page.locator('[data-testid="task-row-wrapper"]').filter({
      has: page.locator('[data-testid="task-row-open"]', { hasText: 'Hero controller' }),
    });

    // Subtask not yet visible
    await expect(page.getByText('Setup input bindings')).not.toBeVisible();

    // Click the expand chevron
    await heroWrapper
      .locator('[data-testid="task-row"] button[aria-label*="subtask"]')
      .first()
      .click();

    // Subtask now appears inside the subtasksContainer under the parent
    const subtasksContainer = heroWrapper.locator('[class*="subtasksContainer"]');
    await expect(subtasksContainer).toBeVisible();
    await expect(subtasksContainer).toContainText('Setup input bindings');
  });

  test('subtask row has higher indentation than its parent', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openListView(page);

    const heroWrapper = page.locator('[data-testid="task-row-wrapper"]').filter({
      has: page.locator('[data-testid="task-row-open"]', { hasText: 'Hero controller' }),
    });

    await heroWrapper
      .locator('[data-testid="task-row"] button[aria-label*="subtask"]')
      .first()
      .click();

    // The parent task-row has data-depth="0", the subtask has data-depth="1"
    const parentDepth = await heroWrapper
      .locator('[data-testid="task-row"]')
      .first()
      .getAttribute('data-depth');
    const subtaskDepth = await heroWrapper
      .locator('[data-testid="task-row"]')
      .nth(1)
      .getAttribute('data-depth');

    expect(Number(parentDepth)).toBe(0);
    expect(Number(subtaskDepth)).toBeGreaterThan(0);

    // The title button inside the subtask row is visually to the right of the parent's
    const parentTitleBox = await heroWrapper
      .locator('[data-testid="task-row"]')
      .first()
      .locator('[data-testid="task-row-open"]')
      .boundingBox();
    const subtaskTitleBox = await heroWrapper
      .locator('[data-testid="task-row"]')
      .nth(1)
      .locator('[data-testid="task-row-open"]')
      .boundingBox();

    expect(parentTitleBox).not.toBeNull();
    expect(subtaskTitleBox).not.toBeNull();
    expect(subtaskTitleBox!.x).toBeGreaterThan(parentTitleBox!.x);
  });

  test('clicking chevron again collapses subtasks', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openListView(page);

    const heroWrapper = page.locator('[data-testid="task-row-wrapper"]').filter({
      has: page.locator('[data-testid="task-row-open"]', { hasText: 'Hero controller' }),
    });
    const chevron = heroWrapper
      .locator('[data-testid="task-row"] button[aria-label*="subtask"]')
      .first();

    // Expand
    await chevron.click();
    await expect(heroWrapper.locator('[class*="subtasksContainer"]')).toBeVisible();

    // Collapse
    await chevron.click();
    await expect(heroWrapper.locator('[class*="subtasksContainer"]')).not.toBeVisible();
    await expect(page.getByText('Setup input bindings')).not.toBeVisible();
  });

  test('clicking subtask row opens task detail', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openListView(page);

    const heroWrapper = page.locator('[data-testid="task-row-wrapper"]').filter({
      has: page.locator('[data-testid="task-row-open"]', { hasText: 'Hero controller' }),
    });

    await heroWrapper
      .locator('[data-testid="task-row"] button[aria-label*="subtask"]')
      .first()
      .click();

    const subtaskTitle = heroWrapper
      .locator('[class*="subtasksContainer"] [data-testid="task-row-open"]')
      .first();
    await subtaskTitle.click();

    // Task detail panel should open — verify by description text (title may be in an input)
    await expect(page.getByTestId('task-detail-page')).toBeVisible();
    // The subtask description is "Configure input action map for the hero controller."
    await expect(page.getByTestId('task-detail-page')).toContainText('Configure input action map');
  });

  test('rows without subtasks show no chevron (placeholder spacer only)', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('MEMBER');
    await openListView(page);

    // 'Fix jump bug' (wp-102) has no subtasks
    const bugWrapper = page.locator('[data-testid="task-row-wrapper"]').filter({
      has: page.locator('[data-testid="task-row-open"]', { hasText: 'Fix jump bug' }),
    });

    // No expand button should be present
    await expect(
      bugWrapper.locator('[data-testid="task-row"] button[aria-label*="subtask"]')
    ).toHaveCount(0);
  });

  test('status sections are collapsible', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openListView(page);

    const todoSection = page.locator('[data-status-wrapper="status-todo"]');
    await expect(todoSection).toContainText('Hero controller');

    const collapseBtn = page
      .locator('[data-status-id="status-todo"] button[aria-label*="Collapse"]')
      .first();
    await collapseBtn.click();
    await expect(todoSection.locator('[data-testid="task-row"]')).toHaveCount(0);

    // Re-expand (aria-label switches to "Expand …")
    const expandBtn = page
      .locator('[data-status-id="status-todo"] button[aria-label*="Expand"]')
      .first();
    await expandBtn.click();
    await expect(todoSection).toContainText('Hero controller');
  });

  test('moves cards across columns and persists targeted order inside a concrete project scope', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('MEMBER');

    await openBoardView(page);

    const todoColumn = page
      .locator('[data-testid="board-column"][data-status-id="status-todo"]')
      .first();
    const reviewColumn = page
      .locator('[data-testid="board-column"][data-status-id="status-review"]')
      .first();
    const heroCard = page.locator('[data-testid="task-card"][data-task-id="wp-101"]').first();
    const todoCards = todoColumn.locator('[data-testid="task-card"]');
    const reviewCards = reviewColumn.locator('[data-testid="task-card"]');
    const menuDropZone = page.locator('[data-target-task-id="wp-103"]').first();

    // Wait for the drop target to be present before dragging
    await expect(menuDropZone).toBeVisible();
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
    mockApi.setCurrentUser('MEMBER');
    mockApi.setFailure('boardOrder');

    await openBoardView(page);
    const heroCard = page.locator('[data-testid="task-card"][data-task-id="wp-101"]').first();
    const reviewTarget = page.locator('[data-target-task-id="wp-103"]').first();
    const todoColumn = page
      .locator('[data-testid="board-column"][data-status-id="status-todo"]')
      .first();

    await expect(reviewTarget).toBeVisible();
    await dragAndDrop(page, heroCard, reviewTarget);
    await expect(page.getByText('Action failed')).toBeVisible();
    await expect(todoColumn).toContainText('Hero controller');

    await page.goto('/tasks');
    await page.getByRole('tab', { name: 'Board' }).click();
    await expect(page.getByText('Read-only')).toBeVisible();
  });

  test('bulk updates from the grouped list apply partial results and stay hidden from readers', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('MEMBER');

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

    mockApi.setCurrentUser('READER');
    await page.goto('/space/space-alpha/folder/folder-alpha');
    await expect(page.getByTestId('bulk-status-select')).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Board view
// ─────────────────────────────────────────────────────────────────────────────

test.describe('board view', () => {
  test('renders a column for each status with correct task cards', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openBoardView(page);

    const todoCol = page.locator('[data-testid="board-column"][data-status-id="status-todo"]');
    const progressCol = page.locator(
      '[data-testid="board-column"][data-status-id="status-progress"]'
    );
    const reviewCol = page.locator('[data-testid="board-column"][data-status-id="status-review"]');

    await expect(todoCol).toContainText('Hero controller');
    await expect(todoCol).toContainText('Unmergeable test task');
    await expect(progressCol).toContainText('Fix jump bug');
    await expect(reviewCol).toContainText('Menu polish');
  });

  test('subtask does not appear as a separate top-level board card', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openBoardView(page);

    // wp-101-sub ('Setup input bindings') should NOT have its own board card
    await expect(page.locator('[data-testid="task-card"][data-task-id="wp-101-sub"]')).toHaveCount(
      0
    );
    // But the parent (wp-101) should still be present
    await expect(page.locator('[data-testid="task-card"][data-task-id="wp-101"]')).toBeVisible();
  });

  test('board cards show task title, priority badge and assignee avatar', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('MEMBER');
    await openBoardView(page);

    const heroCard = page.locator('[data-testid="task-card"][data-task-id="wp-101"]');
    await expect(heroCard).toContainText('Hero controller');
    await expect(heroCard).toContainText('HIGH');
    // Assignee avatar — Priority renders Avatar elements
    await expect(heroCard.locator('.mantine-Avatar-root').first()).toBeVisible();
  });

  test('board shows due date on cards that have one', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openBoardView(page);

    // wp-102 'Fix jump bug' has a dueDate set — verify a date string is visible on the card
    const bugCard = page.locator('[data-testid="task-card"][data-task-id="wp-102"]');
    await expect(bugCard).toBeVisible();
    // The card renders a short month + day string (e.g. "May 30") when dueDate is present
    await expect(bugCard).toContainText(/[A-Z][a-z]{2} \d{1,2}/);
  });

  test('read-only viewer cannot see add-task buttons on board', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('READER');
    await openBoardView(page);

    await expect(page.locator('[data-testid="board-add-task"]')).toHaveCount(0);
  });

  test('writer sees add-task button per column', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openBoardView(page);

    const addBtns = page.locator('[data-testid="board-add-task"]');
    await expect(addBtns.first()).toBeVisible();
  });

  test('PR badge visible on cards that have a pull request', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    // wp-101 (Hero controller) has pr-hero attached and is always in the first page
    await openBoardView(page);

    const heroCard = page.locator('[data-testid="task-card"][data-task-id="wp-101"]');
    await expect(heroCard).toBeVisible();
    await expect(heroCard.getByText('PR')).toBeVisible();
  });

  test('board renders at least one card per list', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openBoardView(page);

    const cards = page.locator('[data-testid="task-card"]');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('board container renders with columns', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openBoardView(page);

    // The inner board div (data-testid="task-board") and columns are present
    await expect(page.locator('[data-testid="task-board"]')).toBeVisible();
    await expect(page.locator('[data-testid="board-column"]').first()).toBeVisible();
  });
});
