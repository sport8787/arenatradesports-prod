// futodds-live-odds — Proxy de odds reais Betfair Exchange (back/lay) por event_id.
// Substitui estimateLiveOdd no frontend e nos cálculos de cashout.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUTODDS_BASE = "https://csv.futodds.com/functions/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const key = Deno.env.get("FUTODDS_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "FUTODDS_API_KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth (qualquer usuário logado)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data, error } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (error || !data?.claims) throw new Error("invalid token");
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* GET ok */ }
  const url = new URL(req.url);
  const eventId = body.event_id ?? url.searchParams.get("event_id");
  const marketType = body.market_type ?? url.searchParams.get("market_type") ?? undefined;

  if (!eventId) {
    return new Response(JSON.stringify({ error: "event_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const target = new URL(`${FUTODDS_BASE}/matches-betfair-live-odds`);
  target.searchParams.set("event_id", String(eventId));
  if (marketType) target.searchParams.set("market_type", marketType);

  const t0 = Date.now();
  const res = await fetch(target.toString(), {
    headers: { Authorization: `Bearer ${key}`, "X-API-Key": key, Accept: "application/json" },
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* keep text */ }

  return new Response(JSON.stringify({
    ok: res.ok,
    ms: Date.now() - t0,
    status: res.status,
    data: json?.data ?? json ?? text,
  }), { status: res.ok ? 200 : res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
