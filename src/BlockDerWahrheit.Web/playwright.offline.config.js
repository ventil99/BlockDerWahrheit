import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5179/';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'offline-pwa.spec.js',
  fullyParallel: false,
  reporter: 'list',
  timeout: 120_000,
  use: {
    baseURL,
    browserName: 'chromium',
  },
  webServer: {
    command: 'node tests/browser/published-server.js',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
