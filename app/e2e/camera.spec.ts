// The live camera scanner, tested with a fake camera that shows the fixture images.
import { expect } from '@playwright/test';
import {
  expectRead,
  expectResult,
  openCameraPage,
  pointing,
  scanNext,
  show,
  test,
} from './helpers';
import { installFakeCamera } from './fakeCamera';
import { cleanFixtures, fixture } from './spec';

test('[REQ-CAM-001] [REQ-SCN-002] [REQ-DAT-002] reads every clean test code through the live camera', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await openCameraPage(page);
  await expect(pointing(page)).toBeVisible();
  for (const item of cleanFixtures) {
    await test.step(item.vectorId, async () => {
      await show(page, item);
      if (await scanNext(page).isVisible()) await scanNext(page).click();
      await expectRead(page, item);
    });
  }
  // The frozen picture is shown, with the code outlined.
  await expect(page.getByAltText('The camera picture that was read')).toBeVisible();
  await expect(page.locator('svg polygon')).toHaveCount(1);
});

test('[REQ-DAT-001] [REQ-DAT-002] keeps the GS separator from camera to result', async ({
  page,
}) => {
  await openCameraPage(page);
  const item = fixture('dm-separator-after-batch');
  await show(page, item);
  await expect(scanNext(page)).toBeVisible({ timeout: 15_000 });
  // The raw data shows the separator as a labelled box...
  await expect(page.getByText('GS', { exact: true })).toBeVisible();
  // ...and the bytes include 1D.
  await page.getByRole('button', { name: 'Show hex' }).click();
  await expect(page.getByText(item.hex, { exact: true })).toBeVisible();
  expect(item.hex).toContain('1D');
});

test('[REQ-CAM-002] ignores the same code for 2 seconds after Scan next', async ({ page }) => {
  await openCameraPage(page);
  const item = fixture('dm-gtin-expiry-batch');
  await show(page, item);
  await expect(scanNext(page)).toBeVisible({ timeout: 15_000 });

  // The camera still points at the same code: it must not read it again.
  await scanNext(page).click();
  await expect(pointing(page)).toBeVisible();
  await page.waitForTimeout(3000);
  await expect(scanNext(page)).toBeHidden();

  // Out of view for more than 2 seconds, then back: it reads again.
  await page.evaluate(() => window.fakeCamera.clear());
  await page.waitForTimeout(2500);
  await show(page, item);
  await expectRead(page, item);
});

test('[REQ-CAM-002] a different code is read straight after Scan next', async ({ page }) => {
  await openCameraPage(page);
  await show(page, fixture('dm-gtin-expiry-batch'));
  await expect(scanNext(page)).toBeVisible({ timeout: 15_000 });
  const next = fixture('qr-digital-link');
  await show(page, next);
  await scanNext(page).click();
  await expectRead(page, next);
});

test('[REQ-CAM-003] shows no camera controls when the browser offers none (like an iPhone)', async ({
  page,
}) => {
  await openCameraPage(page);
  await expect(pointing(page)).toBeVisible();
  await expect(page.getByText('This browser offers no zoom, light or focus control')).toBeVisible();
  await expect(page.getByLabel('Zoom')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Light/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Switch camera' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Sound/ })).toBeVisible();
});

test('[REQ-CAM-003] zoom, light, focus and camera switching, where the camera offers them', async ({
  page,
}) => {
  await openCameraPage(page, {
    cameras: 2,
    capabilities: {
      zoom: { min: 1, max: 5, step: 0.1 },
      torch: true,
      focusMode: ['continuous', 'manual'],
      focusDistance: { min: 0, max: 1, step: 0.01 },
    },
  });
  await expect(pointing(page)).toBeVisible();
  const settings = () => page.evaluate(() => window.fakeCamera.settings());

  // Continuous autofocus is switched on when the camera opens.
  await expect.poll(settings).toMatchObject({ focusMode: 'continuous' });

  await page.getByLabel('Zoom').fill('2.5');
  await expect.poll(settings).toMatchObject({ zoom: 2.5 });
  await expect(page.getByText('2.5×')).toBeVisible();

  await page.getByRole('button', { name: 'Light: off' }).click();
  await expect.poll(settings).toMatchObject({ torch: true });
  await expect(page.getByRole('button', { name: 'Light: on' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Zooming again keeps the light on (every change sends all settings again).
  await page.getByLabel('Zoom').fill('3');
  await expect.poll(settings).toMatchObject({ zoom: 3, torch: true });
  const last = await page.evaluate(() => window.fakeCamera.applied.at(-1));
  expect(last).toMatchObject({ width: { ideal: 1920 }, height: { ideal: 1080 } });

  await page.getByLabel('Focus distance').fill('0.2');
  await expect.poll(settings).toMatchObject({ focusMode: 'manual', focusDistance: 0.2 });
  await expect(page.getByRole('button', { name: 'Auto focus: off' })).toBeVisible();
  await page.getByRole('button', { name: 'Auto focus: off' }).click();
  await expect.poll(settings).toMatchObject({ focusMode: 'continuous' });

  await expect(page.getByText('Camera 1 of 2: Fake camera 1')).toBeVisible();
  await page.getByRole('button', { name: 'Switch camera' }).click();
  await expect(page.getByText('Camera 2 of 2: Fake camera 2')).toBeVisible();
  const opened = await page.evaluate(() => window.fakeCamera.opened);
  expect(opened.at(-1)).toMatchObject({ video: { deviceId: { exact: 'fake-1' } } });

  // The switched camera still reads codes.
  const item = fixture('ean13');
  await show(page, item);
  await expectRead(page, item);
});

test('[REQ-CAM-003] shows controls a camera reports late, as some Android phones do', async ({
  page,
}) => {
  await openCameraPage(page, {
    lateControls: true,
    capabilities: { zoom: { min: 1, max: 5, step: 0.1 }, focusMode: ['continuous'] },
  });
  await expect(page.getByLabel('Zoom')).toBeVisible({ timeout: 5000 });
  await expect
    .poll(() => page.evaluate(() => window.fakeCamera.settings()))
    .toMatchObject({ focusMode: 'continuous' });
});

test('[REQ-CAM-004] explains a blocked camera, then works after Try again', async ({ page }) => {
  await openCameraPage(page, { failWith: 'NotAllowedError', failTimes: 1 });
  await expect(page.getByRole('heading', { name: 'Camera access is blocked' })).toBeVisible();
  // Instructions for Chrome on Android, the browser this test pretends to be.
  await expect(page.getByText(/Android Settings → Apps → Chrome/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Scan from a photo instead' })).toBeVisible();

  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(pointing(page)).toBeVisible();
});

test('[REQ-CAM-004] explains a phone without a camera', async ({ page }) => {
  await openCameraPage(page, { failWith: 'NotFoundError' });
  await expect(page.getByRole('heading', { name: 'No camera found' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Scan from a photo instead' })).toBeVisible();
});

test('[REQ-CAM-004] explains a camera used by another app', async ({ page }) => {
  await openCameraPage(page, { failWith: 'NotReadableError' });
  await expect(page.getByRole('heading', { name: 'The camera is in use' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('[REQ-CAM-004] explains a camera that stops by itself, then works after Try again', async ({
  page,
}) => {
  await openCameraPage(page);
  await expect(pointing(page)).toBeVisible();
  await page.evaluate(() => window.fakeCamera.takenByOtherApp());
  await expect(page.getByRole('heading', { name: 'The camera is in use' })).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(pointing(page)).toBeVisible();
});

test('[REQ-CAM-004] explains a camera that opens but shows no picture', async ({ page }) => {
  await openCameraPage(page, { noPicture: true });
  await expect(page.getByRole('heading', { name: 'The camera could not start' })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText('sent no picture')).toBeVisible();
  expect(await page.evaluate(() => window.fakeCamera.isOn())).toBe(false);
});

test('[REQ-CAM-001] reads every code in one camera picture, each with its own result', async ({
  page,
}) => {
  await openCameraPage(page);
  const left = fixture('dm-gtin-expiry-batch');
  const right = fixture('qr-digital-link');
  await page.evaluate(([a, b]) => window.fakeCamera.show(a, b), [left.imageUrl, right.imageUrl]);
  await expect(scanNext(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Barcode 1 of 2' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Barcode 2 of 2' })).toBeVisible();
  await expect(page.locator('svg polygon')).toHaveCount(2);
  for (const item of [left, right]) {
    await expect(page.getByText(`(${item.symbologyId})`)).toBeVisible();
  }
});

test('[REQ-CAM-005] turns the camera off when leaving the page', async ({ page }) => {
  await openCameraPage(page);
  await expect(pointing(page)).toBeVisible();
  expect(await page.evaluate(() => window.fakeCamera.isOn())).toBe(true);
  await page.getByRole('link', { name: 'Back to start' }).click();
  await expect(page.getByRole('link', { name: 'Scan with camera' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.fakeCamera.isOn())).toBe(false);
});

test("works with Chromium's own fake camera device", async ({ page }) => {
  // No fake camera installed here: the real getUserMedia, with Chromium's test device.
  await page.goto('#/camera');
  await expect(pointing(page)).toBeVisible();
  await expect
    .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth))
    .toBeGreaterThan(0);
});

test('[REQ-SCN-001] photo mode reads every code in a chosen image', async ({ page }) => {
  await page.goto('#/scan');
  const item = fixture('dm-gtin-expiry-batch');
  await page.locator('input[type=file]:not([capture])').setInputFiles(item.path);
  await expectResult(page, item);

  // An image file with two codes side by side, made in the page and chosen like a photo.
  const left = fixture('dm-gtin-expiry-batch');
  const right = fixture('ean13');
  await page.evaluate(
    async ([a, b]) => {
      const load = (url: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = url;
        });
      const [first, second] = await Promise.all([load(a), load(b)]);
      const canvas = document.createElement('canvas');
      canvas.width = first.width + second.width + 60;
      canvas.height = Math.max(first.height, second.height) + 40;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no canvas');
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(first, 20, 20);
      context.drawImage(second, first.width + 40, 20);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('no image');
      const input = document.querySelector<HTMLInputElement>('input[type=file]:not([capture])');
      if (!input) throw new Error('no file input');
      const files = new DataTransfer();
      files.items.add(new File([blob], 'two-codes.png', { type: 'image/png' }));
      input.files = files.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    [left.imageUrl, right.imageUrl],
  );
  await expect(page.getByRole('heading', { name: 'Barcode 2 of 2' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('heading', { name: 'Barcode 1 of 2' })).toBeVisible();
  await expect(page.locator('svg polygon')).toHaveCount(2);
  for (const item of [left, right]) {
    await expect(page.getByText(`(${item.symbologyId})`)).toBeVisible();
  }
});

test('the start page links to the camera', async ({ page }) => {
  await installFakeCamera(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Scan with camera' }).click();
  await expect(pointing(page)).toBeVisible();
});
