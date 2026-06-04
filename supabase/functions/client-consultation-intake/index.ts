import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonObject = Record<string, unknown>;

const BUCKET = "client-consultation-attachments";
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 6;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_SUBMISSIONS = 5;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "pdf", "zip", "doc", "docx", "xls", "xlsx"]);
const ALLOWED_SOURCES = new Set(["imweb-acbankform", "internal-test", "manual"]);

function getEnv(name: string, required = true): string {
  const value = Deno.env.get(name);
  if (required && !value) throw new Error(`${name} is not configured`);
  return value || "";
}

function getServiceClient() {
  return createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

function getAllowedOrigins() {
  const configured = Deno.env.get("CLIENT_CONSULTATION_ALLOWED_ORIGINS");
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
  return value.trim().replace(/\u0000/g, "").slice(0, limit);
}

function optionalText(value: unknown, limit = 1000) {
  const next = text(value, limit);
  return next || null;
}

function toBool(value: unknown) {
  return value === true || value === "true";
}

function getExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

function safeFileName(fileName: string) {
  const cleaned = fileName
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._ -]+/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || "attachment";
}

function validateFile(file: JsonObject) {
  const fileName = text(file.fileName, 180);
  const mimeType = text(file.mimeType, 160);
  const fileSize = Number(file.fileSize || 0);
  const extension = getExtension(fileName);
  if (!fileName) return "파일명이 없습니다.";
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) return "파일 용량은 20MB 이하만 가능합니다.";
  if (!ALLOWED_MIME_TYPES.has(mimeType) && !ALLOWED_EXTENSIONS.has(extension)) return "허용되지 않은 파일 형식입니다.";
  return null;
}

function normalizeSource(value: unknown) {
  const source = text(value, 80) || "imweb-acbankform";
  return ALLOWED_SOURCES.has(source) ? source : "imweb-acbankform";
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

function missingFields(payload: JsonObject) {
  const missing: string[] = [];
  if (!text(payload.customerName, 100)) missing.push("담당자명");
  if (!text(payload.customerPhone, 60)) missing.push("연락처");
  if (!text(payload.inquiryBody, 4000)) missing.push("문의 내용");
  return missing;
}

function buildSummary(payload: JsonObject) {
  return [
    payload.customerCompany,
    payload.customerName,
    payload.acrylicType,
    payload.dimensions,
    payload.quantity,
  ].map((value) => text(value, 120)).filter(Boolean).join(" · ");
}

async function notifyReviewers(supabase: ReturnType<typeof getServiceClient>, leadId: string, payload: JsonObject) {
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["admin", "moderator", "manager"]);
  if (error) throw error;

  const userIds = Array.from(new Set((roles || []).map((row: { user_id: string }) => row.user_id).filter(Boolean)));
  if (userIds.length === 0) return;

  const customer = text(payload.customerCompany, 120) || text(payload.customerName, 80) || "고객";
  const summary = buildSummary(payload) || text(payload.inquiryBody, 120);
  const rows = userIds.map((userId) => ({
    user_id: userId,
    type: "client_consultation_lead",
    title: "새 아임웹 상담폼 문의",
    description: `${customer} 상담폼이 접수되었습니다.${summary ? ` ${summary}` : ""}`,
    data: {
      leadId,
      source: text(payload.source, 80) || "imweb-acbankform",
      customerCompany: text(payload.customerCompany, 120),
      customerName: text(payload.customerName, 80),
    },
    dedupe_key: `client-consultation-lead:${leadId}`,
    is_read: false,
  }));

  const { error: notificationError } = await supabase
    .from("notifications")
    .upsert(rows, {
      onConflict: "user_id,type,dedupe_key",
      ignoreDuplicates: false,
    });
  if (notificationError) throw notificationError;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return fail(origin, "Method not allowed", 405);
  if (!isAllowedOrigin(origin)) return fail(origin, "허용되지 않은 요청 출처입니다.", 403);

  let body: JsonObject;
  try {
    body = await req.json();
  } catch {
    return fail(origin, "JSON 요청만 지원합니다.", 400);
  }

  const action = text(body.action, 80);
  const payload = asObject(body.payload);
  const supabase = getServiceClient();

  if (action === "create-upload-url") {
    const fileError = validateFile(payload);
    if (fileError) return fail(origin, fileError, 400);

    const source = normalizeSource(payload.source);
    const fileName = safeFileName(text(payload.fileName, 180));
    const filePath = `public-intake/${source}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${fileName}`;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(filePath);
    if (error) return fail(origin, `업로드 URL 생성 실패: ${error.message}`, 500);

    return ok(origin, {
      bucket: BUCKET,
      path: filePath,
      token: data.token,
      signedUrl: data.signedUrl,
    });
  }

  if (action !== "submit") return fail(origin, "지원하지 않는 action입니다.", 400);

  if (text(payload.website, 200)) {
    return ok(origin, { success: true, ignored: true });
  }

  if (!toBool(payload.privacyConsent)) {
    return fail(origin, "개인정보 수집·이용 동의가 필요합니다.", 400);
  }

  const missing = missingFields(payload);
  if (missing.length > 0) {
    return fail(origin, `필수 입력값이 부족합니다: ${missing.join(", ")}`, 400, { missingFields: missing });
  }

  const files = Array.isArray(payload.files) ? payload.files.map(asObject).slice(0, MAX_FILES) : [];
  for (const file of files) {
    const fileError = validateFile({
      fileName: file.fileName || file.name,
      mimeType: file.mimeType || file.type,
      fileSize: file.fileSize || file.size,
    });
    if (fileError) return fail(origin, fileError, 400);
    const path = text(file.storagePath || file.path, 500);
    if (!path.startsWith("public-intake/")) return fail(origin, "잘못된 첨부파일 경로입니다.", 400);
  }

  const ipHash = await sha256(`${getClientIp(req)}:${Deno.env.get("CLIENT_CONSULTATION_HASH_SALT") || "acbank-client-consultation"}`);
  const rateLimitSince = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count, error: rateLimitError } = await supabase
    .from("client_consultation_leads")
    .select("id", { count: "exact", head: true })
    .eq("submitter_ip_hash", ipHash)
    .gte("created_at", rateLimitSince);
  if (rateLimitError) return fail(origin, `제출 제한 확인 실패: ${rateLimitError.message}`, 500);
  if ((count || 0) >= RATE_LIMIT_MAX_SUBMISSIONS) {
    return fail(origin, "짧은 시간에 너무 많은 상담이 접수되었습니다. 잠시 후 다시 시도해주세요.", 429);
  }

  const row = {
    source: normalizeSource(payload.source),
    status: "new",
    customer_company: optionalText(payload.customerCompany, 160),
    customer_name: text(payload.customerName, 100),
    customer_position: optionalText(payload.customerPosition, 80),
    customer_phone: text(payload.customerPhone, 80),
    customer_email: optionalText(payload.customerEmail, 160),
    project_name: optionalText(payload.projectName, 160),
    product_type: optionalText(payload.productType, 120),
    acrylic_type: optionalText(payload.acrylicType, 120),
    color_name: optionalText(payload.colorName, 120),
    color_code: optionalText(payload.colorCode, 80),
    thickness: optionalText(payload.thickness, 80),
    sheet_size: optionalText(payload.sheetSize, 120),
    quantity: optionalText(payload.quantity, 120),
    dimensions: optionalText(payload.dimensions, 500),
    processing: Array.isArray(payload.processing)
      ? payload.processing.map((value) => text(value, 80)).filter(Boolean).slice(0, 20)
      : [],
    inquiry_body: text(payload.inquiryBody, 5000),
    desired_delivery_date: optionalText(payload.desiredDeliveryDate, 20),
    delivery_address: optionalText(payload.deliveryAddress, 500),
    privacy_consent: true,
    marketing_consent: toBool(payload.marketingConsent),
    missing_fields: missing,
    raw_payload: payload,
    submitter_ip_hash: ipHash,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
  };

  const { data: lead, error: leadError } = await supabase
    .from("client_consultation_leads")
    .insert(row)
    .select("id")
    .single();
  if (leadError) return fail(origin, `상담 리드 저장 실패: ${leadError.message}`, 500);

  if (files.length > 0) {
    const fileRows = files.map((file) => ({
      lead_id: lead.id,
      file_name: text(file.fileName || file.name, 180),
      storage_bucket: BUCKET,
      storage_path: text(file.storagePath || file.path, 500),
      mime_type: optionalText(file.mimeType || file.type, 160),
      file_size: Number(file.fileSize || file.size || 0),
      metadata: {
        source: row.source,
        uploadedAt: file.uploadedAt || new Date().toISOString(),
      },
    }));
    const { error: filesError } = await supabase.from("client_consultation_files").insert(fileRows);
    if (filesError) return fail(origin, `첨부파일 연결 실패: ${filesError.message}`, 500, { leadId: lead.id });
  }

  try {
    await notifyReviewers(supabase, lead.id, payload);
  } catch (error) {
    console.warn("client consultation notification failed", error);
  }

  return ok(origin, { success: true, leadId: lead.id });
});
