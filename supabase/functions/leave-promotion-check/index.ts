import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * 스마트 연차 촉진 체크 Edge Function
 * - 모든 직원의 소멸 예정 연차를 확인하고
 * - 촉진 설정에 따라 알림을 발송
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check: require admin
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Check admin role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "moderator"]);
      if (!roleData || roleData.length === 0) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 1. Get leave policy with smart_promotion enabled
    const { data: policies } = await supabase
      .from("leave_policy_settings")
      .select("*")
      .eq("smart_promotion", "enabled");

    if (!policies || policies.length === 0) {
      return new Response(
        JSON.stringify({ message: "스마트 연차 촉진이 비활성 상태입니다.", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const policy = policies[0];

    // 2. Get promotion settings
    const { data: settingsRow } = await supabase
      .from("leave_general_settings")
      .select("setting_value")
      .eq("setting_key", "leave_promotion")
      .single();

    const promotionSettings = (settingsRow?.setting_value as any) || {
      annual_promotion_timing: "6months_before",
      monthly_1st_timing: "3months_before",
      member_reminder: false,
      admin_reminder: false,
    };

    // 3. Get all approved employees with join dates
    const { data: employees } = await supabase
      .from("profiles")
      .select("id, full_name, join_date, department")
      .eq("is_approved", true)
      .not("join_date", "is", null);

    if (!employees || employees.length === 0) {
      return new Response(
        JSON.stringify({ message: "직원이 없습니다.", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Get all approved leave requests to calculate used days
    const { data: allRequests } = await supabase
      .from("leave_requests")
      .select("user_id, days, leave_type, status")
      .eq("status", "approved");

    const now = new Date();
    let notifiedCount = 0;
    const notifications: any[] = [];

    // Helper: calculate months/years difference
    const diffMonths = (d1: Date, d2: Date) => {
      return (d1.getFullYear() - d2.getFullYear()) * 12 + d1.getMonth() - d2.getMonth();
    };
    const diffYears = (d1: Date, d2: Date) => {
      const y = d1.getFullYear() - d2.getFullYear();
      const adjusted = new Date(d2);
      adjusted.setFullYear(adjusted.getFullYear() + y);
      return adjusted > d1 ? y - 1 : y;
    };

    // Timing to days before expiration
    const timingToDays = (timing: string): number => {
      switch (timing) {
        case "6months_before": return 180;
        case "3months_before": return 90;
        case "2months_before": return 60;
        case "1month_before": return 30;
        default: return 90;
      }
    };

    const annualTriggerDays = timingToDays(promotionSettings.annual_promotion_timing);
    const monthlyTriggerDays = timingToDays(promotionSettings.monthly_1st_timing);

    for (const emp of employees) {
      const joinDate = new Date(emp.join_date);
      const totalMonths = diffMonths(now, joinDate);
      const totalYears = diffYears(now, joinDate);

      // Calculate used days for this employee
      const empRequests = allRequests?.filter(r => r.user_id === emp.id) || [];
      const usedDays = empRequests
        .filter(r => r.leave_type === "annual" || r.leave_type === "half_am" || r.leave_type === "half_pm")
        .reduce((sum, r) => sum + (r.days || 0), 0);

      // Calculate total leave
      let totalLeaveDays = 0;
      if (totalMonths < 12) {
        totalLeaveDays = Math.min(totalMonths, 11);
      } else {
        let days = 15;
        if (totalYears >= 3) {
          days += Math.min(Math.floor((totalYears - 1) / 2), 10);
        }
        totalLeaveDays = Math.min(days, 25);
      }

      const remainingDays = totalLeaveDays - usedDays;
      if (remainingDays <= 0) continue; // No leave to promote

      // Calculate expiration date
      let expirationDate: Date;
      if (totalMonths < 12) {
        // Monthly leave: expires 1 year after each grant (simplified: join + 2 years)
        expirationDate = new Date(joinDate);
        expirationDate.setFullYear(joinDate.getFullYear() + 2);
      } else {
        if (policy.grant_basis === "fiscal_year") {
          const grantYear = joinDate.getFullYear() + totalYears;
          expirationDate = new Date(grantYear, 11, 31);
        } else {
          expirationDate = new Date(joinDate);
          expirationDate.setFullYear(joinDate.getFullYear() + totalYears + 1);
        }
      }

      // Check if we're within the promotion trigger window
      const daysUntilExpiry = Math.ceil(
        (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const triggerDays = totalMonths < 12 ? monthlyTriggerDays : annualTriggerDays;

      if (daysUntilExpiry > 0 && daysUntilExpiry <= triggerDays) {
        // Send notification to employee
        const expiryDateStr = `${expirationDate.getFullYear()}.${String(expirationDate.getMonth() + 1).padStart(2, "0")}.${String(expirationDate.getDate()).padStart(2, "0")}`;

        notifications.push({
          user_id: emp.id,
          type: "leave_expiry_warning",
          title: "🔔 연차 소멸 예정 안내",
          description: `${emp.full_name}님, 잔여 연차 ${remainingDays}일이 ${expiryDateStr}에 소멸 예정입니다. 연차 사용 계획을 세워주세요.`,
          data: {
            remaining_days: remainingDays,
            expiration_date: expiryDateStr,
            days_until_expiry: daysUntilExpiry,
          },
        });
        notifiedCount++;
      }
    }

    // Also notify admins if admin_reminder is enabled
    if (promotionSettings.admin_reminder && notifiedCount > 0) {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "moderator"]);

      if (adminRoles) {
        const uniqueAdminIds = [...new Set(adminRoles.map(r => r.user_id))];
        for (const adminId of uniqueAdminIds) {
          notifications.push({
            user_id: adminId,
            type: "leave_promotion_summary",
            title: "📋 연차 촉진 발송 완료",
            description: `총 ${notifiedCount}명의 구성원에게 연차 소멸 예정 알림이 발송되었습니다.`,
            data: { notified_count: notifiedCount },
          });
        }
      }
    }

    // Batch insert notifications
    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);
      if (insertError) {
        console.error("Failed to insert notifications:", insertError);
        throw insertError;
      }
    }

    console.log(`Leave promotion check complete. Notified: ${notifiedCount}`);

    return new Response(
      JSON.stringify({
        message: `${notifiedCount}명에게 연차 촉진 알림을 발송했습니다.`,
        notified: notifiedCount,
        total_employees: employees.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in leave-promotion-check:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
