import { defineConfig, devices } from '@playwright/test';

// Node's `process` global, declared here so we don't need @types/node for one config file.
declare const process: { env: Record<string, string | undefined> };

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'] } }, // WebKit (Safari's engine)
    { name: 'android', use: { ...devices['Pixel 7'] } }, // Chromium
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
