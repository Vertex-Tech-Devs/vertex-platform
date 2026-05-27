import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const platformUrl = process.env['PLATFORM_BASE_URL'] ?? 'http://127.0.0.1:4200';
const storefrontUrl = process.env['STOREFRONT_BASE_URL'] ?? 'http://127.0.0.1:4201';
const platformRoot = path.resolve(__dirname, '..');
const storefrontRoot = path.resolve(__dirname, '../../ecommerce-vertex');

export default defineConfig({
  testDir: './specs',
  timeout: 90_000,
  retries: process.env['CI'] ? 1 : 0,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1366, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: [
    {
      command: 'npm run start -- --host 127.0.0.1 --port 4200',
      cwd: platformRoot,
      url: platformUrl,
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
    {
      command: 'npm run start -- --host 127.0.0.1 --port 4201',
      cwd: storefrontRoot,
      url: storefrontUrl,
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
});
