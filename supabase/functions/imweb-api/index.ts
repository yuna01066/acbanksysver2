import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IMWEB_API_BASE = "https://api.imweb.me/v2";

async function getImwebToken(): Promise<string> {
  const key = Deno.env.get("IMWEB_API_KEY");
  const secret = Deno.env.get("IMWEB_API_SECRET");
  if (!key || !secret) throw new Error("IMWEB_API_KEY or IMWEB_API_SECRET not configured");

  // Try POST with JSON body first (some imweb accounts require this)
  let res = await fetch(`${IMWEB_API_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, secret }),
  });
  let data = await res.json();

  // Fallback to GET with query params
  if (data.code !== 200 && !data.access_token) {
    res = await fetch(`${IMWEB_API_BASE}/auth?key=${encodeURIComponent(key)}&secret=${encodeURIComponent(secret)}`);
    data = await res.json();
  }

  if (data.code !== 200 && !data.access_token) {
    throw new Error(`Imweb auth failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function imwebGet(token: string, path: string, params?: Record<string, string>) {
  const url = new URL(`${IMWEB_API_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { "access-token": token, "Content-Type": "application/json" },
  });
  return res.json();
}

async function imwebPatch(token: string, path: string, body: Record<string, unknown>) {
  const res = await fetch(`${IMWEB_API_BASE}${path}`, {
    method: "PATCH",
    headers: { "access-token": token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const imwebToken = await getImwebToken();

    // === PRODUCTS: 상품 목록 조회 ===
    if (action === "sync-products") {
      // Get user name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      // Create sync log
      const { data: syncLog } = await supabase
        .from("imweb_sync_logs")
        .insert({
          sync_type: "products",
          status: "running",
          user_id: userId,
          user_name: profile?.full_name || "Unknown",
        })
        .select()
        .single();

      let page = 1;
      let totalSynced = 0;
      let totalCount = 0;

      try {
        while (true) {
          const result = await imwebGet(imwebToken, "/shop/prodlist", {
            page: String(page),
            limit: "100",
          });

          if (result.code !== 200) throw new Error(`Product list failed: ${JSON.stringify(result)}`);

          const products = result.data?.list || [];
          totalCount = result.data?.total_count || 0;

          if (products.length === 0) break;

          for (const prod of products) {
            const prodNo = String(prod.no);
            // Get detail for stock info
            const detail = await imwebGet(imwebToken, `/shop/prod/${prodNo}`);
            const detailData = detail.data || {};

            await supabase.from("imweb_products").upsert(
              {
                imweb_prod_no: prodNo,
                name: detailData.name || prod.name || "Unknown",
                price: detailData.price?.sell_price || prod.sell_price || 0,
                stock_qty: detailData.stock_use === "Y" ? (detailData.stock_qty ?? 0) : -1,
                image_url: detailData.image_url || prod.image_url || null,
                category: detailData.prod_categories?.[0]?.category_name || null,
                status: detailData.prod_status || "sale",
                raw_data: detailData,
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
          await supabase
            .from("imweb_sync_logs")
            .update({
              status: "success",
              total_count: totalCount,
              synced_count: totalSynced,
              completed_at: new Date().toISOString(),
            })
            .eq("id", syncLog.id);
        }

        return new Response(
          JSON.stringify({ success: true, totalCount, syncedCount: totalSynced }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        if (syncLog) {
          await supabase
            .from("imweb_sync_logs")
            .update({
              status: "error",
              error_message: err instanceof Error ? err.message : String(err),
              completed_at: new Date().toISOString(),
            })
            .eq("id", syncLog.id);
        }
        throw err;
      }
    }

    // === ORDERS: 주문 목록 조회 ===
    if (action === "sync-orders") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      const { data: syncLog } = await supabase
        .from("imweb_sync_logs")
        .insert({
          sync_type: "orders",
          status: "running",
          user_id: userId,
          user_name: profile?.full_name || "Unknown",
        })
        .select()
        .single();

      let page = 1;
      let totalSynced = 0;
      let totalCount = 0;

      // Optional date range
      const body = await req.json().catch(() => ({}));
      const params: Record<string, string> = { limit: "100" };
      if (body.startDate) params.start_date = body.startDate;
      if (body.endDate) params.end_date = body.endDate;

      try {
        while (true) {
          params.page = String(page);
          const result = await imwebGet(imwebToken, "/shop/orders", params);

          if (result.code !== 200) throw new Error(`Orders list failed: ${JSON.stringify(result)}`);

          const orders = result.data?.list || [];
          totalCount = result.data?.total_count || 0;

          if (orders.length === 0) break;

          for (const order of orders) {
            const orderNo = String(order.order_no);
            await supabase.from("imweb_orders").upsert(
              {
                imweb_order_no: orderNo,
                order_date: order.order_time
                  ? new Date(Number(order.order_time) * 1000).toISOString()
                  : null,
                buyer_name: order.orderer?.name || null,
                buyer_email: order.orderer?.email || null,
                buyer_phone: order.orderer?.phone || null,
                total_price: order.price?.total_price || 0,
                order_status: order.order_status || "ordered",
                items: order.items || [],
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
          await supabase
            .from("imweb_sync_logs")
            .update({
              status: "success",
              total_count: totalCount,
              synced_count: totalSynced,
              completed_at: new Date().toISOString(),
            })
            .eq("id", syncLog.id);
        }

        return new Response(
          JSON.stringify({ success: true, totalCount, syncedCount: totalSynced }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        if (syncLog) {
          await supabase
            .from("imweb_sync_logs")
            .update({
              status: "error",
              error_message: err instanceof Error ? err.message : String(err),
              completed_at: new Date().toISOString(),
            })
            .eq("id", syncLog.id);
        }
        throw err;
      }
    }

    // === INVENTORY UPDATE: 재고 수량 업데이트 ===
    if (action === "update-stock") {
      const body = await req.json();
      const { prodNo, stockQty } = body;
      if (!prodNo || stockQty === undefined) {
        return new Response(
          JSON.stringify({ error: "prodNo and stockQty required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await imwebPatch(imwebToken, `/shop/prod/${prodNo}`, {
        stock_qty: stockQty,
      });

      // Also update local cache
      await supabase
        .from("imweb_products")
        .update({ stock_qty: stockQty, synced_at: new Date().toISOString() })
        .eq("imweb_prod_no", String(prodNo));

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === TEST: 연결 테스트 ===
    if (action === "test") {
      const result = await imwebGet(imwebToken, "/shop/prodlist", { limit: "1" });
      return new Response(
        JSON.stringify({
          success: true,
          message: "아임웹 API 연결 성공",
          totalProducts: result.data?.total_count || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Imweb API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
