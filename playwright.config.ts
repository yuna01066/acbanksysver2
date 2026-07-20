import { defineConfig } from "@playwright/test";

/**
 * Playwright config for E2E tests against the live Supabase Edge Functions.
 *
 * Required environment variables (see tests/e2e/README.md):
 *   E2E_SUPABASE_URL                 https://<ref>.supabase.co
 *   E2E_SUPABASE_ANON_KEY            anon publishable key
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD   admin or moderator account
 *
 * Optional (skip provisioning if provided):
 *   E2E_PUBLIC_BOOKING_SLUG          existing customer_request link slug
 *   E2E_RESOURCE_ID                  calendar resource id allowed by the link
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_SUPABASE_URL,
    extraHTTPHeaders: process.env.E2E_SUPABASE_ANON_KEY
      ? {
          apikey: process.env.E2E_SUPABASE_ANON_KEY,
        }
      : undefined,
  },
});
