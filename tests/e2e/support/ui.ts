import type { Locator, Page } from '@playwright/test';

export async function chooseOption(page: Page, testId: string, optionLabel: string) {
  await page.getByTestId(testId).click();
  await page.getByRole('option', { name: optionLabel, exact: true }).click();
}

export async function chooseMultiOption(page: Page, testId: string, optionLabel: string) {
  await page.getByTestId(testId).click();
  await page.getByRole('option', { name: optionLabel, exact: true }).click();
}

export async function dragAndDrop(page: Page, source: Locator, target: Locator) {
  const sourceTaskId = await source.getAttribute('data-task-id');
  const dataTransfer = await page.evaluateHandle('new DataTransfer()');
  await source.dispatchEvent('dragstart', { dataTransfer });
  if (sourceTaskId) {
    await page.waitForFunction(
      ({ selector, taskId }) =>
        (
          (globalThis as any).document?.querySelector(selector) as {
            getAttribute?: (name: string) => string | null;
          } | null
        )?.getAttribute?.('data-dragging-task-id') === taskId,
      { selector: '[data-testid="task-board"]', taskId: sourceTaskId }
    );
  } else {
    await page.evaluate(
      () => new Promise((resolve) => (globalThis as any).requestAnimationFrame(() => resolve(null)))
    );
  }
  await target.dispatchEvent('dragenter', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await target.dispatchEvent('drop', { dataTransfer });
  await source.dispatchEvent('dragend', { dataTransfer });
}
