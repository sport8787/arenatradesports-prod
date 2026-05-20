// One-shot helper to invoke migrate-auth-to-mirror server-side
// using MIGRATION_TOKEN from env (avoids exposing the token to tools).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/migrate-auth-to-mirror`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "X-Migration-Token": Deno.env.get("MIGRATION_TOKEN") ?? "",
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
