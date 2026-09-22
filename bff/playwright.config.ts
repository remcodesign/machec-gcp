import { defineConfig, devices } from "@playwright/test";

// C5's real-host closing check (D115) runs this same suite against the
// deployed Cloud Run BFF by overriding PLAYWRIGHT_BASE_URL — local `next
// dev` otherwise. Never hardcode the Cloud Run host here: it's assigned at
// deploy time and has no fixed literal (see infra/variables.tf).
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // `fullyParallel: false` only serializes tests *within* one spec file —
  // Playwright still schedules different files onto separate workers in
  // parallel by default (up to half the CPU cores). This suite's spec
  // files aren't isolated from each other: several mutate shared,
  // unfixtured state directly (PIM Core's Postgres categories/products,
  // the Firestore cache-aside docs), on the assumption that the whole run
  // is effectively serial. Pinning to one worker actually enforces that,
  // instead of relying on however many cores happen to be free locally.
  workers: 1,
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
