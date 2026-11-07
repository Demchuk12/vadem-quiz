import { defineConfig, devices } from '@playwright/test';

/** Needs the local Supabase stack: `npm run db:start`. */
export default defineConfig({
  testDir: './e2e',
  // Each test plays its own game, but they share one database and one dev server.
  workers: 2,
  timeout: 120_000,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4210',
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
    // Stable measurements: axe would otherwise read contrast mid-fade. Also proves the app is
    // complete without motion.
    contextOptions: { reducedMotion: 'reduce' },
  },
  webServer: {
    command: 'npx ng serve --port 4210',
    url: 'http://localhost:4210',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
