import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonObject = Record<string, unknown>;
type NormalizedConsultationItem = {
  item_name: string | null;
  material_quality_id: string | null;
  material_name: string | null;
  width: string | null;
  height: string | null;
  thickness: string | null;
  quantity: string | null;
  unit: string | null;
  color_option_id: string | null;
  color_name: string | null;
  color_code: string | null;
  sheet_size: string | null;
  processing_options: string[];
  memo: string | null;
  sort_order: number;
};

type ConsultationType = "sheet_purchase" | "fabrication" | "design";

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
const ALLOWED_CONSULTATION_TYPES = new Set<ConsultationType>(["sheet_purchase", "fabrication", "design"]);

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
  return value.trim().split("\u0000").join("").slice(0, limit);
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

function normalizeConsultationType(value: unknown): ConsultationType {
  const next = text(value, 80) as ConsultationType;
  return ALLOWED_CONSULTATION_TYPES.has(next) ? next : "fabrication";
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

function missingFields(payload: JsonObject, consultationType: ConsultationType, items: NormalizedConsultationItem[]) {
  const missing: string[] = [];
  if (!text(payload.customerName, 100)) missing.push("담당자명");
  if (!text(payload.customerPhone, 60)) missing.push("연락처");
  if (!text(payload.consultationType, 80)) missing.push("문의 유형");
  if (consultationType === "sheet_purchase") {
    const hasMaterial = text(payload.materialQualityId, 120) || items.some((item) => item.material_quality_id);
    const hasQuantity = text(payload.quantity, 120) || items.some((item) => item.quantity);
    if (!hasMaterial) missing.push("소재");
    if (!hasQuantity) missing.push("수량");
  }
  if (consultationType === "fabrication") {
    const hasProduction = text(payload.productType, 120) || text(payload.productPurpose, 120) || items.length > 0;
    if (!hasProduction) missing.push("제작 품목");
  }
  if (consultationType === "design") {
    const hasDesignPurpose = text(payload.productPurpose, 120) || text(payload.productType, 120);
    if (!hasDesignPurpose) missing.push("디자인 목적");
  }
  if (!text(payload.inquiryBody, 4000)) missing.push("문의 내용");
  return missing;
}

function normalizeItems(value: unknown): NormalizedConsultationItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 30)
    .map((item, index) => {
      const record = asObject(item);
      const processing = Array.isArray(record.processingOptions)
        ? record.processingOptions.map((option) => text(option, 80)).filter(Boolean).slice(0, 20)
        : [];
      return {
        item_name: optionalText(record.itemName ?? record.item_name, 160),
        material_quality_id: optionalText(record.materialQualityId ?? record.material_quality_id, 120),
        material_name: optionalText(record.materialName ?? record.material_name, 160),
        width: optionalText(record.width, 80),
        height: optionalText(record.height, 80),
        thickness: optionalText(record.thickness, 80),
        quantity: optionalText(record.quantity, 80),
        unit: optionalText(record.unit, 40),
        color_option_id: optionalText(record.colorOptionId ?? record.color_option_id, 120),
        color_name: optionalText(record.colorName ?? record.color_name, 120),
        color_code: optionalText(record.colorCode ?? record.color_code, 80),
        sheet_size: optionalText(record.sheetSize ?? record.sheet_size, 120),
        processing_options: processing,
        memo: optionalText(record.memo, 500),
        sort_order: Number.isFinite(Number(record.sortOrder ?? record.sort_order))
          ? Number(record.sortOrder ?? record.sort_order)
          : index,
      };
    })
    .filter((item) => [
      item.item_name,
      item.material_name,
      item.width,
      item.height,
      item.thickness,
      item.quantity,
      item.color_name,
      item.sheet_size,
      item.memo,
      item.processing_options.length ? "processing" : "",
    ].some(Boolean));
}

function itemSummary(items: NormalizedConsultationItem[]) {
  return items
    .map((item, index) => {
      const size = [item.width, item.height, item.thickness].filter(Boolean).join(" x ");
      return [
        `${index + 1}. ${item.item_name || "품목"}`,
        item.material_name,
        size,
        item.quantity ? `수량 ${item.quantity}${item.unit || ""}` : "",
        item.color_name ? `컬러 ${item.color_name}${item.color_code ? ` (${item.color_code})` : ""}` : "",
        item.sheet_size ? `원장 ${item.sheet_size}` : "",
        item.memo,
      ].filter(Boolean).join(" / ");
    })
    .join("\n");
}

function qualityScore(payload: JsonObject, files: JsonObject[], items: NormalizedConsultationItem[], consultationType: ConsultationType) {
  let score = 0;
  if (text(payload.customerName, 100)) score += 10;
  if (text(payload.customerPhone, 80)) score += 10;
  if (text(payload.customerCompany, 160)) score += 5;
  if (text(payload.projectName, 160)) score += 5;
  if (consultationType) score += 10;
  if (text(payload.productType, 120) || text(payload.productPurpose, 120)) score += 10;
  if (text(payload.materialName, 160) || items.some((item) => item.material_name)) score += 10;
  if (text(payload.thickness, 80) || items.some((item) => item.thickness)) score += 5;
  if (text(payload.colorName, 120) || items.some((item) => item.color_name)) score += 5;
  if (consultationType === "sheet_purchase" && (text(payload.sheetSize, 120) || items.some((item) => item.sheet_size))) score += 10;
  if (items.length > 0) score += 20;
  if (items.some((item) => item.width && item.height)) score += 10;
  if (items.some((item) => item.quantity)) score += 10;
  if (text(payload.inquiryBody, 5000).length >= 20) score += 10;
  if (files.length > 0) score += 10;
  if (text(payload.desiredDeliveryDate, 20)) score += 5;
  if (text(payload.deliveryAddress, 500)) score += 5;
  return Math.max(0, Math.min(100, score));
}

function buildSummary(payload: JsonObject) {
  return [
    payload.consultationType,
    payload.customerCompany,
    payload.customerName,
    payload.materialName || payload.acrylicType,
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
      consultationType: normalizeConsultationType(payload.consultationType),
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

  const files = Array.isArray(payload.files) ? payload.files.map(asObject).slice(0, MAX_FILES) : [];
  const items = normalizeItems(payload.items);
  const consultationType = normalizeConsultationType(payload.consultationType);
  const missing = missingFields(payload, consultationType, items);
  if (missing.length > 0) {
    return fail(origin, `필수 입력값이 부족합니다: ${missing.join(", ")}`, 400, { missingFields: missing });
  }

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
  const source = normalizeSource(payload.source);
  const submissionToken = optionalText(payload.submissionToken, 120);
  if (submissionToken) {
    const { data: existingLead, error: existingError } = await supabase
      .from("client_consultation_leads")
      .select("id")
      .eq("source", source)
      .eq("submission_token", submissionToken)
      .maybeSingle();
    if (existingError) return fail(origin, `중복 제출 확인 실패: ${existingError.message}`, 500);
    if (existingLead?.id) {
      return ok(origin, { success: true, leadId: existingLead.id, duplicate: true });
    }
  }

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
    source,
    consultation_type: consultationType,
    status: "new",
    priority: "normal",
    response_status: "not_contacted",
    submission_token: submissionToken,
    quality_score: qualityScore(payload, files, items, consultationType),
    customer_company: optionalText(payload.customerCompany, 160),
    customer_name: text(payload.customerName, 100),
    customer_position: optionalText(payload.customerPosition, 80),
    customer_phone: text(payload.customerPhone, 80),
    customer_email: optionalText(payload.customerEmail, 160),
    project_name: optionalText(payload.projectName, 160),
    product_type: optionalText(payload.productType, 120),
    acrylic_type: optionalText(payload.acrylicType, 120) || optionalText(payload.materialName, 160),
    color_name: optionalText(payload.colorName, 120),
    color_code: optionalText(payload.colorCode, 80),
    thickness: optionalText(payload.thickness, 80),
    sheet_size: optionalText(payload.sheetSize, 120),
    quantity: optionalText(payload.quantity, 120),
    dimensions: optionalText(payload.dimensions, 500) || (items.length ? itemSummary(items).slice(0, 500) : null),
    processing: Array.isArray(payload.processing)
      ? payload.processing.map((value) => text(value, 80)).filter(Boolean).slice(0, 20)
      : [],
    inquiry_body: text(payload.inquiryBody, 5000),
    desired_delivery_date: optionalText(payload.desiredDeliveryDate, 20),
    delivery_address: optionalText(payload.deliveryAddress, 500),
    privacy_consent: true,
    marketing_consent: toBool(payload.marketingConsent),
    missing_fields: missing,
    raw_payload: {
      ...payload,
      items,
    },
    submitter_ip_hash: ipHash,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
  };

  const { data: lead, error: leadError } = await supabase
    .from("client_consultation_leads")
    .insert(row)
    .select("id")
    .single();
  if (leadError) return fail(origin, `상담 리드 저장 실패: ${leadError.message}`, 500);

  if (items.length > 0) {
    const itemRows = items.map((item) => ({
      lead_id: lead.id,
      ...item,
    }));
    const { error: itemError } = await supabase.from("client_consultation_items").insert(itemRows);
    if (itemError) return fail(origin, `품목 정보 저장 실패: ${itemError.message}`, 500, { leadId: lead.id });
  }

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
    await supabase.from("client_consultation_events").insert({
      lead_id: lead.id,
      event_type: "submitted",
      note: "상담폼이 접수되었습니다.",
      metadata: {
        source,
        consultationType,
        itemCount: items.length,
        fileCount: files.length,
        qualityScore: row.quality_score,
      },
    });
    await notifyReviewers(supabase, lead.id, payload);
  } catch (error) {
    console.warn("client consultation post-submit side effect failed", error);
  }

  return ok(origin, { success: true, leadId: lead.id });
});
