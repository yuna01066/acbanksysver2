import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "quote-wizard-temp";
const FORMULA_VERSION = "pricing-engine-v2-core-260520";

type Json = Record<string, unknown>;

type QuoteWizardFile = {
  id?: string;
  job_id?: string;
  user_id?: string;
  file_name: string;
  file_path: string;
  mime_type?: string | null;
  file_size?: number | null;
  kind: "pdf" | "image" | "dxf" | "dwg" | "source" | "unknown";
};

function ok(body: Json, status = 200) {
  return new Response(JSON.stringify({ success: status < 400, ...body }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string, required = true): string {
  const value = Deno.env.get(name);
  if (required && !value) throw new Error(`${name} is not configured`);
  return value || "";
}

function getServiceClient() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

async function getAuthenticatedUser(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) throw new Error("Authorization token is required");

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid authorization token");
  return data.user;
}

async function loadPayload(supabase: ReturnType<typeof createClient>, jobId: string, userId: string) {
  const { data: job, error: jobError } = await supabase
    .from("quote_wizard_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();
  if (jobError) throw jobError;

  const [{ data: files, error: filesError }, { data: result, error: resultError }] = await Promise.all([
    supabase
      .from("quote_wizard_files")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true }),
    supabase
      .from("quote_wizard_results")
      .select("*")
      .eq("job_id", jobId)
      .maybeSingle(),
  ]);

  if (filesError) throw filesError;
  if (resultError) throw resultError;

  return {
    job,
    files: files || [],
    result: result
      ? {
          analysis: result.analysis_snapshot,
          yield: result.yield_snapshot,
          formula: result.formula_snapshot,
        }
      : null,
  };
}

function hasFastPreview(files: QuoteWizardFile[]) {
  return files.some((file) => file.kind === "pdf" || file.kind === "image" || file.kind === "dxf");
}

function buildFallbackAnalysis(job: any, files: QuoteWizardFile[]) {
  const sourceOnly = !hasFastPreview(files);
  const hasCadSource = files.some((file) => file.kind === "dwg" || file.kind === "source");
  const fileSummary = files.map((file) => `${file.file_name}(${file.kind})`).join(", ");

  const analysis = {
    item_name: sourceOnly ? null : "투명 아크릴 박스형 진열 커버",
    dimensions: sourceOnly ? null : "600 x 380 x 240mm",
    quantity: sourceOnly ? null : 12,
    material: sourceOnly ? null : "아크릴",
    thickness: sourceOnly ? null : "5T",
    color: sourceOnly ? null : "투명",
    finish: sourceOnly ? null : "불광/광택",
    processing: sourceOnly ? [] : ["재단", "타공", "인쇄", "접착", "조립"],
    observed: {
      files: fileSummary,
      customer_note: job.customer_note || null,
    },
    inferred: sourceOnly
      ? {}
      : {
          extraction_mode: "fallback_sample",
          note: "분석 워커 URL이 없어 샘플 구조로 임시 결과를 생성했습니다.",
        },
    parts: sourceOnly
      ? []
      : [
          {
            id: "top-bottom",
            name: "상/하판",
            shape: "rect",
            width_mm: 600,
            height_mm: 380,
            quantity: 24,
            material: "아크릴",
            thickness: "5T",
            basis: "외곽 치수 기준",
            confidence: "medium",
            risk_notes: ["회전 가능 여부 확인"],
          },
          {
            id: "front-back",
            name: "전/후면판",
            shape: "rect",
            width_mm: 600,
            height_mm: 240,
            quantity: 24,
            material: "아크릴",
            thickness: "5T",
            basis: "높이 치수 기준",
            confidence: "medium",
            risk_notes: ["접착 여유 확인"],
          },
          {
            id: "side",
            name: "좌/우 측판",
            shape: "rect",
            width_mm: 380,
            height_mm: 240,
            quantity: 24,
            material: "아크릴",
            thickness: "5T",
            basis: "깊이/높이 기준",
            confidence: "medium",
            risk_notes: ["두께 차감 검수"],
          },
        ],
    missing_fields: sourceOnly
      ? ["PDF/JPG/PNG 미리보기", "제작 품목", "사이즈", "수량", "희망 납기"]
      : ["원장 규격", "회전 가능 여부", "커프/재단 여유", "로고 원본"],
    production_risks: [
      ...(sourceOnly ? ["원본 파일만으로는 빠른 견적 분석이 제한됩니다."] : ["도면 스케일 확인 필요"]),
      ...(hasCadSource ? ["DWG/CAD 원본은 변환기 또는 PDF 미리보기와 대조해야 합니다."] : []),
      "상담원 검수 전 확정 금액으로 사용하지 않습니다.",
    ],
    recommended_reply: sourceOnly
      ? "원본 파일은 확인했습니다. 빠른 견적 확인을 위해 PDF, JPG 또는 PNG 미리보기 파일과 제작 품목, 사이즈, 수량, 희망 납기를 함께 알려주세요."
      : "첨부파일 기준으로 임시 분석했습니다. 원장 규격, 로고 원본, 회전 가능 여부를 확인하면 견적 정확도를 높일 수 있습니다.",
    confidence: sourceOnly ? "low" : "medium",
  };

  const totalAreaMm2 = analysis.parts.reduce((sum, part: any) => (
    sum + (Number(part.width_mm) || 0) * (Number(part.height_mm) || 0) * (Number(part.quantity) || 0)
  ), 0);
  const stockAreaMm2 = 1220 * 2440;
  const sheetCount = totalAreaMm2 ? Math.max(1, Math.ceil(totalAreaMm2 / (stockAreaMm2 * 0.82))) : null;
  const yieldPercent = totalAreaMm2 && sheetCount ? Math.round((totalAreaMm2 / (stockAreaMm2 * sheetCount)) * 1000) / 10 : null;

  const yieldSnapshot = {
    status: sourceOnly ? "insufficient_data" : "estimated",
    candidate_basis: sourceOnly ? null : "fallback_worker_sample",
    stock_sheet: {
      name: sourceOnly ? null : "4*8 후보",
      width_mm: sourceOnly ? null : 1220,
      height_mm: sourceOnly ? null : 2440,
      basis: sourceOnly ? null : "logic_auto_candidate",
    },
    total_part_area_mm2: totalAreaMm2 || null,
    estimated_sheet_count: sheetCount,
    yield_percent: yieldPercent,
    scrap_percent: yieldPercent === null ? null : Math.round((100 - yieldPercent) * 10) / 10,
    notes: sourceOnly
      ? ["원장/수율 계산에 필요한 치수와 수량이 부족합니다."]
      : ["워커 미설정 상태의 참고값입니다.", "실제 DB 원장 후보와 생산 방향성 검수가 필요합니다."],
  };

  const subtotal = sourceOnly ? 0 : 1_348_200;
  const tax = Math.round(subtotal * 0.1);
  const formula = {
    status: sourceOnly ? "blocked" : "needs_review",
    subtotal,
    tax,
    total: subtotal + tax,
    version: FORMULA_VERSION,
    line_items: sourceOnly
      ? []
      : [
          { label: "원장/재단 기준", amount: 624_000, source: "panel", reason: "아크릴 5T 후보 원장" },
          { label: "타공/가공", amount: 312_000, source: "processing", reason: "상단 타공 및 재단 공임" },
          { label: "인쇄/조립", amount: 412_200, source: "fabrication", reason: "UV 인쇄 및 접착 조립" },
        ],
    warnings: analysis.production_risks,
    blocked_reasons: sourceOnly ? ["PDF/JPG/PNG 미리보기 없이 자동 견적 산출 불가"] : [],
  };

  return {
    analysis,
    yield: yieldSnapshot,
    formula,
    status: formula.status,
  };
}

async function requestWorker(job: any, files: QuoteWizardFile[]) {
  const workerUrl = Deno.env.get("QUOTE_WIZARD_WORKER_URL");
  if (!workerUrl) return null;

  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(Deno.env.get("QUOTE_WIZARD_WORKER_SECRET")
        ? { "Authorization": `Bearer ${Deno.env.get("QUOTE_WIZARD_WORKER_SECRET")}` }
        : {}),
    },
    body: JSON.stringify({ job, files, bucket: BUCKET }),
  });

  if (!response.ok) {
    throw new Error(`Quote wizard worker failed: ${response.status} ${await response.text()}`);
  }

  return await response.json();
}

async function saveResult(supabase: ReturnType<typeof createClient>, job: any, resultPayload: any, source: string) {
  const { data: result, error: resultError } = await supabase
    .from("quote_wizard_results")
    .upsert({
      job_id: job.id,
      user_id: job.user_id,
      source,
      analysis_snapshot: resultPayload.analysis,
      yield_snapshot: resultPayload.yield,
      formula_snapshot: resultPayload.formula,
      status: resultPayload.status || resultPayload.formula?.status || "needs_review",
      expires_at: job.expires_at,
    }, { onConflict: "job_id" })
    .select("*")
    .single();
  if (resultError) throw resultError;

  const { error: jobError } = await supabase
    .from("quote_wizard_jobs")
    .update({
      status: "completed",
      review_status: result.status,
      result_id: result.id,
      error_message: null,
    })
    .eq("id", job.id);
  if (jobError) throw jobError;

  return result;
}

async function createJob(supabase: ReturnType<typeof createClient>, userId: string, body: Json) {
  const { data: job, error } = await supabase
    .from("quote_wizard_jobs")
    .insert({
      user_id: userId,
      customer_note: typeof body.customerNote === "string" ? body.customerNote : null,
      source: "internal_app",
    })
    .select("*")
    .single();
  if (error) throw error;
  return loadPayload(supabase, job.id, userId);
}

async function registerFiles(supabase: ReturnType<typeof createClient>, userId: string, body: Json) {
  const jobId = String(body.jobId || "");
  const files = Array.isArray(body.files) ? body.files as QuoteWizardFile[] : [];
  if (!jobId || files.length === 0) throw new Error("jobId and files are required");

  const payload = await loadPayload(supabase, jobId, userId);
  const rows = files.map((file) => ({
    job_id: jobId,
    user_id: userId,
    file_name: file.file_name,
    file_path: file.file_path,
    mime_type: file.mime_type || null,
    file_size: file.file_size || null,
    kind: file.kind || "unknown",
    expires_at: payload.job.expires_at,
  }));

  const { data, error } = await supabase
    .from("quote_wizard_files")
    .insert(rows)
    .select("*");
  if (error) throw error;

  const { error: updateError } = await supabase
    .from("quote_wizard_jobs")
    .update({ status: "uploaded" })
    .eq("id", jobId);
  if (updateError) throw updateError;

  return { files: data || [] };
}

async function analyzeJob(supabase: ReturnType<typeof createClient>, userId: string, body: Json) {
  const jobId = String(body.jobId || "");
  if (!jobId) throw new Error("jobId is required");

  const payload = await loadPayload(supabase, jobId, userId);
  if (!payload.files.length) throw new Error("분석할 파일이 없습니다.");

  const { error: analyzingError } = await supabase
    .from("quote_wizard_jobs")
    .update({ status: "analyzing", error_message: null })
    .eq("id", jobId);
  if (analyzingError) throw analyzingError;

  try {
    const workerResult = await requestWorker(payload.job, payload.files as QuoteWizardFile[]);
    await saveResult(
      supabase,
      payload.job,
      workerResult || buildFallbackAnalysis(payload.job, payload.files as QuoteWizardFile[]),
      workerResult ? "worker" : "edge_fallback",
    );
    return loadPayload(supabase, jobId, userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "분석에 실패했습니다.";
    await supabase
      .from("quote_wizard_jobs")
      .update({ status: "failed", error_message: message })
      .eq("id", jobId);
    throw error;
  }
}

function buildDraftMemo(jobId: string, result: any) {
  const analysis = result.analysis_snapshot || {};
  const yieldSnapshot = result.yield_snapshot || {};
  const formula = result.formula_snapshot || {};
  return [
    `[견적 마법사 전환]`,
    `원본 job_id: ${jobId}`,
    `공식 버전: ${formula.version || FORMULA_VERSION}`,
    `검수 상태: ${formula.status || "needs_review"}`,
    `제작물: ${analysis.item_name || "확인 필요"}`,
    `원장/수율 snapshot: ${JSON.stringify(yieldSnapshot)}`,
    `누락 정보: ${(analysis.missing_fields || []).join(", ") || "없음"}`,
    `위험 요소: ${(analysis.production_risks || []).join(", ") || "없음"}`,
  ].join("\n");
}

function buildDraftItem(jobId: string, result: any) {
  const analysis = result.analysis_snapshot || {};
  const formula = result.formula_snapshot || {};
  const subtotal = Number(formula.subtotal) || 0;

  return {
    id: `quote-wizard-${jobId}`,
    factory: "ACBANK",
    material: analysis.material || "견적 마법사 분석",
    quality: analysis.color || "파일 분석",
    thickness: analysis.thickness || "확인 필요",
    size: analysis.dimensions || "파일 분석 기준",
    surface: analysis.finish || "확인 필요",
    colorMixingCost: 0,
    processing: "quote-wizard",
    processingName: (analysis.processing || []).join(", ") || "견적 마법사 분석",
    totalPrice: subtotal,
    quantity: 1,
    breakdown: (formula.line_items || []).map((item: any) => ({
      label: item.label || item.source || "견적 마법사 항목",
      price: Number(item.amount) || 0,
    })),
    quoteStyle: "fabrication",
    calculationSnapshot: {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      breakdown: (formula.line_items || []).map((item: any) => ({
        label: item.label || item.source || "견적 마법사 항목",
        price: Number(item.amount) || 0,
      })),
      totalPrice: subtotal,
      snapshotVersion: formula.version || FORMULA_VERSION,
      calculationEngineVersion: "quote-wizard-v1",
      calculationStatus: formula.status || "needs_review",
      calculationWarnings: formula.warnings || [],
      calculationBlockedReasons: formula.blocked_reasons || [],
      calculationLineItems: formula.line_items || [],
      note: "견적 마법사에서 상담원 검수 후 전환된 임시 견적 초안입니다.",
    },
    createdAt: new Date().toISOString(),
  };
}

async function convertDraft(supabase: ReturnType<typeof createClient>, userId: string, body: Json) {
  const jobId = String(body.jobId || "");
  if (!jobId) throw new Error("jobId is required");

  const payload = await loadPayload(supabase, jobId, userId);
  if (payload.job.converted_draft_id) {
    return {
      draftId: payload.job.converted_draft_id,
      job: payload.job,
    };
  }

  const { data: result, error: resultError } = await supabase
    .from("quote_wizard_results")
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .single();
  if (resultError) throw resultError;

  const analysis = result.analysis_snapshot || {};
  const formula = result.formula_snapshot || {};
  const subtotal = Number(formula.subtotal) || 0;
  const tax = Math.round(subtotal * 0.1);
  const itemName = analysis.item_name || "견적 마법사 분석";

  const { data: draft, error: draftError } = await supabase
    .from("quote_drafts")
    .insert({
      user_id: userId,
      title: `${itemName} 임시 견적 초안`.slice(0, 150),
      recipient: {
        projectName: itemName,
        quoteNumber: "",
        quoteDate: new Date().toISOString(),
        validUntil: "",
        deliveryPeriod: "",
        paymentCondition: "",
        companyName: "",
        contactPerson: "",
        phoneNumber: "",
        email: "",
        desiredDeliveryDate: null,
        deliveryAddress: "",
        clientMemo: buildDraftMemo(jobId, result),
        attachments: [],
      },
      items: [buildDraftItem(jobId, result)],
      subtotal,
      tax,
      total: subtotal + tax,
      quote_style: "fabrication",
      status: "active",
    })
    .select("*")
    .single();
  if (draftError) throw draftError;

  const { data: updatedJob, error: updateError } = await supabase
    .from("quote_wizard_jobs")
    .update({
      review_status: "converted",
      converted_draft_id: draft.id,
    })
    .eq("id", jobId)
    .select("*")
    .single();
  if (updateError) throw updateError;

  return {
    draftId: draft.id,
    job: updatedJob,
  };
}

async function cleanupExpired(supabase: ReturnType<typeof createClient>) {
  const { data: files, error: fileError } = await supabase
    .from("quote_wizard_files")
    .select("file_path")
    .lt("expires_at", new Date().toISOString())
    .limit(1000);
  if (fileError) throw fileError;

  const paths = (files || []).map((file: any) => file.file_path).filter(Boolean);
  let removedFiles = 0;
  if (paths.length) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
    if (removeError) throw removeError;
    removedFiles = paths.length;
  }

  const { data: deletedRows, error: cleanupError } = await supabase.rpc("cleanup_expired_quote_wizard_rows");
  if (cleanupError) throw cleanupError;

  return { removedFiles, deletedRows: Number(deletedRows) || 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return ok({});
  if (req.method !== "POST") return ok({ error: "Method not allowed" }, 405);

  try {
    const supabase = getServiceClient();
    const user = await getAuthenticatedUser(req, supabase);
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "createJob") return ok(await createJob(supabase, user.id, body));
    if (action === "registerFiles") return ok(await registerFiles(supabase, user.id, body));
    if (action === "analyzeJob") return ok(await analyzeJob(supabase, user.id, body));
    if (action === "getJob") return ok(await loadPayload(supabase, String(body.jobId || ""), user.id));
    if (action === "convertDraft") return ok(await convertDraft(supabase, user.id, body));
    if (action === "cleanupExpired") return ok(await cleanupExpired(supabase));

    return ok({ error: "Unknown quote wizard action" }, 400);
  } catch (error) {
    console.error("quote-wizard error:", error);
    return ok({ error: error instanceof Error ? error.message : "견적 마법사 처리 중 오류가 발생했습니다." }, 500);
  }
});
