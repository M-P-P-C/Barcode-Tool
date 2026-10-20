// Scan history, backup files, and copying or sharing results.
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { expectRead, openCameraPage, scanNext, show, test } from './helpers';
import { fixture, type CleanFixture } from './spec';

test.use({ permissions: ['camera', 'clipboard-read', 'clipboard-write'] });

/** Reads one fixture code with the fake camera, so it is saved to the history. */
async function readWithCamera(page: Page, item: CleanFixture) {
  await show(page, item);
  if (await scanNext(page).isVisible()) await scanNext(page).click();
  await expectRead(page, item);
  await expect(page.getByText('Saved in')).toBeVisible();
}

const row = (page: Page, text: string) =>
  page.getByRole('link', { name: new RegExp(escape(text)) });

test('[REQ-HIS-001] [REQ-HIS-002] a camera read is saved, survives closing the app, and can be deleted', async ({
  page,
  context,
}) => {
  const item = fixture('dm-gtin-expiry-batch');
  await openCameraPage(page);
  await readWithCamera(page, item);

  // Close the app and open it again.
  await page.close();
  const again = await context.newPage();
  await again.goto('#/history');
  await expect(again.getByRole('heading', { name: 'Saved scans (1)' })).toBeVisible();
  await expect(row(again, item.bracketed ?? '')).toBeVisible();

  // Open it: the full result, with the exact bytes.
  await row(again, item.bracketed ?? '').click();
  await expect(again.getByText('Read with the camera on')).toBeVisible();
  await again.getByRole('button', { name: 'Show hex' }).click();
  await expect(again.getByText(item.hex, { exact: true })).toBeVisible();

  await again.getByRole('button', { name: 'Delete this scan' }).click();
  await expect(again.getByText('No scans yet')).toBeVisible();
});

test('[REQ-HIS-001] [REQ-SCN-001] photo reads are saved too', async ({ page }) => {
  const item = fixture('ean13');
  await page.goto('#/scan');
  await page.locator('input[type=file]:not([capture])').setInputFiles(item.path);
  await expect(page.getByText('Saved in')).toBeVisible();
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByText('Saved scans (1)')).toBeVisible();
  await page.getByRole('link', { name: /EAN-13/ }).click();
  await expect(page.getByText('Read from a photo on')).toBeVisible();
});

test('[REQ-HIS-004] [REQ-DAT-001] a backup file keeps every byte and can be loaded again', async ({
  page,
}) => {
  const first = fixture('dm-separator-after-batch');
  const second = fixture('qr-digital-link');
  await openCameraPage(page);
  await readWithCamera(page, first);
  await readWithCamera(page, second);
  await page.goto('#/history');
  await expect(page.getByText('Saved scans (2)')).toBeVisible();

  // Save the backup file.
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save backup file' }).click();
  const download = await downloading;
  const file = await download.path();
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  expect(backup.format).toBe('barcode-inspector-history');
  expect(backup.scans.map((s: { hex: string }) => s.hex)).toEqual([first.hex, second.hex]);

  // Delete everything (two taps), then load the file.
  await page.getByRole('button', { name: 'Delete all scans…' }).click();
  await page.getByRole('button', { name: 'Delete all 2 scans now' }).click();
  await expect(page.getByText('No scans yet')).toBeVisible();

  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByText('Added 2 scans.')).toBeVisible();
  await expect(page.getByText('Saved scans (2)')).toBeVisible();

  // Loading it twice adds nothing.
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByText('Added 0 scans; 2 were already in the history.')).toBeVisible();
});

test('[REQ-HIS-005] a file that is not a backup is refused with a clear message', async ({
  page,
}) => {
  await page.goto('#/history');
  await page.locator('input[type=file]').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello": "world"}'),
  });
  await expect(
    page.getByText('This file is not a Barcode Inspector history backup.'),
  ).toBeVisible();

  // A file far larger than any backup is refused before it is read.
  await page.locator('input[type=file]').setInputFiles({
    name: 'huge.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(5_000_001, 32),
  });
  await expect(page.getByText('This file is too large to be a history backup.')).toBeVisible();
});

test('[REQ-DAT-005] [REQ-DAT-001] copies a result as AI syntax, raw data with {GS}, and JSON', async ({
  page,
}) => {
  const item = fixture('dm-separator-after-batch');
  await openCameraPage(page);
  await readWithCamera(page, item);
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());

  await page.getByRole('button', { name: 'Copy AI syntax' }).click();
  expect(await clipboard()).toBe(item.bracketed);

  await page.getByRole('button', { name: 'Copy raw data with {GS}' }).click();
  expect(await clipboard()).toBe(item.message);

  await page.getByRole('button', { name: 'Copy JSON' }).click();
  const json = JSON.parse(await clipboard());
  expect(json).toMatchObject({
    symbologyId: item.symbologyId,
    message: item.message,
    hex: item.hex,
    bracketed: item.bracketed,
    valid: true,
  });
  expect(json.gs1Engine).toBeTruthy();
});

test('[REQ-DAT-005] shares a result through the phone share sheet, where there is one', async ({
  page,
}) => {
  // Headless Chromium has no share sheet: pretend to have one and record what is shared.
  await page.addInitScript(() => {
    const shared: unknown[] = [];
    Object.assign(window, { shared });
    navigator.share = async (data) => {
      shared.push(data);
    };
  });
  const item = fixture('qr-digital-link');
  await openCameraPage(page);
  await readWithCamera(page, item);
  await page.getByRole('button', { name: 'Share GS1 Digital Link' }).click();
  const shared = await page.evaluate(() => (window as unknown as { shared: unknown[] }).shared);
  expect(shared).toEqual([{ text: item.message }]);
});

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
