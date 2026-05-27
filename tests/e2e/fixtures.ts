import { test as base, expect, type Page } from '@playwright/test';
import { installMockApi, type MockApiController, type MockRole } from './support/mockApi.js';

type Fixtures = {
  mockApi: MockApiController;
};

export const test = base.extend<Fixtures>({
  mockApi: async ({ page }: { page: Page }, use: (mockApi: MockApiController) => Promise<void>) => {
    const mockApi = await installMockApi(page);
    await use(mockApi);
  },
});

export { expect };

export async function openApp(page: Page, path = '/') {
  await page.goto(path);
  await Promise.race([
    page.getByTestId('workspace-shell').waitFor({ state: 'visible' }),
    page.getByTestId('login-form').waitFor({ state: 'visible' }),
    page.getByTestId('setup-screen').waitFor({ state: 'visible' }),
  ]);
  return page;
}

export async function loginAs(page: Page, role: MockRole) {
  const credentialsByRole: Record<MockRole, { email: string; password: string }> = {
    OWNER: { email: 'owner@example.com', password: 'ownerpass123' },
    ADMIN: { email: 'admin@example.com', password: 'adminpass123' },
    LEAD: { email: 'lead@example.com', password: 'leadpass123' },
    MEMBER: { email: 'member@example.com', password: 'memberpass123' },
    VIEWER: { email: 'viewer@example.com', password: 'viewerpass123' },
  };
  const credentials = credentialsByRole[role];

  await page.goto('/');
  await expect(page.getByTestId('login-form')).toBeVisible();
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByTestId('workspace-shell')).toBeVisible();
}
