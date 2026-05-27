import { expect, openApp, test } from './fixtures.js';

test.describe('auth and first-run setup', () => {
  test('creates the first owner through setup and does not allow setup again', async ({
    page,
    mockApi,
  }) => {
    mockApi.setSetupRequired(true);

    await openApp(page);
    await expect(page.getByTestId('setup-screen')).toBeVisible();
    await expect(page.getByTestId('login-form')).toHaveCount(0);

    await page.getByLabel('Workspace name').fill('Bootstrap E2E');
    await page.getByLabel('Your name').fill('First Owner');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('OwnerPass!123');
    await page.getByRole('textbox', { name: 'Confirm password' }).fill('OwnerPass!123');
    await page.getByRole('button', { name: 'Create owner account' }).click();

    await expect(page.getByTestId('workspace-shell')).toBeVisible();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByTestId('login-form')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByTestId('setup-screen')).toHaveCount(0);
  });

  test('shows an error for invalid login credentials', async ({ page, mockApi }) => {
    mockApi.setCurrentUser(null);

    await openApp(page);
    await expect(page.getByTestId('login-form')).toBeVisible();
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Could not sign in')).toBeVisible();
    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });
});
