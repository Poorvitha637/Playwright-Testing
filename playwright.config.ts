/**
 * Playwright configuration for the WebSite Automation framework.
 * BASE_URL is loaded from the .env file via environment.ts.
 */

import { defineConfig, devices } from '@playwright/test';
import { baseUrl } from './src/config/environment';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 35 * 60 * 1000,

  use: {
    baseURL: baseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
