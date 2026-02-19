import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// valid_until 문자열에서 마지막 날짜를 파싱
function parseValidUntilDate(validUntil: string | null): Date | null {
  if (!validUntil || validUntil.trim() === "") return null;

  // "2026. 2. 11. ~ 2026. 2. 25." 형식
  if (validUntil.includes("~")) {
    const parts = validUntil.split("~");
    const endPart = parts[parts.length - 1].trim();
    const nums = endPart.match(/\d+/g);
    if (nums && nums.length >= 3) {
      return new Date(parseInt(nums[0]), parseInt(nums[1]) - 1, parseInt(nums[2]));
    }
  }

  // "2026년 02월 16일" 형식
  const korMatch = validUntil.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (korMatch) {
    return new Date(parseInt(korMatch[1]), parseInt(korMatch[2]) - 1, parseInt(korMatch[3]));
  }

  // "2026. 2. 25." 형식
  const dotMatch = validUntil.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (dotMatch) {
    return new Date(parseInt(dotMatch[1]), parseInt(dotMatch[2]) - 1, parseInt(dotMatch[3]));
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // quote_issued 상태이고 valid_until이 있는 견적서 조회
    const { data: quotes, error: fetchError } = await supabase
      .from("saved_quotes")
      .select("id, valid_until")
      .eq("project_stage", "quote_issued")
      .not("valid_until", "is", null)
      .neq("valid_until", "");

    if (fetchError) throw fetchError;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiredIds = (quotes || [])
      .filter((q) => {
        const expDate = parseValidUntilDate(q.valid_until);
        return expDate && expDate < today;
      })
      .map((q) => q.id);

    if (expiredIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expired quotes found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateError } = await supabase
      .from("saved_quotes")
      .update({ project_stage: "cancelled" })
      .in("id", expiredIds);

    if (updateError) throw updateError;

    console.log(`Auto-expired ${expiredIds.length} quotes`);

    return new Response(
      JSON.stringify({
        message: `${expiredIds.length} quotes auto-expired`,
        count: expiredIds.length,
        ids: expiredIds,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in auto-expire-quotes:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
