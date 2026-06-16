import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx serve -s dist/ecommerce-vertex/browser -l 4200',
    url: 'http://localhost:4200',
    cwd: '..',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
