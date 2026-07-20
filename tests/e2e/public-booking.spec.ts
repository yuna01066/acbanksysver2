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
 * Structured failure dump schema (version 3):
 * {
 *   schema: "acbank.e2e.public-booking.failure/v3",
 *   test: { title, path, file, line, status, expectedStatus, durationMs, retries, workerIndex, project },
 *   errors: [{ message, stack? }],
 *   http: {
 *     count, totalDurationMs, totalResponseBytes, slowest,
 *     entries: [{ seq, ts, label, method, url, status?, request?, response?, error?, durationMs?, responseBytes? }],
 *   },
 *   db: {
 *     link: { id, slug, ... } | null,
 *     queries: { [key]: { url, rows: unknown[] } | { url, error: string } },
 *   },
 *   conflicts: {
 *     count,
 *     entries: [{
 *       seq, label, httpStatus, requestId?, resourceId?, startsAt?, endsAt?,
 *       request?: { row?, error? },
 *       calendarEventsAtSlot?: { url, rows? , error? },
 *       resourceConflictRpc?: { params, result?, error? },
 *     }],
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

  // ---- Conflict-focused dump ----------------------------------------------
  // Any HTTP entry that either returned 409 or whose response body carries a
  // conflict marker is treated as a "conflict entry". For each one, pull the
  // matching public_booking_requests row, any calendar_events already sitting
  // at that resource+start, and re-run get_calendar_resource_conflict so the
  // dump captures the exact reason the server rejected the request.
  const conflictRegex = /conflict|이미 예약|충돌/i;
  const conflictEntries = http.entries
    .map((e, seq) => ({ seq, ...e }))
    .filter((e) => {
      if (typeof e.label !== "string") return false;
      if (!/create-request|confirm-request/.test(e.label)) return false;
      if (e.status === 409) return true;
      try {
        return conflictRegex.test(JSON.stringify(e.response ?? ""));
      } catch {
        return false;
      }
    });

  const conflictDump: Array<Record<string, unknown>> = [];
  for (const e of conflictEntries) {
    const req = (e.request as Record<string, unknown> | undefined) ?? {};
    const requestId = typeof req.requestId === "string" ? req.requestId : undefined;
    const record: Record<string, unknown> = {
      seq: e.seq,
      label: e.label,
      httpStatus: e.status,
      requestPayload: req,
      responseBody: e.response,
      requestId,
    };

    let resourceId: string | undefined;
    let startsAt: string | undefined;
    let endsAt: string | undefined;

    if (requestId) {
      const url = `${REST_URL}/public_booking_requests?select=*&id=eq.${requestId}`;
      try {
        const { data } = await http.call<Array<Record<string, unknown>>>(
          `conflict-request-${requestId}`,
          "GET",
          url,
          { headers: adminHeaders(adminToken) },
        );
        const row = Array.isArray(data) ? data[0] : undefined;
        record.request = { url, row };
        resourceId = typeof row?.resource_id === "string" ? (row.resource_id as string) : undefined;
        startsAt = typeof row?.starts_at === "string" ? (row.starts_at as string) : undefined;
        endsAt = typeof row?.ends_at === "string" ? (row.ends_at as string) : undefined;
      } catch (err) {
        record.request = { url, error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (resourceId && startsAt) {
      const eventsUrl = `${REST_URL}/calendar_events?select=id,starts_at,ends_at,resource_id,status,source_type,metadata&resource_id=eq.${resourceId}&starts_at=eq.${encodeURIComponent(
        startsAt,
      )}`;
      try {
        const { data } = await http.call<Array<Record<string, unknown>>>(
          `conflict-events-${e.seq}`,
          "GET",
          eventsUrl,
          { headers: adminHeaders(adminToken) },
        );
        record.calendarEventsAtSlot = { url: eventsUrl, rows: data };
      } catch (err) {
        record.calendarEventsAtSlot = {
          url: eventsUrl,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      if (endsAt) {
        const rpcUrl = `${REST_URL}/rpc/get_calendar_resource_conflict`;
        const rpcParams = {
          p_resource_ids: [resourceId],
          p_starts_at: startsAt,
          p_ends_at: endsAt,
        };
        try {
          const { data } = await http.call(`conflict-rpc-${e.seq}`, "POST", rpcUrl, {
            headers: { ...adminHeaders(adminToken), "Content-Type": "application/json" },
            data: rpcParams,
          });
          record.resourceConflictRpc = { params: rpcParams, result: data };
        } catch (err) {
          record.resourceConflictRpc = {
            params: rpcParams,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }
    }

    conflictDump.push(record);
  }

  const dump = {
    schema: "acbank.e2e.public-booking.failure/v3",

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
    conflicts: {
      count: conflictDump.length,
      entries: conflictDump,
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
  if (conflictDump.length > 0) {
    await testInfo.attach("conflict-dump.json", {
      body: JSON.stringify({ count: conflictDump.length, entries: conflictDump }, null, 2),
      contentType: "application/json",
    });
  }
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

  test("client retries after calendar_resource_conflict do not create duplicate events", async ({
    http,
    adminToken,
    resourceId,
    link,
    cleanup,
  }) => {
    const slot = await findAvailableSlot(http, link.slug);
    expect(slot, "no available slots for retry test").toBeTruthy();

    const stamp = Date.now();
    const basePayload = (suffix: string) => ({
      slug: link.slug,
      date: slot!.date,
      time: slot!.time,
      resourceId,
      requesterName: `E2E Retry ${suffix}`,
      purpose: `Playwright E2E retry ${suffix}`,
    });

    // Two pending requests for the same slot.
    const [winnerCreate, loserCreate] = await Promise.all([
      callFn<{ requestId: string; status: string }>(http, "create-request", basePayload(`W-${stamp}`)),
      callFn<{ requestId: string; status: string }>(http, "create-request", basePayload(`L-${stamp}`)),
    ]);
    expect([winnerCreate.status, loserCreate.status]).toEqual([200, 200]);
    cleanup.requestIds.push(winnerCreate.data.requestId, loserCreate.data.requestId);

    // Winner confirmed → one event exists.
    const confirmWinner = await callFn<{ eventId: string; status: string }>(
      http,
      "confirm-request",
      { requestId: winnerCreate.data.requestId, reviewNote: "E2E retry winner" },
      adminToken,
    );
    expect(confirmWinner.status).toBe(200);
    expect(confirmWinner.data.eventId).toBeTruthy();
    cleanup.eventIds.push(confirmWinner.data.eventId);

    // Simulate a client that retries confirm-request several times after
    // hitting calendar_resource_conflict. Every attempt must fail and
    // must NOT create an additional calendar_event.
    const RETRY_COUNT = 3;
    const retries: Array<{ status: number; data: unknown }> = [];
    for (let i = 0; i < RETRY_COUNT; i += 1) {
      const attempt = await callFn<{ error?: string }>(
        http,
        "confirm-request",
        {
          requestId: loserCreate.data.requestId,
          reviewNote: `E2E retry loser attempt ${i + 1}`,
        },
        adminToken,
      );
      retries.push({ status: attempt.status, data: attempt.data });
      expect(
        attempt.status,
        `retry #${i + 1} must not succeed: ${JSON.stringify(attempt.data)}`,
      ).not.toBe(200);
      expect(JSON.stringify(attempt.data)).toMatch(/이미 예약|conflict|충돌/i);
    }

    // Also retry create-request for the identical slot — server accepts it as
    // pending_review, but a subsequent confirm must still be rejected.
    const retryCreate = await callFn<{ requestId?: string; status?: string; error?: string }>(
      http,
      "create-request",
      basePayload(`R-${stamp}`),
    );
    if (retryCreate.status === 200 && retryCreate.data.requestId) {
      cleanup.requestIds.push(retryCreate.data.requestId);
      const retryConfirm = await callFn<{ error?: string }>(
        http,
        "confirm-request",
        { requestId: retryCreate.data.requestId, reviewNote: "E2E retry-create confirm" },
        adminToken,
      );
      expect(retryConfirm.status).not.toBe(200);
      expect(JSON.stringify(retryConfirm.data)).toMatch(/이미 예약|conflict|충돌/i);
    }

    // Final DB assertion: exactly one calendar_event for the resource+slot,
    // and it still belongs to the original winner.
    const startsIso = new Date(`${slot!.date}T${slot!.time}:00+09:00`).toISOString();
    const events = await http.call<Array<{ id: string; metadata: Record<string, unknown> }>>(
      "verify-single-event-after-retries",
      "GET",
      `${REST_URL}/calendar_events?select=id,metadata&resource_id=eq.${resourceId}&starts_at=eq.${encodeURIComponent(startsIso)}`,
      { headers: adminHeaders(adminToken) },
    );
    expect(
      events.data,
      `expected exactly 1 event after ${RETRY_COUNT} retries, got ${events.data.length}`,
    ).toHaveLength(1);
    expect(events.data[0].id).toBe(confirmWinner.data.eventId);
    expect(
      (events.data[0].metadata as { publicBookingRequestId?: string })?.publicBookingRequestId,
    ).toBe(winnerCreate.data.requestId);

    // Loser (and any retry-created request) must not have produced events.
    const otherRequestIds = [loserCreate.data.requestId, retryCreate.data?.requestId].filter(
      Boolean,
    ) as string[];
    for (const rid of otherRequestIds) {
      const orphan = await http.call<Array<{ id: string }>>(
        `verify-no-event-${rid}`,
        "GET",
        `${REST_URL}/calendar_events?select=id&metadata->>publicBookingRequestId=eq.${rid}`,
        { headers: adminHeaders(adminToken) },
      );
      expect(orphan.data, `request ${rid} must not have a calendar_event`).toHaveLength(0);
    }
  });


  test("conflict resolution stays consistent as concurrency scales from 2 to 5", async ({
    http,
    adminToken,
    resourceId,
    link,
    cleanup,
  }) => {
    const CONCURRENCY_LEVELS = [2, 3, 4, 5];
    const usedSlotKeys = new Set<string>();

    for (const N of CONCURRENCY_LEVELS) {
      // Pick a fresh available slot per iteration so previous confirmed
      // events don't interfere with this run.
      let slot: { date: string; time: string } | null = null;
      for (let attempt = 0; attempt < 5 && !slot; attempt += 1) {
        const candidate = await findAvailableSlot(http, link.slug);
        if (!candidate) break;
        const key = `${candidate.date}T${candidate.time}`;
        if (!usedSlotKeys.has(key)) {
          usedSlotKeys.add(key);
          slot = candidate;
        }
      }
      expect(slot, `no available slot for concurrency=${N}`).toBeTruthy();

      const stamp = Date.now();
      const payload = (i: number) => ({
        slug: link.slug,
        date: slot!.date,
        time: slot!.time,
        resourceId,
        requesterName: `E2E Scale N=${N} #${i}`,
        purpose: `Playwright E2E scale N=${N} idx=${i}`,
      });

      // 1) Create N pending requests in parallel — all must succeed.
      const creates = await Promise.all(
        Array.from({ length: N }, (_, i) =>
          callFn<{ requestId?: string; status?: string; error?: string }>(
            http,
            "create-request",
            payload(i),
          ),
        ),
      );
      const requestIds: string[] = [];
      for (const r of creates) {
        expect(r.status, `create-request must succeed (N=${N}): ${JSON.stringify(r.data)}`).toBe(200);
        expect(r.data.status).toBe("pending_review");
        if (r.data.requestId) {
          requestIds.push(r.data.requestId);
          cleanup.requestIds.push(r.data.requestId);
        }
      }
      expect(requestIds).toHaveLength(N);

      // 2) Fire N confirm-request calls in parallel — exactly one must win
      //    with 200; all others must fail with 409 conflict.
      const confirms = await Promise.all(
        requestIds.map((rid) =>
          callFn<{ eventId?: string; status?: string; error?: string }>(
            http,
            "confirm-request",
            { requestId: rid, reviewNote: `E2E scale N=${N} confirm` },
            adminToken,
          ).then((res) => ({ rid, ...res })),
        ),
      );

      const winners = confirms.filter((c) => c.status === 200);
      const losers = confirms.filter((c) => c.status !== 200);

      expect(
        winners,
        `exactly 1 winner expected for N=${N}, got ${winners.length}: ${JSON.stringify(
          confirms.map((c) => ({ rid: c.rid, status: c.status, data: c.data })),
        )}`,
      ).toHaveLength(1);
      expect(losers).toHaveLength(N - 1);

      const winner = winners[0];
      expect(winner.data.status).toBe("confirmed");
      expect(winner.data.eventId).toBeTruthy();
      cleanup.eventIds.push(winner.data.eventId as string);

      for (const l of losers) {
        expect(
          l.status,
          `loser must return 409 conflict (N=${N}, rid=${l.rid}): ${JSON.stringify(l.data)}`,
        ).toBe(409);
        expect(JSON.stringify(l.data)).toMatch(/이미 예약|conflict|충돌/i);
      }

      // 3) DB assertion — exactly one calendar_event for this slot.
      const startsIso = new Date(`${slot!.date}T${slot!.time}:00+09:00`).toISOString();
      const events = await http.call<Array<{ id: string; metadata: Record<string, unknown> }>>(
        `verify-scale-single-event-N${N}`,
        "GET",
        `${REST_URL}/calendar_events?select=id,metadata&resource_id=eq.${resourceId}&starts_at=eq.${encodeURIComponent(startsIso)}`,
        { headers: adminHeaders(adminToken) },
      );
      expect(
        events.data,
        `expected exactly 1 calendar_event for N=${N}, got ${events.data.length}`,
      ).toHaveLength(1);
      expect(events.data[0].id).toBe(winner.data.eventId);
      expect(
        (events.data[0].metadata as { publicBookingRequestId?: string })?.publicBookingRequestId,
      ).toBe(winner.rid);

      // Clean up losers so subsequent iterations aren't blocked and to keep
      // the pending_review backlog empty.
      for (const l of losers) {
        await callFn<{ status: string }>(
          http,
          "reject-request",
          { requestId: l.rid, reviewNote: `E2E scale N=${N} loser reject` },
          adminToken,
        );
      }
    }
  });


  test("concurrent-booking conflicts stay consistent across (resource × start-time) matrix", async ({
    http,
    adminToken,
    cleanup,
  }) => {
    // 1) Pull up to 3 active resources so we can exercise a real matrix.
    const resList = await http.call<Array<{ id: string }>>(
      "matrix-pick-resources",
      "GET",
      `${REST_URL}/calendar_resources?select=id&is_active=eq.true&order=display_order.asc&limit=3`,
      { headers: adminHeaders(adminToken) },
    );
    const resourceIds = (resList.data ?? []).map((r) => r.id);
    expect(resourceIds.length, "need at least 1 active resource").toBeGreaterThan(0);

    // 2) Provision a dedicated link that allows all picked resources so we can
    //    freely pick (resource, start-time) pairs without cross-test noise.
    const slug = `e2e-matrix-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const linkInsert = await http.call<Array<{ id: string; slug: string }>>(
      "matrix-provision-link",
      "POST",
      `${REST_URL}/public_booking_links`,
      {
        headers: adminHeaders(adminToken, { Prefer: "return=representation" }),
        data: {
          slug,
          link_type: "customer_request",
          title: "E2E Matrix Link",
          description: "Auto-provisioned matrix link — safe to delete",
          is_active: true,
          allowed_resource_ids: resourceIds,
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
          metadata: { e2e: true, matrix: true },
        },
      },
    );
    expect(linkInsert.status, `matrix link create: ${linkInsert.text}`).toBeLessThan(300);
    const matrixLink = linkInsert.data[0];

    try {
      // 3) Collect several distinct start times (on-the-hour + :30) from the
      //    next few days so we can also cover different date/time patterns.
      const timeSlots: Array<{ date: string; time: string }> = [];
      const now = new Date();
      for (let offset = 0; offset <= 10 && timeSlots.length < 4; offset += 1) {
        const day = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
        const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(day);
        const res = await callFn<{ slots?: Array<{ time: string }> }>(
          http,
          "get-availability",
          { slug: matrixLink.slug, date },
        );
        const slots = res.data.slots ?? [];
        // Prefer alternating on-the-hour and half-hour starts to cover both.
        const onHour = slots.find((s) => s.time.endsWith(":00"));
        const halfHour = slots.find((s) => s.time.endsWith(":30"));
        for (const s of [onHour, halfHour]) {
          if (s && timeSlots.length < 4) timeSlots.push({ date, time: s.time });
        }
      }
      expect(timeSlots.length, "need at least 2 start-time slots for matrix").toBeGreaterThanOrEqual(2);

      // 4) Build (resource × slot) matrix. Cap the total to keep runtime sane.
      type Cell = { resourceId: string; date: string; time: string };
      const matrix: Cell[] = [];
      for (const rid of resourceIds) {
        for (const s of timeSlots) {
          matrix.push({ resourceId: rid, date: s.date, time: s.time });
          if (matrix.length >= 6) break;
        }
        if (matrix.length >= 6) break;
      }
      expect(matrix.length).toBeGreaterThan(0);

      // 5) For each cell, run a 3-way concurrent-confirm race and assert
      //    exactly one 200 winner + two 409 losers + one calendar_event.
      const N = 3;
      const failures: Array<{ cell: Cell; reason: string }> = [];
      for (const cell of matrix) {
        const stamp = Date.now();
        const payload = (i: number) => ({
          slug: matrixLink.slug,
          date: cell.date,
          time: cell.time,
          resourceId: cell.resourceId,
          requesterName: `E2E Matrix r=${cell.resourceId.slice(0, 4)} t=${cell.time} #${i}`,
          purpose: `Playwright matrix cell ${cell.resourceId}/${cell.date} ${cell.time} idx=${i}`,
        });

        const creates = await Promise.all(
          Array.from({ length: N }, (_, i) =>
            callFn<{ requestId?: string; status?: string; error?: string }>(
              http,
              "create-request",
              payload(i),
            ),
          ),
        );
        const requestIds: string[] = [];
        for (const c of creates) {
          if (c.status !== 200 || !c.data.requestId) {
            failures.push({
              cell,
              reason: `create-request failed: ${JSON.stringify({ status: c.status, data: c.data })}`,
            });
            continue;
          }
          requestIds.push(c.data.requestId);
          cleanup.requestIds.push(c.data.requestId);
        }
        if (requestIds.length !== N) continue;

        const confirms = await Promise.all(
          requestIds.map((rid) =>
            callFn<{ eventId?: string; status?: string; error?: string }>(
              http,
              "confirm-request",
              { requestId: rid, reviewNote: `E2E matrix confirm ${stamp}` },
              adminToken,
            ).then((res) => ({ rid, ...res })),
          ),
        );
        const winners = confirms.filter((c) => c.status === 200);
        const losers = confirms.filter((c) => c.status !== 200);

        if (winners.length !== 1) {
          failures.push({
            cell,
            reason: `expected 1 winner, got ${winners.length}: ${JSON.stringify(
              confirms.map((c) => ({ rid: c.rid, status: c.status, data: c.data })),
            )}`,
          });
        } else {
          cleanup.eventIds.push(winners[0].data.eventId as string);
        }
        for (const l of losers) {
          if (l.status !== 409) {
            failures.push({
              cell,
              reason: `loser must be 409, got ${l.status}: ${JSON.stringify(l.data)}`,
            });
          } else if (!/이미 예약|conflict|충돌/i.test(JSON.stringify(l.data))) {
            failures.push({
              cell,
              reason: `409 body missing conflict marker: ${JSON.stringify(l.data)}`,
            });
          }
        }

        // DB check: exactly one calendar_event for this (resource, slot).
        const startsIso = new Date(`${cell.date}T${cell.time}:00+09:00`).toISOString();
        const events = await http.call<Array<{ id: string }>>(
          `matrix-verify-${cell.resourceId.slice(0, 4)}-${cell.time}`,
          "GET",
          `${REST_URL}/calendar_events?select=id&resource_id=eq.${cell.resourceId}&starts_at=eq.${encodeURIComponent(startsIso)}`,
          { headers: adminHeaders(adminToken) },
        );
        if (events.data.length !== 1) {
          failures.push({
            cell,
            reason: `expected 1 calendar_event, got ${events.data.length}`,
          });
        }

        // Reject losers to keep pending backlog clean for the next cell.
        for (const l of losers) {
          await callFn(
            http,
            "reject-request",
            { requestId: l.rid, reviewNote: `E2E matrix loser reject ${stamp}` },
            adminToken,
          ).catch(() => undefined);
        }
      }

      expect(
        failures,
        `matrix conflict failures:\n${failures
          .map((f) => `  - ${f.cell.resourceId} @ ${f.cell.date} ${f.cell.time}: ${f.reason}`)
          .join("\n")}`,
      ).toHaveLength(0);
    } finally {
      // Tear down the matrix link (cleanup fixture handles requests/events).
      await http
        .call(
          "matrix-delete-link",
          "DELETE",
          `${REST_URL}/public_booking_links?id=eq.${matrixLink.id}`,
          { headers: adminHeaders(adminToken) },
        )
        .catch(() => undefined);
    }
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
