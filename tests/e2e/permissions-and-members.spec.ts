import { expect, openApp, test } from './fixtures.js';
import { chooseOption } from './support/ui.js';

test.describe('roles, permissions, and workspace member management', () => {
  test('admin can manage workspace members from workspace settings', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('ADMIN');

    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    await page.getByRole('button', { name: 'Workspace settings' }).click();
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
    // READER is not offered — backend maps it to MEMBER; only ADMIN and MEMBER are valid.
    await page.getByRole('option', { name: 'ADMIN', exact: true }).click();
    await expect(page.getByText('Role updated')).toBeVisible();

    // Member removal is managed directly in OpenProject; the remove button is not rendered.
    await expect(row.locator('[data-testid^="workspace-member-remove-"]')).toHaveCount(0);
  });

  test('readers stay read-only in the UI and receive forbidden on direct write requests', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('READER');

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
