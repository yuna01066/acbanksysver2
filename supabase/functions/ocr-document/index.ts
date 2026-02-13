import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType, documentType } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: '이미지 데이터가 필요합니다.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = documentType === 'receipt'
      ? `이 영수증/구매 영수증 이미지를 분석해주세요. 다음 JSON 형식으로 정확히 응답해주세요:
{
  "vendor_name": "판매업체명",
  "vendor_phone": "전화번호",
  "vendor_business_number": "사업자번호",
  "purchase_date": "YYYY-MM-DD 형식의 구매일자",
  "items": [
    {"name": "항목명", "quantity": 수량(숫자), "unit_price": 단가(숫자), "amount": 금액(숫자)}
  ],
  "subtotal": 공급가액(숫자),
  "tax": 부가세(숫자),
  "total": 합계금액(숫자)
}
숫자 값은 반드시 숫자 타입으로 응답하세요. 알 수 없는 값은 null로 응답하세요. JSON만 응답해주세요.`
      : `이 견적서/Invoice 이미지를 분석해주세요. 다음 JSON 형식으로 정확히 응답해주세요:
{
  "vendor_name": "발행업체명",
  "vendor_phone": "전화번호",
  "vendor_business_number": "사업자번호",
  "purchase_date": "YYYY-MM-DD 형식의 견적일자",
  "items": [
    {"name": "항목명", "quantity": 수량(숫자), "unit_price": 단가(숫자), "amount": 금액(숫자)}
  ],
  "subtotal": 공급가액(숫자),
  "tax": 부가세(숫자),
  "total": 합계금액(숫자)
}
숫자 값은 반드시 숫자 타입으로 응답하세요. 알 수 없는 값은 null로 응답하세요. JSON만 응답해주세요.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      console.error('Parse error:', parseErr, 'Content:', content);
      return new Response(JSON.stringify({ error: 'OCR 결과를 파싱할 수 없습니다.', raw: content }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('OCR error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
