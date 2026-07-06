import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_recipients",
  title: "List recipients",
  description: "List recipients (clients) accessible to the signed-in user. Optional keyword search on name/company.",
  inputSchema: {
    query: z.string().trim().default("").describe("Optional keyword filter (matched against name or company)."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    let request = supabase
      .from("recipients")
      .select("id, name, company_name, phone, email, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (query) {
      request = request.or(`name.ilike.%${query}%,company_name.ilike.%${query}%`);
    }
    const { data, error } = await request;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { recipients: data ?? [] },
    };
  },
});
