import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * 초과근무 자동 감지 Edge Function
 * - 퇴근 기록이 있는 당일 근무 기록을 확인
 * - 9시간 초과 근무자에게 알림 발송
 * - 관리자에게 요약 알림 발송
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const targetDate = body.date || new Date().toISOString().split("T")[0];
    const overtimeThreshold = body.threshold || 9; // hours

    // Get all completed attendance records for the target date
    const { data: records, error: recordsError } = await supabase
      .from("attendance_records")
      .select("id, user_id, user_name, date, check_in, check_out, work_hours, status")
      .eq("date", targetDate)
      .eq("status", "checked_out");

    if (recordsError) throw recordsError;
    if (!records || records.length === 0) {
      return new Response(
        JSON.stringify({ message: "해당 날짜의 완료된 근무 기록이 없습니다.", detected: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect overtime workers
    const overtimeRecords = records.filter(
      (r) => Number(r.work_hours || 0) > overtimeThreshold
    );

    if (overtimeRecords.length === 0) {
      return new Response(
        JSON.stringify({ message: "초과근무 감지 대상이 없습니다.", detected: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notifications: any[] = [];

    // Check existing notifications to avoid duplicates
    const { data: existingNotifs } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("type", "overtime_warning")
      .gte("created_at", `${targetDate}T00:00:00`);

    const alreadyNotified = new Set(existingNotifs?.map((n) => n.user_id) || []);

    for (const record of overtimeRecords) {
      if (alreadyNotified.has(record.user_id)) continue;

      const hours = Number(record.work_hours).toFixed(1);
      const overtime = (Number(record.work_hours) - 8).toFixed(1);

      notifications.push({
        user_id: record.user_id,
        type: "overtime_warning",
        title: "⚠️ 초과근무 감지",
        description: `${record.user_name}님, ${targetDate} 근무시간이 ${hours}시간으로 ${overtime}시간 초과근무가 감지되었습니다. 건강 관리에 유의해 주세요.`,
        data: {
          date: targetDate,
          work_hours: Number(record.work_hours),
          overtime_hours: Number(record.work_hours) - 8,
          record_id: record.id,
        },
      });
    }

    // Notify admins with summary
    if (notifications.length > 0) {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "moderator"]);

      if (adminRoles) {
        const uniqueAdminIds = [...new Set(adminRoles.map((r) => r.user_id))];
        const nameList = overtimeRecords
          .filter((r) => !alreadyNotified.has(r.user_id))
          .map((r) => `${r.user_name}(${Number(r.work_hours).toFixed(1)}h)`)
          .join(", ");

        for (const adminId of uniqueAdminIds) {
          notifications.push({
            user_id: adminId,
            type: "overtime_admin_summary",
            title: "📊 초과근무 감지 요약",
            description: `${targetDate} 초과근무 감지: ${notifications.filter((n) => n.type === "overtime_warning").length}명 - ${nameList}`,
            data: {
              date: targetDate,
              overtime_count: notifications.filter((n) => n.type === "overtime_warning").length,
            },
          });
        }
      }
    }

    // Insert notifications
    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);
      if (insertError) {
        console.error("Failed to insert notifications:", insertError);
        throw insertError;
      }
    }

    const detectedCount = notifications.filter((n) => n.type === "overtime_warning").length;
    console.log(`Overtime detection complete for ${targetDate}. Detected: ${detectedCount}`);

    return new Response(
      JSON.stringify({
        message: `${detectedCount}명의 초과근무가 감지되었습니다.`,
        detected: detectedCount,
        date: targetDate,
        details: overtimeRecords.map((r) => ({
          user_name: r.user_name,
          work_hours: Number(r.work_hours).toFixed(1),
          overtime: (Number(r.work_hours) - 8).toFixed(1),
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in overtime-detection:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
