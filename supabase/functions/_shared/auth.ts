import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

export type AppRole = "admin" | "moderator";

interface RequireAuthOptions {
  allowedRoles?: AppRole[];
  allowInternalSecret?: boolean;
}

interface AuthContext {
  supabaseAdmin: ReturnType<typeof createClient>;
  user: { id: string; email?: string } | null;
  isInternal: boolean;
}

export function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function internalSecretMatches(req: Request): boolean {
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected) return false;

  const provided =
    req.headers.get("x-internal-function-secret") ||
    req.headers.get("x-cron-secret") ||
    "";

  return provided.length > 0 && provided === expected;
}

export async function requireFunctionAuth(
  req: Request,
  options: RequireAuthOptions = {},
): Promise<AuthContext> {
  const supabaseAdmin = getSupabaseAdminClient();

  if (options.allowInternalSecret && internalSecretMatches(req)) {
    return { supabaseAdmin, user: null, isInternal: true };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const user = data.user;

  if (error || !user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (options.allowedRoles?.length) {
    const checks = await Promise.all(
      options.allowedRoles.map((role) =>
        supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: role }),
      ),
    );
    const hasAllowedRole = checks.some(({ data: allowed }) => Boolean(allowed));

    if (!hasAllowedRole) {
      throw new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return {
    supabaseAdmin,
    user: { id: user.id, email: user.email },
    isInternal: false,
  };
}

export function isAuthResponse(error: unknown): error is Response {
  return error instanceof Response;
}

export function withCors(response: Response, corsHeaders: Record<string, string>) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
