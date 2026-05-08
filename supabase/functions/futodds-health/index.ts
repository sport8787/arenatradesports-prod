// futodds-health — Painel admin: agrega latência, taxa de erro e ligas cobertas a partir
// de `futodds_health_log`. Restrito a admins.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: u } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!u?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: roleRow } = await sb.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const minutes = Math.min(Math.max(Number(url.searchParams.get("minutes") ?? "60"), 5), 24 * 60);
  const since = new Date(Date.now() - minutes * 60_000).toISOString();

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: rows, error } = await service
    .from("futodds_health_log")
    .select("endpoint, status_code, latency_ms, ok, error, leagues_count, items_count, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Agregação por endpoint
  const byEndpoint = new Map<string, {
    endpoint: string; total: number; ok: number; err: number;
    sumLat: number; maxLat: number; minLat: number;
    leagues: number; items: number; lastAt: string | null;
  }>();
  for (const r of rows ?? []) {
    const cur = byEndpoint.get(r.endpoint) ?? {
      endpoint: r.endpoint, total: 0, ok: 0, err: 0,
      sumLat: 0, maxLat: 0, minLat: Number.POSITIVE_INFINITY,
      leagues: 0, items: 0, lastAt: null,
    };
    cur.total += 1;
    if (r.ok) cur.ok += 1; else cur.err += 1;
    if (r.latency_ms != null) {
      cur.sumLat += r.latency_ms;
      cur.maxLat = Math.max(cur.maxLat, r.latency_ms);
      cur.minLat = Math.min(cur.minLat, r.latency_ms);
    }
    cur.leagues = Math.max(cur.leagues, r.leagues_count ?? 0);
    cur.items = Math.max(cur.items, r.items_count ?? 0);
    if (!cur.lastAt || r.created_at > cur.lastAt) cur.lastAt = r.created_at;
    byEndpoint.set(r.endpoint, cur);
  }

  const summary = Array.from(byEndpoint.values()).map(c => ({
    endpoint: c.endpoint,
    total: c.total,
    ok: c.ok,
    err: c.err,
    error_rate: c.total ? +(c.err / c.total * 100).toFixed(2) : 0,
    avg_latency_ms: c.total ? Math.round(c.sumLat / c.total) : 0,
    max_latency_ms: c.maxLat,
    min_latency_ms: c.minLat === Number.POSITIVE_INFINITY ? 0 : c.minLat,
    leagues_covered: c.leagues,
    items_max: c.items,
    last_at: c.lastAt,
  })).sort((a, b) => a.endpoint.localeCompare(b.endpoint));

  return new Response(JSON.stringify({
    ok: true,
    window_minutes: minutes,
    samples: rows?.length ?? 0,
    summary,
    recent: (rows ?? []).slice(0, 50),
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
