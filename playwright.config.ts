// Playwright E2E — the browser half of the verification: the React
// render and the canvas gestures are only real in a real browser.
// One project (chromium, headless), one dev server, minimal suite.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:5199",
    headless: true,
    viewport: { width: 1280, height: 900 },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: [
    {
      // the wardrobe API on its real port with AUTH_DISABLED=1 (no IdP
      // in the test browser): /api/* answers without a session, and
      // /auth/me answers the dev user — an accepted readiness status,
      // and it does not depend on dist/ being built
      command: "AUTH_DISABLED=1 PORT=8791 HOST=127.0.0.1 node --experimental-strip-types server.ts",
      url: "http://127.0.0.1:8791/api/whoami",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --port 5199 --strictPort --host 127.0.0.1",
      url: "http://127.0.0.1:5199",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
