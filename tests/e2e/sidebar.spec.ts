import { expect, openApp, test } from './fixtures.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function openSidebar(page: any) {
  await openApp(page, '/space/space-alpha/folder/folder-alpha');
  const sidebar = page.getByTestId('sidebar');
  await expect(sidebar).toBeVisible();
  return sidebar;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar identity & workspace header
// ─────────────────────────────────────────────────────────────────────────────

test.describe('sidebar — workspace header', () => {
  test('shows workspace name', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    const sidebar = await openSidebar(page);
    await expect(sidebar).toContainText('Bootstrap Tracker');
  });

  test('shows workspace settings button for admin', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('ADMIN');
    const sidebar = await openSidebar(page);
    await expect(sidebar.getByRole('button', { name: 'Workspace settings' })).toBeVisible();
  });

  test('hides workspace settings button for member', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    const sidebar = await openSidebar(page);
    await expect(sidebar.getByRole('button', { name: 'Workspace settings' })).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// User profile
// ─────────────────────────────────────────────────────────────────────────────

test.describe('sidebar — user profile', () => {
  test('shows current user name and role', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    const sidebar = await openSidebar(page);
    await expect(sidebar).toContainText('Member One');
    await expect(sidebar).toContainText('MEMBER');
  });

  test('shows logout button', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    const sidebar = await openSidebar(page);
    await expect(sidebar.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('logout returns to login screen', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openSidebar(page);
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByTestId('login-form')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Navigation links
// ─────────────────────────────────────────────────────────────────────────────

test.describe('sidebar — navigation links', () => {
  test('All Tasks navigates to /tasks and shows cross-project tasks', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openSidebar(page);
    await page.getByTestId('all-tasks-link').click();
    await expect(page).toHaveURL('/tasks');
    await expect(page.getByTestId('task-list')).toContainText('Hero controller');
    await expect(page.getByTestId('task-list')).toContainText('Audio balancing');
  });

  test('All Tasks link is highlighted when on /tasks', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openApp(page, '/tasks');
    const link = page.getByTestId('all-tasks-link');
    // Mantine "light" variant sets data-variant attribute
    await expect(link).toHaveAttribute('data-variant', 'light');
  });

  test('My Tasks navigates to /my-tasks', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('LEAD'); // lead has openProjectUserId
    await openSidebar(page);
    await page.getByTestId('my-tasks-link').click();
    await expect(page).toHaveURL('/my-tasks');
    await expect(page.getByTestId('breadcrumbs')).toContainText('My Tasks');
  });

  test('My Tasks is enabled for users with an OpenProject account', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('LEAD'); // lead has openProjectUserId set
    await openSidebar(page);
    await expect(page.getByTestId('my-tasks-link')).not.toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Spaces tree
// ─────────────────────────────────────────────────────────────────────────────

test.describe('sidebar — spaces tree', () => {
  test('lists all spaces', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    const sidebar = await openSidebar(page);
    await expect(sidebar).toContainText('Project Alpha');
    await expect(sidebar).toContainText('Project Beta');
  });

  test('active space is highlighted', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openSidebar(page);
    const alphaLink = page.locator('[data-testid="project-link"][data-project-id="space-alpha"]');
    await expect(alphaLink).toHaveClass(/active/);
  });

  test('clicking another space expands it and shows its folder', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openSidebar(page);

    const betaLink = page.locator('[data-testid="project-link"][data-project-id="space-beta"]');
    await betaLink.click();

    // Folder "Content" from space-beta should appear
    await expect(page.getByTestId('sidebar')).toContainText('Content');
    // URL should update to space-beta/folder-beta
    await expect(page).toHaveURL(/space-beta\/folder\/folder-beta/);
  });

  test('active folder is highlighted in the tree', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    // The folder row for folder-alpha should carry the active CSS class
    const folderRow = page.locator(
      '[class*="folderTreeRow"][class*="active"], [class*="folderTreeRow active"]'
    );
    // At least one active row visible
    await expect(folderRow.first()).toBeVisible();
  });

  test('folder badge shows task count', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    const sidebar = await openSidebar(page);
    // list-alpha has tasks in mock state; the badge should contain a positive number
    await expect(sidebar.locator('.mantine-Badge-root').first()).toBeVisible();
  });

  test('New Space button visible for owner', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('OWNER');
    const sidebar = await openSidebar(page);
    await expect(sidebar.getByText('New Space')).toBeVisible();
  });

  test('New Space button hidden for member', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    const sidebar = await openSidebar(page);
    await expect(sidebar.getByText('New Space')).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sub-project creation
// ─────────────────────────────────────────────────────────────────────────────

test.describe('sidebar — sub-project creation', () => {
  test('+ button visible for owner on active space', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('OWNER');
    await openSidebar(page);
    await expect(page.getByRole('button', { name: 'Create sub-project' })).toBeVisible();
  });

  test('+ button hidden for member', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openSidebar(page);
    await expect(page.getByRole('button', { name: 'Create sub-project' })).toHaveCount(0);
  });

  test('clicking + opens New sub-project modal pre-filled with parent', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('OWNER');
    await openSidebar(page);
    await page.getByRole('button', { name: 'Create sub-project' }).click();

    // Modal title
    await expect(page.getByRole('dialog')).toContainText('New sub-project');

    // Parent project select should be pre-filled with "Project Alpha"
    const parentSelect = page.getByRole('dialog').getByLabel('Parent project');
    await expect(parentSelect).toHaveValue(/Project Alpha/i);
  });

  test('creating a sub-project via modal adds it to the sidebar', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('OWNER');
    await openSidebar(page);

    await page.getByRole('button', { name: 'Create sub-project' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('dialog').getByLabel('Name').fill('Alpha Sub');
    await page.getByRole('dialog').getByRole('button', { name: 'Create project' }).click();

    // Modal closes after creation
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Sidebar reloads and shows the new space
    await expect(page.getByTestId('sidebar')).toContainText('Alpha Sub');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// localStorage — last opened folder
// ─────────────────────────────────────────────────────────────────────────────

test.describe('sidebar — last folder localStorage', () => {
  test('navigating to a folder persists it to localStorage', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openSidebar(page); // opens folder-alpha

    const stored = await page.evaluate(() => localStorage.getItem('op-tracker:last-folder'));
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.spaceId).toBe('space-alpha');
    expect(parsed.folderId).toBe('folder-alpha');
  });

  test('switching to another folder updates localStorage', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openSidebar(page); // opens folder-alpha

    // Navigate to space-beta / folder-beta via sidebar
    await page.locator('[data-testid="project-link"][data-project-id="space-beta"]').click();
    await expect(page).toHaveURL(/folder-beta/);

    const stored = await page.evaluate(() => localStorage.getItem('op-tracker:last-folder'));
    const parsed = JSON.parse(stored!);
    expect(parsed.spaceId).toBe('space-beta');
    expect(parsed.folderId).toBe('folder-beta');
  });

  test('on fresh load with no URL it restores the last folder from localStorage', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('MEMBER');

    // Seed localStorage before loading the app
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem(
        'op-tracker:last-folder',
        JSON.stringify({ spaceId: 'space-beta', folderId: 'folder-beta' })
      );
    });

    // Reload at root — should redirect to space-beta/folder-beta
    await openApp(page, '/');
    await expect(page).toHaveURL(/space-beta\/folder\/folder-beta/);
    await expect(page.getByTestId('task-list')).toContainText('Audio balancing');
  });

  test('unknown stored folder gracefully falls back to first available', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('MEMBER');

    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem(
        'op-tracker:last-folder',
        JSON.stringify({ spaceId: 'space-gone', folderId: 'folder-gone' })
      );
    });

    await openApp(page, '/');
    // Should still land somewhere valid
    await expect(page.getByTestId('workspace-shell')).toBeVisible();
    await expect(page.getByTestId('task-list')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Profile button
// ─────────────────────────────────────────────────────────────────────────────

test.describe('sidebar — profile button', () => {
  test('shows user name and role in profile area', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('LEAD');
    const sidebar = await openSidebar(page);
    await expect(sidebar.getByTestId('profile-button')).toContainText('Lead One');
    await expect(sidebar.getByTestId('profile-button')).toContainText('LEAD');
  });

  test('shows "linked to OpenProject" when user has openProjectUserId', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('LEAD');
    const sidebar = await openSidebar(page);
    await expect(sidebar.getByTestId('profile-button')).toContainText('linked to OpenProject');
  });

  test('clicking profile button opens Account modal', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openSidebar(page);
    await page.getByTestId('profile-button').click();
    // ProfileModal has title="Account"
    await expect(page.getByRole('dialog', { name: 'Account' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Workspace settings button
// ─────────────────────────────────────────────────────────────────────────────

test.describe('sidebar — workspace settings button', () => {
  test('clicking workspace settings opens settings modal', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('ADMIN');
    await openSidebar(page);
    await page.getByRole('button', { name: 'Workspace settings' }).click();
    // WorkspaceSettingsModal is a dialog — check for dialog with "General" tab (initial tab)
    await expect(page.getByRole('dialog').filter({ hasText: 'General' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// My Tasks link highlight
// ─────────────────────────────────────────────────────────────────────────────

test.describe('sidebar — My Tasks link', () => {
  test('My Tasks link is highlighted when on /my-tasks', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('LEAD');
    await openApp(page, '/my-tasks');
    await expect(page.getByTestId('my-tasks-link')).toHaveAttribute('data-variant', 'light');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Space expand / collapse
// ─────────────────────────────────────────────────────────────────────────────

test.describe('sidebar — space expand/collapse', () => {
  test('clicking the active space collapses its folders', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openSidebar(page); // space-alpha is active and expanded

    // Folder "Gameplay" is visible
    await expect(page.getByTestId('folder-row').filter({ hasText: 'Gameplay' })).toBeVisible();

    // Click the active space to collapse
    await page.locator('[data-testid="project-link"][data-project-id="space-alpha"]').click();

    // Folder rows for space-alpha should be gone
    await expect(page.getByTestId('folder-row').filter({ hasText: 'Gameplay' })).not.toBeVisible();
  });

  test('clicking collapsed space re-expands it', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await openSidebar(page);

    const alphaLink = page.locator('[data-testid="project-link"][data-project-id="space-alpha"]');

    // Collapse
    await alphaLink.click();
    await expect(page.getByTestId('folder-row').filter({ hasText: 'Gameplay' })).not.toBeVisible();

    // Re-expand
    await alphaLink.click();
    await expect(page.getByTestId('folder-row').filter({ hasText: 'Gameplay' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Folder rows
// ─────────────────────────────────────────────────────────────────────────────

test.describe('sidebar — folder rows', () => {
  test('clicking a folder row navigates and marks it active', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    // Open space-beta first (it only has one folder: folder-beta / Content)
    await openApp(page, '/space/space-beta/folder/folder-beta');
    await expect(page).toHaveURL(/folder-beta/);

    const contentRow = page.getByTestId('folder-row').filter({ hasText: 'Content' });
    await expect(contentRow).toBeVisible();
    await expect(contentRow).toHaveClass(/active/);
  });

  test('parent folder with sub-folders shows chevron, child hidden initially', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('MEMBER');
    // Navigate to space-gamma which has Engine > Rendering
    await page.locator('[data-testid="project-link"][data-project-id="space-gamma"]');
    await openApp(page, '/space/space-alpha/folder/folder-alpha');

    // Click space-gamma
    await page.locator('[data-testid="project-link"][data-project-id="space-gamma"]').click();

    // "Engine" folder should appear — it has sub-folders so shows a caret, not folder icon
    const engineRow = page.getByTestId('folder-row').filter({ hasText: 'Engine' });
    await expect(engineRow).toBeVisible();

    // "Rendering" sub-folder is NOT yet visible (Engine is collapsed)
    await expect(page.getByTestId('folder-row').filter({ hasText: 'Rendering' })).not.toBeVisible();
  });

  test('parent folder with sub-folders: clicking expands sub-folders', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('MEMBER');
    await openSidebar(page);

    // Navigate to space-gamma (which has Engine > Rendering hierarchy)
    await page.locator('[data-testid="project-link"][data-project-id="space-gamma"]').click();

    const engineRow = page.getByTestId('folder-row').filter({ hasText: 'Engine' });
    await expect(engineRow).toBeVisible();

    // Initially Rendering is not visible (Engine not yet expanded)
    await expect(page.getByTestId('folder-row').filter({ hasText: 'Rendering' })).not.toBeVisible();

    // Clicking Engine expands it, revealing Rendering
    await engineRow.click();
    await expect(page.getByTestId('folder-row').filter({ hasText: 'Rendering' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// New Space modal
// ─────────────────────────────────────────────────────────────────────────────

test.describe('sidebar — New Space modal', () => {
  test('clicking New Space opens the create project modal', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('OWNER');
    await openSidebar(page);
    await page.getByTestId('new-space-button').click();
    await expect(page.getByRole('dialog', { name: 'New OpenProject project' })).toBeVisible();
  });

  test('Cancel closes the modal without creating', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('OWNER');
    await openSidebar(page);
    await page.getByTestId('new-space-button').click();

    const dialog = page.getByRole('dialog', { name: 'New OpenProject project' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();

    // No new space was added
    await expect(page.getByTestId('sidebar')).not.toContainText('Untitled Project');
  });

  test('submitting empty name shows validation error', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('OWNER');
    await openSidebar(page);
    await page.getByTestId('new-space-button').click();

    const dialog = page.getByRole('dialog', { name: 'New OpenProject project' });
    // Submit without filling name
    await dialog.getByRole('button', { name: 'Create project' }).click();

    await expect(dialog).toContainText('Name is required');
    await expect(dialog).toBeVisible(); // modal stays open
  });

  test('identifier field accepts custom value', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('OWNER');
    await openSidebar(page);
    await page.getByTestId('new-space-button').click();

    const dialog = page.getByRole('dialog', { name: 'New OpenProject project' });
    await dialog.getByLabel('Identifier').fill('my-project-id');
    await expect(dialog.getByLabel('Identifier')).toHaveValue('my-project-id');
  });

  test('description field accepts text', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('OWNER');
    await openSidebar(page);
    await page.getByTestId('new-space-button').click();

    const dialog = page.getByRole('dialog', { name: 'New OpenProject project' });
    await dialog.getByLabel('Description').fill('A new space description');
    await expect(dialog.getByLabel('Description')).toHaveValue('A new space description');
  });

  test('public switch toggles', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('OWNER');
    await openSidebar(page);
    await page.getByTestId('new-space-button').click();

    const dialog = page.getByRole('dialog', { name: 'New OpenProject project' });
    // Mantine Switch renders an <input type="checkbox"> — find by label text
    const publicSwitch = dialog.locator('label', { hasText: 'Public project' }).locator('input');

    // Initially off
    await expect(publicSwitch).not.toBeChecked();

    await publicSwitch.click();
    await expect(publicSwitch).toBeChecked();

    await publicSwitch.click();
    await expect(publicSwitch).not.toBeChecked();
  });

  test('parent project select can be changed', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('OWNER');
    await openSidebar(page);
    await page.getByTestId('new-space-button').click();

    const dialog = page.getByRole('dialog', { name: 'New OpenProject project' });
    // Open the parent select and pick "Project Beta"
    await dialog.getByLabel('Parent project').click();
    await page.getByRole('option', { name: 'Project Beta', exact: true }).click();
    await expect(dialog.getByLabel('Parent project')).toHaveValue(/Project Beta/i);
  });

  test('creating a new top-level space adds it to the sidebar', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('OWNER');
    await openSidebar(page);
    await page.getByTestId('new-space-button').click();

    const dialog = page.getByRole('dialog', { name: 'New OpenProject project' });
    await dialog.getByLabel('Name').fill('Project Delta');
    await dialog.getByRole('button', { name: 'Create project' }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId('sidebar')).toContainText('Project Delta');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sub-project modal interactions
// ─────────────────────────────────────────────────────────────────────────────

test.describe('sidebar — sub-project modal interactions', () => {
  test('Cancel on sub-project modal closes without creating', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('OWNER');
    await openSidebar(page);
    await page.getByRole('button', { name: 'Create sub-project' }).click();

    const dialog = page.getByRole('dialog', { name: 'New sub-project' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('submitting empty name in sub-project modal shows validation error', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('OWNER');
    await openSidebar(page);
    await page.getByRole('button', { name: 'Create sub-project' }).click();

    const dialog = page.getByRole('dialog', { name: 'New sub-project' });
    await dialog.getByRole('button', { name: 'Create project' }).click();

    await expect(dialog).toContainText('Name is required');
    await expect(dialog).toBeVisible();
  });

  test('parent select in sub-project modal can be cleared', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('OWNER');
    await openSidebar(page);
    await page.getByRole('button', { name: 'Create sub-project' }).click();

    const dialog = page.getByRole('dialog', { name: 'New sub-project' });
    // Clear the pre-filled parent
    await dialog.getByLabel('Parent project').clear();
    await expect(dialog.getByLabel('Parent project')).toHaveValue('');
  });
});
