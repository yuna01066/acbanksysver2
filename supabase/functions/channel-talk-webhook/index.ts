import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-channel-talk-token",
};

const CHANNEL_API_BASE = "https://api.channel.io/open";
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type JsonObject = Record<string, unknown>;

type QuoteAnalysis = {
  inquiry_type?: string | null;
  item_name?: string | null;
  dimensions?: string | null;
  quantity?: string | null;
  material?: string | null;
  thickness?: string | null;
  color?: string | null;
  processing?: string[] | null;
  desired_due_date?: string | null;
  delivery_or_installation?: string | null;
  confidence?: "low" | "medium" | "high" | null;
  missing_fields?: string[];
  summary?: string | null;
  recommended_reply?: string | null;
};

type QuoteTriage = {
  priority: "normal" | "high";
  recommendedTags: string[];
  followUpQuestions: string[];
};

type ExtractedFile = {
  id?: string;
  key?: string;
  name?: string;
  contentType?: string;
  size?: number;
  raw: JsonObject;
};

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

function ok(body: JsonObject, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function walkObjects(value: unknown, visit: (obj: JsonObject) => void) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkObjects(item, visit));
    return;
  }
  if (!isObject(value)) return;
  visit(value);
  Object.values(value).forEach((child) => walkObjects(child, visit));
}

function extractUserChatId(payload: JsonObject): string | null {
  const entity = isObject(payload.entity) ? payload.entity : {};
  const refers = isObject(payload.refers) ? payload.refers : {};
  const userChat = isObject(refers.userChat) ? refers.userChat : {};

  return firstString(
    entity.userChatId,
    entity.chatType === "userChat" ? entity.chatId : null,
    userChat.id,
    payload.userChatId,
  );
}

function extractMessageId(payload: JsonObject): string | null {
  const entity = isObject(payload.entity) ? payload.entity : {};
  return firstString(entity.id, entity.messageId, payload.messageId);
}

function extractCustomer(payload: JsonObject) {
  const refers = isObject(payload.refers) ? payload.refers : {};
  const user = isObject(refers.user) ? refers.user : {};
  const userProfile = isObject(user.profile) ? user.profile : {};
  const entity = isObject(payload.entity) ? payload.entity : {};

  return {
    userId: firstString(user.id, entity.userId, entity.personId),
    name: firstString(user.name, userProfile.name, entity.name),
    company: firstString(userProfile.description, user.description),
    phone: firstString(userProfile.mobileNumber, userProfile.phone, user.mobileNumber),
    email: firstString(userProfile.email, user.email),
  };
}

function isCustomerMessage(payload: JsonObject): boolean {
  const entity = isObject(payload.entity) ? payload.entity : {};
  const personType = firstString(entity.personType);
  return !personType || personType === "user";
}

function extractFiles(payload: JsonObject): ExtractedFile[] {
  const files = new Map<string, ExtractedFile>();

  walkObjects(payload, (obj) => {
    const maybeKey = firstString(obj.key, obj.fileKey);
    const maybeName = firstString(obj.name, obj.fileName);
    const maybeType = firstString(obj.contentType, obj.mimeType, obj.type);
    const looksLikeFile =
      !!maybeKey &&
      (
        !!maybeName ||
        !!maybeType ||
        maybeKey.includes("pub-file/") ||
        maybeKey.includes("files/")
      );

    if (!looksLikeFile || !maybeKey) return;

    files.set(maybeKey, {
      id: firstString(obj.id) || undefined,
      key: maybeKey,
      name: maybeName || maybeKey.split("/").pop() || "attachment",
      contentType: maybeType || undefined,
      size: typeof obj.size === "number" ? obj.size : undefined,
      raw: obj,
    });
  });

  return [...files.values()];
}

async function channelApi(
  path: string,
  init: RequestInit = {},
  apiVersion = "v5",
): Promise<Response> {
  const accessKey = getEnv("CHANNEL_TALK_ACCESS_KEY");
  const accessSecret = getEnv("CHANNEL_TALK_ACCESS_SECRET");
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  headers.set("content-type", "application/json");
  headers.set("x-access-key", accessKey);
  headers.set("x-access-secret", accessSecret);

  return fetch(`${CHANNEL_API_BASE}/${apiVersion}${path}`, { ...init, headers });
}

async function getSignedFileUrl(userChatId: string, fileKey: string): Promise<string> {
  const path = `/user-chats/${encodeURIComponent(userChatId)}/messages/file?key=${encodeURIComponent(fileKey)}`;
  let res = await channelApi(path, { method: "GET" }, "v5");
  if (!res.ok && (res.status === 404 || res.status === 405)) {
    res = await channelApi(path, { method: "GET" }, "v4");
  }
  if (!res.ok) {
    throw new Error(`Channel Talk file URL failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const signedUrl = firstString(data.result, data.url);
  if (!signedUrl) throw new Error("Channel Talk file URL response did not include a URL");
  return signedUrl;
}

function inferMimeType(file: ExtractedFile, res: Response): string {
  const fromHeader = res.headers.get("content-type");
  const fromFile = file.contentType?.includes("/") ? file.contentType : null;
  return firstString(fromHeader, fromFile) || "application/octet-stream";
}

function isAnalyzableMime(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function analyzeAttachment(file: ExtractedFile, bytes: Uint8Array, mimeType: string): Promise<QuoteAnalysis> {
  if (!isAnalyzableMime(mimeType)) {
    return {
      confidence: "low",
      missing_fields: ["품목", "사이즈", "수량", "희망 납기"],
      summary: `${file.name || "첨부파일"}은 자동 분석 지원 형식이 아니어서 수동 확인이 필요합니다.`,
      recommended_reply: "첨부파일은 확인했습니다. 제작 품목, 사이즈, 수량, 희망 납기를 함께 알려주시면 견적 검토가 가능합니다.",
    };
  }

  const apiKey = getEnv("LOVABLE_API_KEY");
  const base64 = bytesToBase64(bytes);
  const prompt = `아크뱅크의 아크릴/공간 제작 견적 상담을 위한 첨부파일입니다.
도면, 스케치, 제품 이미지, 레퍼런스, PDF에서 견적 검토에 필요한 정보를 추출하세요.

반드시 JSON만 응답하세요:
{
  "inquiry_type": "도면있음 | 레퍼런스 | 구상단계 | 재단가공 | 기타",
  "item_name": "제작 품목",
  "dimensions": "가로 x 세로 x 높이 또는 확인된 치수",
  "quantity": "수량",
  "material": "소재",
  "thickness": "두께",
  "color": "색상/투명도",
  "processing": ["재단", "CNC", "레이저", "절곡", "접착", "인쇄", "기타"],
  "desired_due_date": "희망 납기",
  "delivery_or_installation": "배송/설치 여부",
  "confidence": "low | medium | high",
  "missing_fields": ["누락된 항목"],
  "summary": "상담원이 바로 볼 한글 요약",
  "recommended_reply": "고객에게 추가로 물어볼 짧은 문장"
}

치수/수량/두께는 확실하지 않으면 추정이라고 표시하고, 모르는 값은 null로 두세요.`;

  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1800,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI analysis failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const content = String(result.choices?.[0]?.message?.content || "");
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`AI analysis returned non-JSON content: ${content.slice(0, 200)}`);
  return JSON.parse(jsonMatch[0]) as QuoteAnalysis;
}

function mergeAnalyses(analyses: QuoteAnalysis[]): QuoteAnalysis {
  const merged: QuoteAnalysis = {
    processing: [],
    missing_fields: [],
    confidence: "low",
  };

  for (const analysis of analyses) {
    for (const key of [
      "inquiry_type",
      "item_name",
      "dimensions",
      "quantity",
      "material",
      "thickness",
      "color",
      "desired_due_date",
      "delivery_or_installation",
      "summary",
      "recommended_reply",
    ] as const) {
      if (!merged[key] && analysis[key]) merged[key] = analysis[key] as never;
    }

    const processing = Array.isArray(analysis.processing) ? analysis.processing : [];
    merged.processing = [...new Set([...(merged.processing || []), ...processing])];
    const missing = Array.isArray(analysis.missing_fields) ? analysis.missing_fields : [];
    merged.missing_fields = [...new Set([...(merged.missing_fields || []), ...missing])];

    if (analysis.confidence === "high") merged.confidence = "high";
    if (analysis.confidence === "medium" && merged.confidence === "low") merged.confidence = "medium";
  }

  return merged;
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function hasAny(value: string | null | undefined, patterns: RegExp[]): boolean {
  if (!value) return false;
  return patterns.some((pattern) => pattern.test(value));
}

function deriveQuoteTriage(analysis: QuoteAnalysis): QuoteTriage {
  const tags = ["견적문의", "자동분석완료"];
  const inquiryType = analysis.inquiry_type || "";
  const processing = (analysis.processing || []).join(" ");
  const summary = analysis.summary || "";
  const missing = analysis.missing_fields || [];

  if (hasAny(inquiryType, [/도면/]) || analysis.dimensions) tags.push("도면있음");
  if (hasAny(inquiryType, [/레퍼런스|사진|이미지/]) || hasAny(summary, [/사진|레퍼런스|이미지/])) tags.push("사진견적");
  if (hasAny(inquiryType, [/구상/])) tags.push("구상단계");
  if (hasAny(inquiryType, [/재단|가공/]) || hasAny(processing, [/재단|CNC|레이저|절곡|접착|인쇄/])) tags.push("재단가공");
  if (hasAny(summary, [/설치|배송|현장/]) || analysis.delivery_or_installation) tags.push("배송설치확인");
  if (analysis.desired_due_date || hasAny(summary, [/급|긴급|빠른|납기/])) tags.push("납기확인");
  if (analysis.confidence === "low") tags.push("수동검토필요");

  const followUpQuestions = missing.slice(0, 5).map((field) => `${field} 확인 필요`);
  if (!analysis.quantity) followUpQuestions.push("제작 수량 확인 필요");
  if (!analysis.dimensions) followUpQuestions.push("사이즈 확인 필요");
  if (!analysis.desired_due_date) followUpQuestions.push("희망 납기 확인 필요");

  return {
    priority: missing.length >= 4 || analysis.confidence === "low" ? "normal" : "high",
    recommendedTags: uniq(tags),
    followUpQuestions: uniq(followUpQuestions).slice(0, 6),
  };
}

function formatAnalysisMessage(analysis: QuoteAnalysis, files: ExtractedFile[], leadId?: string): string {
  const missing = analysis.missing_fields?.length ? analysis.missing_fields.join(", ") : "없음";
  const processing = analysis.processing?.length ? analysis.processing.join(", ") : "미확인";
  const triage = deriveQuoteTriage(analysis);

  return [
    "[아크뱅크 견적 파일 자동분석]",
    "",
    "1) 상담 분류",
    `- 리드 ID: ${leadId || "저장 전"}`,
    `- 문의 유형: ${analysis.inquiry_type || "미확인"}`,
    `- 추천 태그: ${triage.recommendedTags.join(", ")}`,
    `- 검토 우선도: ${triage.priority === "high" ? "높음" : "보통"}`,
    "",
    "2) 파일/제작 정보",
    `- 첨부파일: ${files.map((file) => file.name || file.key).join(", ")}`,
    `- 품목: ${analysis.item_name || "미확인"}`,
    `- 사이즈: ${analysis.dimensions || "미확인"}`,
    `- 수량: ${analysis.quantity || "미확인"}`,
    `- 소재/두께: ${[analysis.material, analysis.thickness].filter(Boolean).join(" / ") || "미확인"}`,
    `- 색상: ${analysis.color || "미확인"}`,
    `- 가공: ${processing}`,
    `- 희망 납기: ${analysis.desired_due_date || "미확인"}`,
    `- 배송/설치: ${analysis.delivery_or_installation || "미확인"}`,
    "",
    "3) 추가 확인 필요",
    `- 누락 정보: ${missing}`,
    `- 질문 후보: ${triage.followUpQuestions.length ? triage.followUpQuestions.join(" / ") : "없음"}`,
    "",
    "4) 상담원 메모",
    `- 요약: ${analysis.summary || "자동 요약 없음"}`,
    `- 고객에게 보낼 추천 답변: ${analysis.recommended_reply || "누락된 정보를 고객에게 확인해주세요."}`,
  ].join("\n");
}

async function sendPrivateSummary(userChatId: string, message: string) {
  const botName = encodeURIComponent("ACBANK 견적 분석");
  const res = await channelApi(
    `/user-chats/${encodeURIComponent(userChatId)}/messages?botName=${botName}`,
    {
      method: "POST",
      body: JSON.stringify({
        blocks: [{ type: "text", value: message }],
        options: ["private", "silent"],
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Channel Talk summary message failed: ${res.status} ${await res.text()}`);
  }
}

async function notifyAdmins(supabase: ReturnType<typeof createClient>, lead: JsonObject, analysis: QuoteAnalysis) {
  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["admin", "moderator"]);

  if (roleError || !roles?.length) {
    console.warn("No admin/moderator roles found for channel talk notification", roleError);
    return;
  }

  const confidenceLabel = analysis.confidence === "high"
    ? "신뢰도 높음"
    : analysis.confidence === "medium"
      ? "신뢰도 보통"
      : "수동 검토 필요";
  const missingCount = analysis.missing_fields?.length || 0;

  const notifications = roles.map((role: { user_id: string }) => ({
    user_id: role.user_id,
    type: "channel_talk_quote_lead",
    title: "채널톡 견적 첨부파일 분석",
    description: `${analysis.item_name || "견적 문의"} · ${confidenceLabel} · 누락 ${missingCount}건`,
    data: {
      lead_id: lead.id,
      user_chat_id: lead.channel_talk_user_chat_id,
      confidence: analysis.confidence || "low",
      missing_fields: analysis.missing_fields || [],
    },
  }));

  const { error } = await supabase.from("notifications").insert(notifications);
  if (error) console.warn("Failed to insert channel talk notifications", error);
}

async function processWebhook(payload: JsonObject) {
  if (!isCustomerMessage(payload)) return;

  const files = extractFiles(payload);
  if (files.length === 0) return;

  const userChatId = extractUserChatId(payload);
  if (!userChatId) {
    console.warn("Ignoring attachment webhook without userChatId");
    return;
  }

  const customer = extractCustomer(payload);
  const analyses: QuoteAnalysis[] = [];

  for (const file of files) {
    if (!file.key) continue;
    try {
      const signedUrl = await getSignedFileUrl(userChatId, file.key);
      const fileRes = await fetch(signedUrl);
      if (!fileRes.ok) throw new Error(`File download failed: ${fileRes.status}`);
      const bytes = new Uint8Array(await fileRes.arrayBuffer());
      const mimeType = inferMimeType(file, fileRes);
      analyses.push(await analyzeAttachment(file, bytes, mimeType));
    } catch (error) {
      console.error("Attachment analysis failed", file.key, error);
      analyses.push({
        confidence: "low",
        missing_fields: ["품목", "사이즈", "수량", "희망 납기"],
        summary: `${file.name || file.key} 자동 분석에 실패했습니다. 수동 확인이 필요합니다.`,
        recommended_reply: "첨부파일은 확인했습니다. 제작 품목, 사이즈, 수량, 희망 납기를 함께 알려주시면 견적 검토가 가능합니다.",
      });
    }
  }

  const analysis = mergeAnalyses(analyses);
  const triage = deriveQuoteTriage(analysis);
  const supabase = getServiceClient();

  const { data: lead, error } = await supabase
    .from("channel_talk_quote_leads")
    .insert({
      channel_talk_user_chat_id: userChatId,
      channel_talk_user_id: customer.userId,
      channel_talk_message_id: extractMessageId(payload),
      channel_talk_file_keys: files.map((file) => file.key).filter(Boolean),
      customer_name: customer.name,
      customer_company: customer.company,
      customer_phone: customer.phone,
      customer_email: customer.email,
      inquiry_type: analysis.inquiry_type || "quote",
      status: analysis.confidence === "low" ? "needs_review" : "analyzed",
      analysis: {
        ...analysis,
        triage,
      },
      missing_fields: analysis.missing_fields || [],
      raw_payload: payload,
    })
    .select("id, channel_talk_user_chat_id")
    .single();

  if (error) throw error;

  await sendPrivateSummary(userChatId, formatAnalysisMessage(analysis, files, lead?.id));
  await notifyAdmins(supabase, lead || {}, analysis);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return ok({ error: "Method not allowed" }, 405);
  }

  try {
    const expectedToken = getEnv("CHANNEL_TALK_WEBHOOK_TOKEN", false);
    const url = new URL(req.url);
    const providedToken =
      req.headers.get("x-channel-talk-token") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      url.searchParams.get("token");

    if (expectedToken && providedToken !== expectedToken) {
      return ok({ error: "Unauthorized" }, 401);
    }

    const payload = await req.json() as JsonObject;
    const work = processWebhook(payload);
    const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(work);
    } else {
      await work;
    }

    return ok({ success: true, accepted: true }, 202);
  } catch (error) {
    console.error("Channel Talk webhook error:", error);
    return ok(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
