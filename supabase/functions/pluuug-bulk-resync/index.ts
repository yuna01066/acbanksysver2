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

async function callPluuugApi(endpoint: string, method: string, body?: object): Promise<{ data?: any; error?: string; status: number }> {
  const apiKey = Deno.env.get("PLUUUG_API_KEY");
  const secretKey = Deno.env.get("PLUUUG_SECRET_KEY");
  if (!apiKey || !secretKey) return { error: "Pluuug API keys not configured", status: 500 };

  const bodyString = body ? JSON.stringify(body) : "";
  const signature = await generateSignature(secretKey, bodyString);

  try {
    const response = await fetch(`${PLUUUG_BASE_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
        "X-Signature": signature,
      },
      body: bodyString || undefined,
    });

    let responseData: any = null;
    try { responseData = await response.json(); } catch { responseData = null; }

    if (!response.ok) {
      return { error: responseData?.message || "Pluuug API error", data: responseData, status: response.status };
    }
    return { data: responseData, status: response.status };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { error: msg, status: 500 };
  }
}

// Pluuug 의뢰 필드 ID 상수
const PLUUUG_FIELD_IDS = {
  THICKNESS: 21228,
  SIZE: 21229,
  COLOR_CODE: 21230,
  DOUBLE_SIDED: 21231,
  PAYMENT_STATUS: 21232,
  DELIVERY_ADDRESS: 21233,
  COLOR_CHANGE_NOTE: 21235,
  DESIRED_DELIVERY: 18120,
};

const THICKNESS_OPTION_IDS: Record<string, string> = {
  '1.3T': 'wNyFjaqXQmwypOo', '1.5T': 'aw1opkAgcQPj8bd', '2T': 'KJvrSObaidXzo2S',
  '3T': 'yiRfKobeCyTCa3C', '4T': 'SoIyHZKvYf8hhv7', '5T': 'vTgNJdyhcCg04bU',
  '6T': 'ytU7ES7NoWp7Jgq', '8T': 'ppH2Tu0h3aAeBIS', '10T': 'giolpsVDZtcKs8m',
  '12T': '7sjL4BmpiZWexgr', '14T': '5XoccG4iSIPekhj', '15T': 'R3ybbFBSdMBJ8wx',
  '20T': 'xLe671k980cf3dj', '30T': 'sIEgpDhvZl0MIgb', '30T 이상': 'YhFmNI2zE6DMuFn',
};

const DOUBLE_SIDED_OPTION_IDS: Record<string, string> = {
  '양면': '0DrVqhVvDYwYAPW', '단면': 'dlbz9XjNL7baq3f', '레이어 아크릴': 'l7d3HAb3WguqX6p',
};

function buildFieldSetFromQuoteItems(items: any[], quote: any): any[] {
  const fieldSet: any[] = [];

  // Thickness
  const thicknessOptionIds: { id: string }[] = [];
  const seenThickness = new Set<string>();
  items.forEach((item: any) => {
    if (item.thickness) {
      const t = item.thickness.toString().replace(/\s/g, '');
      if (!seenThickness.has(t) && THICKNESS_OPTION_IDS[t]) {
        seenThickness.add(t);
        thicknessOptionIds.push({ id: THICKNESS_OPTION_IDS[t] });
      }
    }
  });
  if (thicknessOptionIds.length > 0) {
    fieldSet.push({ field: { id: PLUUUG_FIELD_IDS.THICKNESS }, value: thicknessOptionIds });
  }

  // Size
  const sizes: string[] = [];
  items.forEach((item: any) => {
    if (item.width && item.height) sizes.push(`${item.width}×${item.height}mm`);
    else if (item.size) sizes.push(item.size);
    else if (item.selectedSize) sizes.push(item.selectedSize);
  });
  if (sizes.length > 0) {
    fieldSet.push({ field: { id: PLUUUG_FIELD_IDS.SIZE }, value: [...new Set(sizes)].join(', ') });
  }

  // Color codes
  const colors: string[] = [];
  items.forEach((item: any) => {
    if (item.color) colors.push(item.color);
    if (item.selectedColor) colors.push(item.selectedColor);
    if (item.colorCode) colors.push(item.colorCode);
  });
  if (colors.length > 0) {
    fieldSet.push({ field: { id: PLUUUG_FIELD_IDS.COLOR_CODE }, value: [...new Set(colors)].join(', ') });
  }

  // Double sided
  let surfaceOptionId: string | null = null;
  for (const item of items) {
    const surface = (item.surface || '').toString();
    const breakdownText = (item.breakdown || []).map((b: any) => b.label || '').join(' ');
    const sizeText = (item.size || item.selectedSize || '').toString();
    const combined = `${surface} ${breakdownText} ${sizeText}`.toLowerCase();
    if (combined.includes('양면')) { surfaceOptionId = DOUBLE_SIDED_OPTION_IDS['양면']; break; }
    else if (combined.includes('단면')) { surfaceOptionId = DOUBLE_SIDED_OPTION_IDS['단면']; break; }
    else if (combined.includes('레이어')) { surfaceOptionId = DOUBLE_SIDED_OPTION_IDS['레이어 아크릴']; break; }
  }
  if (surfaceOptionId) {
    fieldSet.push({ field: { id: PLUUUG_FIELD_IDS.DOUBLE_SIDED }, value: { id: surfaceOptionId } });
  }

  // Payment status
  fieldSet.push({ field: { id: PLUUUG_FIELD_IDS.PAYMENT_STATUS }, value: false });

  // Delivery address
  if (quote.recipient_address && quote.recipient_address !== '_' && quote.recipient_address !== '-') {
    fieldSet.push({ field: { id: PLUUUG_FIELD_IDS.DELIVERY_ADDRESS }, value: quote.recipient_address });
  }

  // Custom color
  const customColorInfo: string[] = [];
  items.forEach((item: any) => {
    if (item.customColorName) customColorInfo.push(item.customColorName);
    if (item.customOpacity) customColorInfo.push(`투명도: ${item.customOpacity}`);
  });
  if (customColorInfo.length > 0) {
    fieldSet.push({ field: { id: PLUUUG_FIELD_IDS.COLOR_CHANGE_NOTE }, value: customColorInfo.join(', ') });
  }

  // Desired delivery date
  if (quote.desired_delivery_date) {
    try {
      const dateStr = quote.desired_delivery_date.split('T')[0].split(' ')[0];
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        fieldSet.push({ field: { id: PLUUUG_FIELD_IDS.DESIRED_DELIVERY }, value: dateStr });
      }
    } catch {}
  }

  return fieldSet;
}

function formatEstimateContent(quote: any, items: any[]): string {
  const lines: string[] = [];
  lines.push(`=== ${quote.project_name || `아크뱅크 견적서 ${quote.quote_number}`} ===`);
  lines.push(`견적번호: ${quote.quote_number}`);
  lines.push(`견적일자: ${(quote.quote_date || '').split('T')[0]}`);
  lines.push('');
  lines.push('【 품목 내역 】');

  items.forEach((item: any, index: number) => {
    const name = `${item.material || ''} ${item.quality || ''} ${item.thickness || ''}`.trim() || item.name || `항목 ${index + 1}`;
    const qty = item.quantity || 1;
    const unitPrice = item.totalPrice || 0;
    const amount = unitPrice * qty;
    lines.push(`${index + 1}. ${name}`);
    lines.push(`   수량: ${qty}개`);
    lines.push(`   단가: ₩${unitPrice.toLocaleString()}`);
    lines.push(`   금액: ₩${amount.toLocaleString()}`);
    const desc = (item.breakdown || []).filter((b: any) => b.price > 0).map((b: any) => b.label).join(', ');
    if (desc) lines.push(`   상세: ${desc}`);
    lines.push('');
  });

  lines.push('【 합계 】');
  lines.push(`공급가액: ₩${Number(quote.subtotal).toLocaleString()}`);
  lines.push(`부가세: ₩${Number(quote.tax).toLocaleString()}`);
  lines.push(`총합계: ₩${Number(quote.total).toLocaleString()}`);
  lines.push('');
  if (quote.valid_until) lines.push(`유효기한: ${quote.valid_until}`);
  if (quote.delivery_period) lines.push(`납기: ${quote.delivery_period}`);
  if (quote.payment_condition) lines.push(`결제조건: ${quote.payment_condition}`);
  if (quote.issuer_name) {
    lines.push('');
    lines.push('【 담당자 】');
    lines.push(quote.issuer_name);
    if (quote.issuer_phone) lines.push(`연락처: ${quote.issuer_phone}`);
    if (quote.issuer_email) lines.push(`이메일: ${quote.issuer_email}`);
  }

  return lines.join('\n');
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

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: claims, error: authError } = await supabaseUser.auth.getUser(token);
    if (authError || !claims?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const userId = claims.user.id;

    console.log(`[Bulk Resync] Starting for user: ${userId}`);

    // Step 1: Get all synced quotes
    const { data: syncedQuotes, error: fetchError } = await supabaseAdmin
      .from("saved_quotes")
      .select("*")
      .eq("user_id", userId)
      .eq("pluuug_synced", true)
      .not("pluuug_estimate_id", "is", null);

    if (fetchError) {
      console.error("[Bulk Resync] Fetch error:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Bulk Resync] Found ${syncedQuotes?.length || 0} synced quotes`);

    // Step 2: Delete all Pluuug inquiries
    let deletedCount = 0;
    const deleteErrors: string[] = [];

    for (const quote of (syncedQuotes || [])) {
      const pluuugId = quote.pluuug_estimate_id;
      if (!pluuugId) continue;

      console.log(`[Bulk Resync] Deleting Pluuug inquiry: ${pluuugId} (quote: ${quote.quote_number})`);
      const result = await callPluuugApi(`/v1/inquiry/${pluuugId}`, "DELETE");

      if (result.status >= 200 && result.status < 300 || result.status === 404) {
        deletedCount++;
        console.log(`[Bulk Resync] Deleted: ${pluuugId}`);
      } else {
        deleteErrors.push(`${quote.quote_number}: ${result.error}`);
        console.error(`[Bulk Resync] Delete failed for ${pluuugId}:`, result.error);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`[Bulk Resync] Deleted ${deletedCount} inquiries, ${deleteErrors.length} errors`);

    // Step 3: Reset sync metadata for ALL quotes (even failed deletes - Pluuug side is gone or errored)
    const { error: resetError } = await supabaseAdmin
      .from("saved_quotes")
      .update({
        pluuug_synced: false,
        pluuug_synced_at: null,
        pluuug_estimate_id: null,
      })
      .eq("user_id", userId);

    if (resetError) {
      console.error("[Bulk Resync] Reset error:", resetError);
    }

    // Also clear any pending sync events
    await supabaseAdmin
      .from("pluuug_sync_events")
      .update({ status: "resolved", resolved_action: "bulk_resync", resolved_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "pending");

    // Step 4: Get ALL quotes to re-sync
    const { data: allQuotes, error: allFetchError } = await supabaseAdmin
      .from("saved_quotes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (allFetchError) {
      console.error("[Bulk Resync] Fetch all quotes error:", allFetchError);
      return new Response(JSON.stringify({
        phase: "resync",
        error: allFetchError.message,
        deleted: deletedCount,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[Bulk Resync] Re-syncing ${allQuotes?.length || 0} quotes`);

    // Step 5: Get recipient data and build client ID mapping
    const { data: recipients } = await supabaseAdmin
      .from("recipients")
      .select("*")
      .eq("user_id", userId);

    const clientIdMap = new Map<string, number>();
    const recipientMap = new Map<string, any>();
    (recipients || []).forEach((r: any) => {
      const key = `${r.company_name}|${r.contact_person}`;
      recipientMap.set(key, r);
      if (r.pluuug_client_id) {
        clientIdMap.set(key, r.pluuug_client_id);
      }
    });

    // Step 5.5: Pre-create all unique clients first (to avoid timeout)
    const uniqueClients = new Set<string>();
    for (const quote of (allQuotes || [])) {
      const clientKey = `${quote.recipient_company || ''}|${quote.recipient_name || ''}`;
      if (quote.recipient_company && !clientIdMap.has(clientKey) && !uniqueClients.has(clientKey)) {
        uniqueClients.add(clientKey);
      }
    }

    let clientsCreated = 0;
    const syncErrors: string[] = [];

    console.log(`[Bulk Resync] Need to create ${uniqueClients.size} unique clients`);

    for (const clientKey of uniqueClients) {
      const [companyName, contactPerson] = clientKey.split('|');
      const recipient = recipientMap.get(clientKey);
      const email = (recipient?.email || '');
      const validEmail = email && email.includes('@') ? email
        : `${(companyName || 'unknown').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'client'}@example.com`;

      const clientPayload = {
        companyName: companyName || '미정 회사',
        inCharge: contactPerson || '담당자',
        position: recipient?.position || '담당자',
        contact: recipient?.phone || '010-0000-0000',
        email: validEmail,
        content: recipient?.memo || '-',
        ceoName: recipient?.ceo_name || contactPerson || '대표자',
        businessRegistrationNumber: recipient?.business_registration_number || '000-00-00000',
        companyAddress: recipient?.address || '미정',
        companyDetailAddress: recipient?.detail_address || '-',
        businessType: recipient?.business_type || '서비스업',
        businessClass: recipient?.business_class || '기타',
        branchNumber: recipient?.branch_number || '00',
        status: { id: 45637 },
        fieldSet: [],
      };

      const clientResult = await callPluuugApi("/v1/client", "POST", clientPayload);

      if (clientResult.data?.id) {
        clientIdMap.set(clientKey, clientResult.data.id);
        clientsCreated++;
        if (recipient) {
          await supabaseAdmin
            .from("recipients")
            .update({ pluuug_client_id: clientResult.data.id, pluuug_synced_at: new Date().toISOString() })
            .eq("id", recipient.id);
        }
        console.log(`[Bulk Resync] Created client ${clientResult.data.id} for ${companyName}`);
      } else {
        console.error(`[Bulk Resync] Client create failed for ${companyName}:`, JSON.stringify(clientResult));
      }
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    console.log(`[Bulk Resync] Clients created: ${clientsCreated}. Now creating inquiries...`);

    // Step 6: Re-create inquiries on Pluuug
    let syncedCount = 0;

    for (const quote of (allQuotes || [])) {
      // Skip already synced (from previous partial run)
      if (quote.pluuug_synced && quote.pluuug_estimate_id) {
        syncedCount++;
        continue;
      }

      const items = Array.isArray(quote.items) ? quote.items : [];
      const clientKey = `${quote.recipient_company || ''}|${quote.recipient_name || ''}`;
      const clientId = clientIdMap.get(clientKey);

      if (!clientId) {
        syncErrors.push(`${quote.quote_number}: 고객 ID 없음`);
        continue;
      }

      const estimateContent = formatEstimateContent(quote, items);
      const fieldSet = buildFieldSetFromQuoteItems(items, quote);

      const inquiryName = quote.project_name || `아크뱅크 견적서 ${quote.quote_number}`;
      const inquiryDate = (quote.quote_date || new Date().toISOString()).split('T')[0];

      const payload = {
        name: inquiryName,
        estimate: quote.total.toString(),
        content: estimateContent,
        inquiryDate,
        contract: null,
        workSet: [],
        inChargeSet: [],
        fieldSet,
        status: { id: 120348 },
        client: { id: clientId },
      };

      console.log(`[Bulk Resync] Creating inquiry for: ${quote.quote_number}`);
      const result = await callPluuugApi("/v1/inquiry", "POST", payload);

      if (result.data?.id) {
        const newInquiryId = result.data.id.toString();
        syncedCount++;

        // Update local record
        await supabaseAdmin
          .from("saved_quotes")
          .update({
            pluuug_synced: true,
            pluuug_synced_at: new Date().toISOString(),
            pluuug_estimate_id: newInquiryId,
          })
          .eq("id", quote.id);

        console.log(`[Bulk Resync] Created inquiry ${newInquiryId} for ${quote.quote_number}`);
      } else {
        console.error(`[Bulk Resync] Create failed for ${quote.quote_number}:`, result.error);
        syncErrors.push(`${quote.quote_number}: ${result.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`[Bulk Resync] Done. Deleted: ${deletedCount}, Re-synced: ${syncedCount}, Errors: ${syncErrors.length}`);

    return new Response(JSON.stringify({
      success: true,
      deleted: deletedCount,
      clientsCreated,
      synced: syncedCount,
      total: allQuotes?.length || 0,
      deleteErrors,
      syncErrors,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("[Bulk Resync] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
