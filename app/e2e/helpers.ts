// Shared parts of the browser tests.
import { expect, test as base, type Page } from '@playwright/test';
import { installFakeCamera, type FakeCameraOptions } from './fakeCamera';
import type { CleanFixture } from './spec';

// Every test fails if the page logs an error, e.g. a Content Security Policy violation.
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

export async function openCameraPage(page: Page, options: FakeCameraOptions = {}) {
  await installFakeCamera(page, options);
  await page.goto('#/camera');
}

export const show = (page: Page, item: CleanFixture) =>
  page.evaluate((url) => window.fakeCamera.show(url), item.imageUrl);

export const pointing = (page: Page) => page.getByText('Point the camera at a barcode');
export const scanNext = (page: Page) => page.getByRole('button', { name: 'Scan next' });

/** Waits for a camera read and checks it shows exactly the fixture's identifier and bytes. */
export async function expectRead(page: Page, item: CleanFixture) {
  await expect(scanNext(page)).toBeVisible({ timeout: 15_000 });
  await expectResult(page, item);
}

export async function expectResult(page: Page, item: CleanFixture) {
  await expect(page.getByText(`(${item.symbologyId})`)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Show hex' }).click();
  await expect(page.getByText(item.hex, { exact: true })).toBeVisible();
}
