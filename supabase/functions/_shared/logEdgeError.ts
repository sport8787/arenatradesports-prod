// Shared helper to log edge function errors into public.edge_function_errors.
// Import from any edge function: import { logEdgeError } from "../_shared/logEdgeError.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

export async function logEdgeError(
  functionName: string,
  error: unknown,
  ctx: { context?: Record<string, unknown>; statusCode?: number; severity?: "error" | "warning" } = {},
): Promise<void> {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return;
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack ?? null : null;
    const client = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });
    await client.from("edge_function_errors").insert({
      function_name: functionName,
      error_message: message.slice(0, 2000),
      error_stack: stack ? stack.slice(0, 4000) : null,
      context: ctx.context ?? {},
      status_code: ctx.statusCode ?? null,
      severity: ctx.severity ?? "error",
    });
  } catch (_e) {
    // Best effort — never throw from the logger.
  }
}
