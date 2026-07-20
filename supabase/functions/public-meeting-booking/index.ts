import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonObject = Record<string, unknown>;
type PublicBookingLink = {
  id: string;
  slug: string;
  link_type: "customer_request" | "partner_room";
  title: string;
  description: string | null;
  is_active: boolean;
  allowed_resource_ids: string[];
  allowed_weekdays: number[];
  start_time: string;
  end_time: string;
  slot_minutes: number;
  duration_minutes: number;
  buffer_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  requires_approval: boolean;
  access_code_hash: string | null;
  notify_user_ids: string[];
};
type CalendarResource = {
  id: string;
  name: string;
  floor: string | null;
  display_order: number;
};
type PublicBookingRequest = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  resource_id: string;
  requester_name: string;
  company_name: string | null;
  purpose: string;
};

const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_REQUESTS = 20;

function getEnv(name: string, required = true) {
  const value = Deno.env.get(name);
  if (required && !value) throw new Error(`${name} is not configured`);
  return value || "";
}

function getServiceClient() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

function getAllowedOrigins() {
  const configured = Deno.env.get("PUBLIC_BOOKING_ALLOWED_ORIGINS");
  const values = configured
    ? configured.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [
      "https://acbank.co.kr",
      "https://www.acbank.co.kr",
      "http://localhost:8080",
      "http://127.0.0.1:8080",
      "http://localhost:8081",
      "http://127.0.0.1:8081",
      "http://localhost:8082",
      "http://127.0.0.1:8082",
      "http://localhost:8083",
      "http://127.0.0.1:8083",
      "http://localhost:8084",
      "http://127.0.0.1:8084",
      "http://localhost:8085",
      "http://127.0.0.1:8085",
      "http://localhost:8086",
      "http://127.0.0.1:8086",
      "http://localhost:8090",
      "http://127.0.0.1:8090",
      "http://localhost:8091",
      "http://127.0.0.1:8091",
      "http://localhost:8092",
      "http://127.0.0.1:8092",
      "http://localhost:8093",
      "http://127.0.0.1:8093",
      "http://localhost:8096",
      "http://127.0.0.1:8096",
    ];
  return new Set(values);
}

function isAllowedOrigin(origin: string | null) {
  if (!origin) return true;
  if (getAllowedOrigins().has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.hostname === "localhost"
      || url.hostname === "127.0.0.1"
      || url.hostname.endsWith(".lovable.app")
      || url.hostname.endsWith(".lovableproject.com")
      || url.hostname.endsWith(".lovable.dev");
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) && origin ? origin : "https://acbank.co.kr",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

function ok(origin: string | null, body: JsonObject, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  });
}

function fail(origin: string | null, message: string, status = 400, extra: JsonObject = {}) {
  return ok(origin, { error: message, ...extra }, status);
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function text(value: unknown, limit = 1000) {
  if (typeof value !== "string") return "";
  return value.trim().split("\u0000").join("").slice(0, limit);
}

function optionalText(value: unknown, limit = 1000) {
  const next = text(value, limit);
  return next || null;
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toSeoulDateTime(date: string, time: string) {
  return `${date}T${time.length === 5 ? `${time}:00` : time}+09:00`;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function clockToMinutes(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function minutesToClock(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getDateOnly(value: unknown) {
  const date = text(value, 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function getTimeOnly(value: unknown) {
  const time = text(value, 10);
  return /^\d{2}:\d{2}$/.test(time) ? time : "";
}

function publicLinkResponse(link: PublicBookingLink, resources: CalendarResource[]) {
  return {
    slug: link.slug,
    linkType: link.link_type,
    title: link.title,
    description: link.description,
    isActive: link.is_active,
    requiresApproval: link.requires_approval,
    requiresAccessCode: Boolean(link.access_code_hash),
    rules: {
      allowedWeekdays: link.allowed_weekdays,
      startTime: link.start_time.slice(0, 5),
      endTime: link.end_time.slice(0, 5),
      slotMinutes: link.slot_minutes,
      durationMinutes: link.duration_minutes,
      bufferMinutes: link.buffer_minutes,
      minNoticeMinutes: link.min_notice_minutes,
      maxDaysAhead: link.max_days_ahead,
    },
    resources: resources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      floor: resource.floor,
    })),
  };
}

async function loadLink(supabase: ReturnType<typeof getServiceClient>, slug: string) {
  const { data: link, error } = await supabase
    .from("public_booking_links")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!link) throw new Error("예약 링크를 찾을 수 없습니다.");
  return link as PublicBookingLink;
}

async function loadResources(supabase: ReturnType<typeof getServiceClient>, resourceIds: string[]) {
  if (resourceIds.length === 0) return [];
  const { data, error } = await supabase
    .from("calendar_resources")
    .select("id, name, floor, display_order")
    .in("id", resourceIds)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as CalendarResource[];
}

async function verifyAccessCode(link: PublicBookingLink, accessCode: unknown) {
  if (!link.access_code_hash) return true;
  const next = text(accessCode, 120);
  if (!next) return false;
  return await sha256(next) === link.access_code_hash;
}

function assertLinkUsable(link: PublicBookingLink) {
  if (!link.is_active) throw new Error("비활성화된 예약 링크입니다.");
  if (!Array.isArray(link.allowed_resource_ids) || link.allowed_resource_ids.length === 0) {
    throw new Error("예약 가능한 회의실이 설정되지 않았습니다.");
  }
}

function validateWindow(link: PublicBookingLink, date: string, startsAt: Date, endsAt: Date) {
  if (endsAt <= startsAt) throw new Error("예약 시간이 올바르지 않습니다.");
  const day = new Date(`${date}T00:00:00+09:00`).getDay();
  if (!link.allowed_weekdays.includes(day)) throw new Error("예약 가능한 요일이 아닙니다.");

  const now = new Date();
  const minStart = addMinutes(now, link.min_notice_minutes);
  if (startsAt < minStart) throw new Error("예약 가능한 사전 예약 시간이 지났습니다.");

  const maxStart = addMinutes(now, link.max_days_ahead * 24 * 60);
  if (startsAt > maxStart) throw new Error("예약 가능 기간을 벗어났습니다.");

  const startClock = Number.isFinite(startsAt.getTime()) ? startsAt.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) : "";
  const endClock = Number.isFinite(endsAt.getTime()) ? endsAt.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) : "";
  if (startClock < link.start_time.slice(0, 5) || endClock > link.end_time.slice(0, 5)) {
    throw new Error("예약 가능한 시간을 벗어났습니다.");
  }
}

async function findConflict(
  supabase: ReturnType<typeof getServiceClient>,
  resourceIds: string[],
  startsAt: string,
  endsAt: string,
) {
  const { data, error } = await supabase.rpc("get_calendar_resource_conflict", {
    _resource_ids: resourceIds,
    _starts_at: startsAt,
    _ends_at: endsAt,
    _exclude_event_id: null,
  });
  if (error) throw error;
  return typeof data === "string" && data ? data : null;
}

async function checkRateLimit(
  supabase: ReturnType<typeof getServiceClient>,
  linkId: string,
  ipHash: string,
) {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const { count, error } = await supabase
    .from("public_booking_requests")
    .select("id", { count: "exact", head: true })
    .eq("link_id", linkId)
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if (error) throw error;
  if ((count || 0) >= RATE_LIMIT_MAX_REQUESTS) {
    throw new Error("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
  }
}

async function notifyTargets(
  supabase: ReturnType<typeof getServiceClient>,
  link: PublicBookingLink,
  request: PublicBookingRequest,
  kind: "pending" | "confirmed" | "rejected",
) {
  const targetIds = new Set<string>(Array.isArray(link.notify_user_ids) ? link.notify_user_ids : []);
  if (targetIds.size === 0) {
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "moderator"]);
    if (error) throw error;
    (roles || []).forEach((role: { user_id: string }) => targetIds.add(role.user_id));
  }

  if (targetIds.size === 0) return;

  const title = kind === "pending"
    ? "외부 예약 요청이 접수되었습니다"
    : kind === "confirmed"
    ? "외부 회의실 예약이 확정되었습니다"
    : "외부 예약 요청이 거절되었습니다";
  const description = `${request.company_name || request.requester_name} / ${new Date(request.starts_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`;

  const rows = [...targetIds].map((userId) => ({
    user_id: userId,
    type: "public_booking_request",
    title,
    description,
    data: {
      publicBookingRequestId: request.id,
      publicBookingLinkId: link.id,
      status: request.status,
    },
    dedupe_key: `public-booking:${request.id}`,
  }));

  const { error } = await supabase
    .from("notifications")
    .upsert(rows, { onConflict: "user_id,type,dedupe_key" });
  if (error) console.error("Failed to insert public booking notifications", error);
}

async function requireAdminOrModerator(req: Request, supabase: ReturnType<typeof getServiceClient>) {
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("로그인이 필요합니다.");

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) throw new Error("로그인이 필요합니다.");

  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", authData.user.id)
    .in("role", ["admin", "moderator"]);
  if (roleError) throw roleError;
  if (!roles || roles.length === 0) throw new Error("관리자 권한이 필요합니다.");

  return authData.user.id;
}

async function handleGetLink(origin: string | null, body: JsonObject, supabase: ReturnType<typeof getServiceClient>) {
  const slug = text(body.slug, 100);
  if (!slug) return fail(origin, "예약 링크가 필요합니다.", 400);
  const link = await loadLink(supabase, slug);
  assertLinkUsable(link);
  const resources = await loadResources(supabase, link.allowed_resource_ids || []);
  return ok(origin, { link: publicLinkResponse(link, resources) });
}

async function handleAvailability(origin: string | null, body: JsonObject, supabase: ReturnType<typeof getServiceClient>) {
  const slug = text(body.slug, 100);
  const date = getDateOnly(body.date);
  if (!slug || !date) return fail(origin, "예약 링크와 날짜가 필요합니다.", 400);

  const link = await loadLink(supabase, slug);
  assertLinkUsable(link);
  if (!(await verifyAccessCode(link, body.accessCode))) return fail(origin, "접근 코드가 올바르지 않습니다.", 403);

  const resources = await loadResources(supabase, link.allowed_resource_ids || []);
  const startMinutes = clockToMinutes(link.start_time);
  const endMinutes = clockToMinutes(link.end_time);
  const slots = [];

  for (const resource of resources) {
    for (let cursor = startMinutes; cursor + link.duration_minutes <= endMinutes; cursor += link.slot_minutes) {
      const startsAt = new Date(toSeoulDateTime(date, minutesToClock(cursor)));
      const endsAt = addMinutes(startsAt, link.duration_minutes);
      try {
        validateWindow(link, date, startsAt, endsAt);
        const conflict = await findConflict(supabase, [resource.id], startsAt.toISOString(), endsAt.toISOString());
        if (!conflict) {
          slots.push({
            resourceId: resource.id,
            resourceName: resource.name,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            time: minutesToClock(cursor),
            label: `${minutesToClock(cursor)} - ${minutesToClock(cursor + link.duration_minutes)}`,
          });
        }
      } catch {
        // Exclude invalid or unavailable slots.
      }
    }
  }

  return ok(origin, { slots });
}

async function handleCreateRequest(req: Request, origin: string | null, body: JsonObject, supabase: ReturnType<typeof getServiceClient>) {
  const slug = text(body.slug, 100);
  const date = getDateOnly(body.date);
  const time = getTimeOnly(body.time);
  const resourceId = text(body.resourceId, 80);
  if (!slug || !date || !time || !resourceId) return fail(origin, "예약 날짜, 시간, 회의실을 선택해주세요.", 400);

  const link = await loadLink(supabase, slug);
  assertLinkUsable(link);
  if (!(await verifyAccessCode(link, body.accessCode))) return fail(origin, "접근 코드가 올바르지 않습니다.", 403);
  if (!link.allowed_resource_ids.includes(resourceId)) return fail(origin, "예약 가능한 회의실이 아닙니다.", 400);

  const startsAt = new Date(toSeoulDateTime(date, time));
  const endsAt = addMinutes(startsAt, link.duration_minutes);
  validateWindow(link, date, startsAt, endsAt);

  const requesterName = text(body.requesterName, 80);
  const purpose = text(body.purpose, 500);
  if (!requesterName) return fail(origin, "예약자 이름을 입력해주세요.", 400);
  if (!purpose) return fail(origin, "예약 목적을 입력해주세요.", 400);

  const ipHash = await sha256(`${getClientIp(req)}:${slug}`);
  await checkRateLimit(supabase, link.id, ipHash);

  const conflict = await findConflict(supabase, [resourceId], startsAt.toISOString(), endsAt.toISOString());
  if (conflict) return fail(origin, `이미 예약된 회의실입니다: ${conflict}`, 409);

  const { data: requestRow, error: insertError } = await supabase
    .from("public_booking_requests")
    .insert({
      link_id: link.id,
      status: "pending_review",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      resource_id: resourceId,
      requester_name: requesterName,
      company_name: optionalText(body.companyName, 120),
      phone: optionalText(body.phone, 80),
      email: optionalText(body.email, 160),
      purpose,
      notes: optionalText(body.notes, 1000),
      ip_hash: ipHash,
      user_agent: text(req.headers.get("user-agent") || "", 500),
      metadata: {
        source: "public_booking_link",
        link_slug: link.slug,
        link_type: link.link_type,
      },
    })
    .select("id, status, starts_at, ends_at, resource_id, requester_name, company_name, purpose")
    .single();
  if (insertError) throw insertError;

  let nextStatus = "pending_review";
  if (!link.requires_approval) {
    const { error: confirmError } = await supabase.rpc("confirm_public_booking_request", {
      _request_id: requestRow.id,
      _reviewer_id: null,
      _review_note: "공유회사 전용 링크 자동 확정",
    });
    if (confirmError) throw confirmError;
    nextStatus = "confirmed";
  }

  const requestForNotification = { ...requestRow, status: nextStatus } as PublicBookingRequest;
  await notifyTargets(supabase, link, requestForNotification, nextStatus === "confirmed" ? "confirmed" : "pending");

  return ok(origin, {
    requestId: requestRow.id,
    status: nextStatus,
    requiresApproval: link.requires_approval,
  });
}

async function handleConfirmRequest(req: Request, origin: string | null, body: JsonObject, supabase: ReturnType<typeof getServiceClient>) {
  const reviewerId = await requireAdminOrModerator(req, supabase);
  const requestId = text(body.requestId, 80);
  if (!requestId) return fail(origin, "예약 요청 ID가 필요합니다.", 400);

  const { data: eventId, error } = await supabase.rpc("confirm_public_booking_request", {
    _request_id: requestId,
    _reviewer_id: reviewerId,
    _review_note: optionalText(body.reviewNote, 300),
  });
  if (error) throw error;

  const { data: requestRow } = await supabase
    .from("public_booking_requests")
    .select("id, status, starts_at, ends_at, resource_id, requester_name, company_name, purpose, public_booking_links(*)")
    .eq("id", requestId)
    .maybeSingle();
  const link = asObject(requestRow?.public_booking_links) as unknown as PublicBookingLink;
  if (requestRow && link?.id) await notifyTargets(supabase, link, requestRow as PublicBookingRequest, "confirmed");

  return ok(origin, { eventId, status: "confirmed" });
}

async function handleRejectRequest(req: Request, origin: string | null, body: JsonObject, supabase: ReturnType<typeof getServiceClient>) {
  const reviewerId = await requireAdminOrModerator(req, supabase);
  const requestId = text(body.requestId, 80);
  if (!requestId) return fail(origin, "예약 요청 ID가 필요합니다.", 400);
  const reviewNote = text(body.reviewNote, 500);
  if (!reviewNote) return fail(origin, "거절 사유를 입력해주세요.", 400);

  const { data: requestRow, error } = await supabase
    .from("public_booking_requests")
    .update({
      status: "rejected",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote,
    })
    .eq("id", requestId)
    .in("status", ["pending_review"])
    .select("id, status, starts_at, ends_at, resource_id, requester_name, company_name, purpose, public_booking_links(*)")
    .maybeSingle();
  if (error) throw error;
  if (!requestRow) return fail(origin, "거절할 수 있는 예약 요청을 찾을 수 없습니다.", 404);

  const link = asObject(requestRow.public_booking_links) as unknown as PublicBookingLink;
  if (link?.id) await notifyTargets(supabase, link, requestRow as PublicBookingRequest, "rejected");

  return ok(origin, { status: "rejected" });
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return fail(origin, "Method not allowed", 405);

  try {
    const supabase = getServiceClient();
    const body = asObject(await req.json().catch(() => ({})));
    const action = text(body.action, 80);

    if (action === "get-link") return await handleGetLink(origin, body, supabase);
    if (action === "get-availability") return await handleAvailability(origin, body, supabase);
    if (action === "create-request") return await handleCreateRequest(req, origin, body, supabase);
    if (action === "confirm-request") return await handleConfirmRequest(req, origin, body, supabase);
    if (action === "reject-request") return await handleRejectRequest(req, origin, body, supabase);

    return fail(origin, "지원하지 않는 요청입니다.", 400);
  } catch (error) {
    console.error("public-meeting-booking failed", error);
    return fail(origin, error instanceof Error ? error.message : "예약 처리에 실패했습니다.", 500);
  }
});
