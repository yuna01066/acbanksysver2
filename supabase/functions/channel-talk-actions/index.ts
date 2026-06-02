import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHANNEL_API_BASE = "https://api.channel.io/open";

type JsonObject = Record<string, unknown>;

type StaffProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type ChannelAction =
  | "send_private_note"
  | "send_customer_reply"
  | "refresh_messages"
  | "mark_lead_closed";

function getEnv(name: string, required = true): string {
  const value = Deno.env.get(name);
  if (required && !value) throw new Error(`${name} is not configured`);
  return value || "";
}

function ok(body: JsonObject, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getServiceClient() {
  return createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function firstIsoTimestamp(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      const millis = value > 1_000_000_000_000 ? value : value * 1000;
      return new Date(millis).toISOString();
    }
    if (typeof value === "string" && value.trim()) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && /^\d+$/.test(value.trim())) {
        const millis = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
        return new Date(millis).toISOString();
      }
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
    }
  }
  return new Date().toISOString();
}

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseJsonResponse(text: string): JsonObject {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return isObject(parsed) ? parsed : { result: parsed };
  } catch {
    return { raw: text };
  }
}

function normalizeSenderType(value: unknown): "user" | "manager" | "bot" | "system" | "unknown" {
  if (typeof value !== "string") return "unknown";
  const normalized = value.toLowerCase();
  if (normalized === "user" || normalized === "manager" || normalized === "bot" || normalized === "system") {
    return normalized;
  }
  if (/manager|staff|operator|admin/.test(normalized)) return "manager";
  if (/bot/.test(normalized)) return "bot";
  if (/system|workflow/.test(normalized)) return "system";
  if (/user|customer|member/.test(normalized)) return "user";
  return "unknown";
}

function buildStaffName(profile: StaffProfile | null, fallbackEmail?: string | null): string {
  return firstString(profile?.full_name, fallbackEmail, profile?.email) || "아크뱅크 담당자";
}

function walkObjects(value: unknown, visit: (obj: JsonObject) => void) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkObjects(item, visit));
    return;
  }
  if (!isObject(value)) return;
  visit(value);
  Object.values(value).forEach((child) => walkObjects(child, visit));
}

function extractMessageBody(payload: JsonObject): string | null {
  const entity = isObject(payload.entity) ? payload.entity : payload;
  const direct = firstString(
    entity.plainText,
    entity.text,
    entity.message,
    entity.body,
    entity.content,
    payload.plainText,
    payload.text,
    payload.message,
  );
  if (direct) return direct;

  const blocks = Array.isArray(entity.blocks) ? entity.blocks : [];
  const blockText = blocks
    .map((block) => isObject(block) ? firstString(block.value, block.text, block.content) : null)
    .filter(Boolean)
    .join("\n");
  return blockText || null;
}

function extractMessageId(payload: JsonObject): string | null {
  const message = isObject(payload.message) ? payload.message : {};
  return firstString(payload.id, payload.messageId, message.id);
}

function extractFileKeys(payload: JsonObject): string[] {
  const keys = new Set<string>();
  walkObjects(payload, (obj) => {
    const key = firstString(obj.key, obj.fileKey);
    const name = firstString(obj.name, obj.fileName);
    const contentType = firstString(obj.contentType, obj.mimeType, obj.type);
    if (key && (name || contentType || key.includes("pub-file/") || key.includes("files/"))) {
      keys.add(key);
    }
  });
  return [...keys];
}

async function channelApi(
  path: string,
  init: RequestInit = {},
  apiVersion = "v5",
): Promise<Response> {
  const accessKey = getEnv("CHANNEL_TALK_ACCESS_KEY");
  const accessSecret = getEnv("CHANNEL_TALK_ACCESS_SECRET");
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  headers.set("content-type", "application/json");
  headers.set("x-access-key", accessKey);
  headers.set("x-access-secret", accessSecret);

  return fetch(`${CHANNEL_API_BASE}/${apiVersion}${path}`, { ...init, headers });
}

async function getAuthenticatedUser(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authorization token is required");

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid authorization token");
  return data.user;
}

async function loadStaffProfile(supabase: ReturnType<typeof createClient>, userId: string): Promise<StaffProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("Failed to load Channel Talk staff profile", error);
    return null;
  }
  return data as StaffProfile | null;
}

async function loadLead(supabase: ReturnType<typeof createClient>, leadId: string, userId: string) {
  const { data: canManage, error: accessError } = await supabase.rpc(
    "can_manage_channel_talk_lead",
    { _lead_id: leadId, _user_id: userId },
  );
  if (accessError) throw accessError;
  if (!canManage) throw new Error("Channel Talk lead access denied");

  const { data, error } = await supabase
    .from("channel_talk_quote_leads")
    .select("id, channel_talk_user_chat_id, status")
    .eq("id", leadId)
    .single();
  if (error) throw error;
  if (!data?.channel_talk_user_chat_id) throw new Error("Channel Talk userChatId is missing");
  return data as { id: string; channel_talk_user_chat_id: string; status: string };
}

async function logAction(
  supabase: ReturnType<typeof createClient>,
  params: {
    leadId: string;
    action: ChannelAction;
    userId: string;
    status: "success" | "failed";
    requestPayload?: JsonObject;
    responsePayload?: JsonObject;
    errorMessage?: string;
    senderName?: string | null;
    visibleSenderName?: string | null;
    channelMessageId?: string | null;
  },
) {
  const { error } = await supabase.from("channel_talk_action_logs").insert({
    lead_id: params.leadId,
    action: params.action,
    requested_by: params.userId,
    sender_name: params.senderName || null,
    visible_sender_name: params.visibleSenderName || null,
    channel_message_id: params.channelMessageId || null,
    status: params.status,
    request_payload: params.requestPayload || {},
    response_payload: params.responsePayload || {},
    error_message: params.errorMessage || null,
  });
  if (error) console.warn("Failed to write Channel Talk action log", error);
}

async function sendChannelMessage(userChatId: string, body: string, privateSilent: boolean) {
  const botName = encodeURIComponent(privateSilent ? "ACBANK 내부 메모" : "ACBANK");
  const payload: JsonObject = {
    blocks: [{ type: "text", value: body }],
  };
  if (privateSilent) payload.options = ["private", "silent"];

  let res = await channelApi(
    `/user-chats/${encodeURIComponent(userChatId)}/messages?botName=${botName}`,
    { method: "POST", body: JSON.stringify(payload) },
    "v5",
  );
  if (!res.ok && (res.status === 404 || res.status === 405)) {
    res = await channelApi(
      `/user-chats/${encodeURIComponent(userChatId)}/messages?botName=${botName}`,
      { method: "POST", body: JSON.stringify(payload) },
      "v4",
    );
  }
  const text = await res.text();
  const parsed = parseJsonResponse(text);
  if (!res.ok) throw new Error(`Channel Talk message failed: ${res.status} ${text}`);
  return parsed;
}

async function fetchChannelMessages(userChatId: string) {
  let res = await channelApi(
    `/user-chats/${encodeURIComponent(userChatId)}/messages`,
    { method: "GET" },
    "v5",
  );
  if (!res.ok && (res.status === 404 || res.status === 405)) {
    res = await channelApi(
      `/user-chats/${encodeURIComponent(userChatId)}/messages`,
      { method: "GET" },
      "v4",
    );
  }
  const text = await res.text();
  const parsed = parseJsonResponse(text);
  if (!res.ok) throw new Error(`Channel Talk messages fetch failed: ${res.status} ${text}`);
  return parsed;
}

function normalizeMessageRows(leadId: string, userChatId: string, response: JsonObject) {
  const source = Array.isArray(response.messages)
    ? response.messages
    : isObject(response.result) && Array.isArray(response.result.messages)
      ? response.result.messages
      : Array.isArray(response.result)
        ? response.result
        : [];

  return source
    .filter(isObject)
    .map((message) => {
      const messageId = extractMessageId(message);
      return {
        lead_id: leadId,
        user_chat_id: userChatId,
        message_id: messageId,
        event_id: firstString(message.eventId) || null,
        sender_type: normalizeSenderType(firstString(message.personType, message.senderType)),
        message_type: firstString(message.messageType, message.type) || "text",
        body: extractMessageBody(message),
        file_keys: extractFileKeys(message),
        raw_payload: message,
        received_at: firstIsoTimestamp(message.createdAt, message.created_at, message.updatedAt),
      };
    })
    .filter((row) => row.message_id || row.body || row.file_keys.length);
}

function extractChannelMessageId(response: JsonObject): string | null {
  return firstString(
    response.id,
    response.messageId,
    isObject(response.message) ? response.message.id : null,
    isObject(response.result) ? response.result.id : null,
    isObject(response.result) && isObject(response.result.message) ? response.result.message.id : null,
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return ok({ error: "Method not allowed" }, 405);
  }

  const supabase = getServiceClient();
  let action: ChannelAction | undefined;
  let leadId = "";
  let userId = "";
  let requestPayload: JsonObject = {};
  let senderNameForLog: string | null = null;

  try {
    const user = await getAuthenticatedUser(req, supabase);
    userId = user.id;
    const staffProfile = await loadStaffProfile(supabase, userId);
    const staffName = buildStaffName(staffProfile, user.email);
    senderNameForLog = staffName;

    const payload = await req.json() as JsonObject;
    requestPayload = payload;
    action = payload.action as ChannelAction;
    leadId = firstString(payload.leadId, payload.lead_id) || "";
    const body = firstString(payload.body);
    const draftId = firstString(payload.draftId, payload.draft_id);
    const closeLead = Boolean(payload.closeLead);

    if (!action) throw new Error("action is required");
    if (!leadId) throw new Error("leadId is required");

    const lead = await loadLead(supabase, leadId, userId);

    if (action === "send_private_note" || action === "send_customer_reply") {
      if (!body) throw new Error("body is required");
      const finalBody = body;
      const visibleSenderName = action === "send_customer_reply" ? "ACBANK" : "ACBANK 내부 메모";
      const response = await sendChannelMessage(
        lead.channel_talk_user_chat_id,
        finalBody,
        action === "send_private_note",
      );
      const channelMessageId = extractChannelMessageId(response);
      const storedMessageId = channelMessageId || `${action}-${crypto.randomUUID()}`;

      await supabase.from("channel_talk_messages").upsert({
        lead_id: lead.id,
        user_chat_id: lead.channel_talk_user_chat_id,
        message_id: storedMessageId,
        sender_type: "manager",
        message_type: action === "send_private_note" ? "private_note" : "customer_reply",
        body: finalBody,
        file_keys: [],
        raw_payload: response,
        received_at: new Date().toISOString(),
      }, { onConflict: "user_chat_id,message_id" });

      if (draftId && action === "send_customer_reply") {
        await supabase
          .from("channel_talk_reply_drafts")
          .update({
            status: "sent",
            body: finalBody,
            updated_by: userId,
            sent_by: userId,
            sent_at: new Date().toISOString(),
            channel_message_id: channelMessageId,
          })
          .eq("id", draftId);
      }

      if (action === "send_customer_reply") {
        await supabase
          .from("channel_talk_quote_leads")
          .update({
            status: closeLead ? "closed" : "waiting_customer",
            closed_at: closeLead ? new Date().toISOString() : null,
          })
          .eq("id", lead.id);
      }

      await logAction(supabase, {
        leadId,
        action,
        userId,
        status: "success",
        requestPayload: {
          body,
          sentBody: finalBody,
          draftId,
          closeLead,
          visibleSenderName,
        },
        responsePayload: response,
        senderName: staffName,
        visibleSenderName,
        channelMessageId,
      });
      return ok({ success: true, channelMessageId, response });
    }

    if (action === "refresh_messages") {
      const response = await fetchChannelMessages(lead.channel_talk_user_chat_id);
      const rows = normalizeMessageRows(lead.id, lead.channel_talk_user_chat_id, response);
      if (rows.length > 0) {
        await supabase
          .from("channel_talk_messages")
          .upsert(rows, { onConflict: "user_chat_id,message_id" });
      }
      await logAction(supabase, {
        leadId,
        action,
        userId,
        status: "success",
        requestPayload: {},
        responsePayload: { synced: rows.length },
        senderName: staffName,
      });
      return ok({ success: true, synced: rows.length });
    }

    if (action === "mark_lead_closed") {
      const { error } = await supabase
        .from("channel_talk_quote_leads")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", lead.id);
      if (error) throw error;
      await logAction(supabase, {
        leadId,
        action,
        userId,
        status: "success",
        requestPayload: {},
        senderName: staffName,
      });
      return ok({ success: true });
    }

    throw new Error(`Unsupported action: ${action}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (action && leadId && userId) {
      await logAction(supabase, {
        leadId,
        action,
        userId,
        status: "failed",
        requestPayload,
        errorMessage: message,
        senderName: senderNameForLog,
      });
    }
    console.error("Channel Talk action error:", error);
    return ok({ error: message }, /Unauthorized|authorization|access denied/i.test(message) ? 401 : 500);
  }
});
