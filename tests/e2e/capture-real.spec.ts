import { test, chromium } from '@playwright/test';

test.skip('capture tags in real app', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('http://localhost:5174/space/219/folder/221?view=tasks');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/real-tags.png', fullPage: false });
  await browser.close();
});
