import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAuthResponse, requireFunctionAuth, withCors } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IMWEB_API_BASE = "https://openapi.imweb.me";

function getImwebClientId() {
  return Deno.env.get("IMWEB_CLIENT_ID") || Deno.env.get("IMWEB_API_KEY") || "";
}

function getImwebClientSecret() {
  return Deno.env.get("IMWEB_CLIENT_SECRET") || Deno.env.get("IMWEB_API_SECRET") || "";
}

// --- Helper: get service-role supabase client for token storage ---
function getServiceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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
  const clientId = getImwebClientId();
  const clientSecret = getImwebClientSecret();
  if (!clientId || !clientSecret)
    throw new Error("IMWEB_CLIENT_ID/IMWEB_API_KEY or IMWEB_CLIENT_SECRET/IMWEB_API_SECRET not configured");

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

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function collectText(value: unknown, depth = 0): string[] {
  if (depth > 3) return [];
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text ? [text] : [];
  }
  if (Array.isArray(value)) return value.flatMap((item) => collectText(item, depth + 1));
  if (isRecord(value)) {
    return Object.values(value).flatMap((item) => collectText(item, depth + 1));
  }
  return [];
}

function normalizeTextKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function appendStat(
  map: Map<string, { label: string; quantity: number; amount: number }>,
  label: string,
  quantity: number,
  amount = 0,
) {
  const normalizedLabel = label.trim();
  if (!normalizedLabel) return;
  const key = normalizeTextKey(normalizedLabel);
  const current = map.get(key) || { label: normalizedLabel, quantity: 0, amount: 0 };
  current.quantity += quantity;
  current.amount += amount;
  map.set(key, current);
}

function topStats(map: Map<string, { label: string; quantity: number; amount: number }>, limit = 10) {
  return [...map.values()]
    .sort((a, b) => b.quantity - a.quantity || b.amount - a.amount || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((item) => ({
      ...item,
      quantity: Number(item.quantity.toFixed(2)),
      amount: Math.round(item.amount),
    }));
}

function extractOptionValue(item: JsonRecord, labels: string[]) {
  const candidates = [
    item.options,
    item.option,
    item.optionValues,
    item.option_values,
    item.selectedOptions,
    item.selected_options,
    item.prodOption,
    item.prod_option,
  ];

  for (const candidate of candidates) {
    const optionEntries = Array.isArray(candidate)
      ? candidate.map((option) => ["", option] as const)
      : isRecord(candidate)
        ? Object.entries(candidate)
        : [];
    for (const [entryKey, option] of optionEntries) {
      if (typeof option === "string" || typeof option === "number") {
        const normalizedKey = entryKey.toLowerCase();
        if (labels.some((label) => normalizedKey.includes(label))) return String(option).trim();
        continue;
      }
      if (!isRecord(option)) continue;
      const optionName = firstText(
        entryKey,
        option.name,
        option.label,
        option.key,
        option.optionName,
        option.option_name,
        option.title,
      );
      const optionValue = firstText(
        option.value,
        option.text,
        option.content,
        option.optionValue,
        option.option_value,
        option.valueName,
        option.value_name,
        option.label,
      );
      const normalizedName = optionName.toLowerCase();
      if (optionValue && optionValue !== optionName && labels.some((label) => normalizedName.includes(label)))
        return optionValue;
    }
  }

  return "";
}

function extractMaterial(item: JsonRecord, textBlob: string) {
  const optionMaterial = extractOptionValue(item, ["소재", "재질", "material", "quality"]);
  if (optionMaterial) return optionMaterial;

  const materialPatterns: Array<[RegExp, string]> = [
    [/(astel|아스텔)/i, "ASTEL"],
    [/(satin|사틴)/i, "SATIN"],
    [/(bright|브라이트)/i, "BRIGHT"],
    [/(mirror|미러|거울)/i, "MIRROR"],
    [/(clear|클리어|투명)/i, "CLEAR"],
    [/(포맥스|폼보드|formax)/i, "포맥스"],
    [/(pc|폴리카보네이트)/i, "PC"],
    [/(pet|a-pet|apet)/i, "A-PET"],
    [/(abs)/i, "ABS"],
    [/(아크릴)/i, "아크릴"],
  ];

  for (const [pattern, label] of materialPatterns) {
    if (pattern.test(textBlob)) return label;
  }
  return "미분류";
}

function extractColor(item: JsonRecord, textBlob: string) {
  const optionColor = extractOptionValue(item, ["색상", "컬러", "color", "colour"]);
  if (optionColor) return optionColor;

  const acbankCode = textBlob.match(/\bAC[-\s]?[A-Z]{0,2}\d{2,4}\b/i);
  if (acbankCode) return acbankCode[0].replace(/\s+/g, "-").toUpperCase();

  const colorPatterns: Array<[RegExp, string]> = [
    [/(clear|클리어|투명)/i, "투명"],
    [/(white|화이트|백색|흰색)/i, "화이트"],
    [/(black|블랙|검정|흑색)/i, "블랙"],
    [/(red|레드|빨강|적색)/i, "레드"],
    [/(blue|블루|파랑|청색)/i, "블루"],
    [/(green|그린|초록|녹색)/i, "그린"],
    [/(yellow|옐로우|노랑|황색)/i, "옐로우"],
    [/(orange|오렌지|주황)/i, "오렌지"],
    [/(purple|퍼플|보라)/i, "퍼플"],
    [/(gray|grey|그레이|회색)/i, "그레이"],
  ];

  for (const [pattern, label] of colorPatterns) {
    if (pattern.test(textBlob)) return label;
  }
  return "미분류";
}

function normalizeOrderItems(order: JsonRecord) {
  const rawItems = asArray(order.items);
  if (rawItems.length > 0) return rawItems;

  const rawData = isRecord(order.raw_data) ? order.raw_data : {};
  return asArray(rawData.items).length > 0 ? asArray(rawData.items) : asArray(rawData.orderItems);
}

function orderIsCountable(status: unknown) {
  const normalized = String(status || "").toLowerCase();
  return !["cancel", "cancelled", "canceled", "refund", "refunded", "failed"].some((token) =>
    normalized.includes(token),
  );
}

function getOrderNoFromApi(order: JsonRecord) {
  return String(order.orderNo || order.order_no || order.no || "").trim();
}

function buildImwebOrderUpsert(order: JsonRecord) {
  const orderNo = getOrderNoFromApi(order);
  return {
    imweb_order_no: orderNo,
    order_date: firstText(order.orderDate, order.orderedAt, order.createdAt, order.created_at) || null,
    buyer_name: firstText(isRecord(order.orderer) ? order.orderer.name : "", order.buyerName, order.buyer_name) || null,
    buyer_email:
      firstText(isRecord(order.orderer) ? order.orderer.email : "", order.buyerEmail, order.buyer_email) || null,
    buyer_phone:
      firstText(isRecord(order.orderer) ? order.orderer.phone : "", order.buyerPhone, order.buyer_phone) || null,
    total_price: toNumber(
      isRecord(order.price) ? order.price.totalPrice : undefined,
      toNumber(order.totalPrice ?? order.total_price, 0),
    ),
    order_status: firstText(order.orderStatus, order.status, order.order_status) || "ordered",
    items: asArray(order.items).length > 0 ? order.items : order.orderItems || [],
    raw_data: order,
    synced_at: new Date().toISOString(),
  };
}

function maskName(value: unknown) {
  const text = firstText(value);
  if (!text) return "";
  if (text.length <= 1) return "*";
  if (text.length === 2) return `${text[0]}*`;
  return `${text[0]}${"*".repeat(Math.max(1, text.length - 2))}${text[text.length - 1]}`;
}

function maskEmail(value: unknown) {
  const text = firstText(value);
  if (!text || !text.includes("@")) return text ? "***" : "";
  const [local, domain] = text.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskPhone(value: unknown) {
  const text = firstText(value);
  if (!text) return "";
  const digits = text.replace(/\D/g, "");
  if (digits.length < 7) return "***";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function buildMaskedAssignedOrder(order: JsonRecord, link: JsonRecord) {
  return {
    id: order.id,
    imweb_order_no: order.imweb_order_no,
    order_date: order.order_date,
    buyer_name: maskName(order.buyer_name),
    buyer_email: maskEmail(order.buyer_email),
    buyer_phone: maskPhone(order.buyer_phone),
    total_price: order.total_price,
    order_status: order.order_status,
    items: order.items,
    synced_at: order.synced_at,
    link,
  };
}

async function getTopOrderItems(serviceClient: ReturnType<typeof createClient>, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await serviceClient
    .from("imweb_orders")
    .select("order_date, order_status, items, synced_at")
    .gte("order_date", since)
    .order("order_date", { ascending: false })
    .limit(500);

  if (error) throw error;

  const products = new Map<string, { label: string; quantity: number; amount: number }>();
  const materials = new Map<string, { label: string; quantity: number; amount: number }>();
  const colors = new Map<string, { label: string; quantity: number; amount: number }>();
  let orderCount = 0;
  let itemCount = 0;
  let lastSyncedAt = "";

  for (const order of (data || []) as JsonRecord[]) {
    if (!orderIsCountable(order.order_status)) continue;
    orderCount++;
    if (typeof order.synced_at === "string" && (!lastSyncedAt || order.synced_at > lastSyncedAt)) {
      lastSyncedAt = order.synced_at;
    }

    const items = normalizeOrderItems(order);
    for (const rawItem of items) {
      if (!isRecord(rawItem)) continue;

      const productName =
        firstText(
          rawItem.name,
          rawItem.prodName,
          rawItem.prod_name,
          rawItem.productName,
          rawItem.product_name,
          rawItem.itemName,
          rawItem.item_name,
          isRecord(rawItem.product) ? rawItem.product.name : "",
        ) || "상품명 미확인";
      const quantity = Math.max(
        1,
        toNumber(rawItem.quantity ?? rawItem.qty ?? rawItem.count ?? rawItem.itemCount ?? rawItem.item_count, 1),
      );
      const amount = toNumber(
        rawItem.totalPrice ?? rawItem.total_price ?? rawItem.price ?? rawItem.salePrice ?? rawItem.sale_price,
        0,
      );
      const textBlob = collectText(rawItem).join(" ");

      appendStat(products, productName, quantity, amount);
      appendStat(materials, extractMaterial(rawItem, textBlob), quantity, amount);
      appendStat(colors, extractColor(rawItem, textBlob), quantity, amount);
      itemCount += quantity;
    }
  }

  return {
    days,
    orderCount,
    itemCount,
    lastSyncedAt: lastSyncedAt || null,
    products: topStats(products, 10),
    materials: topStats(materials, 10),
    colors: topStats(colors, 10),
  };
}

function safeAppRedirect(value: string | null): string {
  if (!value) return "/imweb-management";
  if (value.startsWith("/")) return value;

  try {
    const parsed = new URL(value);
    const allowedHosts = new Set([
      "acbanksysver2.lovable.app",
      "preview--acbanksysver2.lovable.app",
      "id-preview--29211ce7-47f3-4107-b997-8f94d725e890.lovable.app",
      "localhost",
      "127.0.0.1",
    ]);
    if (allowedHosts.has(parsed.hostname)) {
      return value;
    }
  } catch {
    return "/imweb-management";
  }

  return "/imweb-management";
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

      const clientId = getImwebClientId();
      const clientSecret = getImwebClientSecret();
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
        const appUrl = safeAppRedirect(state);
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
      const appUrl = safeAppRedirect(state);
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: `${appUrl}?imweb_connected=true`,
        },
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

      return new Response(
        JSON.stringify({
          connected: !!tokenRow,
          token: tokenRow
            ? { scope: tokenRow.scope, createdAt: tokenRow.created_at, expiresAt: tokenRow.expires_at }
            : null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Aggregated dashboard data only. Requires login, but does not expose buyer/order PII.
    if (action === "top-order-items") {
      await requireFunctionAuth(req);
      const daysParam = Number(url.searchParams.get("days") || "90");
      const days = Number.isFinite(daysParam) ? Math.min(Math.max(Math.round(daysParam), 7), 365) : 90;
      const result = await getTopOrderItems(getServiceClient(), days);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assigned user view. Uses service role and returns masked buyer PII.
    if (action === "assigned-orders") {
      const assignedAuth = await requireFunctionAuth(req);
      const assignedUserId = assignedAuth.user!.id;
      const serviceClient = assignedAuth.supabaseAdmin;

      const { data: links, error: linkError } = await serviceClient
        .from("imweb_order_links")
        .select("*")
        .eq("assigned_to", assignedUserId)
        .neq("link_status", "archived")
        .order("updated_at", { ascending: false })
        .limit(100);

      if (linkError) throw linkError;

      const orderNos = Array.from(
        new Set((links || []).map((link: JsonRecord) => String(link.imweb_order_no)).filter(Boolean)),
      );
      const { data: orders, error: orderError } =
        orderNos.length > 0
          ? await serviceClient
              .from("imweb_orders")
              .select(
                "id, imweb_order_no, order_date, buyer_name, buyer_email, buyer_phone, total_price, order_status, items, synced_at",
              )
              .in("imweb_order_no", orderNos)
          : { data: [], error: null };

      if (orderError) throw orderError;

      const orderMap = new Map((orders || []).map((order: JsonRecord) => [String(order.imweb_order_no), order]));
      const maskedOrders = (links || []).map((link: JsonRecord) => {
        const order = orderMap.get(String(link.imweb_order_no)) || { imweb_order_no: link.imweb_order_no };
        return buildMaskedAssignedOrder(order, link);
      });

      return new Response(JSON.stringify({ success: true, orders: maskedOrders }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authContext = await requireFunctionAuth(req, { allowedRoles: ["admin", "moderator"] });
    const userId = authContext.user!.id;

    // === Generate OAuth authorize URL ===
    if (action === "get-auth-url") {
      const clientId = getImwebClientId();
      const siteCode = Deno.env.get("IMWEB_SITE_CODE");
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      if (!clientId || !siteCode) {
        return new Response(JSON.stringify({ error: "Missing IMWEB_CLIENT_ID or IMWEB_SITE_CODE" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Read the body for the app's origin/callback
      let appOrigin = "";
      try {
        const body = await req.json();
        appOrigin = body.appOrigin || "";
      } catch {
        /* ignore */
      }

      const redirectUri = `${supabaseUrl}/functions/v1/imweb-api?action=oauth-callback`;
      const state = appOrigin ? `${appOrigin}/imweb-management` : "/imweb-management";
      const scope = "product:read product:write order:read";

      const authUrl = `${IMWEB_API_BASE}/oauth2/authorize?responseType=code&clientId=${encodeURIComponent(clientId)}&redirectUri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}&siteCode=${encodeURIComponent(siteCode)}`;

      return new Response(JSON.stringify({ authUrl, redirectUri }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Internal order link operations do not require a live Imweb token.
    if (action === "link-order") {
      const body = await req.json();
      const orderNo = firstText(body.orderNo, body.imweb_order_no);
      if (!orderNo) {
        return new Response(JSON.stringify({ error: "orderNo required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const serviceClient = authContext.supabaseAdmin;
      const { data: profile } = await serviceClient.from("profiles").select("full_name").eq("id", userId).maybeSingle();

      const status =
        firstText(body.linkStatus, body.link_status) ||
        (body.projectId
          ? "project_created"
          : body.quoteId
            ? "quote_created"
            : body.recipientId
              ? "linked_recipient"
              : "unlinked");

      const { data: order } = await serviceClient
        .from("imweb_orders")
        .select("id")
        .eq("imweb_order_no", orderNo)
        .maybeSingle();

      const payload = {
        imweb_order_id: order?.id ?? null,
        imweb_order_no: orderNo,
        recipient_id: body.recipientId || body.recipient_id || null,
        quote_id: body.quoteId || body.quote_id || null,
        project_id: body.projectId || body.project_id || null,
        assigned_to: body.assignedTo || body.assigned_to || null,
        due_date: body.dueDate || body.due_date || null,
        memo: body.memo || null,
        link_status: status,
        created_by: userId,
      };

      const { data: link, error } = await serviceClient
        .from("imweb_order_links")
        .upsert(payload, { onConflict: "imweb_order_no" })
        .select()
        .single();

      if (error) throw error;

      await serviceClient.from("inventory_action_logs").insert({
        actor_id: userId,
        actor_name: profile?.full_name || "Unknown",
        action_type: "link_order",
        target_type: "imweb_order",
        target_id: link?.id ?? null,
        imweb_order_no: orderNo,
        metadata: {
          linkStatus: status,
          recipientId: payload.recipient_id,
          quoteId: payload.quote_id,
          projectId: payload.project_id,
          assignedTo: payload.assigned_to,
          dueDate: payload.due_date,
        },
      });

      return new Response(JSON.stringify({ success: true, link }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // === SYNC PRODUCTS ===
    if (action === "sync-products") {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).single();

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
              { onConflict: "imweb_prod_no" },
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

        return new Response(JSON.stringify({ success: true, totalCount, syncedCount: totalSynced }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

    // === SYNC ORDERS ===
    if (action === "sync-orders") {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).single();

      const { data: syncLog } = await supabase
        .from("imweb_sync_logs")
        .insert({ sync_type: "orders", status: "running", user_id: userId, user_name: profile?.full_name || "Unknown" })
        .select()
        .single();

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
              { onConflict: "imweb_order_no" },
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

        return new Response(JSON.stringify({ success: true, totalCount, syncedCount: totalSynced }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

    // === INCREMENTAL SYNC ORDERS ===
    if (action === "sync-orders-incremental") {
      const body = await req.json().catch(() => ({}));
      const days = Math.min(Math.max(Math.round(Number(body.days || 30)), 1), 365);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).single();

      const { data: syncLog } = await supabase
        .from("imweb_sync_logs")
        .insert({
          sync_type: "orders_incremental",
          status: "running",
          user_id: userId,
          user_name: profile?.full_name || "Unknown",
        })
        .select()
        .single();

      let page = 1;
      let totalSynced = 0;
      let totalCount = 0;
      let reachedOlderOrders = false;

      try {
        while (!reachedOlderOrders) {
          const result = await imwebGet(imwebToken, "/orders", { page: String(page), limit: "100" });

          if (result.statusCode && result.statusCode !== 200) {
            throw new Error(`Orders incremental list failed: ${JSON.stringify(result)}`);
          }

          const orders = result.data?.list || result.data || [];
          totalCount = result.data?.totalCount || orders.length;

          if (!Array.isArray(orders) || orders.length === 0) break;

          for (const rawOrder of orders) {
            const order = isRecord(rawOrder) ? rawOrder : {};
            const upsertRow = buildImwebOrderUpsert(order);
            const orderNo = String(upsertRow.imweb_order_no || "");
            if (!orderNo) continue;

            if (upsertRow.order_date) {
              const orderedAt = new Date(String(upsertRow.order_date));
              if (!Number.isNaN(orderedAt.getTime()) && orderedAt < since) {
                reachedOlderOrders = true;
                continue;
              }
            }

            await supabase.from("imweb_orders").upsert(upsertRow, { onConflict: "imweb_order_no" });
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

        return new Response(JSON.stringify({ success: true, totalCount, syncedCount: totalSynced, days }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

    // === SYNC SINGLE ORDER DETAIL ===
    if (action === "sync-order-detail") {
      const body = await req.json();
      const orderNo = firstText(body.orderNo, body.imweb_order_no);
      if (!orderNo) {
        return new Response(JSON.stringify({ error: "orderNo required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await imwebGet(imwebToken, `/orders/${encodeURIComponent(orderNo)}`);
      if (result.statusCode && result.statusCode !== 200) {
        throw new Error(`Order detail failed: ${JSON.stringify(result)}`);
      }

      const order = isRecord(result.data) ? result.data : isRecord(result) ? result : {};
      const upsertRow = buildImwebOrderUpsert({ ...order, orderNo });
      await supabase.from("imweb_orders").upsert(upsertRow, { onConflict: "imweb_order_no" });

      return new Response(JSON.stringify({ success: true, order: upsertRow }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === UPDATE STOCK ===
    if (action === "update-stock" || action === "update-product-stock") {
      const body = await req.json();
      const { prodNo, stockQty } = body;
      if (!prodNo || stockQty === undefined) {
        return new Response(JSON.stringify({ error: "prodNo and stockQty required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await imwebPatch(imwebToken, `/products/${prodNo}/stock-info`, { stockQty });

      await supabase
        .from("imweb_products")
        .update({ stock_qty: stockQty, synced_at: new Date().toISOString() })
        .eq("imweb_prod_no", String(prodNo));

      await authContext.supabaseAdmin.from("inventory_action_logs").insert({
        actor_id: userId,
        action_type: "update_product_stock",
        target_type: "imweb_product",
        imweb_prod_no: String(prodNo),
        metadata: { stockQty },
      });

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
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (isAuthResponse(error)) return withCors(error, corsHeaders);
    console.error("Imweb API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const isNotConnected = message.includes("IMWEB_NOT_CONNECTED");
    return new Response(JSON.stringify({ error: message, notConnected: isNotConnected }), {
      status: isNotConnected ? 403 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
