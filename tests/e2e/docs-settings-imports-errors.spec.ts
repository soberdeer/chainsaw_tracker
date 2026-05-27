import { expect, openApp, test } from './fixtures.js';

test.describe('docs, workspace settings, imports, and error states', () => {
  test('local docs can be created, edited, reopened, and stay read-only for viewers', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('MEMBER');

    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    await page.getByRole('tab', { name: 'Local Docs' }).click();
    await expect(page.getByTestId('docs-page')).toBeVisible();
    await page.getByLabel('Embed title').fill('Playtest board');
    await page.getByLabel('Embed link').fill('https://example.test/playtest-board');
    await page.getByRole('button', { name: 'Add embed' }).click();

    await page.getByText('Playtest board').click();
    await page.getByTestId('doc-title-input').fill('Playtest board updated');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByTestId('docs-page')).toContainText('Playtest board updated');

    await page.reload();
    await page.getByRole('tab', { name: 'Local Docs' }).click();
    await expect(page.getByTestId('docs-page')).toContainText('Playtest board updated');

    mockApi.setCurrentUser('VIEWER');
    await page.goto('/space/space-alpha/folder/folder-alpha');
    await page.getByRole('tab', { name: 'Local Docs' }).click();
    await expect(page.getByRole('button', { name: 'New MD' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add embed' })).toHaveCount(0);
  });

  test('workspace settings show connection status and import reports for owners', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('OWNER');

    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    await page.getByRole('button', { name: 'Open Workspace Settings' }).click();
    const settingsDialog = page.getByRole('dialog', { name: 'Workspace settings' });
    await expect(settingsDialog).toBeVisible();

    await page.getByRole('tab', { name: 'OpenProject' }).click();
    await expect(
      settingsDialog.getByText('Base URL: https://openproject.example.test')
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Imports' }).click();
    await expect(settingsDialog.getByText('CLICKUP')).toBeVisible();
    await expect(settingsDialog.getByRole('button', { name: 'Open' })).toBeVisible();
    await settingsDialog.getByRole('button', { name: 'Open' }).click();
    const importDialog = page.getByRole('dialog', { name: 'Import report' });
    await expect(importDialog).toBeVisible();
    await expect(importDialog.getByText('Assignees mapped')).toBeVisible();
  });

  test('shows understandable errors for unavailable task lists and direct task links', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('LEAD');
    mockApi.setFailure('getTasks', 5);

    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    await expect(page.getByText('Could not load tasks')).toBeVisible();
    await expect(page.getByText('OpenProject is currently unavailable')).toBeVisible();

    mockApi.setFailure('getTask', 2);
    await page.goto('/space/space-alpha/folder/folder-alpha/task/wp-101');
    await expect(page.getByText('Action failed')).toBeVisible();
  });

  test('keeps the main shell usable in a narrow viewport', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');
    await page.setViewportSize({ width: 1280, height: 900 });

    await openApp(page, '/tasks');
    await expect(page.getByTestId('workspace-shell')).toBeVisible();
    await expect(page.getByTestId('sidebar')).toBeVisible();
  });
});
