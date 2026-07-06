import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listRecentQuotesTool from "./tools/list-recent-quotes";
import listRecipientsTool from "./tools/list-recipients";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "acbank-sys-mcp",
  title: "AC Bank Sys MCP",
  version: "0.1.0",
  instructions:
    "Tools for the AC Bank Sys workspace. All tools run as the signed-in user via Supabase RLS. Use `whoami` to verify the connection, `list_recent_quotes` to browse saved quotes, and `list_recipients` to look up clients.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listRecentQuotesTool, listRecipientsTool],
});
