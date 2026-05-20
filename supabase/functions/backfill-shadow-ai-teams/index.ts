// backfill-shadow-ai-teams
// Preenche home_team/away_team/championship em mycroft_analyses_shadow_ai
// para sinais antigos. Usa Sportmonks (sm_*) e tenta numéricos como SM id.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOKEN = Deno.env.get("SPORTMONKS_API_KEY") ?? "";
const FUTODDS_KEY = Deno.env.get("FUTODDS_API_KEY") ?? "";
const BASE = "https://api.sportmonks.com/v3";
const FUTODDS_BASE = "https://csv.futodds.com/functions/v1";

async function fetchTeamsSM(smId: number): Promise<{ home: string | null; away: string | null; league: string | null }> {
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

async function fdGet(path: string): Promise<any> {
  if (!FUTODDS_KEY) return null;
  const r = await fetch(`${FUTODDS_BASE}${path}`, {
    headers: { Authorization: `Bearer ${FUTODDS_KEY}`, "X-API-Key": FUTODDS_KEY, Accept: "application/json" },
  });
  if (!r.ok) return null;
  return await r.json().catch(() => null);
}

function pickTeamsFromFD(item: any): { home: string | null; away: string | null; league: string | null } {
  if (!item) return { home: null, away: null, league: null };
  return {
    home: item.home_name || item.home_team || item.home || null,
    away: item.away_name || item.away_team || item.away || null,
    league: item.league_name || item.league || item.championship || null,
  };
}

async function fetchTeamsFutodds(matchId: string): Promise<{ home: string | null; away: string | null; league: string | null }> {
  // Tentativa 1: live full
  const live = await fdGet("/matches-betfair-live");
  const arr = Array.isArray(live) ? live : (live?.data ?? []);
  const found = (arr || []).find((m: any) => String(m.id ?? m.match_id ?? m.fixture_id) === matchId);
  if (found) return pickTeamsFromFD(found);

  // Tentativa 2: ended dos últimos 10 dias
  for (let d = 0; d <= 10; d++) {
    const date = new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10);
    const j = await fdGet(`/matches-ended?date=${date}`);
    const list = Array.isArray(j) ? j : (j?.data ?? []);
    const f = (list || []).find((m: any) => String(m.id ?? m.match_id ?? m.fixture_id) === matchId);
    if (f) return pickTeamsFromFD(f);
  }
  return { home: null, away: null, league: null };
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
    let info = byMatch.get(mid);
    if (!info) {
      try {
        if (mid.startsWith("sm_")) {
          const smId = Number(mid.slice(3));
          info = Number.isFinite(smId) ? await fetchTeamsSM(smId) : { home: null, away: null, league: null };
        } else if (/^\d+$/.test(mid)) {
          // Tenta Futodds primeiro (IDs numéricos costumam ser FD)
          info = await fetchTeamsFutodds(mid);
          if (!info.home) {
            const smTry = await fetchTeamsSM(Number(mid));
            if (smTry.home) info = smTry;
          }
        } else {
          info = { home: null, away: null, league: null };
        }
        byMatch.set(mid, info);
      } catch (_e) {
        info = { home: null, away: null, league: null };
      }
    }

    if (info && info.home && info.away) {
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
