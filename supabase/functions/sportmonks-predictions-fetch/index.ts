// =============================================================================
// SPORTMONKS PREDICTIONS FETCH
// Busca probabilidades 1X2, Over/Under e BTTS calculadas pela Sportmonks para
// um fixture específico (endpoint /football/predictions/probabilities/fixtures/{id}).
//
// Uso: segunda opinião contra o modelo Mycroft. Divergência >15pp marca
// sherlock_alert (não veta).
//
// Input: { match_id, home_team?, away_team?, commence_time?, sm_fixture_id?, force? }
// Output: { success, cached, fixture_id, predictions: { home_win, draw, away_win,
//          over_25, under_25, btts_yes, btts_no, ... }, raw? }
//
// Cache: sportmonks_predictions_cache (TTL aplicacional 6h)
// =============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SM_TOKEN = Deno.env.get("SPORTMONKS_API_KEY") ?? "";
const SM_BASE = "https://api.sportmonks.com/v3";
const TTL_HOURS = 6;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

interface NormalizedPredictions {
  home_win: number | null;   // 0..100
  draw: number | null;
  away_win: number | null;
  over_25: number | null;
  under_25: number | null;
  btts_yes: number | null;
  btts_no: number | null;
  over_15: number | null;
  under_15: number | null;
  over_35: number | null;
  under_35: number | null;
}

function smNorm(n: string): string {
  return (n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|sc|cf|rc|ac|ss|ssc|sv|vfb|vfl|rb|bsc|afc|fk|sk|nk|rsc|ec|ad|cd|club|deportivo|sporting|sport|de|do|da|the)\b/gi, " ")
    .replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, " ");
}
function teamsMatch(a: string, b: string): boolean {
  const na = smNorm(a), nb = smNorm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.includes(na)) return true;
  if (nb.length >= 4 && na.includes(nb)) return true;
  const wa = na.split(/\s+/), wb = nb.split(/\s+/);
  return wa[0] === wb[0];
}

async function resolveSmFixtureId(
  homeTeam: string,
  awayTeam: string,
  commence: string,
): Promise<number | null> {
  if (!SM_TOKEN || !homeTeam || !awayTeam || !commence) return null;
  const base = new Date(commence);
  if (isNaN(base.getTime())) return null;
  for (const offset of [0, -1, 1]) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + offset);
    const ymd = d.toISOString().slice(0, 10);
    const url = new URL(`${SM_BASE}/football/fixtures/date/${ymd}`);
    url.searchParams.set("api_token", SM_TOKEN);
    url.searchParams.set("include", "participants");
    url.searchParams.set("per_page", "100");
    try {
      const r = await fetch(url.toString());
      if (!r.ok) continue;
      const j = await r.json();
      const fixtures = j.data || [];
      for (const f of fixtures) {
        const p = f.participants || [];
        const home = p.find((x: any) => x.meta?.location === "home") || p[0];
        const away = p.find((x: any) => x.meta?.location === "away") || p[1];
        if (!home || !away) continue;
        if (teamsMatch(home.name, homeTeam) && teamsMatch(away.name, awayTeam)) {
          return Number(f.id);
        }
      }
    } catch { /* continue */ }
  }
  return null;
}

async function fetchPredictionsRaw(smFixtureId: number): Promise<any | null> {
  if (!SM_TOKEN) return null;
  const url = new URL(`${SM_BASE}/football/predictions/probabilities/fixtures/${smFixtureId}`);
  url.searchParams.set("api_token", SM_TOKEN);
  try {
    const r = await fetch(url.toString());
    if (!r.ok) {
      console.warn(`[sm-predictions] HTTP ${r.status} para fixture ${smFixtureId}`);
      return null;
    }
    const j = await r.json();
    return j.data || null;
  } catch (e) {
    console.warn("[sm-predictions] fetch falhou:", (e as Error).message);
    return null;
  }
}

// Sportmonks retorna array de "type" com predictions{}. Cada type tem developer_name
// como FULLTIME_RESULT_PROBABILITY, OVER_UNDER_2_5_PROBABILITY, BTTS_PROBABILITY etc.
function normalize(raw: any): NormalizedPredictions {
  const out: NormalizedPredictions = {
    home_win: null, draw: null, away_win: null,
    over_25: null, under_25: null,
    btts_yes: null, btts_no: null,
    over_15: null, under_15: null,
    over_35: null, under_35: null,
  };
  const items = Array.isArray(raw) ? raw : [raw];
  for (const item of items) {
    if (!item || !item.predictions) continue;
    const dev = String(item.type?.developer_name || item.developer_name || "").toUpperCase();
    const p = item.predictions || {};
    const num = (v: any): number | null => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    if (dev.includes("FULLTIME_RESULT")) {
      out.home_win = num(p.home);
      out.draw = num(p.draw);
      out.away_win = num(p.away);
    } else if (dev.includes("OVER_UNDER_2_5") || dev.includes("OVER_UNDER_25")) {
      out.over_25 = num(p.yes ?? p.over);
      out.under_25 = num(p.no ?? p.under);
    } else if (dev.includes("OVER_UNDER_1_5") || dev.includes("OVER_UNDER_15")) {
      out.over_15 = num(p.yes ?? p.over);
      out.under_15 = num(p.no ?? p.under);
    } else if (dev.includes("OVER_UNDER_3_5") || dev.includes("OVER_UNDER_35")) {
      out.over_35 = num(p.yes ?? p.over);
      out.under_35 = num(p.no ?? p.under);
    } else if (dev.includes("BTTS")) {
      out.btts_yes = num(p.yes);
      out.btts_no = num(p.no);
    }
  }
  return out;
}

async function loadCache(matchId: string): Promise<any | null> {
  const { data } = await sb.from("sportmonks_predictions_cache")
    .select("*").eq("match_id", matchId).maybeSingle();
  if (!data) return null;
  const ageH = (Date.now() - new Date(data.fetched_at).getTime()) / 3_600_000;
  if (ageH > TTL_HOURS) return null;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { match_id, home_team, away_team, commence_time, force } = body;
    let { sm_fixture_id } = body;
    if (!match_id) {
      return new Response(JSON.stringify({ success: false, error: "match_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!force) {
      const cached = await loadCache(String(match_id));
      if (cached) {
        return new Response(JSON.stringify({
          success: true, cached: true, sm_fixture_id: cached.sm_fixture_id,
          predictions: cached.payload?.predictions || null,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!sm_fixture_id && home_team && away_team && commence_time) {
      sm_fixture_id = await resolveSmFixtureId(home_team, away_team, commence_time);
    }
    if (!sm_fixture_id) {
      return new Response(JSON.stringify({
        success: false, error: "fixture não encontrado na Sportmonks",
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const raw = await fetchPredictionsRaw(Number(sm_fixture_id));
    if (!raw) {
      return new Response(JSON.stringify({
        success: false, error: "predictions indisponíveis", sm_fixture_id,
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const predictions = normalize(raw);

    await sb.from("sportmonks_predictions_cache").upsert({
      match_id: String(match_id),
      sm_fixture_id: Number(sm_fixture_id),
      home_team: home_team || null,
      away_team: away_team || null,
      commence_time: commence_time || null,
      payload: { predictions },
      fetched_at: new Date().toISOString(),
    }, { onConflict: "match_id" });

    return new Response(JSON.stringify({
      success: true, cached: false, sm_fixture_id, predictions,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[sm-predictions]", e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
