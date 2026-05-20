// backfill-shadow-ai-teams
// Preenche home_team/away_team/championship em mycroft_analyses_shadow_ai
// para sinais antigos. Usa Sportmonks (sm_*) e tenta numéricos como SM id.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOKEN = Deno.env.get("SPORTMONKS_API_KEY") ?? "";
const BASE = "https://api.sportmonks.com/v3";

async function fetchTeams(smId: number): Promise<{ home: string | null; away: string | null; league: string | null }> {
  const url = `${BASE}/football/fixtures/${smId}?api_token=${TOKEN}&include=participants;league`;
  const r = await fetch(url);
  if (!r.ok) return { home: null, away: null, league: null };
  const j = await r.json();
  const f = j?.data;
  if (!f) return { home: null, away: null, league: null };
  const parts = f.participants || [];
  const home = parts.find((p: any) => p.meta?.location === "home") || parts[0];
  const away = parts.find((p: any) => p.meta?.location === "away") || parts[1];
  return {
    home: home?.name ?? null,
    away: away?.name ?? null,
    league: f.league?.name ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (!TOKEN) {
    return new Response(JSON.stringify({ error: "SPORTMONKS_API_KEY missing" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data: rows, error } = await sb
    .from("mycroft_analyses_shadow_ai")
    .select("id, match_id, home_team")
    .or("home_team.is.null,home_team.eq.")
    .limit(500);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const byMatch = new Map<string, { home: string | null; away: string | null; league: string | null }>();
  let updated = 0, failed = 0;
  const details: any[] = [];

  for (const r of rows || []) {
    const mid = String(r.match_id || "");
    let smId: number | null = null;
    if (mid.startsWith("sm_")) smId = Number(mid.slice(3));
    else if (/^\d+$/.test(mid)) smId = Number(mid);
    if (!smId || !Number.isFinite(smId)) { failed++; continue; }

    let info = byMatch.get(mid);
    if (!info) {
      try {
        info = await fetchTeams(smId);
        byMatch.set(mid, info);
      } catch (e) {
        info = { home: null, away: null, league: null };
      }
    }

    if (info.home && info.away) {
      const { error: uErr } = await sb
        .from("mycroft_analyses_shadow_ai")
        .update({ home_team: info.home, away_team: info.away, championship: info.league })
        .eq("id", r.id);
      if (uErr) { failed++; details.push({ id: r.id, err: uErr.message }); }
      else updated++;
    } else {
      failed++;
      details.push({ id: r.id, match_id: mid, reason: "no fixture" });
    }
  }

  return new Response(JSON.stringify({
    ok: true, processed: (rows || []).length, updated, failed,
    unique_matches: byMatch.size, details: details.slice(0, 20),
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
