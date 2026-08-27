#!/usr/bin/env node
/**
 * Integration test for the `public-meeting-booking` Edge Function
 * `get-schedule` action.
 *
 * Guarantees in CI:
 *   - POST get-schedule returns HTTP 200 for month / week / day views
 *   - The response matches the documented schema (scripts/lib/get-schedule-schema.mjs)
 *   - Invalid input is rejected (unknown view -> 400, missing slug -> 400)
 *   - GET on the function endpoint is rejected (405)
 *
 * Modes:
 *   1. Existing link:   E2E_PUBLIC_BOOKING_SLUG=<partner_room slug>  (read-only)
 *   2. Auto-provision:  E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD (creates and deletes
 *                       a temporary partner_room link)
 *
 * Always required: E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY
 *
 * Without credentials the script skips with exit code 0, unless
 * CI_STRICT_GET_SCHEDULE=1 (or --strict) is set, in which case it fails.
 *
 * Usage:
 *   node scripts/test-get-schedule-integration.mjs
 *   node scripts/test-get-schedule-integration.mjs --strict
 */
import { assertGetScheduleResponse } from "./lib/get-schedule-schema.mjs";

const STRICT = process.argv.includes("--strict") || process.env.CI_STRICT_GET_SCHEDULE === "1";

const SUPABASE_URL = (process.env.E2E_SUPABASE_URL || "").trim().replace(/\/$/, "");
const ANON_KEY = (process.env.E2E_SUPABASE_ANON_KEY || "").trim();
const SLUG_OVERRIDE = (process.env.E2E_PUBLIC_BOOKING_SLUG || "").trim();
const ACCESS_CODE = (process.env.E2E_PUBLIC_BOOKING_ACCESS_CODE || "").trim();
const ADMIN_EMAIL = (process.env.E2E_ADMIN_EMAIL || "").trim();
const ADMIN_PASSWORD = (process.env.E2E_ADMIN_PASSWORD || "").trim();
const RESOURCE_ID_OVERRIDE = (process.env.E2E_RESOURCE_ID || "").trim();

const results = [];
let failures = 0;

function skip(reason) {
  if (STRICT) {
    console.error(`✖ get-schedule integration test cannot run: ${reason}`);
    process.exit(1);
  }
  console.log(`⚠ get-schedule integration test skipped: ${reason}`);
  process.exit(0);
}

function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures += 1;
    results.push({ name, ok: false, error: error.message });
    console.error(`  ✖ ${name}\n    ${error.message.replace(/\n/g, "\n    ")}`);
  }
}

function fnUrl() {
  return `${SUPABASE_URL}/functions/v1/public-meeting-booking`;
}

function restUrl(path) {
  return `${SUPABASE_URL}/rest/v1/${path}`;
}

async function callFn(action, body) {
  const res = await fetch(fnUrl(), {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body, action }),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }
  return { status: res.status, data, text };
}

async function adminLogin() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`admin login failed (${res.status})`);
  }
  return data.access_token;
}

function adminHeaders(token, extra = {}) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function provisionLink(token) {
  let resourceId = RESOURCE_ID_OVERRIDE;
  if (!resourceId) {
    const res = await fetch(
      restUrl("calendar_resources?select=id&is_active=eq.true&order=display_order.asc&limit=1"),
      { headers: adminHeaders(token) },
    );
    const rows = await res.json().catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("no active calendar_resources found (set E2E_RESOURCE_ID)");
    }
    resourceId = rows[0].id;
  }

  const slug = `ci-schedule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch(restUrl("public_booking_links"), {
    method: "POST",
    headers: adminHeaders(token, { Prefer: "return=representation" }),
    body: JSON.stringify({
      slug,
      link_type: "partner_room",
      title: "CI get-schedule Link",
      description: "Auto-provisioned by CI integration test — safe to delete",
      is_active: true,
      allowed_resource_ids: [resourceId],
      allowed_weekdays: [0, 1, 2, 3, 4, 5, 6],
      start_time: "09:00:00",
      end_time: "18:00:00",
      slot_minutes: 30,
      duration_minutes: 30,
      buffer_minutes: 0,
      min_notice_minutes: 0,
      max_days_ahead: 30,
      requires_approval: true,
      notify_user_ids: [],
      metadata: { ci: true, purpose: "get-schedule integration test" },
    }),
  });
  const rows = await res.json().catch(() => []);
  if (!res.ok || !Array.isArray(rows) || !rows[0]?.id) {
    throw new Error(`failed to provision partner_room link (${res.status}): ${JSON.stringify(rows)}`);
  }
  return { id: rows[0].id, slug: rows[0].slug };
}

async function deleteLink(token, linkId) {
  await fetch(restUrl(`public_booking_links?id=eq.${linkId}`), {
    method: "DELETE",
    headers: adminHeaders(token),
  }).catch(() => undefined);
}

function seoulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

async function run() {
  if (!SUPABASE_URL || !ANON_KEY) skip("E2E_SUPABASE_URL / E2E_SUPABASE_ANON_KEY are not set");
  if (!SLUG_OVERRIDE && !(ADMIN_EMAIL && ADMIN_PASSWORD)) {
    skip("set E2E_PUBLIC_BOOKING_SLUG or E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD");
  }

  let slug = SLUG_OVERRIDE;
  let token = null;
  let provisioned = null;

  console.log("public-meeting-booking · get-schedule integration test");

  try {
    if (!slug) {
      token = await adminLogin();
      provisioned = await provisionLink(token);
      slug = provisioned.slug;
      console.log(`  provisioned temporary link: ${slug}`);
    } else {
      console.log(`  using existing link: ${slug}`);
    }

    const date = seoulToday();
    const base = ACCESS_CODE ? { slug, accessCode: ACCESS_CODE } : { slug };

    for (const view of ["month", "week", "day"]) {
      const res = await callFn("get-schedule", { ...base, view, date });
      check(`POST get-schedule (${view}) returns 200`, () => {
        if (res.status !== 200) throw new Error(`status ${res.status}: ${res.text.slice(0, 500)}`);
      });
      check(`POST get-schedule (${view}) matches response schema`, () => {
        if (res.status !== 200) throw new Error("skipped schema check — non-200 response");
        assertGetScheduleResponse(res.data, { view, date });
      });
    }

    const badView = await callFn("get-schedule", { ...base, view: "quarter", date });
    check("unknown view is rejected with 400", () => {
      if (badView.status !== 400) throw new Error(`status ${badView.status}: ${badView.text.slice(0, 300)}`);
    });

    const noSlug = await callFn("get-schedule", { view: "month", date });
    check("missing slug is rejected with 400", () => {
      if (noSlug.status !== 400) throw new Error(`status ${noSlug.status}: ${noSlug.text.slice(0, 300)}`);
    });

    const getRes = await fetch(fnUrl(), { headers: { apikey: ANON_KEY } });
    await getRes.text();
    check("GET on function endpoint is rejected with 405", () => {
      if (getRes.status !== 405) throw new Error(`status ${getRes.status}`);
    });
  } finally {
    if (token && provisioned) await deleteLink(token, provisioned.id);
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${failures === 0 ? "✓" : "✖"} ${passed}/${results.length} checks passed`);
  if (failures > 0) process.exit(1);
}

run().catch((error) => {
  console.error(`✖ get-schedule integration test crashed: ${error.message}`);
  process.exit(1);
});
