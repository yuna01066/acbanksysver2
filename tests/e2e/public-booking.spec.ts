import {
  test as base,
  expect,
  request as pwRequest,
  APIRequestContext,
} from "@playwright/test";

/**
 * Full E2E: auto-provisions a public booking link with the admin session token,
 * runs approve + reject flows against the live `public-meeting-booking`
 * Edge Function, verifies the resulting calendar events, then cleans up.
 *
 * On failure this suite dumps every request/response made during the test and
 * a live DB snapshot (link, requests, events) to the console AND attaches
 * them to the Playwright HTML report next to the retained trace.
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

type LogEntry = {
  ts: string;
  label: string;
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
  responseBytes?: number;
  request?: unknown;
  response?: unknown;
  error?: string;

};

class HttpRecorder {
  entries: LogEntry[] = [];

  constructor(private api: APIRequestContext) {}

  private redact(value: unknown): unknown {
    if (!value || typeof value !== "object") return value;
    const clone: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const key of ["password", "access_token", "refresh_token", "apikey", "Authorization"]) {
      if (key in clone) clone[key] = "[redacted]";
    }
    return clone;
  }

  async call<T>(
    label: string,
    method: "GET" | "POST" | "DELETE",
    url: string,
    init: { headers?: Record<string, string>; data?: unknown } = {},
  ): Promise<{ status: number; data: T; text: string; durationMs: number; responseBytes: number }> {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      label,
      method,
      url,
      request: init.data !== undefined ? this.redact(init.data) : undefined,
    };
    this.entries.push(entry);
    const startedAt = performance.now();
    try {
      const res =
        method === "GET"
          ? await this.api.get(url, { headers: init.headers })
          : method === "DELETE"
          ? await this.api.delete(url, { headers: init.headers })
          : await this.api.post(url, { headers: init.headers, data: init.data });
      const text = await res.text();
      const durationMs = Math.round((performance.now() - startedAt) * 1000) / 1000;
      const responseBytes = new TextEncoder().encode(text).length;
      let data: unknown = text;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        // keep as text
      }
      entry.status = res.status();
      entry.response = data;
      entry.durationMs = durationMs;
      entry.responseBytes = responseBytes;
      return { status: res.status(), data: data as T, text, durationMs, responseBytes };
    } catch (err) {
      entry.durationMs = Math.round((performance.now() - startedAt) * 1000) / 1000;
      entry.error = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }
}

}

type Fixtures = {
  api: APIRequestContext;
  http: HttpRecorder;
  adminToken: string;
  resourceId: string;
  link: { id: string; slug: string };
  cleanup: { requestIds: string[]; eventIds: string[] };
};

const test = base.extend<Fixtures>({
  api: async ({}, use) => {
    const api = await pwRequest.newContext();
    await use(api);
    await api.dispose();
  },
  http: async ({ api }, use) => {
    await use(new HttpRecorder(api));
  },
  adminToken: async ({ http }, use) => {
    const { data } = await http.call<{ access_token?: string }>(
      "admin-login",
      "POST",
      `${AUTH_URL}/token?grant_type=password`,
      {
        headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      },
    );
    if (!data.access_token) throw new Error("admin login returned no access_token");
    await use(data.access_token);
  },
  resourceId: async ({ http, adminToken }, use) => {
    if (RESOURCE_ID_OVERRIDE) return use(RESOURCE_ID_OVERRIDE);
    const { data } = await http.call<Array<{ id: string }>>(
      "pick-resource",
      "GET",
      `${REST_URL}/calendar_resources?select=id&is_active=eq.true&order=display_order.asc&limit=1`,
      { headers: adminHeaders(adminToken) },
    );
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No active calendar_resources found. Set E2E_RESOURCE_ID.");
    }
    await use(data[0].id);
  },
  link: async ({ http, adminToken, resourceId }, use) => {
    const slug = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const { data, status, text } = await http.call<Array<{ id: string; slug: string }>>(
      "provision-link",
      "POST",
      `${REST_URL}/public_booking_links`,
      {
        headers: adminHeaders(adminToken, { Prefer: "return=representation" }),
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
      },
    );
    if (status >= 300 || !Array.isArray(data) || !data[0]?.id) {
      throw new Error(`failed to create link: ${status} ${text}`);
    }
    const link = data[0];
    await use(link);
    // teardown handled in afterEach cleanup fixture
    await http
      .call("delete-link", "DELETE", `${REST_URL}/public_booking_links?id=eq.${link.id}`, {
        headers: adminHeaders(adminToken),
      })
      .catch(() => undefined);

    // Final DB verification — confirm nothing tied to this link survives.
    await verifyLinkFullyDeleted(http, adminToken, link.id);
  },
  cleanup: async ({ http, adminToken }, use) => {
    const state = { requestIds: [] as string[], eventIds: [] as string[] };
    await use(state);
    for (const id of state.eventIds) {
      await http
        .call("delete-event", "DELETE", `${REST_URL}/calendar_events?id=eq.${id}`, {
          headers: adminHeaders(adminToken),
        })
        .catch(() => undefined);
    }
    for (const id of state.requestIds) {
      await http
        .call("delete-request", "DELETE", `${REST_URL}/public_booking_requests?id=eq.${id}`, {
          headers: adminHeaders(adminToken),
        })
        .catch(() => undefined);
    }
    // Verify per-test cleanup removed everything we created.
    for (const id of state.requestIds) {
      const res = await http.call<Array<{ id: string }>>(
        "verify-request-deleted",
        "GET",
        `${REST_URL}/public_booking_requests?select=id&id=eq.${id}`,
        { headers: adminHeaders(adminToken) },
      );
      expect(res.data, `request ${id} not cleaned up`).toHaveLength(0);
    }
    for (const id of state.eventIds) {
      const res = await http.call<Array<{ id: string }>>(
        "verify-event-deleted",
        "GET",
        `${REST_URL}/calendar_events?select=id&id=eq.${id}`,
        { headers: adminHeaders(adminToken) },
      );
      expect(res.data, `event ${id} not cleaned up`).toHaveLength(0);
    }
  },
});

async function verifyLinkFullyDeleted(
  http: HttpRecorder,
  adminToken: string,
  linkId: string,
) {
  const link = await http.call<Array<{ id: string }>>(
    "verify-link-deleted",
    "GET",
    `${REST_URL}/public_booking_links?select=id&id=eq.${linkId}`,
    { headers: adminHeaders(adminToken) },
  );
  expect(link.data, `public_booking_links row ${linkId} still present`).toHaveLength(0);

  const requests = await http.call<Array<{ id: string }>>(
    "verify-requests-deleted",
    "GET",
    `${REST_URL}/public_booking_requests?select=id&link_id=eq.${linkId}`,
    { headers: adminHeaders(adminToken) },
  );
  expect(
    requests.data,
    `public_booking_requests remain for link ${linkId}: ${JSON.stringify(requests.data)}`,
  ).toHaveLength(0);

  const events = await http.call<Array<{ id: string }>>(
    "verify-events-deleted",
    "GET",
    `${REST_URL}/calendar_events?select=id&metadata->>publicBookingLinkId=eq.${linkId}`,
    { headers: adminHeaders(adminToken) },
  );
  expect(
    events.data,
    `calendar_events remain for link ${linkId}: ${JSON.stringify(events.data)}`,
  ).toHaveLength(0);
}


function adminHeaders(token: string, extra: Record<string, string> = {}) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function callFn<T = unknown>(
  http: HttpRecorder,
  action: string,
  body: Record<string, unknown>,
  authToken?: string,
) {
  return http.call<T>(`fn:${action}`, "POST", FN_URL, {
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken ?? ANON_KEY}`,
    },
    data: { ...body, action },
  });
}

async function findAvailableSlot(
  http: HttpRecorder,
  slug: string,
): Promise<{ date: string; time: string } | null> {
  const now = new Date();
  for (let offset = 0; offset <= 14; offset++) {
    const day = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(day);
    const res = await callFn<{ slots?: Array<{ time: string }> }>(http, "get-availability", {
      slug,
      date,
    });
    const slot = res.data.slots?.[0];
    if (slot) return { date, time: slot.time };
  }
  return null;
}

/**
 * Structured failure dump schema (version 1):
 * {
 *   schema: "acbank.e2e.public-booking.failure/v2",
 *   test: { title, path, file, line, status, expectedStatus, durationMs, retries, workerIndex, project },
 *   errors: [{ message, stack? }],
 *   http: {
 *     count,
 *     entries: [{ seq, ts, label, method, url, status?, request?, response?, error? }],
 *   },
 *   db: {
 *     link: { id, slug, ... } | null,
 *     queries: { [key]: { url, rows: unknown[] } | { url, error: string } },
 *   },
 *   pendingCleanup: { requestIds: string[], eventIds: string[] },
 * }
 */
test.afterEach(async ({ http, adminToken, link, cleanup }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;

  const dbQueries: Record<
    string,
    { url: string; rows: unknown } | { url: string; error: string }
  > = {};
  if (link?.id) {
    const targets: Array<[string, string]> = [
      ["public_booking_requests", `${REST_URL}/public_booking_requests?link_id=eq.${link.id}&select=*`],
      [
        "calendar_events",
        `${REST_URL}/calendar_events?select=*&metadata->>publicBookingLinkId=eq.${link.id}`,
      ],
      [
        "public_booking_link",
        `${REST_URL}/public_booking_links?select=*&id=eq.${link.id}`,
      ],
    ];
    for (const [key, url] of targets) {
      try {
        const { data } = await http.call(`snapshot-${key}`, "GET", url, {
          headers: adminHeaders(adminToken),
        });
        dbQueries[key] = { url, rows: data };
      } catch (err) {
        dbQueries[key] = { url, error: err instanceof Error ? err.message : String(err) };
      }
    }
  }

  const dump = {
    schema: "acbank.e2e.public-booking.failure/v2",

    test: {
      title: testInfo.title,
      path: testInfo.titlePath,
      file: testInfo.file,
      line: testInfo.line,
      status: testInfo.status,
      expectedStatus: testInfo.expectedStatus,
      durationMs: testInfo.duration,
      retries: testInfo.retry,
      workerIndex: testInfo.workerIndex,
      project: testInfo.project.name,
    },
    errors: testInfo.errors.map((e) => ({ message: e.message, stack: e.stack })),
    http: (() => {
      const entries = http.entries.map((e, i) => ({ seq: i, ...e }));
      const totalMs = entries.reduce((s, e) => s + (e.durationMs ?? 0), 0);
      const totalBytes = entries.reduce((s, e) => s + (e.responseBytes ?? 0), 0);
      const slowest = [...entries]
        .filter((e) => typeof e.durationMs === "number")
        .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
        .slice(0, 5)
        .map((e) => ({ seq: e.seq, label: e.label, method: e.method, url: e.url, status: e.status, durationMs: e.durationMs, responseBytes: e.responseBytes }));
      return {
        count: entries.length,
        totalDurationMs: Math.round(totalMs * 1000) / 1000,
        totalResponseBytes: totalBytes,
        slowest,
        entries,
      };
    })(),

    db: {
      link: link ?? null,
      queries: dbQueries,
    },
    pendingCleanup: cleanup,
  };

  const json = JSON.stringify(dump, null, 2);
  console.error(
    `\n===== E2E FAILURE DUMP [${dump.schema}] ${testInfo.titlePath.join(" › ")} =====\n${json}\n===== END DUMP =====\n`,
  );
  await testInfo.attach("failure-dump.json", { body: json, contentType: "application/json" });
  await testInfo.attach("http-log.json", {
    body: JSON.stringify({ count: http.entries.length, entries: http.entries }, null, 2),
    contentType: "application/json",
  });
});


test.describe("public-meeting-booking E2E", () => {
  test("approval flow creates a calendar event", async ({
    http,
    adminToken,
    resourceId,
    link,
    cleanup,
  }) => {
    const meta = await callFn<{
      slug: string;
      requiresApproval: boolean;
      requiresAccessCode: boolean;
      resources: Array<{ id: string }>;
    }>(http, "get-link", { slug: link.slug });
    expect(meta.status).toBe(200);
    expect(meta.data.slug).toBe(link.slug);
    expect(meta.data.requiresApproval).toBe(true);
    expect(meta.data.resources.map((r) => r.id)).toContain(resourceId);

    const slot = await findAvailableSlot(http, link.slug);
    expect(slot, "no available slots found in next 14 days").toBeTruthy();

    const stamp = Date.now();
    const create = await callFn<{ requestId: string; status: string }>(http, "create-request", {
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
    cleanup.requestIds.push(create.data.requestId);

    const confirm = await callFn<{ eventId: string; status: string }>(
      http,
      "confirm-request",
      { requestId: create.data.requestId, reviewNote: "E2E approve" },
      adminToken,
    );
    expect(confirm.status, JSON.stringify(confirm.data)).toBe(200);
    expect(confirm.data.status).toBe("confirmed");
    expect(confirm.data.eventId).toBeTruthy();
    cleanup.eventIds.push(confirm.data.eventId);

    const event = await http.call<Array<{ source_type: string }>>(
      "verify-event",
      "GET",
      `${REST_URL}/calendar_events?id=eq.${confirm.data.eventId}&select=id,source_type`,
      { headers: adminHeaders(adminToken) },
    );
    expect(event.status).toBe(200);
    expect(event.data).toHaveLength(1);
    expect(event.data[0].source_type).toBe("external_booking");
  });

  test("concurrent requests: winner confirmed, loser rejected, exactly one event", async ({
    http,
    adminToken,
    resourceId,
    link,
    cleanup,
  }) => {
    const slot = await findAvailableSlot(http, link.slug);
    expect(slot, "no available slots for conflict test").toBeTruthy();

    const stamp = Date.now();
    const payload = (suffix: string) => ({
      slug: link.slug,
      date: slot!.date,
      time: slot!.time,
      resourceId,
      requesterName: `E2E Conflict ${suffix}`,
      purpose: `Playwright E2E conflict ${suffix}`,
    });

    // Fire both create-request calls in parallel. Conflict is only checked
    // against confirmed calendar_events, so both should land as pending_review.
    // The race is resolved at confirm time by get_calendar_resource_conflict.
    const [a, b] = await Promise.all([
      callFn<{ requestId?: string; status?: string; error?: string }>(
        http,
        "create-request",
        payload(`A-${stamp}`),
      ),
      callFn<{ requestId?: string; status?: string; error?: string }>(
        http,
        "create-request",
        payload(`B-${stamp}`),
      ),
    ]);

    for (const r of [a, b]) {
      if (r.status === 200 && r.data.requestId) cleanup.requestIds.push(r.data.requestId);
    }

    expect(
      [a.status, b.status],
      `both create-request calls must succeed, got: ${JSON.stringify({ a, b })}`,
    ).toEqual([200, 200]);
    expect(a.data.status).toBe("pending_review");
    expect(b.data.status).toBe("pending_review");

    // Confirm A first — must succeed and create exactly one calendar_event.
    const winner = a;
    const loser = b;
    const confirmWinner = await callFn<{ eventId: string; status: string }>(
      http,
      "confirm-request",
      { requestId: winner.data.requestId, reviewNote: "E2E conflict winner" },
      adminToken,
    );
    expect(confirmWinner.status).toBe(200);
    expect(confirmWinner.data.status).toBe("confirmed");
    expect(confirmWinner.data.eventId).toBeTruthy();
    cleanup.eventIds.push(confirmWinner.data.eventId);

    // Confirming B for the same slot must fail via get_calendar_resource_conflict.
    const confirmLoser = await callFn<{ error?: string }>(
      http,
      "confirm-request",
      { requestId: loser.data.requestId, reviewNote: "E2E conflict loser (should fail)" },
      adminToken,
    );
    expect(
      confirmLoser.status,
      `loser confirm should not succeed: ${JSON.stringify(confirmLoser.data)}`,
    ).not.toBe(200);
    expect(JSON.stringify(confirmLoser.data)).toMatch(/이미 예약|conflict|충돌/i);

    // Now reject the loser to complete the flow.
    const rejectLoser = await callFn<{ status: string }>(
      http,
      "reject-request",
      { requestId: loser.data.requestId, reviewNote: "E2E conflict loser rejected" },
      adminToken,
    );
    expect(rejectLoser.status).toBe(200);
    expect(rejectLoser.data.status).toBe("rejected");

    // DB verification: exactly one calendar_event for the resource+start time,
    // and it must match the winner's event id.
    const startsIso = new Date(`${slot!.date}T${slot!.time}:00+09:00`).toISOString();
    const events = await http.call<Array<{ id: string; metadata: Record<string, unknown> }>>(
      "verify-single-event",
      "GET",
      `${REST_URL}/calendar_events?select=id,metadata&resource_id=eq.${resourceId}&starts_at=eq.${encodeURIComponent(startsIso)}`,
      { headers: adminHeaders(adminToken) },
    );
    expect(events.data).toHaveLength(1);
    expect(events.data[0].id).toBe(confirmWinner.data.eventId);
    expect(
      (events.data[0].metadata as { publicBookingRequestId?: string })?.publicBookingRequestId,
    ).toBe(winner.data.requestId);

    // Request row statuses must exactly match the outcome.
    const rows = await http.call<Array<{ id: string; status: string }>>(
      "verify-request-statuses",
      "GET",
      `${REST_URL}/public_booking_requests?select=id,status&id=in.(${winner.data.requestId},${loser.data.requestId})`,
      { headers: adminHeaders(adminToken) },
    );
    const byId = Object.fromEntries(rows.data.map((r) => [r.id, r.status]));
    expect(byId[winner.data.requestId!]).toBe("confirmed");
    expect(byId[loser.data.requestId!]).toBe("rejected");

    // Loser must NOT have produced a calendar_event.
    const loserEvents = await http.call<Array<{ id: string }>>(
      "verify-no-loser-event",
      "GET",
      `${REST_URL}/calendar_events?select=id&metadata->>publicBookingRequestId=eq.${loser.data.requestId}`,
      { headers: adminHeaders(adminToken) },
    );
    expect(loserEvents.data).toHaveLength(0);
  });




  test("rejection flow does not create a calendar event", async ({
    http,
    adminToken,
    resourceId,
    link,
    cleanup,
  }) => {
    const slot = await findAvailableSlot(http, link.slug);
    expect(slot, "no available slots for rejection test").toBeTruthy();

    const stamp = Date.now();
    const create = await callFn<{ requestId: string; status: string }>(http, "create-request", {
      slug: link.slug,
      date: slot!.date,
      time: slot!.time,
      resourceId,
      requesterName: `E2E Reject ${stamp}`,
      purpose: `Playwright E2E reject ${stamp}`,
    });
    expect(create.status, JSON.stringify(create.data)).toBe(200);
    cleanup.requestIds.push(create.data.requestId);

    const reject = await callFn<{ status: string }>(
      http,
      "reject-request",
      { requestId: create.data.requestId, reviewNote: "E2E rejection reason" },
      adminToken,
    );
    expect(reject.status).toBe(200);
    expect(reject.data.status).toBe("rejected");

    const events = await http.call<unknown[]>(
      "verify-no-event",
      "GET",
      `${REST_URL}/calendar_events?select=id&source_type=eq.external_booking&metadata->>publicBookingRequestId=eq.${create.data.requestId}`,
      { headers: adminHeaders(adminToken) },
    );
    expect(events.data).toHaveLength(0);
  });
});
