import { test, expect, request as pwRequest, APIRequestContext } from "@playwright/test";

/**
 * Full E2E: auto-provisions a public booking link with the admin session token,
 * runs approve + reject flows against the live `public-meeting-booking`
 * Edge Function, verifies the resulting calendar events, then cleans up.
 *
 * Env vars (see tests/e2e/README.md):
 *   E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 *
 * Optional overrides:
 *   E2E_RESOURCE_ID   pre-existing calendar_resources.id to use;
 *                     otherwise the first active resource is auto-selected.
 */

const SUPABASE_URL = requiredEnv("E2E_SUPABASE_URL");
const ANON_KEY = requiredEnv("E2E_SUPABASE_ANON_KEY");
const ADMIN_EMAIL = requiredEnv("E2E_ADMIN_EMAIL");
const ADMIN_PASSWORD = requiredEnv("E2E_ADMIN_PASSWORD");
const RESOURCE_ID_OVERRIDE = process.env.E2E_RESOURCE_ID?.trim() || "";

const FN_URL = `${SUPABASE_URL}/functions/v1/public-meeting-booking`;
const REST_URL = `${SUPABASE_URL}/rest/v1`;
const AUTH_URL = `${SUPABASE_URL}/auth/v1`;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

type SlotResponse = {
  slots: Array<{
    resourceId: string;
    resourceName: string;
    startsAt: string;
    endsAt: string;
    time: string;
    label: string;
  }>;
};

async function callFn<T = unknown>(
  api: APIRequestContext,
  body: Record<string, unknown>,
  authToken?: string,
): Promise<{ status: number; data: T }> {
  const res = await api.post(FN_URL, {
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken ?? ANON_KEY}`,
    },
    data: body,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status(), data };
}

function adminHeaders(token: string, extra: Record<string, string> = {}) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function loginAdmin(api: APIRequestContext): Promise<string> {
  const res = await api.post(`${AUTH_URL}/token?grant_type=password`, {
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok(), `admin login failed (${res.status()})`).toBeTruthy();
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("admin login returned no access_token");
  return json.access_token;
}

async function pickResourceId(api: APIRequestContext, token: string): Promise<string> {
  if (RESOURCE_ID_OVERRIDE) return RESOURCE_ID_OVERRIDE;
  const res = await api.get(
    `${REST_URL}/calendar_resources?select=id&is_active=eq.true&order=display_order.asc&limit=1`,
    { headers: adminHeaders(token) },
  );
  expect(res.ok(), `failed to load calendar_resources: ${res.status()}`).toBeTruthy();
  const rows = (await res.json()) as Array<{ id: string }>;
  if (rows.length === 0) {
    throw new Error(
      "No active calendar_resources found. Create one first or set E2E_RESOURCE_ID.",
    );
  }
  return rows[0].id;
}

async function provisionLink(
  api: APIRequestContext,
  token: string,
  resourceId: string,
): Promise<{ id: string; slug: string }> {
  const slug = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await api.post(`${REST_URL}/public_booking_links`, {
    headers: adminHeaders(token, { Prefer: "return=representation" }),
    data: {
      slug,
      link_type: "customer_request",
      title: "E2E Automation Link",
      description: "Auto-provisioned for Playwright E2E — safe to delete",
      is_active: true,
      allowed_resource_ids: [resourceId],
      allowed_weekdays: [0, 1, 2, 3, 4, 5, 6],
      start_time: "00:00:00",
      end_time: "23:59:00",
      slot_minutes: 30,
      duration_minutes: 30,
      buffer_minutes: 0,
      min_notice_minutes: 0,
      max_days_ahead: 30,
      requires_approval: true,
      notify_user_ids: [],
      metadata: { e2e: true },
    },
  });
  expect(res.ok(), `failed to create link: ${res.status()} ${await res.text()}`).toBeTruthy();
  const rows = (await res.json()) as Array<{ id: string; slug: string }>;
  return rows[0];
}

async function deleteRow(api: APIRequestContext, table: string, id: string, token: string) {
  await api
    .delete(`${REST_URL}/${table}?id=eq.${id}`, { headers: adminHeaders(token) })
    .catch(() => undefined);
}

test.describe("public-meeting-booking E2E", () => {
  let api: APIRequestContext;
  let adminToken: string;
  let resourceId: string;
  let link: { id: string; slug: string };
  const createdRequestIds: string[] = [];
  const createdEventIds: string[] = [];

  test.beforeAll(async () => {
    api = await pwRequest.newContext();
    adminToken = await loginAdmin(api);
    resourceId = await pickResourceId(api, adminToken);
    link = await provisionLink(api, adminToken, resourceId);
  });

  test.afterAll(async () => {
    for (const id of createdEventIds) await deleteRow(api, "calendar_events", id, adminToken);
    for (const id of createdRequestIds) await deleteRow(api, "public_booking_requests", id, adminToken);
    if (link?.id) await deleteRow(api, "public_booking_links", link.id, adminToken);
    await api.dispose();
  });

  test("approval flow creates a calendar event", async () => {
    const meta = await callFn<{
      slug: string;
      requiresApproval: boolean;
      requiresAccessCode: boolean;
      resources: Array<{ id: string }>;
    }>(api, { action: "get-link", slug: link.slug });
    expect(meta.status).toBe(200);
    expect(meta.data.slug).toBe(link.slug);
    expect(meta.data.requiresApproval).toBe(true);
    expect(meta.data.resources.map((r) => r.id)).toContain(resourceId);

    const slot = await findAvailableSlot(api, link.slug);
    expect(slot, "no available slots found in next 14 days").toBeTruthy();

    const stamp = Date.now();
    const create = await callFn<{ requestId: string; status: string }>(api, {
      action: "create-request",
      slug: link.slug,
      date: slot!.date,
      time: slot!.time,
      resourceId,
      requesterName: `E2E Tester ${stamp}`,
      companyName: "E2E Automation",
      phone: "010-0000-0000",
      email: `e2e+${stamp}@example.com`,
      purpose: `Playwright E2E approval ${stamp}`,
    });
    expect(create.status, JSON.stringify(create.data)).toBe(200);
    expect(create.data.status).toBe("pending_review");
    createdRequestIds.push(create.data.requestId);

    const confirm = await callFn<{ eventId: string; status: string }>(
      api,
      { action: "confirm-request", requestId: create.data.requestId, reviewNote: "E2E approve" },
      adminToken,
    );
    expect(confirm.status, JSON.stringify(confirm.data)).toBe(200);
    expect(confirm.data.status).toBe("confirmed");
    expect(confirm.data.eventId).toBeTruthy();
    createdEventIds.push(confirm.data.eventId);

    const eventRes = await api.get(
      `${REST_URL}/calendar_events?id=eq.${confirm.data.eventId}&select=id,source_type`,
      { headers: adminHeaders(adminToken) },
    );
    expect(eventRes.ok(), await eventRes.text()).toBeTruthy();
    const rows = (await eventRes.json()) as Array<{ source_type: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].source_type).toBe("external_booking");
  });

  test("rejection flow does not create a calendar event", async () => {
    const slot = await findAvailableSlot(api, link.slug);
    expect(slot, "no available slots for rejection test").toBeTruthy();

    const stamp = Date.now();
    const create = await callFn<{ requestId: string; status: string }>(api, {
      action: "create-request",
      slug: link.slug,
      date: slot!.date,
      time: slot!.time,
      resourceId,
      requesterName: `E2E Reject ${stamp}`,
      purpose: `Playwright E2E reject ${stamp}`,
    });
    expect(create.status, JSON.stringify(create.data)).toBe(200);
    createdRequestIds.push(create.data.requestId);

    const reject = await callFn<{ status: string }>(
      api,
      {
        action: "reject-request",
        requestId: create.data.requestId,
        reviewNote: "E2E rejection reason",
      },
      adminToken,
    );
    expect(reject.status, JSON.stringify(reject.data)).toBe(200);
    expect(reject.data.status).toBe("rejected");

    const eventRes = await api.get(
      `${REST_URL}/calendar_events?select=id&source_type=eq.external_booking&metadata->>publicBookingRequestId=eq.${create.data.requestId}`,
      { headers: adminHeaders(adminToken) },
    );
    const rows = (await eventRes.json().catch(() => [])) as unknown[];
    expect(rows).toHaveLength(0);
  });
});

async function findAvailableSlot(
  api: APIRequestContext,
  slug: string,
): Promise<{ date: string; time: string } | null> {
  const now = new Date();
  for (let offset = 0; offset <= 14; offset++) {
    const day = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(day);
    const res = await callFn<SlotResponse>(api, { action: "get-availability", slug, date });
    if (res.status !== 200) continue;
    const slot = res.data.slots?.[0];
    if (slot) return { date, time: slot.time };
  }
  return null;
}
