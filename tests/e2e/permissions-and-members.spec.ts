import { expect, openApp, test } from './fixtures.js';
import { chooseOption } from './support/ui.js';

test.describe('roles, permissions, and workspace member management', () => {
  test('owner can manage workspace members from workspace settings', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('OWNER');

    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    await page.getByRole('button', { name: 'Open Workspace Settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Workspace settings' })).toBeVisible();
    await page.getByRole('tab', { name: 'Members' }).click();

    await page.getByTestId('workspace-invite-email').fill('friend@example.com');
    await page.getByTestId('workspace-invite-name').fill('Friend Dev');
    await chooseOption(page, 'workspace-invite-role', 'MEMBER');
    await page.getByTestId('workspace-invite-submit').click();
    await expect(page.getByText('Member invited')).toBeVisible();
    await expect(page.getByText('friend@example.com')).toBeVisible();

    const row = page
      .locator('[data-testid="workspace-member-row"]')
      .filter({ hasText: 'friend@example.com' });
    await row.locator('[data-testid^="workspace-member-role-"]').click();
    await page.getByRole('option', { name: 'LEAD', exact: true }).click();
    await expect(page.getByText('Workspace role updated.')).toBeVisible();
    await expect(page.getByText('friend@example.com is now LEAD.')).toBeVisible();

    await row.locator('[data-testid^="workspace-member-remove-"]').click();
    await page.getByRole('button', { name: 'Remove member' }).click();
    await expect(page.getByText('Workspace member removed.')).toBeVisible();
    await expect(page.getByText('friend@example.com')).toHaveCount(0);
  });

  test('viewers stay read-only in the UI and receive forbidden on direct write requests', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('VIEWER');

    await openApp(page, '/space/space-alpha/folder/folder-alpha/task/wp-101');
    const taskDetail = page.getByTestId('task-detail-page');
    await expect(taskDetail.getByRole('button', { name: 'Save' })).toHaveCount(0);
    await expect(taskDetail.getByRole('button', { name: 'Add comment' })).toHaveCount(0);
    await expect(taskDetail.getByRole('button', { name: 'Log time' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Create task in Todo' })).toHaveCount(0);

    const response = await page.evaluate(async () => {
      const result = await fetch('/api/openproject/tasks/wp-101', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Viewer should not update this' }),
      });
      return {
        status: result.status,
        body: await result.json(),
      };
    });

    expect(response.status).toBe(403);
    expect((response.body as { error?: string }).error).toBe('Forbidden');
  });
});
