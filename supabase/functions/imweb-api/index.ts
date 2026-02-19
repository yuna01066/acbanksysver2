import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IMWEB_API_BASE = "https://openapi.imweb.me";

// --- Helper: get service-role supabase client for token storage ---
function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// --- Helper: get stored access token, refresh if needed ---
async function getImwebToken(): Promise<string> {
  const serviceClient = getServiceClient();

  const { data: tokenRow } = await serviceClient
    .from("imweb_oauth_tokens")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!tokenRow) {
    throw new Error("IMWEB_NOT_CONNECTED: 아임웹 OAuth 연결이 필요합니다. '아임웹 연결' 버튼을 눌러주세요.");
  }

  // Check if token is expired (with 5 min buffer)
  if (tokenRow.expires_at) {
    const expiresAt = new Date(tokenRow.expires_at);
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    if (now > expiresAt) {
      // Refresh the token
      console.log("Access token expired, refreshing...");
      return await refreshImwebToken(serviceClient, tokenRow.id, tokenRow.refresh_token);
    }
  }

  return tokenRow.access_token;
}

async function refreshImwebToken(serviceClient: any, tokenId: string, refreshToken: string): Promise<string> {
  const clientId = Deno.env.get("IMWEB_CLIENT_ID");
  const clientSecret = Deno.env.get("IMWEB_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("IMWEB_CLIENT_ID or IMWEB_CLIENT_SECRET not configured");

  const body = new URLSearchParams({
    clientId,
    clientSecret,
    refreshToken,
    grantType: "refresh_token",
  });

  const res = await fetch(`${IMWEB_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  console.log("Token refresh response:", JSON.stringify(data));

  if (!res.ok || !data.data?.accessToken) {
    // If refresh fails, delete the token row so user re-authenticates
    await serviceClient.from("imweb_oauth_tokens").delete().eq("id", tokenId);
    throw new Error("IMWEB_NOT_CONNECTED: 토큰이 만료되었습니다. 아임웹을 다시 연결해주세요.");
  }

  // Update stored tokens
  const updateData: Record<string, unknown> = {
    access_token: data.data.accessToken,
    updated_at: new Date().toISOString(),
  };
  if (data.data.refreshToken) {
    updateData.refresh_token = data.data.refreshToken;
  }
  // Assume token expires in 2 hours (imweb doesn't always return expires_in)
  updateData.expires_at = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  await serviceClient.from("imweb_oauth_tokens").update(updateData).eq("id", tokenId);

  return data.data.accessToken;
}

// --- API helpers ---
async function imwebGet(token: string, path: string, params?: Record<string, string>) {
  const url = new URL(`${IMWEB_API_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  return res.json();
}

async function imwebPatch(token: string, path: string, body: Record<string, unknown>) {
  const res = await fetch(`${IMWEB_API_BASE}${path}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // === OAuth callback - no auth required ===
    if (action === "oauth-callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      if (!code) {
        return new Response("Missing authorization code", { status: 400, headers: corsHeaders });
      }

      const clientId = Deno.env.get("IMWEB_CLIENT_ID");
      const clientSecret = Deno.env.get("IMWEB_CLIENT_SECRET");
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      if (!clientId || !clientSecret) {
        return new Response("Missing client credentials", { status: 500, headers: corsHeaders });
      }

      // The redirect URI must match exactly what was used in the authorize request
      const redirectUri = `${supabaseUrl}/functions/v1/imweb-api?action=oauth-callback`;

      const tokenBody = new URLSearchParams({
        clientId,
        clientSecret,
        code,
        grantType: "authorization_code",
        redirectUri,
      });

      const tokenRes = await fetch(`${IMWEB_API_BASE}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody.toString(),
      });

      const tokenData = await tokenRes.json();
      console.log("OAuth token exchange response:", JSON.stringify(tokenData));

      if (!tokenRes.ok || !tokenData.data?.accessToken) {
        // Redirect to app with error
        const appUrl = state || "/imweb-management";
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            Location: `${appUrl}?imweb_error=${encodeURIComponent(JSON.stringify(tokenData))}`,
          },
        });
      }

      // Store tokens using service role
      const serviceClient = getServiceClient();

      // Delete old tokens first
      await serviceClient.from("imweb_oauth_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      // Insert new token
      await serviceClient.from("imweb_oauth_tokens").insert({
        access_token: tokenData.data.accessToken,
        refresh_token: tokenData.data.refreshToken,
        scope: tokenData.data.scope || "",
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      });

      // Redirect back to app with success
      const appUrl = state || "/imweb-management";
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: `${appUrl}?imweb_connected=true`,
        },
      });
    }

    // === Generate OAuth authorize URL ===
    if (action === "get-auth-url") {
      const clientId = Deno.env.get("IMWEB_CLIENT_ID");
      const siteCode = Deno.env.get("IMWEB_SITE_CODE");
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      if (!clientId || !siteCode) {
        return new Response(JSON.stringify({ error: "Missing IMWEB_CLIENT_ID or IMWEB_SITE_CODE" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Read the body for the app's origin/callback
      let appOrigin = "";
      try {
        const body = await req.json();
        appOrigin = body.appOrigin || "";
      } catch { /* ignore */ }

      const redirectUri = `${supabaseUrl}/functions/v1/imweb-api?action=oauth-callback`;
      const state = appOrigin ? `${appOrigin}/imweb-management` : "/imweb-management";
      const scope = "product:read product:write order:read";
      const stateParam = crypto.randomUUID();

      const authUrl = `${IMWEB_API_BASE}/oauth2/authorize?responseType=code&clientId=${encodeURIComponent(clientId)}&redirectUri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}&siteCode=${encodeURIComponent(siteCode)}`;

      return new Response(JSON.stringify({ authUrl, redirectUri }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Check connection status (no user auth needed) ===
    if (action === "check-connection") {
      const serviceClient = getServiceClient();
      const { data: tokenRow } = await serviceClient
        .from("imweb_oauth_tokens")
        .select("id, scope, created_at, expires_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      return new Response(JSON.stringify({ connected: !!tokenRow, token: tokenRow ? { scope: tokenRow.scope, createdAt: tokenRow.created_at, expiresAt: tokenRow.expires_at } : null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- All other actions require user auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const jwtToken = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwtToken);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const imwebToken = await getImwebToken();

    // === TEST connection ===
    if (action === "test") {
      const result = await imwebGet(imwebToken, "/products", { limit: "1" });
      return new Response(
        JSON.stringify({
          success: true,
          message: "아임웹 Ground API 연결 성공",
          totalProducts: result.data?.totalCount || result.data?.length || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === SYNC PRODUCTS ===
    if (action === "sync-products") {
      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", userId).single();

      const { data: syncLog } = await supabase
        .from("imweb_sync_logs")
        .insert({ sync_type: "products", status: "running", user_id: userId, user_name: profile?.full_name || "Unknown" })
        .select().single();

      let page = 1;
      let totalSynced = 0;
      let totalCount = 0;

      try {
        while (true) {
          const result = await imwebGet(imwebToken, "/products", { page: String(page), limit: "100" });

          if (result.statusCode && result.statusCode !== 200) {
            throw new Error(`Product list failed: ${JSON.stringify(result)}`);
          }

          const products = result.data?.list || result.data || [];
          totalCount = result.data?.totalCount || products.length;

          if (!Array.isArray(products) || products.length === 0) break;

          for (const prod of products) {
            const prodNo = String(prod.prodNo || prod.no);

            await supabase.from("imweb_products").upsert(
              {
                imweb_prod_no: prodNo,
                name: prod.name || prod.prodName || "Unknown",
                price: prod.price?.salePrice || prod.salePrice || prod.price || 0,
                stock_qty: prod.stockInfo?.stockQty ?? prod.stockQty ?? -1,
                image_url: prod.imageUrl || prod.mainImageUrl || null,
                category: prod.categories?.[0]?.name || null,
                status: prod.status || prod.prodStatus || "sale",
                raw_data: prod,
                synced_at: new Date().toISOString(),
              },
              { onConflict: "imweb_prod_no" }
            );
            totalSynced++;
          }

          if (products.length < 100) break;
          page++;
        }

        if (syncLog) {
          await supabase.from("imweb_sync_logs")
            .update({ status: "success", total_count: totalCount, synced_count: totalSynced, completed_at: new Date().toISOString() })
            .eq("id", syncLog.id);
        }

        return new Response(JSON.stringify({ success: true, totalCount, syncedCount: totalSynced }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        if (syncLog) {
          await supabase.from("imweb_sync_logs")
            .update({ status: "error", error_message: err instanceof Error ? err.message : String(err), completed_at: new Date().toISOString() })
            .eq("id", syncLog.id);
        }
        throw err;
      }
    }

    // === SYNC ORDERS ===
    if (action === "sync-orders") {
      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", userId).single();

      const { data: syncLog } = await supabase
        .from("imweb_sync_logs")
        .insert({ sync_type: "orders", status: "running", user_id: userId, user_name: profile?.full_name || "Unknown" })
        .select().single();

      let page = 1;
      let totalSynced = 0;
      let totalCount = 0;

      try {
        while (true) {
          const result = await imwebGet(imwebToken, "/orders", { page: String(page), limit: "100" });

          if (result.statusCode && result.statusCode !== 200) {
            throw new Error(`Orders list failed: ${JSON.stringify(result)}`);
          }

          const orders = result.data?.list || result.data || [];
          totalCount = result.data?.totalCount || orders.length;

          if (!Array.isArray(orders) || orders.length === 0) break;

          for (const order of orders) {
            const orderNo = String(order.orderNo || order.order_no);
            await supabase.from("imweb_orders").upsert(
              {
                imweb_order_no: orderNo,
                order_date: order.orderDate || order.orderedAt || null,
                buyer_name: order.orderer?.name || order.buyerName || null,
                buyer_email: order.orderer?.email || order.buyerEmail || null,
                buyer_phone: order.orderer?.phone || order.buyerPhone || null,
                total_price: order.price?.totalPrice || order.totalPrice || 0,
                order_status: order.orderStatus || order.status || "ordered",
                items: order.items || order.orderItems || [],
                raw_data: order,
                synced_at: new Date().toISOString(),
              },
              { onConflict: "imweb_order_no" }
            );
            totalSynced++;
          }

          if (orders.length < 100) break;
          page++;
        }

        if (syncLog) {
          await supabase.from("imweb_sync_logs")
            .update({ status: "success", total_count: totalCount, synced_count: totalSynced, completed_at: new Date().toISOString() })
            .eq("id", syncLog.id);
        }

        return new Response(JSON.stringify({ success: true, totalCount, syncedCount: totalSynced }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        if (syncLog) {
          await supabase.from("imweb_sync_logs")
            .update({ status: "error", error_message: err instanceof Error ? err.message : String(err), completed_at: new Date().toISOString() })
            .eq("id", syncLog.id);
        }
        throw err;
      }
    }

    // === UPDATE STOCK ===
    if (action === "update-stock") {
      const body = await req.json();
      const { prodNo, stockQty } = body;
      if (!prodNo || stockQty === undefined) {
        return new Response(JSON.stringify({ error: "prodNo and stockQty required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await imwebPatch(imwebToken, `/products/${prodNo}/stock-info`, { stockQty });

      await supabase.from("imweb_products")
        .update({ stock_qty: stockQty, synced_at: new Date().toISOString() })
        .eq("imweb_prod_no", String(prodNo));

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === DISCONNECT ===
    if (action === "disconnect") {
      const serviceClient = getServiceClient();
      await serviceClient.from("imweb_oauth_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Imweb API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const isNotConnected = message.includes("IMWEB_NOT_CONNECTED");
    return new Response(
      JSON.stringify({ error: message, notConnected: isNotConnected }),
      {
        status: isNotConnected ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
