import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonObject = Record<string, unknown>;

const BUCKET = "branding-intake-attachments";
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 8;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_SUBMISSIONS = 5;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf", "zip", "doc", "docx", "xls", "xlsx"]);
const ALLOWED_SOURCES = new Set(["branding-intake", "internal-test", "manual"]);

const PACKAGE_PRICE: Record<string, { label: string; price: number; note: string }> = {
  basic: { label: "브랜드 기본형", price: 220, note: "기초 방향성, 톤앤매너, 주요 시각 기준 정리" },
  standard: { label: "브랜드 런칭형", price: 440, note: "브랜드 시스템, 응용 가이드, 주요 매체 기준 정리" },
  open: { label: "브랜드 오픈형", price: 880, note: "공간/사인/콘텐츠까지 확장되는 통합 브랜딩" },
};

const LEAD_TIME_RATE: Record<string, { label: string; rate: number }> = {
  normal: { label: "일반 납기", rate: 0 },
  fast: { label: "빠른 납기", rate: 0.15 },
  urgent: { label: "긴급 납기", rate: 0.3 },
};

const OPTIMIZATION_PRICE: Record<string, { label: string; price: number }> = {
  none: { label: "선택 안 함", price: 0 },
  basic: { label: "기본 검색 최적화", price: 120 },
  launch: { label: "런칭 최적화", price: 240 },
  expand: { label: "SEO/AEO/GEO 확장", price: 420 },
};

const ADDON_PRICE: Record<string, { label: string; price: number; review?: boolean }> = {
  story: { label: "브랜드 스토리 보강", price: 80 },
  prints: { label: "인쇄물 2종 디자인", price: 120 },
  signageBasicDesign: { label: "기본 사인 디자인", price: 120 },
  signageComplexDesign: { label: "복합 사인 디자인", price: 240, review: true },
  standingSignDesign: { label: "입간판/스탠딩 사인", price: 90 },
  webConcept: { label: "웹 컨셉 보드", price: 160 },
  webDesign: { label: "웹 상세 디자인", price: 280, review: true },
  webOpen: { label: "웹 오픈 지원", price: 0, review: true },
  webAiImages: { label: "AI 이미지 추가 제작", price: 60 },
  packageGoodsProduction: { label: "패키지/굿즈 제작 검토", price: 0, review: true },
};

function getEnv(name: string, required = true): string {
  const value = Deno.env.get(name);
  if (required && !value) throw new Error(`${name} is not configured`);
  return value || "";
}

function getServiceClient() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

function getAllowedOrigins() {
  const configured = Deno.env.get("BRANDING_INTAKE_ALLOWED_ORIGINS");
  const values = configured
    ? configured.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [
      "https://acbank.co.kr",
      "https://www.acbank.co.kr",
      "https://acbanksysver2.lovable.app",
      "http://localhost:8080",
      "http://127.0.0.1:8080",
      "http://localhost:8081",
      "http://127.0.0.1:8081",
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
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
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

function safeStorageFileName(fileName: string) {
  const extension = getExtension(fileName);
  const baseName = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80)
    || "attachment";
  return extension ? `${baseName}.${extension}` : baseName;
}

function normalizeSource(value: unknown) {
  const source = text(value, 80) || "branding-intake";
  return ALLOWED_SOURCES.has(source) ? source : "branding-intake";
}

function normalizeId(value: unknown, allowed: Record<string, unknown>, fallback: string) {
  const next = text(value, 80);
  return Object.prototype.hasOwnProperty.call(allowed, next) ? next : fallback;
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

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

function formatPrice(value: number) {
  const rounded = Math.max(0, Math.round(value / 10) * 10);
  return `${rounded.toLocaleString("ko-KR")}만 원 내외`;
}

function selectedAddons(value: unknown) {
  const values = Array.isArray(value) ? value : [];
  return values
    .map((addon) => text(addon, 80))
    .filter((addon) => Object.prototype.hasOwnProperty.call(ADDON_PRICE, addon))
    .slice(0, 30);
}

function calculatePricing(payload: JsonObject) {
  const packageId = normalizeId(payload.packageId, PACKAGE_PRICE, "basic");
  const leadTimeId = normalizeId(payload.leadTimeId, LEAD_TIME_RATE, "normal");
  const optimizationTierId = normalizeId(payload.optimizationTierId, OPTIMIZATION_PRICE, "none");
  const addons = selectedAddons(payload.selectedAddons);
  const packageInfo = PACKAGE_PRICE[packageId];
  const leadTimeInfo = LEAD_TIME_RATE[leadTimeId];
  const optimizationInfo = OPTIMIZATION_PRICE[optimizationTierId];

  const addonRows = addons.map((id) => ({ id, ...ADDON_PRICE[id] }));
  const addonTotal = addonRows.reduce((sum, addon) => sum + addon.price, 0);
  const subtotal = packageInfo.price + optimizationInfo.price + addonTotal;
  const leadTimeSurcharge = Math.round(subtotal * leadTimeInfo.rate);
  const designSubtotal = subtotal + leadTimeSurcharge;
  const pmRate = Number(payload.pmRate ?? 0.1);
  const pmCost = Math.round(designSubtotal * (Number.isFinite(pmRate) ? pmRate : 0.1));
  const internalTotal = designSubtotal + pmCost;
  const separateReviewItems = addonRows.filter((addon) => addon.review).map((addon) => addon.label);

  const customerMessage = [
    `${packageInfo.label} 기준 예상 범위는 ${formatPrice(designSubtotal)}입니다.`,
    "제작비, 인쇄비, 시공비, 제품 제작비는 실제 사양 확인 후 별도 안내됩니다.",
    separateReviewItems.length > 0 ? `별도 검토 항목: ${separateReviewItems.join(", ")}` : "",
    "최종 견적은 자료 확인 후 조정될 수 있습니다.",
  ].filter(Boolean).join("\n");

  const internalBreakdown = [
    `패키지: ${packageInfo.label} ${packageInfo.price}만 원`,
    `검색/AI 최적화: ${optimizationInfo.label} ${optimizationInfo.price}만 원`,
    addonRows.length ? `추가 옵션: ${addonRows.map((addon) => `${addon.label} ${addon.price ? `${addon.price}만 원` : "별도"}`).join(", ")}` : "추가 옵션: 없음",
    `납기 가산: ${leadTimeInfo.label} ${leadTimeSurcharge}만 원`,
    `디자인/전략 소계: ${designSubtotal}만 원`,
    `PM 참고 비용: ${pmCost}만 원`,
    `내부 참고 총액: ${internalTotal}만 원`,
    separateReviewItems.length ? `별도 검토 필요: ${separateReviewItems.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  return {
    packageId,
    packageLabel: packageInfo.label,
    leadTimeId,
    leadTimeLabel: leadTimeInfo.label,
    optimizationTierId,
    optimizationLabel: optimizationInfo.label,
    selectedAddons: addonRows,
    designSubtotal,
    leadTimeSurcharge,
    pmCost,
    internalTotal,
    customerEstimateText: formatPrice(designSubtotal),
    separateReviewItems,
    customerMessage,
    internalBreakdown,
  };
}

async function notifyReviewers(supabase: ReturnType<typeof getServiceClient>, intakeId: string, payload: JsonObject) {
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["admin", "moderator", "manager"]);
  if (error) throw error;

  const userIds = Array.from(new Set((roles || []).map((row: { user_id: string }) => row.user_id).filter(Boolean)));
  if (userIds.length === 0) return;

  const customer = text(payload.customerCompany, 120) || text(payload.customerName, 80) || "고객";
  const project = text(payload.projectName, 120) || "브랜딩 프로젝트";
  const rows = userIds.map((userId) => ({
    user_id: userId,
    type: "branding_intake",
    title: "새 브랜딩 접수",
    description: `${customer} · ${project}`,
    data: {
      intakeId,
      customerCompany: text(payload.customerCompany, 120),
      customerName: text(payload.customerName, 80),
      projectName: text(payload.projectName, 120),
    },
    dedupe_key: `branding-intake:${intakeId}`,
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

    const fileName = safeStorageFileName(safeFileName(text(payload.fileName, 180)));
    const filePath = `public-intake/branding/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${fileName}`;
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

  const missing: string[] = [];
  if (!text(payload.customerName, 100)) missing.push("담당자명");
  if (!text(payload.customerPhone, 80)) missing.push("연락처");
  if (!text(payload.projectName, 160)) missing.push("프로젝트명");
  if (!text(payload.inquiryBody, 5000)) missing.push("문의 내용");
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
    if (!path.startsWith("public-intake/branding/")) return fail(origin, "잘못된 첨부파일 경로입니다.", 400);
  }

  const ipHash = await sha256(`${getClientIp(req)}:${Deno.env.get("BRANDING_INTAKE_HASH_SALT") || "acbank-branding-intake"}`);
  const source = normalizeSource(payload.source);
  const submissionToken = optionalText(payload.submissionToken, 120);
  if (submissionToken) {
    const { data: existing, error: existingError } = await supabase
      .from("branding_intakes")
      .select("id")
      .eq("source", source)
      .eq("submission_token", submissionToken)
      .maybeSingle();
    if (existingError) return fail(origin, `중복 제출 확인 실패: ${existingError.message}`, 500);
    if (existing?.id) return ok(origin, { success: true, intakeId: existing.id, duplicate: true });
  }

  const rateLimitSince = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count, error: rateLimitError } = await supabase
    .from("branding_intakes")
    .select("id", { count: "exact", head: true })
    .eq("submitter_ip_hash", ipHash)
    .gte("created_at", rateLimitSince);
  if (rateLimitError) return fail(origin, `제출 제한 확인 실패: ${rateLimitError.message}`, 500);
  if ((count || 0) >= RATE_LIMIT_MAX_SUBMISSIONS) {
    return fail(origin, "짧은 시간에 너무 많은 브랜딩 문의가 접수되었습니다. 잠시 후 다시 시도해주세요.", 429);
  }

  const pricing = calculatePricing(payload);
  const row = {
    source,
    status: "new",
    submission_token: submissionToken,
    customer_company: optionalText(payload.customerCompany, 160),
    customer_name: text(payload.customerName, 100),
    customer_position: optionalText(payload.customerPosition, 80),
    customer_phone: text(payload.customerPhone, 80),
    customer_email: optionalText(payload.customerEmail, 160),
    project_name: text(payload.projectName, 160),
    industry: optionalText(payload.industry, 120),
    homepage_url: optionalText(payload.homepageUrl, 300),
    reference_note: optionalText(payload.referenceNote, 1000),
    inquiry_body: text(payload.inquiryBody, 5000),
    package_id: pricing.packageId,
    package_label: pricing.packageLabel,
    lead_time_id: pricing.leadTimeId,
    lead_time_label: pricing.leadTimeLabel,
    optimization_tier_id: pricing.optimizationTierId,
    optimization_tier_label: pricing.optimizationLabel,
    selected_addons: pricing.selectedAddons,
    customer_estimate_text: pricing.customerEstimateText,
    design_subtotal: pricing.designSubtotal,
    lead_time_surcharge: pricing.leadTimeSurcharge,
    pm_cost: pricing.pmCost,
    internal_total: pricing.internalTotal,
    separate_review_items: pricing.separateReviewItems,
    pricing_snapshot: pricing,
    customer_message: pricing.customerMessage,
    internal_breakdown: pricing.internalBreakdown,
    privacy_consent: true,
    marketing_consent: toBool(payload.marketingConsent),
    raw_payload: payload,
    submitter_ip_hash: ipHash,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
  };

  const { data: intake, error: intakeError } = await supabase
    .from("branding_intakes")
    .insert(row)
    .select("id")
    .single();
  if (intakeError) return fail(origin, `브랜딩 접수 저장 실패: ${intakeError.message}`, 500);

  if (files.length > 0) {
    const fileRows = files.map((file) => ({
      intake_id: intake.id,
      file_name: text(file.fileName || file.name, 180),
      storage_bucket: BUCKET,
      storage_path: text(file.storagePath || file.path, 500),
      mime_type: optionalText(file.mimeType || file.type, 160),
      file_size: Number(file.fileSize || file.size || 0),
      metadata: {
        uploadedAt: file.uploadedAt || new Date().toISOString(),
      },
    }));
    const { error: filesError } = await supabase.from("branding_intake_files").insert(fileRows);
    if (filesError) return fail(origin, `첨부파일 연결 실패: ${filesError.message}`, 500, { intakeId: intake.id });
  }

  try {
    await supabase.from("branding_intake_events").insert({
      intake_id: intake.id,
      event_type: "submitted",
      note: "브랜딩 접수가 생성되었습니다.",
      metadata: {
        source,
        files: files.length,
        customerEstimateText: pricing.customerEstimateText,
      },
    });
    await notifyReviewers(supabase, intake.id, payload);
  } catch (eventError) {
    console.error("branding intake post-save warning", eventError);
  }

  return ok(origin, {
    success: true,
    intakeId: intake.id,
    customerEstimateText: pricing.customerEstimateText,
    customerMessage: pricing.customerMessage,
  });
});
