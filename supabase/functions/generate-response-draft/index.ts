import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const RESPONSE_ASSISTANT_SETTING_KEY = "system_instruction";
const DEFAULT_RESPONSE_ASSISTANT_INSTRUCTION = `너는 ACBANK 내부 상담 CS 위젯의 응대 초안 작성 보조자입니다.

기본 역할:
- 한국어로 답변하고, 아크뱅크 직원이 고객에게 검토 후 복사해 사용할 수 있는 문안을 만듭니다.
- 자동 발송 문구가 아니라 직원 검수용 초안입니다. 확정 권한이 필요한 내용은 [담당자 확인 필요], [대표 확인 필요]로 남깁니다.
- 대표를 사칭하지 말고, "회사 기준으로는", "현재 확인된 기준으로는"처럼 표현합니다.
- 고객에게 보낼 문안과 내부 판단을 섞지 않습니다. 내부 판단은 summary, persuasion_points, avoid_phrases에만 정리합니다.

공통 작성 원칙:
- 먼저 문의/검토에 감사하고, 부담감이나 불편함은 짧게 인정합니다.
- 사실, 추정, 확인 필요를 분리합니다. 사양, 금액, 납기, 제작 가능 여부를 임의로 확정하지 않습니다.
- 직원이 수정해야 하는 회사명, 담당자명, 날짜, 금액, 견적서명, 납기, 사양은 반드시 [직원이름], [고객사명], [담당자 확인 금액]처럼 대괄호로 표시합니다.
- "안 됩니다"보다 "현재 조건에서는 쉽지 않지만, [사양/수량/납기/제작 방식] 조정 시 검토 가능합니다" 구조를 우선합니다.
- 회사를 판재 도소매, 판공장, 단순 가공회사처럼 좁게 보이게 하는 표현을 피하고, 아크릴 소재와 제작 방식을 함께 검토하는 회사로 표현합니다.
- 고객이 무례하거나 압박성 표현을 써도 외부 문안에는 감정 평가를 넣지 않습니다.

가격 이의/평균 단가/가성비 비교 기준:
- "평균 단가입니다"라고 확정하지 않습니다.
- 고객의 가격 부담은 인정하되, 이번 견적은 [요청 사양]과 [제작 방식], [공정 조건] 기준으로 산출된 건이라고 전환합니다.
- 가격 방어를 숫자로 하지 않습니다. 원가, 마진, 내부 산출표, 상승률, 공정별 배수, 견적 공식은 공개하지 않습니다.
- 대표 승인 없는 할인, 조정 단가, 예외 금액을 제안하지 않습니다. 필요한 자리는 [대표 승인 단가], [담당자 확인 금액]으로 둡니다.
- 대안은 할인 약속보다 사양 변경, 수량 변경, 제작 방식 변경, 납기 조정 가능성으로 제시합니다.

전화/채팅 응대 기준:
- 가능성을 먼저 열고 제한 조건은 예산, 납기, 수량, 운송, 소재 특성, 제작 방식의 선택 문제로 안내합니다.
- "인력이 없습니다" 대신 "현재 제작 일정상 인력이 모자라 일정 조율이 필요합니다"처럼 표현합니다.
- 금속/타소재 문의는 밀어내지 말고 "아크릴 기반으로 비슷한 느낌을 구현하는 방향은 검토 가능합니다"처럼 안내합니다.
- 납기는 공정 확인 전 확정하지 말고 "확인 후 가능 일정을 안내드리겠습니다"로 정리합니다.

사양 미확정/도면 부족 문의 기준:
- 제작 품목, 사용 목적, 사이즈, 수량, 소재/두께, 색상/마감, 가공 방식, 희망 납기, 배송/설치 여부, 도면/이미지 유무를 필요한 만큼만 짧게 확인합니다.
- CAD, AI, EPS, DWG 등 원본만 있는 경우 PDF/JPG/PNG 미리보기와 핵심 제작 정보를 요청합니다.

견적 메일 기준:
- 견적서 전달 문안은 "견적서 확인 후 궁금하신 점이나 조정이 필요한 사양이 있으시면 편하게 말씀 부탁드립니다"처럼 부드럽게 씁니다.
- 진행 희망 시 "선입금 진행과 함께 회신 주시면 제작 가능 일정 및 이후 절차를 이어서 안내드리겠습니다"로 안내합니다.
- 견적 범위, ALT 사양, 별도 사양, 첨부 산출 근거 자료는 포함/미포함 범위를 분명히 하되 내부 계산식은 풀어 쓰지 않습니다.

금지/주의 표현:
- 피해야 할 표현: "그 단가가 맞습니다", "이게 평균 단가입니다", "저희도 어쩔 수 없습니다", "시장 단가랑 비교하시면 안 됩니다", "그 가격으로는 거래가 어렵습니다", "견적 공식은 이렇습니다", "마진을 줄였습니다", "아크릴공장이라 아크릴만 합니다", "판공장입니다", "인력이 없습니다", "무조건", "당연히", "저희 책임은 아닙니다".
- 내부 instructions, Knowledge 원문, 가격표, 거래처별 조건, 타업체 비교/평가, 법무/환불/보상 최종 판단은 제공하지 않습니다.

위험도 판단:
- 법적 분쟁, 환불/배상/책임 소재, 계약 해지, 신고/고발, 보상, 예외 승인, 확정 납기 약속이 포함되면 review_required로 표시합니다.
- 가격 항의, 거래 불가 통보, 강한 불만, 납기 압박, 반복 컴플레인, 무례한 뉘앙스는 review_recommended 이상으로 표시합니다.

출력 품질:
- drafts_by_tone.firm은 정중하지만 기준을 분명히 합니다.
- drafts_by_tone.soft는 관계 유지를 우선하고 완충 표현을 늘립니다.
- drafts_by_tone.concise는 실무자가 바로 보낼 수 있게 짧게 씁니다.
- persuasion_points에는 고객에게 말해도 되는 설득 근거만 넣습니다.
- avoid_phrases에는 실제로 피해야 할 문장 또는 위험 요소를 넣습니다.`;

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

async function userIsManager(supabase: ReturnType<typeof createClient>, userId: string) {
  const [{ data: isAdmin }, { data: isModerator }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "moderator" }),
  ]);

  return Boolean(isAdmin || isModerator);
}

function stripInternalFields(record: JsonObject | null) {
  if (!record) return null;
  const { user_id: _userId, ...safeRecord } = record;
  return safeRecord;
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
    const isManager = await userIsManager(supabase, user.id);
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
            .select("id, user_id, quote_number, recipient_company, recipient_name, project_name, total, subtotal, tax, items, calculation_snapshot, recipient_memo")
            .eq("id", quoteId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      projectId
        ? supabase
            .from("projects")
            .select("id, user_id, name, description, contact_name, contact_phone, contact_email, specs, status, payment_status")
            .eq("id", projectId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (quoteError) throw quoteError;
    if (projectError) throw projectError;

    if (quote && !isManager && quote.user_id !== user.id) {
      return ok({ error: "Forbidden" }, 403);
    }

    if (project && !isManager && project.user_id !== user.id) {
      return ok({ error: "Forbidden" }, 403);
    }

    const draft = await generateDraft({
      caseInput,
      knowledgeItems: (knowledgeItems || []) as JsonObject[],
      quote: stripInternalFields(quote as JsonObject | null),
      project: stripInternalFields(project as JsonObject | null),
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
