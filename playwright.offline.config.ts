import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/offline',
  outputDir: './offline-test-results',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:5180', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium-offline', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node tests/offline/server.mjs',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: false,
  },
});
