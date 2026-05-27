// Kakao chatbot Skill endpoint for Acbank
// Returns Kakao "version 2.0" Skill JSON. Validates a shared secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-kakao-chatbot-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type QuickReply = { label: string; action: string; messageText?: string };

function kakaoText(text: string, quickReplies?: QuickReply[]) {
  const body: any = {
    version: "2.0",
    template: {
      outputs: [{ simpleText: { text: String(text).slice(0, 1000) } }],
    },
  };
  if (quickReplies && quickReplies.length) body.template.quickReplies = quickReplies;
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonResp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pickString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function extractUtterance(payload: any): string {
  return (
    pickString(
      payload?.userRequest?.utterance,
      payload?.action?.params?.utterance,
      payload?.action?.detailParams?.utterance?.value,
      payload?.bot?.utterance,
      payload?.user?.utterance,
      payload?.utterance,
    ) || ""
  );
}

function extractKakaoUserId(payload: any): string | null {
  const u = payload?.userRequest?.user || {};
  return pickString(
    u?.id,
    u?.properties?.plusfriendUserKey,
    u?.properties?.botUserKey,
    u?.properties?.appUserId,
    payload?.userRequest?.callback?.url,
    payload?.botUserKey,
    payload?.plusfriendUserKey,
    payload?.user?.id,
  );
}

function stripPrefix(s: string): string {
  let t = s.trim();
  const prefixes = ["@아크뱅크", "@아뱅", "아크뱅크", "아뱅"];
  for (const p of prefixes) {
    if (t.startsWith(p)) {
      t = t.slice(p.length).trim();
      break;
    }
  }
  return t;
}

async function logAudit(
  admin: ReturnType<typeof createClient>,
  entry: Record<string, unknown>,
) {
  try {
    await admin.from("kakao_chatbot_audit_logs").insert(entry);
  } catch (_e) {
    // best-effort
  }
}

function hasAction(allowed: string[] | null | undefined, want: "read" | "write" | "admin") {
  if (!allowed) return false;
  if (want === "read") return allowed.includes("read") || allowed.includes("write") || allowed.includes("admin");
  if (want === "write") return allowed.includes("write") || allowed.includes("admin");
  return allowed.includes("admin");
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "-";
  try {
    const dd = typeof d === "string" ? new Date(d) : d;
    return dd.toISOString().slice(0, 10);
  } catch {
    return String(d);
  }
}

async function cmdHelp(): Promise<Response> {
  const text = [
    "사용 가능한 명령어:",
    "• 도움말",
    "• 원판 오늘",
    "• 원판 입고대기",
    "• 원판 검색 <키워드>",
    "• 프로젝트 최근",
    "• 프로젝트 <키워드>",
    "• 프로세스 변경 <프로젝트키워드> <단계>",
    "",
    "예) 아뱅 원판 오늘",
  ].join("\n");
  return kakaoText(text, [
    { label: "도움말", action: "message", messageText: "아뱅 도움말" },
    { label: "원판 오늘", action: "message", messageText: "아뱅 원판 오늘" },
    { label: "프로젝트 최근", action: "message", messageText: "아뱅 프로젝트 최근" },
  ]);
}

async function cmdMaterialToday(admin: any): Promise<Response> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const start = `${today}T00:00:00Z`;
    const end = `${today}T23:59:59Z`;
    const { data, error } = await admin
      .from("material_orders")
      .select("*")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return kakaoText(`원판 오늘 조회 실패: ${error.message}`);
    if (!data || data.length === 0) return kakaoText("오늘 등록된 원판 발주가 없습니다.");
    const lines = data.map((r: any, i: number) => {
      const name = r.name || r.title || r.material_name || r.order_name || `발주 ${i + 1}`;
      const status = r.status || r.order_status || "-";
      return `${i + 1}. ${name} [${status}]`;
    });
    return kakaoText(`오늘 원판 발주 ${data.length}건\n` + lines.join("\n"));
  } catch (e) {
    return kakaoText(`원판 오늘 처리 오류: ${(e as Error).message}`);
  }
}

async function cmdMaterialPending(admin: any): Promise<Response> {
  try {
    const { data, error } = await admin
      .from("material_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return kakaoText(`원판 입고대기 조회 실패: ${error.message}`);
    const pending = (data || []).filter((r: any) => {
      const s = String(r.status || r.order_status || "").toLowerCase();
      return s.includes("pending") || s.includes("대기") || s.includes("발주") || s === "ordered";
    }).slice(0, 10);
    if (!pending.length) return kakaoText("입고 대기중인 원판 발주가 없습니다.");
    const lines = pending.map((r: any, i: number) => {
      const name = r.name || r.title || r.material_name || r.order_name || `발주 ${i + 1}`;
      const status = r.status || r.order_status || "-";
      return `${i + 1}. ${name} [${status}]`;
    });
    return kakaoText(`입고 대기 원판 ${pending.length}건\n` + lines.join("\n"));
  } catch (e) {
    return kakaoText(`원판 입고대기 처리 오류: ${(e as Error).message}`);
  }
}

async function cmdMaterialSearch(admin: any, kw: string): Promise<Response> {
  if (!kw) return kakaoText("검색어를 입력해주세요. 예) 아뱅 원판 검색 아크릴");
  try {
    const { data, error } = await admin
      .from("material_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return kakaoText(`원판 검색 실패: ${error.message}`);
    const k = kw.toLowerCase();
    const hits = (data || []).filter((r: any) =>
      JSON.stringify(r).toLowerCase().includes(k)
    ).slice(0, 10);
    if (!hits.length) return kakaoText(`"${kw}" 검색 결과가 없습니다.`);
    const lines = hits.map((r: any, i: number) => {
      const name = r.name || r.title || r.material_name || r.order_name || `발주 ${i + 1}`;
      return `${i + 1}. ${name} [${r.status || "-"}] (${fmtDate(r.created_at)})`;
    });
    return kakaoText(`원판 검색 "${kw}" ${hits.length}건\n` + lines.join("\n"));
  } catch (e) {
    return kakaoText(`원판 검색 처리 오류: ${(e as Error).message}`);
  }
}

async function cmdProjectsRecent(admin: any): Promise<Response> {
  try {
    const { data, error } = await admin
      .from("projects")
      .select("id,name,stage,status,created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return kakaoText(`프로젝트 최근 조회 실패: ${error.message}`);
    if (!data?.length) return kakaoText("등록된 프로젝트가 없습니다.");
    const lines = data.map((p: any, i: number) =>
      `${i + 1}. ${p.name || p.id} [${p.stage || p.status || "-"}] (${fmtDate(p.created_at)})`
    );
    return kakaoText(`최근 프로젝트 ${data.length}건\n` + lines.join("\n"));
  } catch (e) {
    return kakaoText(`프로젝트 최근 처리 오류: ${(e as Error).message}`);
  }
}

async function cmdProjectSearch(admin: any, kw: string): Promise<Response> {
  if (!kw) return kakaoText("검색어를 입력해주세요. 예) 아뱅 프로젝트 앤트러사이트");
  try {
    const { data, error } = await admin
      .from("projects")
      .select("id,name,stage,status,created_at")
      .ilike("name", `%${kw}%`)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return kakaoText(`프로젝트 검색 실패: ${error.message}`);
    if (!data?.length) return kakaoText(`"${kw}" 프로젝트가 없습니다.`);
    const lines = data.map((p: any, i: number) =>
      `${i + 1}. ${p.name || p.id} [${p.stage || p.status || "-"}] (${fmtDate(p.created_at)})`
    );
    return kakaoText(`프로젝트 "${kw}" ${data.length}건\n` + lines.join("\n"));
  } catch (e) {
    return kakaoText(`프로젝트 검색 처리 오류: ${(e as Error).message}`);
  }
}

async function cmdChangeStage(
  admin: any,
  kw: string,
  newStage: string,
  actorProfileId: string | null,
  kakaoUserId: string | null,
  commandText: string,
): Promise<Response> {
  if (!kw || !newStage) {
    return kakaoText("형식: 아뱅 프로세스 변경 <프로젝트키워드> <단계>");
  }
  try {
    const { data: matches, error } = await admin
      .from("projects")
      .select("id,name,stage,status")
      .ilike("name", `%${kw}%`)
      .limit(5);
    if (error) return kakaoText(`프로젝트 조회 실패: ${error.message}`);
    if (!matches?.length) return kakaoText(`"${kw}" 일치하는 프로젝트가 없습니다.`);
    if (matches.length > 1) {
      const list = matches.map((p: any, i: number) => `${i + 1}. ${p.name}`).join("\n");
      return kakaoText(`복수 프로젝트 일치. 더 구체적인 키워드로 지정해주세요:\n${list}`);
    }
    const proj = matches[0];
    const oldStage = proj.stage || proj.status || null;
    // try stage column first, then status
    let updateErr: any = null;
    const tryUpdate = async (col: string) => {
      const { error: e } = await admin.from("projects").update({ [col]: newStage }).eq("id", proj.id);
      return e;
    };
    updateErr = await tryUpdate("stage");
    if (updateErr) updateErr = await tryUpdate("status");
    if (updateErr) return kakaoText(`프로세스 변경 실패: ${updateErr.message}`);

    await logAudit(admin, {
      kakao_user_id: kakaoUserId,
      actor_profile_id: actorProfileId,
      command_text: commandText,
      action: "project.stage_change",
      target_type: "project",
      target_id: proj.id,
      old_value: oldStage,
      new_value: newStage,
      result: "success",
    });

    return kakaoText(`✅ "${proj.name}" 단계 변경 완료\n${oldStage || "-"} → ${newStage}`);
  } catch (e) {
    return kakaoText(`프로세스 변경 처리 오류: ${(e as Error).message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);

  if (req.method === "GET") {
    return jsonResp({ ok: true, function: "kakao-chatbot" });
  }

  if (req.method !== "POST") {
    return jsonResp({ error: "Method not allowed" }, 405);
  }

  const expected = Deno.env.get("KAKAO_CHATBOT_SECRET");
  if (!expected) {
    return jsonResp({ error: "Server misconfigured: KAKAO_CHATBOT_SECRET missing" }, 500);
  }

  const provided =
    req.headers.get("x-kakao-chatbot-secret") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("secret") ||
    url.searchParams.get("token") ||
    "";

  if (provided !== expected) {
    return jsonResp({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const utterance = extractUtterance(payload);
  const kakaoUserId = extractKakaoUserId(payload);
  const commandText = utterance;
  const stripped = stripPrefix(utterance);

  // Look up Kakao user mapping
  let mapping: any = null;
  if (kakaoUserId) {
    const { data } = await admin
      .from("kakao_chatbot_users")
      .select("*")
      .eq("kakao_user_id", kakaoUserId)
      .eq("is_active", true)
      .maybeSingle();
    mapping = data || null;
  }

  if (!mapping) {
    await logAudit(admin, {
      kakao_user_id: kakaoUserId,
      actor_profile_id: null,
      command_text: commandText,
      action: "auth.unmapped",
      result: "denied",
      error_message: "kakao user not mapped",
    });
    return kakaoText(
      `등록되지 않은 카카오톡 사용자입니다.\n\n관리자가 아래 ID를 내부 직원 계정과 연결해야 합니다.\nkakao_user_id: ${kakaoUserId || "(알 수 없음)"}`,
    );
  }

  const allowed: string[] = mapping.allowed_actions || [];
  const actorProfileId: string | null = mapping.profile_id || null;

  const lower = stripped.toLowerCase();

  // help
  if (!stripped || lower === "도움말" || lower === "help") {
    await logAudit(admin, {
      kakao_user_id: kakaoUserId,
      actor_profile_id: actorProfileId,
      command_text: commandText,
      action: "help",
      result: "success",
    });
    return cmdHelp();
  }

  const requireRead = () => {
    if (!hasAction(allowed, "read")) {
      logAudit(admin, {
        kakao_user_id: kakaoUserId,
        actor_profile_id: actorProfileId,
        command_text: commandText,
        action: "auth.denied_read",
        result: "denied",
      });
      return kakaoText("권한이 없습니다. (read 권한 필요)");
    }
    return null;
  };
  const requireWrite = () => {
    if (!hasAction(allowed, "write")) {
      logAudit(admin, {
        kakao_user_id: kakaoUserId,
        actor_profile_id: actorProfileId,
        command_text: commandText,
        action: "auth.denied_write",
        result: "denied",
      });
      return kakaoText("권한이 없습니다. (write 권한 필요)");
    }
    return null;
  };

  // 원판 ...
  if (stripped.startsWith("원판")) {
    const denied = requireRead();
    if (denied) return denied;
    const rest = stripped.slice("원판".length).trim();
    if (rest === "오늘") {
      const r = await cmdMaterialToday(admin);
      logAudit(admin, { kakao_user_id: kakaoUserId, actor_profile_id: actorProfileId, command_text: commandText, action: "material.today", result: "success" });
      return r;
    }
    if (rest === "입고대기" || rest === "대기") {
      const r = await cmdMaterialPending(admin);
      logAudit(admin, { kakao_user_id: kakaoUserId, actor_profile_id: actorProfileId, command_text: commandText, action: "material.pending", result: "success" });
      return r;
    }
    if (rest.startsWith("검색")) {
      const kw = rest.slice("검색".length).trim();
      const r = await cmdMaterialSearch(admin, kw);
      logAudit(admin, { kakao_user_id: kakaoUserId, actor_profile_id: actorProfileId, command_text: commandText, action: "material.search", result: "success", metadata: { keyword: kw } });
      return r;
    }
    return kakaoText("원판 명령을 인식하지 못했습니다. (오늘 / 입고대기 / 검색 <키워드>)");
  }

  // 프로젝트 ...
  if (stripped.startsWith("프로젝트")) {
    const denied = requireRead();
    if (denied) return denied;
    const rest = stripped.slice("프로젝트".length).trim();
    if (!rest || rest === "최근") {
      const r = await cmdProjectsRecent(admin);
      logAudit(admin, { kakao_user_id: kakaoUserId, actor_profile_id: actorProfileId, command_text: commandText, action: "project.recent", result: "success" });
      return r;
    }
    const r = await cmdProjectSearch(admin, rest);
    logAudit(admin, { kakao_user_id: kakaoUserId, actor_profile_id: actorProfileId, command_text: commandText, action: "project.search", result: "success", metadata: { keyword: rest } });
    return r;
  }

  // 프로세스 변경 ...
  if (stripped.startsWith("프로세스 변경")) {
    const denied = requireWrite();
    if (denied) return denied;
    const rest = stripped.slice("프로세스 변경".length).trim();
    const parts = rest.split(/\s+/);
    if (parts.length < 2) {
      return kakaoText("형식: 아뱅 프로세스 변경 <프로젝트키워드> <단계>");
    }
    const newStage = parts.pop()!;
    const kw = parts.join(" ");
    return cmdChangeStage(admin, kw, newStage, actorProfileId, kakaoUserId, commandText);
  }

  await logAudit(admin, {
    kakao_user_id: kakaoUserId,
    actor_profile_id: actorProfileId,
    command_text: commandText,
    action: "unknown",
    result: "success",
  });
  return kakaoText(
    `명령을 인식하지 못했습니다.\n"아뱅 도움말"을 입력해보세요.\n\n입력: ${utterance || "(빈 입력)"}`,
  );
});
