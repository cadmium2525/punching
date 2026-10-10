import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const local = '/opt/pw-browsers/chromium';
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    ...devices['Pixel 7'],
    launchOptions: existsSync(local) ? { executablePath: local } : {},
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: true,
  },
});
