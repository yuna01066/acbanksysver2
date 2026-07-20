import { defineConfig } from "@playwright/test";

/**
 * Playwright config for E2E tests against the live Supabase Edge Functions.
 *
 * On failure the runner keeps a Playwright trace, any captured screenshots,
 * and attaches the per-test request/response log plus a DB snapshot to the
 * HTML report (see tests/e2e/public-booking.spec.ts).
 *
 * Required env vars (see tests/e2e/README.md):
 *   E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  outputDir: "test-results",
  use: {
    baseURL: process.env.E2E_SUPABASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: process.env.E2E_SUPABASE_ANON_KEY
      ? { apikey: process.env.E2E_SUPABASE_ANON_KEY }
      : undefined,
  },
});
