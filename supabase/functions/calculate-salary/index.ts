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

    const { annual_salary, monthly_work_hours = 209, weekly_work_hours = 40 } = await req.json();

    if (!annual_salary || annual_salary <= 0) {
      return new Response(
        JSON.stringify({ error: "연봉 금액을 입력해주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `당신은 한국 근로기준법 전문 급여 계산 AI입니다.
주어진 연봉을 기반으로 다음 항목을 정확히 계산해주세요:

계산 규칙:
1. 월급여 = 연봉 ÷ 12
2. 통상시급 = 월급여 ÷ 월 소정근로시간(${monthly_work_hours}시간)
3. 기본급과 고정초과근무수당 분리 계산
   - 고정초과근무수당은 월 연장근로 시간을 12시간(주당 약 3시간)으로 가정
   - 연장근로 수당 = 통상시급 × 1.5 × 월 연장근로시간(12시간)
   - 기본급 = 월급여 - 고정초과근무수당
4. 모든 금액은 원 단위로 반올림

반드시 아래 형식의 JSON으로만 응답하세요. 다른 텍스트는 포함하지 마세요.`;

    const userPrompt = `연봉: ${annual_salary}원, 월 소정근로시간: ${monthly_work_hours}시간, 주 소정근로시간: ${weekly_work_hours}시간`;

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
              name: "salary_breakdown",
              description: "Return salary breakdown calculation result",
              parameters: {
                type: "object",
                properties: {
                  monthly_salary: { type: "number", description: "월급여 (원)" },
                  hourly_wage: { type: "number", description: "통상시급 (원)" },
                  base_pay: { type: "number", description: "기본급 (원)" },
                  fixed_overtime_pay: { type: "number", description: "고정초과근무수당 (원)" },
                  fixed_overtime_hours: { type: "number", description: "월 고정초과근무시간" },
                },
                required: ["monthly_salary", "hourly_wage", "base_pay", "fixed_overtime_pay", "fixed_overtime_hours"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "salary_breakdown" } },
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
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI 크레딧이 부족합니다." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      // Fallback: manual calculation
      const monthly = Math.round(annual_salary / 12);
      const hourly = Math.round(monthly / monthly_work_hours);
      const overtimePay = Math.round(hourly * 1.5 * 12);
      const basePay = monthly - overtimePay;

      return new Response(
        JSON.stringify({
          monthly_salary: monthly,
          hourly_wage: hourly,
          base_pay: basePay,
          fixed_overtime_pay: overtimePay,
          fixed_overtime_hours: 12,
          source: "fallback",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log("Salary calculation result:", result);

    return new Response(
      JSON.stringify({ ...result, source: "ai" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in calculate-salary:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
