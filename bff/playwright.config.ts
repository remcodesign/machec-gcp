import { defineConfig, devices } from "@playwright/test";

// C5's real-host closing check (D115) runs this same suite against the
// deployed Cloud Run BFF by overriding PLAYWRIGHT_BASE_URL — local `next
// dev` otherwise. Never hardcode the Cloud Run host here: it's assigned at
// deploy time and has no fixed literal (see infra/variables.tf).
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
