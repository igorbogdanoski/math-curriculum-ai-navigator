import { defineConfig, devices } from '@playwright/test';

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: '.env.local' });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Global timeout per action (click, fill, expect...)
    actionTimeout: 10_000,
    // Capture screenshot only on failure
    screenshot: 'only-on-failure',
  },

  // Default timeout per test
  timeout: 30_000,
  expect: { timeout: 8_000 },

  projects: [
    // Default: Chromium only (fast feedback loop)
    // Run cross-browser with: npm run test:e2e -- --project=firefox
    // Run cross-browser with: npm run test:e2e -- --project=webkit
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
