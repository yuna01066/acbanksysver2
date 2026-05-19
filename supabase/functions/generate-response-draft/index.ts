import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const RESPONSE_ASSISTANT_SETTING_KEY = "system_instruction";
const DEFAULT_RESPONSE_ASSISTANT_INSTRUCTION = `아크뱅크 직원의 고객 상담 응대를 돕는 초안을 작성하세요.

목표:
- 상대의 기분을 상하게 하지 않으면서도 회사의 단가, 제작 조건, 정책을 설득력 있게 설명합니다.
- 자동 발송 문구가 아니라 직원이 검토 후 복사해 사용할 초안입니다.
- 가격 항의, 컴플레인, 거래 중단, 법적/환불/책임 소재 이슈는 검수 필요성을 표시합니다.
- 과장, 책임 전가, 고객 탓, 무조건 할인 약속, 확정되지 않은 납기/가격 약속을 피합니다.
- 담당자가 수정해야 하는 회사명, 담당자명, 견적서명, 날짜, 금액 등은 [직원이름]처럼 대괄호로 표시합니다.
- 고객의 부담감이나 불편함은 먼저 인정하고, 단가 방어가 필요한 경우에는 요청 사양과 제작 방식 기준으로 산출된 금액임을 설명합니다.
- 조정 가능성이 있으면 할인 약속보다 사양 변경, 수량 변경, 제작 방식 변경 등 검토 가능한 대안을 제안합니다.`;

type JsonObject = Record<string, unknown>;

type CaseInput = {
  source_channel?: string;
  external_thread_id?: string | null;
  external_message_id?: string | null;
  customer_company?: string | null;
  customer_name?: string | null;
  customer_contact?: string | null;
  inquiry_type?: string | null;
  customer_message: string;
  internal_context?: string | null;
  related_quote_id?: string | null;
  related_project_id?: string | null;
  assigned_to?: string | null;
};

type DraftPayload = {
  risk_level?: "normal" | "review_recommended" | "review_required";
  inquiry_type?: string;
  summary?: string;
  drafts_by_tone?: {
    firm?: string;
    soft?: string;
    concise?: string;
  };
  persuasion_points?: string[];
  empathy_points?: string[];
  avoid_phrases?: string[];
  review_required?: boolean;
};

function getEnv(name: string, required = true): string {
  const value = Deno.env.get(name);
  if (required && !value) throw new Error(`${name} is not configured`);
  return value || "";
}

function ok(body: JsonObject, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getServiceClient() {
  return createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

function parseJsonContent(content: string): DraftPayload {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`AI draft returned non-JSON content: ${content.slice(0, 200)}`);
  return JSON.parse(jsonMatch[0]) as DraftPayload;
}

function inferRisk(text: string): DraftPayload["risk_level"] {
  if (/법적|소송|환불|배상|책임|고발|신고|계약해지|거래.?중단/.test(text)) return "review_required";
  if (/비싸|단가|가격|컴플레인|불만|항의|거래.?불가|못.?하|터무니|납득/.test(text)) return "review_recommended";
  return "normal";
}

function normalizeDraft(ai: DraftPayload, sourceText: string): Required<DraftPayload> {
  const risk = ai.risk_level || inferRisk(sourceText) || "normal";
  return {
    risk_level: risk,
    inquiry_type: ai.inquiry_type || "general",
    summary: ai.summary || "상담 내용을 바탕으로 응대 초안을 생성했습니다.",
    drafts_by_tone: {
      firm: ai.drafts_by_tone?.firm || "",
      soft: ai.drafts_by_tone?.soft || "",
      concise: ai.drafts_by_tone?.concise || "",
    },
    persuasion_points: pickArray(ai.persuasion_points),
    empathy_points: pickArray(ai.empathy_points),
    avoid_phrases: pickArray(ai.avoid_phrases),
    review_required: Boolean(ai.review_required || risk === "review_required"),
  };
}

async function getAuthenticatedUser(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) throw new Error("Authorization token is required");

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid authorization token");
  return data.user;
}

async function generateDraft(input: {
  caseInput: CaseInput;
  knowledgeItems: JsonObject[];
  quote: JsonObject | null;
  project: JsonObject | null;
  systemInstruction: string;
}): Promise<Required<DraftPayload>> {
  const apiKey = getEnv("LOVABLE_API_KEY");
  const systemInstruction = input.systemInstruction.trim() || DEFAULT_RESPONSE_ASSISTANT_INSTRUCTION;
  const prompt = `${systemInstruction}

아래 응답 형식은 시스템에서 고정합니다. 반드시 JSON만 응답하세요:
{
  "risk_level": "normal | review_recommended | review_required",
  "inquiry_type": "문의 유형",
  "summary": "내부용 한 줄 요약",
  "drafts_by_tone": {
    "firm": "정중하고 단호한 답변 초안",
    "soft": "부드럽고 양보형 답변 초안",
    "concise": "간결한 실무형 답변 초안"
  },
  "persuasion_points": ["핵심 설득 근거"],
  "empathy_points": ["감정 완화 문구 또는 태도"],
  "avoid_phrases": ["피해야 할 표현"],
  "review_required": true
}

상담 채널: ${input.caseInput.source_channel || "email"}
고객사/고객: ${[input.caseInput.customer_company, input.caseInput.customer_name].filter(Boolean).join(" / ") || "미확인"}
문의 유형: ${input.caseInput.inquiry_type || "미분류"}

[고객 원문]
${input.caseInput.customer_message}

[직원 내부 메모]
${input.caseInput.internal_context || "없음"}

[관리자 등록 근거]
${input.knowledgeItems.map((item, index) => `${index + 1}. ${item.title || "근거"}: ${item.content || ""}`).join("\n") || "선택된 근거 없음"}

[관련 견적]
${input.quote ? JSON.stringify(input.quote, null, 2) : "없음"}

[관련 프로젝트]
${input.project ? JSON.stringify(input.project, null, 2) : "없음"}`;

  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2600,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI draft generation failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const content = String(result.choices?.[0]?.message?.content || "");
  return normalizeDraft(parseJsonContent(content), input.caseInput.customer_message);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return ok({});
  if (req.method !== "POST") return ok({ error: "Method not allowed" }, 405);

  try {
    const supabase = getServiceClient();
    const user = await getAuthenticatedUser(req, supabase);
    const body = await req.json();
    const caseInput = body.caseInput as CaseInput;
    const knowledgeItemIds = Array.isArray(body.knowledgeItemIds) ? body.knowledgeItemIds.filter(Boolean) : [];

    if (!caseInput?.customer_message?.trim()) {
      return ok({ error: "customer_message is required" }, 400);
    }

    const { data: knowledgeItems, error: knowledgeError } = knowledgeItemIds.length
      ? await supabase
          .from("response_knowledge_items")
          .select("id, title, category, content")
          .in("id", knowledgeItemIds)
          .eq("is_active", true)
      : await supabase
          .from("response_knowledge_items")
          .select("id, title, category, content")
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .limit(12);

    if (knowledgeError) throw knowledgeError;

    let systemInstruction = DEFAULT_RESPONSE_ASSISTANT_INSTRUCTION;
    const { data: setting, error: settingError } = await supabase
      .from("response_assistant_settings")
      .select("value")
      .eq("key", RESPONSE_ASSISTANT_SETTING_KEY)
      .maybeSingle();

    if (settingError) {
      console.warn("Failed to load response assistant setting, using fallback", settingError.message);
    } else if (typeof setting?.value === "string" && setting.value.trim()) {
      systemInstruction = setting.value.trim();
    }

    const quoteId = firstString(caseInput.related_quote_id);
    const projectId = firstString(caseInput.related_project_id);

    const [{ data: quote, error: quoteError }, { data: project, error: projectError }] = await Promise.all([
      quoteId
        ? supabase
            .from("saved_quotes")
            .select("id, quote_number, recipient_company, recipient_name, project_name, total, subtotal, tax, items, calculation_snapshot, recipient_memo")
            .eq("id", quoteId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      projectId
        ? supabase
            .from("projects")
            .select("id, name, description, contact_name, contact_phone, contact_email, specs, status, payment_status")
            .eq("id", projectId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (quoteError) throw quoteError;
    if (projectError) throw projectError;

    const draft = await generateDraft({
      caseInput,
      knowledgeItems: (knowledgeItems || []) as JsonObject[],
      quote: quote as JsonObject | null,
      project: project as JsonObject | null,
      systemInstruction,
    });

    const { data: responseCase, error: caseError } = await supabase
      .from("response_cases")
      .insert({
        source_channel: caseInput.source_channel || "email",
        external_thread_id: caseInput.external_thread_id || null,
        external_message_id: caseInput.external_message_id || null,
        customer_company: caseInput.customer_company || null,
        customer_name: caseInput.customer_name || null,
        customer_contact: caseInput.customer_contact || null,
        inquiry_type: draft.inquiry_type || caseInput.inquiry_type || "general",
        customer_message: caseInput.customer_message.trim(),
        internal_context: caseInput.internal_context || null,
        related_quote_id: quoteId,
        related_project_id: projectId,
        assigned_to: caseInput.assigned_to || user.id,
        status: draft.review_required ? "needs_review" : "draft",
        risk_level: draft.risk_level,
        review_required: draft.review_required,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (caseError) throw caseError;

    const usedKnowledgeIds = ((knowledgeItems || []) as JsonObject[])
      .map((item) => firstString(item.id))
      .filter(Boolean);

    const { data: responseDraft, error: draftError } = await supabase
      .from("response_drafts")
      .insert({
        case_id: responseCase.id,
        selected_tone: "firm",
        drafts_by_tone: draft.drafts_by_tone,
        summary: draft.summary,
        persuasion_points: draft.persuasion_points,
        empathy_points: draft.empathy_points,
        avoid_phrases: draft.avoid_phrases,
        used_knowledge_item_ids: usedKnowledgeIds,
        ai_risk_level: draft.risk_level,
        review_required: draft.review_required,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (draftError) throw draftError;

    return ok({ case: responseCase, draft: responseDraft });
  } catch (error) {
    console.error("generate-response-draft failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return ok({ error: message }, 500);
  }
});
