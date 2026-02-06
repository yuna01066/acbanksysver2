import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PLUUUG_BASE_URL = "https://openapi.pluuug.com";

async function generateSignature(secretKey: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(body);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function callPluuugApi(endpoint: string, method: string): Promise<{ data?: any; error?: string; status: number }> {
  const apiKey = Deno.env.get("PLUUUG_API_KEY");
  const secretKey = Deno.env.get("PLUUUG_SECRET_KEY");
  if (!apiKey || !secretKey) return { error: "Pluuug API keys not configured", status: 500 };

  const signature = await generateSignature(secretKey, "");
  try {
    const response = await fetch(`${PLUUUG_BASE_URL}${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey, "X-Signature": signature },
    });

    let responseData: any = null;
    try { responseData = await response.json(); } catch { responseData = null; }

    if (!response.ok) {
      return { error: responseData?.message || "Pluuug API error", status: response.status };
    }
    return { data: responseData, status: response.status };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { error: msg, status: 500 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Optional: authenticate user for manual trigger
    let requestUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      const { data: claims } = await supabaseUser.auth.getUser(token);
      requestUserId = claims?.user?.id || null;
    }

    console.log("[Pluuug Reverse Sync] Starting check...", requestUserId ? `for user: ${requestUserId}` : "for all users");

    // Get all synced quotes
    let query = supabaseAdmin
      .from("saved_quotes")
      .select("id, user_id, pluuug_estimate_id, pluuug_synced_at, total, quote_number")
      .eq("pluuug_synced", true)
      .not("pluuug_estimate_id", "is", null);

    if (requestUserId) {
      query = query.eq("user_id", requestUserId);
    }

    const { data: syncedQuotes, error: fetchError } = await query;
    if (fetchError) {
      console.error("[Pluuug Reverse Sync] Error fetching quotes:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!syncedQuotes || syncedQuotes.length === 0) {
      console.log("[Pluuug Reverse Sync] No synced quotes found");
      return new Response(JSON.stringify({ checked: 0, events: 0, autoUnlinked: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Pluuug Reverse Sync] Checking ${syncedQuotes.length} synced quotes`);

    let eventsCreated = 0;
    let autoUnlinked = 0;
    const results: any[] = [];

    for (const quote of syncedQuotes) {
      const pluuugId = quote.pluuug_estimate_id;

      // Check inquiry status on Pluuug
      const pluuugResult = await callPluuugApi(`/v1/inquiry/${pluuugId}`, "GET");

      if (pluuugResult.status === 404 || pluuugResult.error?.includes("Not Found") || pluuugResult.error?.includes("not found")) {
        // Inquiry was deleted on Pluuug → 자동으로 동기화 해제
        console.log(`[Pluuug Reverse Sync] DELETED on Pluuug: quote ${quote.quote_number} (inquiry ${pluuugId}) → Auto-unlinking`);

        const { error: unlinkError } = await supabaseAdmin
          .from("saved_quotes")
          .update({
            pluuug_synced: false,
            pluuug_synced_at: null,
            pluuug_estimate_id: null,
          })
          .eq("id", quote.id);

        if (unlinkError) {
          console.error(`[Pluuug Reverse Sync] Failed to unlink quote ${quote.quote_number}:`, unlinkError);
        } else {
          autoUnlinked++;
          console.log(`[Pluuug Reverse Sync] Auto-unlinked quote ${quote.quote_number}`);
        }

        // 기존 pending 이벤트가 있으면 자동 해결 처리
        await supabaseAdmin
          .from("pluuug_sync_events")
          .update({
            status: "resolved",
            resolved_action: "auto_unlink",
            resolved_at: new Date().toISOString(),
          })
          .eq("quote_id", quote.id)
          .eq("status", "pending");

        results.push({ quote_number: quote.quote_number, event: "auto_unlinked" });
      } else if (pluuugResult.data) {
        // Check if inquiry was modified (compare updatedAt)
        const pluuugUpdatedAt = pluuugResult.data.updatedAt || pluuugResult.data.updated_at;
        const localSyncedAt = quote.pluuug_synced_at;

        if (pluuugUpdatedAt && localSyncedAt) {
          const pluuugTime = new Date(pluuugUpdatedAt).getTime();
          const localTime = new Date(localSyncedAt).getTime();

          // If Pluuug was updated after local sync (with 10s buffer)
          if (pluuugTime > localTime + 10000) {
            // Check if there's already a pending event for this quote
            const { data: existingEvent } = await supabaseAdmin
              .from("pluuug_sync_events")
              .select("id")
              .eq("quote_id", quote.id)
              .eq("status", "pending")
              .maybeSingle();

            if (existingEvent) {
              console.log(`[Pluuug Reverse Sync] Pending event already exists for quote ${quote.quote_number}`);
              continue;
            }

            console.log(`[Pluuug Reverse Sync] MODIFIED on Pluuug: quote ${quote.quote_number}`);

            const pluuugData = pluuugResult.data;
            const changedDetails: any = {
              quote_number: quote.quote_number,
              detected_at: new Date().toISOString(),
              pluuug_updated_at: pluuugUpdatedAt,
              local_synced_at: localSyncedAt,
            };

            if (pluuugData.title) changedDetails.pluuug_title = pluuugData.title;
            if (pluuugData.content) changedDetails.pluuug_content = pluuugData.content;
            if (pluuugData.status) changedDetails.pluuug_status = pluuugData.status;

            const { error: insertError } = await supabaseAdmin
              .from("pluuug_sync_events")
              .insert({
                quote_id: quote.id,
                user_id: quote.user_id,
                event_type: "modified",
                pluuug_estimate_id: pluuugId,
                details: changedDetails,
              });

            if (!insertError) eventsCreated++;
            results.push({ quote_number: quote.quote_number, event: "modified" });
          }
        }
      }

      // Rate limit: small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`[Pluuug Reverse Sync] Done. Checked: ${syncedQuotes.length}, Auto-unlinked: ${autoUnlinked}, Events created: ${eventsCreated}`);

    return new Response(
      JSON.stringify({ checked: syncedQuotes.length, events: eventsCreated, autoUnlinked, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[Pluuug Reverse Sync] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
