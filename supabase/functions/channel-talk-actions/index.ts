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

type ChannelConversation = {
  id: string;
  user_chat_id: string;
  status: string;
  assigned_to: string | null;
  latest_lead_id: string | null;
};

type ChannelLead = {
  id: string;
  channel_talk_user_chat_id: string;
  status: string;
  conversation_id: string | null;
};

type ChannelButton = {
  title: string;
  url: string;
  colorVariant?: string;
};

type AttachmentLink = {
  name: string;
  url: string;
};

type ChannelAction =
  | "send_private_note"
  | "send_customer_reply"
  | "refresh_messages"
  | "mark_lead_closed"
  | "assign_conversation"
  | "mark_conversation_read"
  | "close_conversation";

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

function normalizeButtons(value: unknown): ChannelButton[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .map((item) => ({
      title: firstString(item.title, item.label) || "",
      url: firstString(item.url, item.href) || "",
      colorVariant: firstString(item.colorVariant) || "cobalt",
    }))
    .filter((item) => item.title && /^https?:\/\//i.test(item.url))
    .slice(0, 2);
}

function normalizeAttachmentLinks(value: unknown): AttachmentLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .map((item) => ({
      name: firstString(item.name, item.label, item.title) || "첨부 링크",
      url: firstString(item.url, item.href) || "",
    }))
    .filter((item) => /^https?:\/\//i.test(item.url))
    .slice(0, 5);
}

function appendAttachmentLinks(body: string, links: AttachmentLink[]) {
  if (!links.length) return body;
  const attachmentText = links
    .map((link, index) => `${index + 1}. ${link.name}: ${link.url}`)
    .join("\n");
  return `${body.trim()}\n\n[첨부 링크]\n${attachmentText}`;
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

async function loadLead(supabase: ReturnType<typeof createClient>, leadId: string, userId: string): Promise<ChannelLead> {
  const { data: canManage, error: accessError } = await supabase.rpc(
    "can_manage_channel_talk_lead",
    { _lead_id: leadId, _user_id: userId },
  );
  if (accessError) throw accessError;
  if (!canManage) throw new Error("Channel Talk lead access denied");

  const { data, error } = await supabase
    .from("channel_talk_quote_leads")
    .select("id, channel_talk_user_chat_id, status, conversation_id")
    .eq("id", leadId)
    .single();
  if (error) throw error;
  if (!data?.channel_talk_user_chat_id) throw new Error("Channel Talk userChatId is missing");
  return data as ChannelLead;
}

async function loadConversation(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  userId: string,
): Promise<ChannelConversation> {
  const { data: canManage, error: accessError } = await supabase.rpc(
    "can_manage_channel_talk_conversation",
    { _conversation_id: conversationId, _user_id: userId },
  );
  if (accessError) throw accessError;
  if (!canManage) throw new Error("Channel Talk conversation access denied");

  const { data, error } = await supabase
    .from("channel_talk_conversations")
    .select("id, user_chat_id, status, assigned_to, latest_lead_id")
    .eq("id", conversationId)
    .single();
  if (error) throw error;
  if (!data?.user_chat_id) throw new Error("Channel Talk userChatId is missing");
  return data as ChannelConversation;
}

async function loadConversationFromUserChat(
  supabase: ReturnType<typeof createClient>,
  userChatId: string,
  userId: string,
): Promise<ChannelConversation> {
  const { data, error } = await supabase
    .from("channel_talk_conversations")
    .select("id, user_chat_id, status, assigned_to, latest_lead_id")
    .eq("user_chat_id", userChatId)
    .single();
  if (error) throw error;
  if (!data?.id) throw new Error("Channel Talk conversation is missing");

  const { data: canManage, error: accessError } = await supabase.rpc(
    "can_manage_channel_talk_conversation",
    { _conversation_id: data.id, _user_id: userId },
  );
  if (accessError) throw accessError;
  if (!canManage) throw new Error("Channel Talk conversation access denied");
  return data as ChannelConversation;
}

async function logAction(
  supabase: ReturnType<typeof createClient>,
  params: {
    leadId?: string | null;
    conversationId?: string | null;
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
    lead_id: params.leadId || null,
    conversation_id: params.conversationId || null,
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

async function sendChannelMessage(userChatId: string, body: string, privateSilent: boolean, buttons: ChannelButton[] = []) {
  const botName = encodeURIComponent(privateSilent ? "ACBANK 내부 메모" : "ACBANK");
  const payload: JsonObject = {
    blocks: [{ type: "text", value: body }],
  };
  if (!privateSilent && buttons.length > 0) {
    payload.buttons = buttons.map((button) => ({
      title: button.title,
      url: button.url,
      colorVariant: button.colorVariant || "cobalt",
    }));
  }
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

function normalizeMessageRows(conversationId: string, leadId: string | null, userChatId: string, response: JsonObject) {
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
        conversation_id: conversationId,
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
  let conversationId = "";
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
    conversationId = firstString(payload.conversationId, payload.conversation_id) || "";
    const userChatId = firstString(payload.userChatId, payload.user_chat_id);
    const body = firstString(payload.body);
    const buttons = normalizeButtons(payload.buttons);
    const attachmentLinks = normalizeAttachmentLinks(payload.attachmentLinks);
    const draftId = firstString(payload.draftId, payload.draft_id);
    const closeLead = Boolean(payload.closeLead);
    const closeReason = firstString(payload.closeReason, payload.close_reason);
    const forceAssign = Boolean(payload.force);

    if (!action) throw new Error("action is required");

    let lead: ChannelLead | null = null;
    let conversation: ChannelConversation | null = null;

    if (conversationId) {
      conversation = await loadConversation(supabase, conversationId, userId);
    }

    if (leadId) {
      lead = await loadLead(supabase, leadId, userId);
      if (!conversation && lead.conversation_id) {
        conversation = await loadConversation(supabase, lead.conversation_id, userId);
        conversationId = conversation.id;
      }
    }

    if (!conversation && userChatId) {
      conversation = await loadConversationFromUserChat(supabase, userChatId, userId);
      conversationId = conversation.id;
    }

    if (!lead && conversation?.latest_lead_id) {
      try {
        lead = await loadLead(supabase, conversation.latest_lead_id, userId);
        leadId = lead.id;
      } catch (error) {
        console.warn("Failed to load latest Channel Talk lead", error);
      }
    }

    if (action === "assign_conversation") {
      if (!conversation) throw new Error("conversationId is required");
      if (conversation.assigned_to && conversation.assigned_to !== userId && !forceAssign) {
        return ok({
          error: "Conversation is already assigned",
          assignedTo: conversation.assigned_to,
          requiresConfirmation: true,
        }, 409);
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("channel_talk_conversations")
        .update({
          assigned_to: userId,
          assigned_at: now,
          assigned_by: userId,
          status: conversation.status === "closed" ? "active" : conversation.status,
        })
        .eq("id", conversation.id);
      if (error) throw error;

      await supabase
        .from("channel_talk_quote_leads")
        .update({ assigned_to: userId })
        .eq("conversation_id", conversation.id);

      await logAction(supabase, {
        leadId: lead?.id || null,
        conversationId: conversation.id,
        action,
        userId,
        status: "success",
        requestPayload: { forceAssign },
        senderName: staffName,
      });

      return ok({ success: true, assignedTo: userId });
    }

    if (action === "mark_conversation_read") {
      if (!conversation) throw new Error("conversationId is required");
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("channel_talk_conversation_reads")
        .upsert({
          conversation_id: conversation.id,
          user_id: userId,
          last_read_at: now,
        }, { onConflict: "conversation_id,user_id" });
      if (error) throw error;

      await logAction(supabase, {
        leadId: lead?.id || null,
        conversationId: conversation.id,
        action,
        userId,
        status: "success",
        requestPayload: {},
        senderName: staffName,
      });
      return ok({ success: true });
    }

    if (action === "close_conversation") {
      if (!conversation) throw new Error("conversationId is required");
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("channel_talk_conversations")
        .update({
          status: "closed",
          closed_at: now,
          close_reason: closeReason,
        })
        .eq("id", conversation.id);
      if (error) throw error;

      await supabase
        .from("channel_talk_quote_leads")
        .update({ status: "closed", closed_at: now })
        .eq("conversation_id", conversation.id);

      await logAction(supabase, {
        leadId: lead?.id || null,
        conversationId: conversation.id,
        action,
        userId,
        status: "success",
        requestPayload: { closeReason },
        senderName: staffName,
      });
      return ok({ success: true });
    }

    if (!conversation) throw new Error("conversationId or leadId is required");
    const conversationLeadId = lead?.id || conversation.latest_lead_id || null;

    if (action === "send_private_note" || action === "send_customer_reply") {
      if (!body) throw new Error("body is required");
      const finalBody = appendAttachmentLinks(body, attachmentLinks);
      const visibleSenderName = action === "send_customer_reply" ? "ACBANK" : "ACBANK 내부 메모";
      const response = await sendChannelMessage(
        conversation.user_chat_id,
        finalBody,
        action === "send_private_note",
        action === "send_customer_reply" ? buttons : [],
      );
      const channelMessageId = extractChannelMessageId(response);
      const storedMessageId = channelMessageId || `${action}-${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      await supabase.from("channel_talk_messages").upsert({
        lead_id: conversationLeadId,
        conversation_id: conversation.id,
        user_chat_id: conversation.user_chat_id,
        message_id: storedMessageId,
        sender_type: "manager",
        message_type: action === "send_private_note" ? "private_note" : "customer_reply",
        body: finalBody,
        file_keys: attachmentLinks.map((link) => link.url),
        raw_payload: {
          ...response,
          composerButtons: buttons,
          attachmentLinks,
        },
        received_at: now,
      }, { onConflict: "user_chat_id,message_id" });

      if (draftId && action === "send_customer_reply") {
        await supabase
          .from("channel_talk_reply_drafts")
          .update({
            status: "sent",
            body: finalBody,
            updated_by: userId,
            sent_by: userId,
            sent_at: now,
            channel_message_id: channelMessageId,
          })
          .eq("id", draftId);
      }

      if (action === "send_customer_reply") {
        await supabase
          .from("channel_talk_conversations")
          .update({
            status: closeLead ? "closed" : "waiting_customer",
            closed_at: closeLead ? now : null,
            last_staff_reply_at: now,
            last_message_at: now,
          })
          .eq("id", conversation.id);

        await supabase
          .from("channel_talk_quote_leads")
          .update({
            status: closeLead ? "closed" : "waiting_customer",
            closed_at: closeLead ? now : null,
          })
          .eq("conversation_id", conversation.id);
      } else {
        await supabase
          .from("channel_talk_conversations")
          .update({ last_message_at: now })
          .eq("id", conversation.id);
      }

      await logAction(supabase, {
        leadId: conversationLeadId,
        conversationId: conversation.id,
        action,
        userId,
        status: "success",
        requestPayload: {
          body,
          sentBody: finalBody,
          draftId,
          closeLead,
          visibleSenderName,
          buttons,
          attachmentLinks,
        },
        responsePayload: {
          ...response,
          composerButtons: buttons,
          attachmentLinks,
        },
        senderName: staffName,
        visibleSenderName,
        channelMessageId,
      });
      return ok({ success: true, channelMessageId, response });
    }

    if (action === "refresh_messages") {
      const response = await fetchChannelMessages(conversation.user_chat_id);
      const rows = normalizeMessageRows(conversation.id, conversationLeadId, conversation.user_chat_id, response);
      if (rows.length > 0) {
        await supabase
          .from("channel_talk_messages")
          .upsert(rows, { onConflict: "user_chat_id,message_id" });

        const lastMessageAt = rows.reduce((latest, row) => (
          new Date(row.received_at).getTime() > new Date(latest).getTime() ? row.received_at : latest
        ), rows[0].received_at);
        const lastCustomerMessageAt = rows
          .filter((row) => row.sender_type === "user")
          .reduce<string | null>((latest, row) => !latest || new Date(row.received_at).getTime() > new Date(latest).getTime() ? row.received_at : latest, null);
        const lastStaffReplyAt = rows
          .filter((row) => row.sender_type !== "user" && row.message_type !== "private_note")
          .reduce<string | null>((latest, row) => !latest || new Date(row.received_at).getTime() > new Date(latest).getTime() ? row.received_at : latest, null);

        await supabase
          .from("channel_talk_conversations")
          .update({
            last_message_at: lastMessageAt,
            last_customer_message_at: lastCustomerMessageAt,
            last_staff_reply_at: lastStaffReplyAt,
          })
          .eq("id", conversation.id);
      }
      await logAction(supabase, {
        leadId: conversationLeadId,
        conversationId: conversation.id,
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
      if (!lead) throw new Error("leadId is required");
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("channel_talk_quote_leads")
        .update({ status: "closed", closed_at: now })
        .eq("id", lead.id);
      if (error) throw error;
      if (conversation) {
        await supabase
          .from("channel_talk_conversations")
          .update({ status: "closed", closed_at: now })
          .eq("id", conversation.id);
      }
      await logAction(supabase, {
        leadId,
        conversationId: conversation?.id || null,
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
    if (action && userId && (leadId || conversationId)) {
      await logAction(supabase, {
        leadId: leadId || null,
        conversationId: conversationId || null,
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
