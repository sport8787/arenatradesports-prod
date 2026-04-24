// Logs the start/finish of an edge function execution into public.edge_function_runs.
// Use:
//   const run = startEdgeRun("my-function");
//   try { ... await run.success({ statusCode: 200, context: {...} }); }
//   catch (e) { await run.error(e, { statusCode: 500 }); throw e; }
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

let _client: SupabaseClient | null = null;
function client(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  if (!_client) _client = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  return _client;
}

export interface RunHandle {
  success: (opts?: { statusCode?: number; context?: Record<string, unknown> }) => Promise<void>;
  error: (
    err: unknown,
    opts?: { statusCode?: number; context?: Record<string, unknown> },
  ) => Promise<void>;
}

export function startEdgeRun(functionName: string): RunHandle {
  const startedAt = new Date();
  const t0 = performance.now();

  const finalize = async (
    status: "success" | "error",
    opts: { statusCode?: number; context?: Record<string, unknown>; errorMessage?: string } = {},
  ) => {
    try {
      const c = client();
      if (!c) return;
      await c.from("edge_function_runs").insert({
        function_name: functionName,
        status,
        duration_ms: Math.round(performance.now() - t0),
        status_code: opts.statusCode ?? null,
        error_message: opts.errorMessage ?? null,
        context: opts.context ?? {},
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
      });
    } catch (_) {
      // best-effort, never throw
    }
  };

  return {
    success: (opts) => finalize("success", opts),
    error: (err, opts) =>
      finalize("error", {
        ...opts,
        errorMessage: (err instanceof Error ? err.message : String(err)).slice(0, 2000),
      }),
  };
}
