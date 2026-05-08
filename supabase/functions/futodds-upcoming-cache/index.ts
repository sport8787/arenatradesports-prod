// futodds-upcoming-cache — Cron 60s. Busca /matches-upcoming na Futodds, alimenta `cached_odds_games`
// (TTL 60s) e registra latência/erros em `futodds_health_log`. Reduz a 1 chamada/min para upcoming.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUTODDS_BASE = "https://csv.futodds.com/functions/v1";
const TOKEN = Deno.env.get("FUTODDS_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function logHealth(supabase: any, row: Record<string, unknown>) {
  try { await supabase.from("futodds_health_log").insert(row); } catch { /* ignore */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  if (!TOKEN) {
    await logHealth(supabase, { endpoint: "/matches-upcoming", ok: false, error: "no_token" });
    return new Response(JSON.stringify({ ok: false, error: "FUTODDS_API_KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const t0 = Date.now();
  let status = 0;
  let items: any[] = [];
  let errMsg: string | null = null;
  try {
    const res = await fetch(`${FUTODDS_BASE}/matches-upcoming`, {
      headers: { Authorization: `Bearer ${TOKEN}`, "X-API-Key": TOKEN, Accept: "application/json" },
    });
    status = res.status;
    const json = await res.json().catch(() => null);
    items = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
    if (!res.ok) errMsg = `http_${res.status}`;
  } catch (e) {
    errMsg = (e as Error).message;
  }
  const latency = Date.now() - t0;

  // Cobertura de ligas
  const leagues = new Set<string>();
  for (const m of items) {
    const lid = m?.league_id ?? m?.competition_id ?? m?.tournament?.id;
    if (lid != null) leagues.add(String(lid));
  }

  await logHealth(supabase, {
    endpoint: "/matches-upcoming",
    status_code: status,
    latency_ms: latency,
    ok: !errMsg && status >= 200 && status < 300,
    error: errMsg,
    leagues_count: leagues.size,
    items_count: items.length,
  });

  // Upsert no cache (TTL 60s) — só campos básicos. Bookmakers vazio (preenchido por outras funções).
  const now = new Date();
  const expires = new Date(now.getTime() + 60_000).toISOString();
  let upserted = 0;
  if (items.length > 0) {
    const rows = items
      .map((g: any) => {
        const ev = g?.event_id ?? g?.eventId ?? g?.id_betfair ?? g?.id ?? g?.fixture_id;
        const home = g?.home_team ?? g?.home?.name ?? g?.homeTeam;
        const away = g?.away_team ?? g?.away?.name ?? g?.awayTeam;
        const commence = g?.commence_time ?? g?.start_time ?? g?.kickoff ?? g?.date;
        if (!ev || !home || !away || !commence) return null;
        return {
          event_id: String(ev),
          sport_key: g?.sport_key ?? "soccer",
          home_team: String(home),
          away_team: String(away),
          commence_time: new Date(commence).toISOString(),
          bookmakers: [],
          simulated_odds: false,
          fetched_at: now.toISOString(),
          expires_at: expires,
        };
      })
      .filter(Boolean);

    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await supabase.from("cached_odds_games").upsert(chunk as any, { onConflict: "event_id" });
      if (!error) upserted += chunk.length;
    }
  }

  return new Response(JSON.stringify({
    ok: !errMsg,
    latency_ms: latency,
    items_received: items.length,
    upserted,
    leagues_count: leagues.size,
    error: errMsg,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
