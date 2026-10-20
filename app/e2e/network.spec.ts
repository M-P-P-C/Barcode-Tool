// The app requests nothing from other websites (AGENTS.md rule 4).
import { expect } from '@playwright/test';
import { openCameraPage, scanNext, show, test } from './helpers';
import { fixture } from './spec';

test('[REQ-PRV-001] every request goes to our own site, engines included', async ({
  page,
  context,
  baseURL,
}) => {
  const ours = new URL(baseURL ?? '').origin;
  const elsewhere: string[] = [];
  const seen: string[] = [];
  context.on('request', (request) => {
    const url = new URL(request.url());
    seen.push(url.pathname);
    // data: and blob: addresses stay inside the browser.
    if (url.protocol !== 'data:' && url.protocol !== 'blob:' && url.origin !== ours) {
      elsewhere.push(request.url());
    }
  });

  // Use every part of the app that loads something: both engines, history, About.
  await openCameraPage(page);
  await show(page, fixture('dm-gtin-expiry-batch'));
  await expect(scanNext(page)).toBeVisible({ timeout: 15_000 });
  await page.goto('#/history');
  await expect(page.getByText('Saved scans (1)')).toBeVisible();
  await page.goto('#/about');
  await expect(page.getByText('gs1encoder', { exact: false }).first()).toBeVisible();
  await page.goto('#/check');
  await expect(page.getByText('GS1 Syntax Engine', { exact: false }).first()).toBeVisible();

  // Both engines' WebAssembly files were really loaded, from our own site.
  expect(seen.some((path) => /zxing_reader.*\.wasm$/.test(path))).toBe(true);
  expect(seen.some((path) => /gs1encoder.*\.wasm$/.test(path))).toBe(true);
  expect(elsewhere).toEqual([]);
});

test('[REQ-PRV-003] the page carries a strict Content Security Policy', async ({ page }) => {
  await page.goto('/');
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("connect-src 'self'");
  // No other website is allowed anywhere in the policy.
  expect(policy).not.toMatch(/https?:|\*/);
});
