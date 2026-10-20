// The About page: version, privacy, install steps and the licenses the build collects.
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { test } from './helpers';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('[REQ-INF-001] [REQ-INF-002] [REQ-INF-003] the About page shows the version, privacy, install steps and licenses', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'About, privacy and licenses' }).click();

  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
  await expect(page.locator('dd', { hasText: version })).toBeVisible();
  await expect(page.getByText('Nothing you scan leaves your device, unless')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Android' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'iPhone and iPad' })).toBeVisible();
  // A preview (0.x) makes no promise of fixed copies; 1.0.0 and later do.
  if (version.startsWith('0.')) {
    await expect(page.getByText('This is a preview')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fixed versions' })).toHaveCount(0);
  } else {
    await expect(page.getByText('/v/1.0.0/')).toBeVisible();
  }

  // The list the build wrote, with the engines and the libraries in the app.
  const software = page.locator('section', {
    has: page.getByRole('heading', { name: 'Open-source software' }),
  });
  for (const name of [
    'gs1encoder',
    'zxing-wasm',
    'zxing-cpp',
    'react',
    'idb',
    'workbox-core',
    'workbox-strategies',
    'tailwindcss',
    'musl libc',
  ]) {
    await expect(software.getByText(new RegExp(`^${name} `))).toBeVisible();
  }

  // The full texts are a file on our own site.
  const href = await page.getByRole('link', { name: 'Full license texts' }).getAttribute('href');
  const response = await page.request.get(href ?? '');
  expect(response.ok()).toBe(true);
  const text = await response.text();
  expect(text).toContain('Apache License');
  expect(text).toContain('zxing-wasm');
  expect(text).toContain('Rich Felker'); // musl's copyright line, not just a link
});
