import { expect, openApp, test } from './fixtures.js';

test.describe('task scopes and navigation', () => {
  test('All Tasks is cross-project and My Tasks is user-specific', async ({ page, mockApi }) => {
    mockApi.setCurrentUser('MEMBER');

    await openApp(page, '/tasks');
    await expect(page.getByTestId('workspace-shell')).toBeVisible();
    await expect(page.getByTestId('breadcrumbs')).toContainText('All Tasks');
    await expect(page.getByTestId('task-list')).toContainText('Hero controller');
    await expect(page.getByTestId('task-list')).toContainText('Audio balancing');

    await page.goto('/my-tasks');
    await expect(page.getByTestId('breadcrumbs')).toContainText('My Tasks');
    await expect(page.getByTestId('task-list')).toContainText('Fix jump bug');
    await expect(page.getByTestId('task-list')).toContainText('Audio balancing');
    await expect(page.getByTestId('task-list')).not.toContainText('Hero controller');
  });

  test('project scope stays inside the selected OpenProject project and shows breadcrumbs', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('LEAD');

    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    await expect(page.getByTestId('breadcrumbs')).toContainText('Bootstrap Tracker');
    await expect(page.getByTestId('breadcrumbs')).toContainText('Project Alpha');
    await expect(page.getByTestId('breadcrumbs')).toContainText('Gameplay');
    await expect(page.getByTestId('task-list')).toContainText('Hero controller');
    await expect(page.getByTestId('task-list')).not.toContainText('Audio balancing');
  });

  test('project scope shows an honest empty state when there are no tasks', async ({
    page,
    mockApi,
  }) => {
    mockApi.setCurrentUser('OWNER');
    mockApi.state.tasks = mockApi.state.tasks.filter((task) => task.taskListId !== 'list-alpha');

    await openApp(page, '/space/space-alpha/folder/folder-alpha');
    await expect(page.getByText('No tasks in this list yet')).toBeVisible();
    await expect(
      page.getByText('This OpenProject list does not contain any work packages yet.')
    ).toBeVisible();
  });
});
