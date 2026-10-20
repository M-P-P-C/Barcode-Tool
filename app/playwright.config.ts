// End-to-end tests: the built app (with its Content Security Policy) in a real browser at
// phone size. The camera is faked (see e2e/fakeCamera.ts), so the live scanner can be
// tested without a phone. Run with: npm run e2e
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // The JSON results feed the traceability matrix (npm run trace).
  reporter: [
    ['list'],
    ['json', { outputFile: 'reports/e2e-tests.json' }],
    ...(process.env.CI ? [['html', { open: 'never' }] as const] : []),
  ],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    // The offline cache would only get in the way of testing the newest build.
    serviceWorkers: 'block',
    permissions: ['camera'],
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'android-chrome',
      use: {
        ...devices['Pixel 7'],
        launchOptions: {
          // Chromium's own fake camera, used by the test that needs a real camera stream.
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
          // Use an already installed Chromium when set (the cloud dev container has one).
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
        },
      },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
