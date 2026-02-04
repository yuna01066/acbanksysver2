import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PLUUUG_BASE_URL = "https://openapi.pluuug.com";
const COLOR_CLASSIFICATION_ID = 2648; // Pluuug '컬러' 분류 ID

// HMAC-SHA256 서명 생성
async function generateSignature(secretKey: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(body);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Pluuug API 호출
async function callPluuugApi(
  endpoint: string,
  method: string,
  body?: object
): Promise<{ data?: any; error?: string; status: number }> {
  const apiKey = Deno.env.get("PLUUUG_API_KEY");
  const secretKey = Deno.env.get("PLUUUG_SECRET_KEY");

  if (!apiKey || !secretKey) {
    return { error: "Pluuug API keys not configured", status: 500 };
  }

  const bodyString = body ? JSON.stringify(body) : "";
  const signature = await generateSignature(secretKey, bodyString);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-KEY": apiKey,
    "X-Signature": signature,
  };

  try {
    const response = await fetch(`${PLUUUG_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: bodyString || undefined,
    });

    let responseData: any = null;
    try {
      responseData = await response.json();
    } catch {
      responseData = await response.text().catch(() => null);
    }

    if (!response.ok) {
      const message =
        (typeof responseData === "string" && responseData) ||
        responseData?.message ||
        responseData?.error ||
        "Pluuug API error";
      return { error: message, data: responseData, status: response.status };
    }

    return { data: responseData, status: response.status };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { error: `Network error: ${errorMessage}`, status: 500 };
  }
}

// 소재 타입별 접두사 매핑
function getMaterialPrefix(quality: string): string {
  switch (quality) {
    case 'glossy-color':
      return 'Clear';
    case 'astel-color':
      return 'Astel';
    case 'satin-color':
      return 'Bright';
    case 'acrylic-mirror':
      return 'Mirror';
    case 'astel-mirror':
      return 'Astel Mirror';
    default:
      return 'Color';
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 인증 확인
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !claims?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, quality, offset = 0, limit = 50 } = await req.json();
    console.log(`[Pluuug Color Sync] Action: ${action}, Quality: ${quality}, Offset: ${offset}, Limit: ${limit}`);

    if (action === "sync-colors") {
      // 색상 데이터 가져오기
      let query = supabaseClient
        .from("color_options")
        .select(`
          color_name,
          color_code,
          panel_masters!inner(name, quality)
        `)
        .eq("is_active", true)
        .order("display_order");

      if (quality) {
        query = query.eq("panel_masters.quality", quality);
      }

      query = query.range(offset, offset + limit - 1);

      const { data: colors, error: dbError } = await query;

      if (dbError) {
        console.error("[Pluuug Color Sync] DB Error:", dbError);
        return new Response(
          JSON.stringify({ error: dbError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Pluuug Color Sync] Found ${colors?.length || 0} colors to sync`);

      const results: { success: number; failed: number; errors: string[] } = {
        success: 0,
        failed: 0,
        errors: []
      };

      // 색상별로 Pluuug 항목 생성
      for (const color of colors || []) {
        const panelMaster = (color.panel_masters as unknown as { name: string; quality: string });
        const prefix = getMaterialPrefix(panelMaster.quality);
        const title = `${prefix} ${color.color_name}`;
        const description = `${panelMaster.name} ${color.color_code}`;

        const result = await callPluuugApi("/v1/estimate/item", "POST", {
          title,
          unitCost: 0,
          classification: { id: COLOR_CLASSIFICATION_ID },
          unit: "EA",
          description
        });

        if (result.status === 201) {
          results.success++;
          console.log(`[Pluuug Color Sync] Created: ${title}`);
        } else {
          results.failed++;
          results.errors.push(`${title}: ${result.error}`);
          console.error(`[Pluuug Color Sync] Failed: ${title} - ${result.error}`);
        }

        // Rate limiting - 100ms delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return new Response(
        JSON.stringify({
          message: `Synced ${results.success} colors, ${results.failed} failed`,
          ...results,
          totalProcessed: colors?.length || 0,
          nextOffset: offset + (colors?.length || 0)
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-color-count") {
      // 각 소재별 색상 개수 조회
      const { data: counts, error } = await supabaseClient
        .from("color_options")
        .select(`
          panel_masters!inner(quality, name)
        `)
        .eq("is_active", true);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 소재별 그룹핑
      const grouped: Record<string, { name: string; count: number }> = {};
      for (const item of counts || []) {
        const pm = (item.panel_masters as unknown as { quality: string; name: string });
        if (!grouped[pm.quality]) {
          grouped[pm.quality] = { name: pm.name, count: 0 };
        }
        grouped[pm.quality].count++;
      }

      return new Response(
        JSON.stringify({ data: grouped, total: counts?.length || 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[Pluuug Color Sync] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
