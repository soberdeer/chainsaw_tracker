import { expect, openApp, test } from './fixtures.js';
import { chooseOption } from './support/ui.js';

test.describe('comments, files, subtasks, relations, and time', () => {
  test('members can comment and viewers do not see the comment form', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');

    await openApp(page, '/space/space-alpha/folder/folder-alpha/task/wp-101');
    await expect(page.getByTestId('task-detail-page')).toBeVisible();
    await page.getByRole('tab', { name: 'Activity' }).click();
    await page.getByTestId('task-comment-input').fill('Leaving a real OpenProject-backed comment.');
    await page.getByTestId('task-comment-submit').click();
    await expect(page.getByText('Comment posted')).toBeVisible();
    await expect(page.getByText('Leaving a real OpenProject-backed comment.')).toBeVisible();

    await page.reload();
    await page.getByRole('tab', { name: 'Activity' }).click();
    await expect(page.getByText('Leaving a real OpenProject-backed comment.')).toBeVisible();

    mockApi.setCurrentUser('VIEWER');
    await openApp(page, '/space/space-alpha/folder/folder-alpha/task/wp-101');
    await expect(page.getByTestId('task-detail-page')).toBeVisible();
    await page.getByRole('tab', { name: 'Activity' }).click();
    await expect(page.getByTestId('task-comment-form')).toHaveCount(0);
  });

  test('uploads attachments through the files tab and surfaces upload errors', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('MEMBER');

    await openApp(page, '/space/space-alpha/folder/folder-alpha/task/wp-101');
    await expect(page.getByTestId('task-detail-page')).toBeVisible();
    await page.getByRole('tab', { name: 'Files' }).click();

    await page
      .getByTestId('task-attachments-form')
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('attachment body'),
      });
    await page.getByTestId('task-attachment-submit').click();
    await expect(page.getByText('uploaded-file.txt')).toBeVisible();

    mockApi.setFailure('attachmentUpload');
    await page
      .getByTestId('task-attachments-form')
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'broken.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('broken'),
      });
    await page.getByTestId('task-attachment-submit').click();
    await expect(page.getByText('Could not complete action').first()).toBeVisible();
  });

  test('creates subtasks and relations from the drawer', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('LEAD');

    await openApp(page, '/space/space-alpha/folder/folder-alpha/task/wp-101');
    await expect(page.getByTestId('task-detail-page')).toBeVisible();
    await page.getByRole('tab', { name: 'Subtasks' }).click();
    await page.getByRole('button', { name: 'Add subtask' }).click();
    await page.getByLabel('Name').fill('Subtask from e2e');
    await page.getByRole('button', { name: 'Create subtask' }).click();
    await expect(
      page.getByTestId('subtask-row').filter({ hasText: 'Subtask from e2e' })
    ).toBeVisible();

    await page.getByTestId('task-relation-open-modal').click();
    await page.getByTestId('task-relation-target-input').fill('wp-102');
    await chooseOption(page, 'task-relation-type-select', 'Блокирует');
    await page.getByTestId('task-relation-submit').click();
    await expect(page.getByTestId('relation-row')).toContainText('Fix jump bug');
  });

  test('logs time with a selected activity and validates when multiple activities exist', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('MEMBER');
    mockApi.setTimeActivities([
      { id: 'activity-dev', name: 'Development' },
      { id: 'activity-qa', name: 'QA' },
    ]);

    await openApp(page, '/space/space-alpha/folder/folder-alpha/task/wp-101');
    await page.getByRole('tab', { name: 'Time' }).click();
    await page.getByTestId('task-time-hours-input').fill('2');
    await page.getByTestId('task-time-date-input').fill('2026-05-22');
    await page.getByTestId('task-time-comment-input').fill('Focus pass');
    await page.getByTestId('task-time-submit').click();
    await expect(page.getByText('Activity is required')).toBeVisible();

    await chooseOption(page, 'task-time-activity-select', 'QA');
    await page.getByTestId('task-time-submit').click();
    await expect(page.getByText('Time logged')).toBeVisible();
    await expect(page.getByText('Focus pass')).toBeVisible();

    mockApi.setCurrentUser('VIEWER');
    await page.goto('/space/space-alpha/folder/folder-alpha/task/wp-101');
    await page.getByRole('tab', { name: 'Time' }).click();
    await expect(page.getByTestId('task-time-form')).toHaveCount(0);
  });
});
