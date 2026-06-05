import { expect, openApp, test } from './fixtures.js';

test.describe('docs, workspace settings, imports, and error states', () => {
  test('workspace settings show connection status and import reports for owners', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('OWNER');

    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    await page.getByRole('button', { name: 'Workspace settings' }).click();
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
