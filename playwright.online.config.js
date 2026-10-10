import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const local = '/opt/pw-browsers/chromium';
export default defineConfig({
  testDir: 'tests/online',
  timeout: 120_000,
  use: {
    baseURL: 'http://127.0.0.1:4174/',
    ...devices['Pixel 7'],
    launchOptions: existsSync(local) ? { executablePath: local } : {},
  },
  webServer: {
    command: 'npx vite preview --port 4174 --strictPort --host 127.0.0.1 --outDir dist-emulator',
    url: 'http://127.0.0.1:4174/',
    reuseExistingServer: false,
  },
});
