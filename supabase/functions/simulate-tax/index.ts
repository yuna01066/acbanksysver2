import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const {
      total_salary,
      total_tax_paid = 0,
      total_local_tax_paid = 0,
      basic_deduction_count = 1,
      dependents = [],
      deductions = [],
    } = body;

    if (!total_salary || total_salary <= 0) {
      return new Response(
        JSON.stringify({ error: "총급여를 입력해주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deductionSummary = deductions
      .map((d: any) => `- ${d.category}: ${d.total.toLocaleString()}원`)
      .join("\n");

    const dependentSummary = dependents
      .map((d: any) => {
        const tags = [];
        if (d.is_disabled) tags.push("장애인");
        if (d.is_senior) tags.push("경로우대");
        if (d.is_child_under6) tags.push("6세이하");
        if (d.is_single_parent) tags.push("한부모");
        return `- ${d.relationship}${tags.length ? ` (${tags.join(", ")})` : ""}`;
      })
      .join("\n");

    const systemPrompt = `당신은 한국 소득세법 전문가입니다. 주어진 근로소득과 공제자료를 바탕으로 예상 결정세액과 환급/추가납부액을 계산해주세요.

계산 규칙:
1. 근로소득금액 = 총급여 - 근로소득공제
2. 과세표준 = 근로소득금액 - 각종 소득공제
3. 산출세액 = 과세표준 × 세율 (누진세율 적용)
4. 결정세액 = 산출세액 - 세액공제
5. 환급/추가납부 = 기납부세액 - 결정세액

2025년 기준 세율표:
- 1,400만원 이하: 6%
- 5,000만원 이하: 15% (126만원)
- 8,800만원 이하: 24% (576만원)
- 1.5억원 이하: 35% (1,544만원)
- 3억원 이하: 38% (1,994만원)
- 5억원 이하: 40% (2,594만원)
- 10억원 이하: 42% (3,594만원)
- 10억원 초과: 45% (6,594만원)

기본공제: 1인당 150만원
근로소득세액공제, 자녀세액공제 등도 고려하세요.

반드시 JSON으로만 응답하세요.`;

    const userPrompt = `총급여: ${total_salary.toLocaleString()}원
기납부 소득세: ${total_tax_paid.toLocaleString()}원
기납부 지방소득세: ${total_local_tax_paid.toLocaleString()}원
기본공제 대상: ${basic_deduction_count}명 (본인 포함)

부양가족:
${dependentSummary || "없음"}

소득·세액공제 자료:
${deductionSummary || "없음"}

위 정보를 바탕으로 예상 결정세액과 환급/추가납부액을 계산해주세요.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "tax_simulation_result",
              description: "Return year-end tax settlement simulation result",
              parameters: {
                type: "object",
                properties: {
                  gross_income: { type: "number", description: "총급여 (원)" },
                  earned_income_deduction: { type: "number", description: "근로소득공제 (원)" },
                  earned_income: { type: "number", description: "근로소득금액 (원)" },
                  total_income_deduction: { type: "number", description: "소득공제 합계 (원)" },
                  taxable_income: { type: "number", description: "과세표준 (원)" },
                  calculated_tax: { type: "number", description: "산출세액 (원)" },
                  tax_credits: { type: "number", description: "세액공제 합계 (원)" },
                  estimated_tax: { type: "number", description: "결정세액 (원)" },
                  estimated_refund: { type: "number", description: "환급액 (양수=환급, 음수=추가납부)" },
                  explanation: { type: "string", description: "계산 과정 간략 설명" },
                },
                required: ["estimated_tax", "estimated_refund"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "tax_simulation_result" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      // Fallback: simple calculation
      const grossIncome = total_salary;
      let deduction = 0;
      if (grossIncome <= 5000000) deduction = grossIncome * 0.7;
      else if (grossIncome <= 15000000) deduction = 3500000 + (grossIncome - 5000000) * 0.4;
      else if (grossIncome <= 45000000) deduction = 7500000 + (grossIncome - 15000000) * 0.15;
      else if (grossIncome <= 100000000) deduction = 12000000 + (grossIncome - 45000000) * 0.05;
      else deduction = 14750000 + (grossIncome - 100000000) * 0.02;

      const earnedIncome = grossIncome - deduction;
      const personalDeduction = basic_deduction_count * 1500000;
      const totalDeduction = deductions.reduce((s: number, d: any) => s + d.total, 0);
      const taxableIncome = Math.max(0, earnedIncome - personalDeduction - totalDeduction * 0.12);

      let tax = 0;
      if (taxableIncome <= 14000000) tax = taxableIncome * 0.06;
      else if (taxableIncome <= 50000000) tax = 840000 + (taxableIncome - 14000000) * 0.15;
      else if (taxableIncome <= 88000000) tax = 6240000 + (taxableIncome - 50000000) * 0.24;
      else tax = 15360000 + (taxableIncome - 88000000) * 0.35;

      const estimatedTax = Math.round(Math.max(0, tax * 0.9));
      const refund = total_tax_paid - estimatedTax;

      return new Response(
        JSON.stringify({ estimated_tax: estimatedTax, estimated_refund: refund, source: "fallback" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(
      JSON.stringify({ ...result, source: "ai" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in simulate-tax:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
