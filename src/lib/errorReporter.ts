import { supabase } from "@/integrations/supabase/client";

type ReportInput = {
  message: string;
  stack?: string | null;
  source?: string;
  context?: Record<string, unknown>;
};

let installed = false;
const recent = new Map<string, number>();
const DEDUPE_MS = 5000;

async function send(input: ReportInput) {
  try {
    const key = `${input.source ?? ""}|${input.message}`;
    const now = Date.now();
    const last = recent.get(key) ?? 0;
    if (now - last < DEDUPE_MS) return;
    recent.set(key, now);

    const { data } = await supabase.auth.getUser();
    const payload = {
      user_id: data?.user?.id ?? null,
      route: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
      message: String(input.message).slice(0, 2000),
      stack: input.stack ? String(input.stack).slice(0, 8000) : null,
      source: input.source ?? "unknown",
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      context: input.context ?? {},
    };
    // Best-effort console mirror so dev can see immediately
    // eslint-disable-next-line no-console
    console.error("[errorReporter]", payload.source, payload.message, input.stack ?? "");
    await supabase.from("client_error_logs").insert(payload as never);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[errorReporter] failed to report", e);
  }
}

export function reportError(err: unknown, context?: Record<string, unknown>, source = "manual") {
  if (err instanceof Error) {
    void send({ message: err.message, stack: err.stack, source, context });
  } else {
    void send({ message: typeof err === "string" ? err : JSON.stringify(err), source, context });
  }
}

export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    const err = event.error instanceof Error ? event.error : null;
    void send({
      message: err?.message ?? event.message ?? "window.onerror",
      stack: err?.stack,
      source: "window.error",
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const err = reason instanceof Error ? reason : null;
    void send({
      message: err?.message ?? (typeof reason === "string" ? reason : JSON.stringify(reason ?? "unhandledrejection")),
      stack: err?.stack,
      source: "unhandledrejection",
    });
  });
}
