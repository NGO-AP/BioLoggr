import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,   // sequentieel: voorkomt race conditions met de lokale dev-server
  retries: 1,             // 1 retry bij flaky timing
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    headless: true,
    // Genereuze timeouts: Angular + Leaflet hebben initialisatietijd nodig
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
