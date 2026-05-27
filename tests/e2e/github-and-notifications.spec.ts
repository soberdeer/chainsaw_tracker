import { expect, openApp, test } from './fixtures.js';

test.describe('GitHub workPackage flow and notifications', () => {
  test('links and unlinks a pull request for an OpenProject-backed task', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('LEAD');

    await openApp(page, '/space/space-alpha/folder/folder-alpha/task/wp-101');
    await expect(page.getByTestId('github-tab')).toBeVisible();
    await page.getByTestId('github-tab').click();
    await page.getByTestId('github-manual-pr-input').fill('42');
    await expect(page.getByTestId('github-link-pr-submit')).toBeEnabled();
    await page.getByTestId('github-link-pr-submit').click();
    await expect(page.getByText('#42')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('[data-testid="task-row"][data-task-id="wp-101"]')).toContainText(
      'PR'
    );

    await page.goto('/space/space-alpha/folder/folder-alpha/task/wp-101');
    await expect(page.getByTestId('task-detail-page')).toBeVisible();
    await page.getByTestId('github-tab').click();

    await page.getByRole('button', { name: 'Unlink' }).click();
    await expect(page.getByText('#42')).toHaveCount(0);
  });

  test('GitHub webhook events create notification-only updates for OpenProject-backed tasks', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('LEAD');

    await openApp(page, '/space/space-alpha/folder/folder-alpha/task/wp-101');
    await page.evaluate(async () => {
      await fetch('/api/integrations/github/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-event': 'pull_request',
        },
        body: JSON.stringify({
          action: 'ready_for_review',
          pull_request: {
            number: 57,
            title: 'WP-101 gameplay cleanup',
            body: 'Links back to WP-101',
            head: {
              ref: 'feature/wp-101-gameplay-cleanup',
            },
          },
        }),
      });
    });

    await page.goto('/space/space-alpha/folder/folder-alpha');
    await page.getByTestId('notification-center').click();
    await expect(
      page
        .getByRole('menuitem')
        .filter({ hasText: 'GitHub PR ready for review for Hero controller' })
    ).toBeVisible();

    await page.goto('/space/space-alpha/folder/folder-alpha/task/wp-101');
    await page.getByRole('tab', { name: 'Activity' }).click();
    await expect(page.getByText('GitHub PR ready for review for Hero controller')).toHaveCount(0);
  });

  test('notification center supports read state and hides other users events', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('MEMBER');

    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    await page.getByTestId('notification-center').click();
    const assignedNotification = page
      .getByRole('menuitem')
      .filter({ hasText: 'Assigned to Fix jump bug' });
    await expect(assignedNotification).toBeVisible();
    await assignedNotification.click();
    await page.goto('/space/space-alpha/folder/folder-alpha');
    await page.getByTestId('notification-center').click();
    await page.getByRole('menuitem', { name: 'Mark all as read' }).click();

    mockApi.setCurrentUser('VIEWER');
    await page.goto('/space/space-alpha/folder/folder-alpha');
    await page.getByTestId('notification-center').click();
    await expect(
      page.getByRole('menuitem').filter({ hasText: 'Assigned to Fix jump bug' })
    ).toHaveCount(0);
  });
});
