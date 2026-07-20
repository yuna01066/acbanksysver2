import { test, expect, request as pwRequest, APIRequestContext } from "@playwright/test";

/**
 * Full E2E: public booking link → availability → request → admin confirm/reject
 * → calendar event verification.
 *
 * Uses Playwright's request context to call the live Edge Function
 * (`public-meeting-booking`) and the Supabase REST endpoints. See
 * tests/e2e/README.md for required env vars.
 */

const SUPABASE_URL = requiredEnv("E2E_SUPABASE_URL");
const ANON_KEY = requiredEnv("E2E_SUPABASE_ANON_KEY");
const ADMIN_EMAIL = requiredEnv("E2E_ADMIN_EMAIL");
const ADMIN_PASSWORD = requiredEnv("E2E_ADMIN_PASSWORD");
const SLUG = process.env.E2E_PUBLIC_BOOKING_SLUG?.trim() || "";
const RESOURCE_ID = process.env.E2E_RESOURCE_ID?.trim() || "";

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
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken ?? ANON_KEY}`,
  };
  const res = await api.post(FN_URL, { headers, data: body });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status(), data };
}

async function loginAdmin(api: APIRequestContext): Promise<string> {
  const res = await api.post(`${AUTH_URL}/token?grant_type=password`, {
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok(), `admin login failed (${res.status()})`).toBeTruthy();
  const json = (await res.json()) as { access_token?: string };
  const token = json.access_token;
  if (!token) throw new Error("admin login returned no access_token");
  return token;
}

async function deleteRow(
  api: APIRequestContext,
  table: string,
  id: string,
  adminToken: string,
) {
  await api.delete(`${REST_URL}/${table}?id=eq.${id}`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${adminToken}`,
    },
  });
}

test.describe("public-meeting-booking E2E", () => {
  let api: APIRequestContext;
  let adminToken: string;
  const createdRequestIds: string[] = [];
  const createdEventIds: string[] = [];

  test.beforeAll(async () => {
    api = await pwRequest.newContext();
    adminToken = await loginAdmin(api);

    if (!SLUG || !RESOURCE_ID) {
      throw new Error(
        "E2E_PUBLIC_BOOKING_SLUG and E2E_RESOURCE_ID are required — create an active customer_request link at /meeting-reservations?tab=public first.",
      );
    }
  });

  test.afterAll(async () => {
    for (const id of createdEventIds) {
      await deleteRow(api, "calendar_events", id, adminToken).catch(() => undefined);
    }
    for (const id of createdRequestIds) {
      await deleteRow(api, "public_booking_requests", id, adminToken).catch(() => undefined);
    }
    await api.dispose();
  });

  test("approval flow creates a calendar event", async () => {
    // 1. Load link metadata
    const link = await callFn<{
      slug: string;
      requiresApproval: boolean;
      requiresAccessCode: boolean;
      resources: Array<{ id: string }>;
    }>(api, { action: "get-link", slug: SLUG });
    expect(link.status).toBe(200);
    expect(link.data.slug).toBe(SLUG);
    expect(link.data.requiresAccessCode).toBeFalsy();
    expect(link.data.resources.map((r) => r.id)).toContain(RESOURCE_ID);

    // 2. Find an available slot within the next 14 days
    const slot = await findAvailableSlot(api);
    expect(slot, "no available slots found in next 14 days").toBeTruthy();

    // 3. Submit the booking request
    const stamp = Date.now();
    const create = await callFn<{ requestId: string; status: string }>(api, {
      action: "create-request",
      slug: SLUG,
      date: slot!.date,
      time: slot!.time,
      resourceId: RESOURCE_ID,
      requesterName: `E2E Tester ${stamp}`,
      companyName: "E2E Automation",
      phone: "010-0000-0000",
      email: `e2e+${stamp}@example.com`,
      purpose: `Playwright E2E approval ${stamp}`,
    });
    expect(create.status, JSON.stringify(create.data)).toBe(200);
    expect(create.data.requestId).toBeTruthy();
    expect(create.data.status).toBe("pending_review");
    createdRequestIds.push(create.data.requestId);

    // 4. Admin confirms it
    const confirm = await callFn<{ eventId: string; status: string }>(
      api,
      {
        action: "confirm-request",
        requestId: create.data.requestId,
        reviewNote: "E2E approve",
      },
      adminToken,
    );
    expect(confirm.status, JSON.stringify(confirm.data)).toBe(200);
    expect(confirm.data.status).toBe("confirmed");
    expect(confirm.data.eventId).toBeTruthy();
    createdEventIds.push(confirm.data.eventId);

    // 5. Verify calendar_events row exists with source_type=external_booking
    const eventRes = await api.get(
      `${REST_URL}/calendar_events?id=eq.${confirm.data.eventId}&select=id,source_type,starts_at,ends_at`,
      {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );
    expect(eventRes.ok(), await eventRes.text()).toBeTruthy();
    const rows = (await eventRes.json()) as Array<{ source_type: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].source_type).toBe("external_booking");
  });

  test("rejection flow does not create a calendar event", async () => {
    const slot = await findAvailableSlot(api);
    expect(slot, "no available slots for rejection test").toBeTruthy();

    const stamp = Date.now();
    const create = await callFn<{ requestId: string; status: string }>(api, {
      action: "create-request",
      slug: SLUG,
      date: slot!.date,
      time: slot!.time,
      resourceId: RESOURCE_ID,
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
      {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );
    const rows = (await eventRes.json().catch(() => [])) as unknown[];
    expect(rows).toHaveLength(0);
  });
});

async function findAvailableSlot(
  api: APIRequestContext,
): Promise<{ date: string; time: string } | null> {
  const now = new Date();
  for (let offset = 1; offset <= 14; offset++) {
    const day = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    // yyyy-mm-dd in Asia/Seoul
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(day);
    const res = await callFn<SlotResponse>(api, {
      action: "get-availability",
      slug: SLUG,
      date,
    });
    if (res.status !== 200) continue;
    const slot = res.data.slots?.find((s) => s.resourceId === RESOURCE_ID);
    if (slot) return { date, time: slot.time };
  }
  return null;
}
