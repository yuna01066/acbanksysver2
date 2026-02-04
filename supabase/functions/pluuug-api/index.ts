import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PLUUUG_BASE_URL = "https://openapi.pluuug.com";

// HMAC-SHA256 서명 생성 (Web Crypto API 사용)
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

// Pluuug API 호출 헬퍼
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
    console.log(`[Pluuug API] ${method} ${endpoint}`);
    
    const response = await fetch(`${PLUUUG_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: bodyString || undefined,
    });

    const responseData = await response.json();
    console.log(`[Pluuug API] Response status: ${response.status}`);

    if (!response.ok) {
      console.error(`[Pluuug API] Error:`, responseData);
      return { error: responseData.message || "Pluuug API error", status: response.status };
    }

    return { data: responseData, status: response.status };
  } catch (error: unknown) {
    console.error(`[Pluuug API] Network error:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { error: `Network error: ${errorMessage}`, status: 500 };
  }
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      }
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

    const { action, ...params } = await req.json();
    console.log(`[Pluuug] Action: ${action}`, params);

    let result;

    switch (action) {
      // ==================== 고객 (Client) ====================
      case "client.list":
        result = await callPluuugApi("/v1/client", "GET");
        break;

      case "client.create":
        result = await callPluuugApi("/v1/client", "POST", params.data);
        break;

      case "client.get":
        result = await callPluuugApi(`/v1/client/${params.id}`, "GET");
        break;

      case "client.update":
        result = await callPluuugApi(`/v1/client/${params.id}`, "PATCH", params.data);
        break;

      case "client.delete":
        result = await callPluuugApi(`/v1/client/${params.id}`, "DELETE");
        break;

      case "client.status.list":
        result = await callPluuugApi("/v1/client/status", "GET");
        break;

      // ==================== 견적서 (Estimate) ====================
      case "estimate.list":
        result = await callPluuugApi("/v1/estimate", "GET");
        break;

      case "estimate.create":
        result = await callPluuugApi("/v1/estimate", "POST", params.data);
        break;

      case "estimate.get":
        result = await callPluuugApi(`/v1/estimate/${params.id}`, "GET");
        break;

      case "estimate.update":
        result = await callPluuugApi(`/v1/estimate/${params.id}`, "PATCH", params.data);
        break;

      case "estimate.delete":
        result = await callPluuugApi(`/v1/estimate/${params.id}`, "DELETE");
        break;

      case "estimate.status.list":
        result = await callPluuugApi("/v1/estimate/status", "GET");
        break;

      case "estimate.item.list":
        result = await callPluuugApi("/v1/estimate/item", "GET");
        break;

      // ==================== 계약 (Contract) ====================
      case "contract.list":
        result = await callPluuugApi("/v1/contract", "GET");
        break;

      case "contract.create":
        result = await callPluuugApi("/v1/contract", "POST", params.data);
        break;

      case "contract.get":
        result = await callPluuugApi(`/v1/contract/${params.id}`, "GET");
        break;

      case "contract.update":
        result = await callPluuugApi(`/v1/contract/${params.id}`, "PATCH", params.data);
        break;

      case "contract.delete":
        result = await callPluuugApi(`/v1/contract/${params.id}`, "DELETE");
        break;

      case "contract.category.list":
        result = await callPluuugApi("/v1/contract/category", "GET");
        break;

      // ==================== 정산 (Settlement) ====================
      case "settlement.list":
        result = await callPluuugApi("/v1/settlement", "GET");
        break;

      case "settlement.create":
        result = await callPluuugApi("/v1/settlement", "POST", params.data);
        break;

      case "settlement.get":
        result = await callPluuugApi(`/v1/settlement/${params.id}`, "GET");
        break;

      case "settlement.update":
        result = await callPluuugApi(`/v1/settlement/${params.id}`, "PATCH", params.data);
        break;

      case "settlement.delete":
        result = await callPluuugApi(`/v1/settlement/${params.id}`, "DELETE");
        break;

      case "settlement.type.list":
        result = await callPluuugApi("/v1/settlement/type", "GET");
        break;

      // ==================== 의뢰 (Request) ====================
      case "request.list":
        result = await callPluuugApi("/v1/request", "GET");
        break;

      case "request.create":
        result = await callPluuugApi("/v1/request", "POST", params.data);
        break;

      case "request.get":
        result = await callPluuugApi(`/v1/request/${params.id}`, "GET");
        break;

      case "request.update":
        result = await callPluuugApi(`/v1/request/${params.id}`, "PATCH", params.data);
        break;

      case "request.delete":
        result = await callPluuugApi(`/v1/request/${params.id}`, "DELETE");
        break;

      // ==================== 폴더 (Folder) ====================
      case "folder.list":
        result = await callPluuugApi("/v1/folder", "GET");
        break;

      case "folder.create":
        result = await callPluuugApi("/v1/folder", "POST", params.data);
        break;

      case "folder.get":
        result = await callPluuugApi(`/v1/folder/${params.id}`, "GET");
        break;

      case "folder.update":
        result = await callPluuugApi(`/v1/folder/${params.id}`, "PATCH", params.data);
        break;

      case "folder.delete":
        result = await callPluuugApi(`/v1/folder/${params.id}`, "DELETE");
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[Pluuug] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
