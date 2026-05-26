import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "quote-wizard-temp";
const FORMULA_VERSION = "pricing-engine-v2-core-260520";
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const ENGINE_VERSION = "quote-wizard-observed-only-20260526";

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

type ExtractedPart = {
  id: string;
  name: string;
  shape: "rect" | "trapezoid" | "irregular" | "unknown";
  width_mm: number | null;
  height_mm: number | null;
  quantity: number | null;
  material: string | null;
  thickness: string | null;
  basis: string;
  confidence: "low" | "medium" | "high";
  risk_notes: string[];
};

type FileObservation = {
  file: string;
  kind: QuoteWizardFile["kind"];
  text?: string;
  text_excerpt?: string;
  parts?: ExtractedPart[];
  error?: string;
  note?: string;
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

  const safeResult = normalizeStoredResult(job, files || [], result);

  return {
    job: safeResult?.legacyFallbackHidden
      ? { ...job, review_status: "blocked" }
      : job,
    files: files || [],
    result: safeResult
      ? {
          analysis: safeResult.analysis,
          yield: safeResult.yield,
          formula: safeResult.formula,
        }
      : null,
  };
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10) / 10 : null;
}

function normalizeUnit(value: number, unit?: string | null) {
  const normalized = (unit || "mm").toLowerCase();
  if (normalized === "m" || normalized === "meter" || normalized === "meters") return value * 1000;
  if (normalized === "cm" || normalized === "센티") return value * 10;
  return value;
}

function compactText(text: string, limit = 7000) {
  return text.replace(/\s+/g, " ").trim().slice(0, limit);
}

function decodePdfLiteral(raw: string) {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function extractPdfText(bytes: Uint8Array) {
  const raw = new TextDecoder("latin1").decode(bytes);
  const fragments: string[] = [];

  for (const match of raw.matchAll(/\((?:\\.|[^\\)]){1,500}\)\s*Tj/g)) {
    fragments.push(decodePdfLiteral(match[0].replace(/\)\s*Tj$/, "").slice(1)));
  }

  for (const match of raw.matchAll(/\[((?:\((?:\\.|[^\\)]){1,500}\)\s*)+)\]\s*TJ/g)) {
    const inner = match[1];
    for (const stringMatch of inner.matchAll(/\((?:\\.|[^\\)]){1,500}\)/g)) {
      fragments.push(decodePdfLiteral(stringMatch[0].slice(1, -1)));
    }
  }

  const fallback = raw
    .replace(/[^\x20-\x7E가-힣ㄱ-ㅎㅏ-ㅣ]/g, " ")
    .match(/[A-Za-z가-힣0-9][A-Za-z가-힣0-9\s.,:;()xX*×/+-]{3,}/g);

  return compactText([...fragments, ...(fallback || [])].join(" "), 10000);
}

function inferQuantity(text: string, matchIndex: number) {
  const windowText = text.slice(Math.max(0, matchIndex - 80), matchIndex + 120);
  const quantityMatch = windowText.match(/(?:수량|qty|quantity|ea|set|세트|개수)?\s*[:：]?\s*(\d{1,5})\s*(?:개|ea|EA|set|SET|세트)/);
  return quantityMatch ? Number(quantityMatch[1]) : null;
}

function inferLabel(text: string, matchIndex: number, index: number) {
  const before = text.slice(Math.max(0, matchIndex - 48), matchIndex).replace(/\s+/g, " ").trim();
  const labelMatch = before.match(/([가-힣A-Za-z0-9_/-]{2,24})\s*[:：-]?\s*$/);
  return labelMatch ? labelMatch[1] : `추출 파트 ${index + 1}`;
}

function extractThickness(text: string) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*T\b/i);
  return match ? `${match[1].replace(/\.0$/, "")}T` : null;
}

function extractMaterial(text: string) {
  if (/아크릴|acrylic|pmma/i.test(text)) return "아크릴";
  if (/포맥스|폼보드|foam/i.test(text)) return "포맥스";
  if (/알루미늄|aluminum|aluminium/i.test(text)) return "알루미늄";
  if (/스테인리스|스텐|sus|stainless/i.test(text)) return "스테인리스";
  return null;
}

function extractProcessing(text: string) {
  const candidates = [
    ["재단", /재단|cut/i],
    ["CNC", /cnc/i],
    ["레이저", /레이저|laser/i],
    ["타공", /타공|홀|hole|drill/i],
    ["인쇄", /인쇄|출력|uv|print/i],
    ["접착", /접착|본딩|bond/i],
    ["조립", /조립|assembly/i],
    ["절곡", /절곡|bending/i],
  ];
  return candidates.filter(([, pattern]) => pattern.test(text)).map(([label]) => label as string);
}

function extractDimensionParts(text: string, sourceLabel: string) {
  const parts: ExtractedPart[] = [];
  const dimensionPattern = /(\d{2,5}(?:\.\d+)?)\s*(?:mm|㎜|미리|cm|m)?\s*(?:x|X|×|\*)\s*(\d{2,5}(?:\.\d+)?)\s*(?:mm|㎜|미리|cm|m)?(?:\s*(?:x|X|×|\*)\s*(\d{1,4}(?:\.\d+)?)\s*(?:T|t|mm|㎜|미리)?)?/g;
  const material = extractMaterial(text);
  const thickness = extractThickness(text);
  let index = 0;

  for (const match of text.matchAll(dimensionPattern)) {
    const unitMatch = match[0].match(/\b(mm|cm|m|㎜|미리)\b/i)?.[1] || "mm";
    const width = normalizeUnit(Number(match[1]), unitMatch);
    const height = normalizeUnit(Number(match[2]), unitMatch);
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue;
    if (width < 10 || height < 10 || width > 20000 || height > 20000) continue;

    const quantity = inferQuantity(text, match.index || 0);
    parts.push({
      id: `${sourceLabel}-${index + 1}`,
      name: inferLabel(text, match.index || 0, index),
      shape: "rect",
      width_mm: Math.round(width * 10) / 10,
      height_mm: Math.round(height * 10) / 10,
      quantity,
      material,
      thickness: match[3] ? `${match[3].replace(/\.0$/, "")}T` : thickness,
      basis: `${sourceLabel} 텍스트에서 치수 패턴 직접 추출`,
      confidence: quantity ? "medium" : "low",
      risk_notes: [
        "텍스트 기반 자동 추출값입니다. 도면 스케일과 실제 수량 검수가 필요합니다.",
        ...(quantity ? [] : ["수량 표기가 명확하지 않습니다."]),
      ],
    });
    index += 1;
    if (parts.length >= 24) break;
  }

  return dedupeParts(parts);
}

function parseDxfParts(text: string, sourceLabel: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const parts: ExtractedPart[] = [];
  let index = 0;

  for (let i = 0; i < lines.length - 1; i += 2) {
    if (lines[i] !== "0" || lines[i + 1] !== "LWPOLYLINE") continue;
    const entity: Array<[string, string]> = [];
    i += 2;
    while (i < lines.length - 1 && !(lines[i] === "0" && lines[i + 1])) {
      entity.push([lines[i], lines[i + 1]]);
      i += 2;
    }
    i -= 2;

    const closed = entity.some(([code, value]) => code === "70" && (Number(value) & 1) === 1);
    const xs = entity.filter(([code]) => code === "10").map(([, value]) => Number(value)).filter(Number.isFinite);
    const ys = entity.filter(([code]) => code === "20").map(([, value]) => Number(value)).filter(Number.isFinite);
    if (!closed || xs.length < 4 || ys.length < 4) continue;
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    if (width < 10 || height < 10 || width > 20000 || height > 20000) continue;
    parts.push({
      id: `${sourceLabel}-polyline-${index + 1}`,
      name: `DXF 폐합 외곽 ${index + 1}`,
      shape: "rect",
      width_mm: Math.round(width * 10) / 10,
      height_mm: Math.round(height * 10) / 10,
      quantity: 1,
      material: null,
      thickness: null,
      basis: "DXF LWPOLYLINE 폐합 외곽 bounding box 기준",
      confidence: "low",
      risk_notes: ["DXF 단위와 스케일 확인이 필요합니다.", "폐합 외곽의 실제 파트 여부는 상담원 검수가 필요합니다."],
    });
    index += 1;
    if (parts.length >= 24) break;
  }

  return dedupeParts(parts);
}

function dedupeParts(parts: ExtractedPart[]) {
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = [part.name, part.width_mm, part.height_mm, part.quantity].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeAiParts(value: unknown): ExtractedPart[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      id: toText(record.id) || `ai-part-${index + 1}`,
      name: toText(record.name) || `AI 추출 파트 ${index + 1}`,
      shape: ["rect", "trapezoid", "irregular", "unknown"].includes(String(record.shape)) ? record.shape as ExtractedPart["shape"] : "unknown",
      width_mm: toNumber(record.width_mm),
      height_mm: toNumber(record.height_mm),
      quantity: toNumber(record.quantity),
      material: toText(record.material),
      thickness: toText(record.thickness),
      basis: toText(record.basis) || "AI Gateway 파일 분석 결과",
      confidence: ["low", "medium", "high"].includes(String(record.confidence)) ? record.confidence as ExtractedPart["confidence"] : "low",
      risk_notes: Array.isArray(record.risk_notes) ? record.risk_notes.map(String).filter(Boolean) : ["AI 추출값은 상담원 검수가 필요합니다."],
    };
  }).filter((part) => part.width_mm && part.height_mm);
}

function parseAiJson(content: string) {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function downloadFileBytes(supabase: ReturnType<typeof createClient>, file: QuoteWizardFile) {
  const { data, error } = await supabase.storage.from(BUCKET).download(file.file_path);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

async function runAiAnalysis(input: {
  job: any;
  files: QuoteWizardFile[];
  observations: FileObservation[];
  imagePayloads: Array<{ mimeType: string; base64: string; fileName: string }>;
}) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;

  const content: unknown[] = [
    {
      type: "text",
      text: `ACBANK 견적 마법사 파일 분석입니다. 첨부 파일에서 실제로 보이는 내용만 근거로 JSON을 반환하세요.

절대 샘플 치수나 일반적인 박스 파트를 invent 하지 마세요. 치수/수량이 안 보이면 null 또는 빈 배열로 두세요.
파트는 실제로 관찰되거나 텍스트에서 직접 추출 가능한 조각만 작성하세요.

응답 JSON 스키마:
{
  "item_name": string | null,
  "dimensions": string | null,
  "quantity": number | null,
  "material": string | null,
  "thickness": string | null,
  "color": string | null,
  "finish": string | null,
  "processing": string[],
  "parts": [
    {"name": string, "shape": "rect"|"trapezoid"|"irregular"|"unknown", "width_mm": number|null, "height_mm": number|null, "quantity": number|null, "material": string|null, "thickness": string|null, "basis": string, "confidence": "low"|"medium"|"high", "risk_notes": string[]}
  ],
  "missing_fields": string[],
  "production_risks": string[],
  "recommended_reply": string,
  "confidence": "low"|"medium"|"high"
}

고객 메모: ${input.job.customer_note || "없음"}
파일 관찰값:
${JSON.stringify(input.observations.map((item) => ({
  file: item.file,
  kind: item.kind,
  text_excerpt: item.text_excerpt,
  extracted_parts: item.parts,
  error: item.error,
  note: item.note,
})), null, 2)}`,
    },
  ];

  for (const image of input.imagePayloads.slice(0, 4)) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
    });
  }

  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content }],
      max_tokens: 2500,
    }),
  });

  if (!response.ok) {
    console.error("quote-wizard AI gateway error:", response.status, await response.text());
    return null;
  }

  const result = await response.json();
  return parseAiJson(result.choices?.[0]?.message?.content || "");
}

function buildYieldSnapshot(parts: ExtractedPart[]) {
  const totalArea = parts.reduce((sum, part) => (
    sum + (Number(part.width_mm) || 0) * (Number(part.height_mm) || 0) * (Number(part.quantity) || 1)
  ), 0);

  return {
    status: totalArea ? "insufficient_data" : "insufficient_data",
    candidate_basis: null,
    stock_sheet: { name: null, width_mm: null, height_mm: null, basis: null },
    total_part_area_mm2: totalArea || null,
    estimated_sheet_count: null,
    yield_percent: null,
    scrap_percent: null,
    notes: totalArea
      ? ["파일에서 파트 면적은 추출했지만 원장 규격/방향/커프 정보가 없어 수율은 계산하지 않았습니다."]
      : ["원장/수율 계산에 필요한 파트 치수와 수량이 부족합니다."],
  };
}

function buildFormulaSnapshot(parts: ExtractedPart[], risks: string[]) {
  const blockedReasons = [
    ...(parts.length ? [] : ["파일에서 견적 산출 가능한 파트 치수를 추출하지 못했습니다."]),
    "원장 규격, 소재 단가, 가공 조건 검수 전에는 임시 금액을 산출하지 않습니다.",
  ];

  return {
    status: "blocked",
    subtotal: 0,
    tax: 0,
    total: 0,
    version: FORMULA_VERSION,
    line_items: [],
    warnings: risks,
    blocked_reasons: blockedReasons,
  };
}

function isKnownSamplePart(part: any) {
  const name = String(part?.name || "");
  const width = Number(part?.width_mm) || 0;
  const height = Number(part?.height_mm) || 0;
  const quantity = Number(part?.quantity) || 0;
  return (
    (name.includes("상/하판") && width === 600 && height === 380 && quantity === 24) ||
    (name.includes("전/후면판") && width === 600 && height === 240 && quantity === 24) ||
    (name.includes("좌/우") && width === 380 && height === 240 && quantity === 24)
  );
}

function sanitizeResultPayload(resultPayload: any) {
  const analysis = resultPayload?.analysis || {};
  const parts = Array.isArray(analysis.parts) ? analysis.parts : [];
  const samplePartDetected = parts.some(isKnownSamplePart);
  const safeParts = samplePartDetected ? [] : parts;
  const risks = [
    ...new Set([
      ...((Array.isArray(analysis.production_risks) ? analysis.production_risks.map(String) : []) || []),
      ...(samplePartDetected ? ["이전 샘플 파트 패턴이 감지되어 자동 결과에서 제거했습니다."] : []),
      "자동 금액 산출은 비활성화되어 상담원 검수 전에는 임시 금액을 만들지 않습니다.",
    ]),
  ];
  const missing = [
    ...new Set([
      ...((Array.isArray(analysis.missing_fields) ? analysis.missing_fields.map(String) : []) || []),
      ...(safeParts.length ? [] : ["파트별 치수", "수량"]),
      "원장 규격",
      "소재 단가",
      "가공 조건",
    ]),
  ];

  return {
    ...resultPayload,
    analysis: {
      ...analysis,
      parts: safeParts,
      inferred: {
        ...(analysis.inferred && typeof analysis.inferred === "object" ? analysis.inferred : {}),
        engine_version: ENGINE_VERSION,
        pricing_policy: "observed_only_no_auto_amount",
      },
      missing_fields: missing,
      production_risks: risks,
    },
    yield: buildYieldSnapshot(safeParts),
    formula: buildFormulaSnapshot(safeParts, risks),
    status: "blocked",
  };
}

function isLegacyFallbackSnapshot(result: any) {
  if (!result) return false;
  const analysis = result.analysis_snapshot || {};
  const inferred = analysis.inferred && typeof analysis.inferred === "object" ? analysis.inferred : {};
  const mode = typeof inferred.extraction_mode === "string" ? inferred.extraction_mode : "";
  const note = typeof inferred.note === "string" ? inferred.note : "";
  const parts = Array.isArray(analysis.parts) ? analysis.parts : [];

  return (
    mode === "fallback_sample" ||
    note.includes("샘플 구조") ||
    parts.some(isKnownSamplePart)
  );
}

function buildLegacyFallbackHiddenResult(job: any, files: QuoteWizardFile[]) {
  const hidden = buildEngineUnavailableResult(
    job,
    files,
    "이전 버전 함수가 생성한 샘플 분석 결과가 감지되어 화면에서 제거했습니다. 파일을 다시 업로드해 새 분석을 실행해주세요.",
  );

  return {
    ...hidden,
    analysis: {
      ...hidden.analysis,
      inferred: {
        ...hidden.analysis.inferred,
        extraction_mode: "legacy_fallback_hidden",
        worker_status: "not_connected",
      },
      production_risks: [
        ...hidden.analysis.production_risks,
        "상담원 검수 전에는 임시 금액을 만들지 않습니다.",
      ],
      recommended_reply: "이전 샘플 분석 결과가 감지되어 자동 표시를 중단했습니다. 파일을 다시 업로드해 견적 마법사를 새로 실행해주세요.",
    },
    legacyFallbackHidden: true,
  };
}

function normalizeStoredResult(job: any, files: QuoteWizardFile[], result: any) {
  if (!result) return null;
  if (isLegacyFallbackSnapshot(result)) return buildLegacyFallbackHiddenResult(job, files);

  return {
    analysis: result.analysis_snapshot,
    yield: result.yield_snapshot,
    formula: result.formula_snapshot,
    legacyFallbackHidden: false,
  };
}

function buildEngineUnavailableResult(job: any, files: QuoteWizardFile[], reason: string) {
  const risks = [
    reason,
    "파일 내용 기반 파트 추출이 실행되지 않았으므로 치수/수량을 상담원이 확인해야 합니다.",
  ];
  return {
    analysis: {
      item_name: null,
      dimensions: null,
      quantity: null,
      material: null,
      thickness: null,
      color: null,
      finish: null,
      processing: [],
      observed: {
        files: files.map((file) => `${file.file_name}(${file.kind})`),
        customer_note: job.customer_note || null,
      },
      inferred: {
        engine_status: "unavailable",
        extraction_mode: "none",
        engine_version: ENGINE_VERSION,
        pricing_policy: "observed_only_no_auto_amount",
        note: reason,
      },
      parts: [],
      missing_fields: ["분석 엔진 연결", "제작 품목", "파트별 치수", "수량", "소재/두께", "원장 규격"],
      production_risks: risks,
      recommended_reply: "첨부파일은 접수했지만 자동 분석 엔진이 연결되지 않아 도면 내용 기반 추출을 진행하지 못했습니다. 상담원이 도면 치수, 수량, 소재/두께를 확인해야 합니다.",
      confidence: "low",
    },
    yield: buildYieldSnapshot([]),
    formula: buildFormulaSnapshot([], risks),
    status: "blocked",
  };
}

async function buildBuiltInAnalysis(supabase: ReturnType<typeof createClient>, job: any, files: QuoteWizardFile[]) {
  const observations: FileObservation[] = [];
  const imagePayloads: Array<{ mimeType: string; base64: string; fileName: string }> = [];
  const extractedParts: ExtractedPart[] = [];
  let combinedText = "";

  for (const file of files) {
    try {
      const bytes = await downloadFileBytes(supabase, file);
      if (file.kind === "pdf") {
        const text = extractPdfText(bytes);
        const parts = extractDimensionParts(text, `${file.file_name} PDF`);
        observations.push({ file: file.file_name, kind: file.kind, text, text_excerpt: compactText(text, 1200), parts });
        combinedText += `\n${text}`;
        extractedParts.push(...parts);
      } else if (file.kind === "dxf") {
        const text = new TextDecoder().decode(bytes);
        const parts = dedupeParts([...parseDxfParts(text, file.file_name), ...extractDimensionParts(text, `${file.file_name} DXF`)]);
        observations.push({ file: file.file_name, kind: file.kind, text_excerpt: compactText(text, 1200), parts });
        combinedText += `\n${text.slice(0, 12000)}`;
        extractedParts.push(...parts);
      } else if (file.kind === "image") {
        imagePayloads.push({
          fileName: file.file_name,
          mimeType: file.mime_type || "image/png",
          base64: base64Encode(bytes),
        });
        observations.push({ file: file.file_name, kind: file.kind, note: "AI Gateway vision 분석 대상으로 전달했습니다." });
      } else if (file.kind === "dwg") {
        observations.push({ file: file.file_name, kind: file.kind, note: "DWG는 Edge Function 내장 분석에서 직접 파싱할 수 없어 DXF/PDF 미리보기가 필요합니다." });
      } else {
        observations.push({ file: file.file_name, kind: file.kind, note: "내장 분석기가 지원하지 않는 원본 형식입니다." });
      }
    } catch (error) {
      observations.push({ file: file.file_name, kind: file.kind, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const ai = await runAiAnalysis({ job, files, observations, imagePayloads });
  const aiParts = normalizeAiParts(ai?.parts);
  const parts = dedupeParts([...aiParts, ...extractedParts]);
  const material = toText(ai?.material) || extractMaterial(combinedText);
  const thickness = toText(ai?.thickness) || extractThickness(combinedText);
  const processing = Array.isArray(ai?.processing) ? ai.processing.map(String).filter(Boolean) : extractProcessing(combinedText);
  const risks = [
    ...new Set([
      ...((Array.isArray(ai?.production_risks) ? ai.production_risks.map(String) : []) || []),
      ...(observations.some((item) => item.error) ? ["일부 파일을 분석하지 못했습니다."] : []),
      ...(files.some((file) => file.kind === "dwg") ? ["DWG 원본은 DXF/PDF 미리보기와 대조해야 합니다."] : []),
      "자동 추출값은 상담원 검수 전 확정 견적으로 사용할 수 없습니다.",
    ]),
  ];
  const missing = [
    ...new Set([
      ...((Array.isArray(ai?.missing_fields) ? ai.missing_fields.map(String) : []) || []),
      ...(parts.length ? [] : ["파트별 치수", "수량"]),
      ...(material ? [] : ["소재"]),
      ...(thickness ? [] : ["두께"]),
      "원장 규격",
      "커프/재단 여유",
    ]),
  ];

  const analysis = {
    item_name: toText(ai?.item_name),
    dimensions: toText(ai?.dimensions),
    quantity: toNumber(ai?.quantity),
    material,
    thickness,
    color: toText(ai?.color),
    finish: toText(ai?.finish),
    processing,
    observed: {
      files: files.map((file) => `${file.file_name}(${file.kind})`),
      customer_note: job.customer_note || null,
      observations,
    },
    inferred: {
      engine_status: parts.length || ai ? "limited" : "needs_review",
      extraction_mode: ai ? "edge_builtin_ai" : "edge_builtin_text",
      worker_status: Deno.env.get("QUOTE_WIZARD_WORKER_URL") ? "configured_but_fallback_used" : "not_configured",
      ai_gateway_status: Deno.env.get("LOVABLE_API_KEY") ? "available" : "missing",
      engine_version: ENGINE_VERSION,
      pricing_policy: "observed_only_no_auto_amount",
      note: "Edge Function 내장 분석기가 파일 텍스트/이미지에서 관찰 가능한 값만 추출했습니다.",
    },
    parts,
    missing_fields: missing,
    production_risks: risks,
    recommended_reply: toText(ai?.recommended_reply) || "첨부파일 기준으로 자동 추출 가능한 값만 정리했습니다. 파트별 치수, 수량, 소재/두께, 원장 규격을 확인하면 견적 산출이 가능합니다.",
    confidence: (["low", "medium", "high"].includes(String(ai?.confidence)) ? ai?.confidence : (parts.length ? "medium" : "low")) as "low" | "medium" | "high",
  };

  const yieldSnapshot = buildYieldSnapshot(parts);
  const formula = buildFormulaSnapshot(parts, risks);

  return { analysis, yield: yieldSnapshot, formula, status: formula.status };
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
    const rawAnalysisResult = workerResult || await buildBuiltInAnalysis(
      supabase,
      payload.job,
      payload.files as QuoteWizardFile[],
    );
    const analysisResult = sanitizeResultPayload(
      rawAnalysisResult || buildEngineUnavailableResult(payload.job, payload.files as QuoteWizardFile[], "분석 엔진이 결과를 반환하지 않았습니다."),
    );
    await saveResult(
      supabase,
      payload.job,
      analysisResult,
      workerResult ? "worker" : "edge_builtin",
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
  const total = Number(formula.total) || 0;
  const lineItems = Array.isArray(formula.line_items) ? formula.line_items : [];
  if (formula.status !== "calculable" || subtotal <= 0 || total <= 0 || lineItems.length === 0) {
    throw new Error("견적 마법사 결과가 금액 산출 보류 상태입니다. 상담원 검수 후 기존 견적 초안에서 직접 산출해주세요.");
  }
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
