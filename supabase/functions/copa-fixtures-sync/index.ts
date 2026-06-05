// ─────────────────────────────────────────────────────────────────────
// copa-fixtures-sync
// Sincroniza diariamente fixtures da Copa do Mundo 2026 e enriquece
// com ranking FIFA, xG das últimas 5 oficiais, desfalques e status
// de classificação/eliminação. Persiste em public.copa_fixtures.
// Cron: 09:00 UTC.
// ─────────────────────────────────────────────────────────────────────
import { createClient } from "npm:@supabase/supabase-js@2";
import { getFifa } from "../_shared/fifaRanking.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WORLD_CUP_LEAGUE_ID = 1; // API-Football: World Cup
const SEASON = 2026;
const HORIZON_DAYS = 5;
const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

function phaseFromRound(round: string | undefined, fixtureDate: string): string {
  const r = (round || "").toLowerCase();
  if (r.includes("group") || r.includes("grupo")) {
    if (r.includes("1st") || r.includes("1ª") || r.includes("matchday 1")) return "grupos_j1";
    if (r.includes("2nd") || r.includes("2ª") || r.includes("matchday 2")) return "grupos_j2";
    if (r.includes("3rd") || r.includes("3ª") || r.includes("matchday 3")) return "grupos_j3";
    return "grupos_j1";
  }
  if (r.includes("round of 16") || r.includes("oitavas")) return "oitavas";
  if (r.includes("quarter") || r.includes("quartas")) return "quartas";
  if (r.includes("3rd place") || r.includes("third place") || r.includes("terceiro")) return "3lugar";
  if (r.includes("semi")) return "semi";
  if (r.includes("final")) return "final";
  return "grupos_j1";
}

async function apiFootball(path: string, key: string): Promise<any> {
  const r = await fetch(`${API_FOOTBALL_BASE}${path}`, {
    headers: { "x-apisports-key": key },
  });
  if (!r.ok) throw new Error(`API-Football ${path} → ${r.status}`);
  return r.json();
}

async function fetchLast5OfficialStats(teamId: number, key: string) {
  // Últimos jogos oficiais (Copa + Eliminatórias + Nations League). Amistosos peso baixo.
  try {
    const j = await apiFootball(`/fixtures?team=${teamId}&last=10`, key);
    const games = j?.response || [];
    const official = games.filter((g: any) => {
      const lname = String(g?.league?.name || "").toLowerCase();
      return lname.includes("world cup") || lname.includes("eliminat") ||
             lname.includes("qualification") || lname.includes("nations league") ||
             lname.includes("uefa euro") || lname.includes("copa america");
    }).slice(0, 5);
    let gf = 0, ga = 0, n = 0;
    for (const g of official) {
      const isHome = g?.teams?.home?.id === teamId;
      const my = isHome ? g?.goals?.home : g?.goals?.away;
      const his = isHome ? g?.goals?.away : g?.goals?.home;
      if (typeof my === "number" && typeof his === "number") { gf += my; ga += his; n++; }
    }
    if (!n) return { xg: null, xga: null, sample: 0 };
    return { xg: +(gf / n).toFixed(2), xga: +(ga / n).toFixed(2), sample: n };
  } catch (e) {
    console.warn(`[copa-sync] last5 stats fail team=${teamId}:`, (e as Error).message);
    return { xg: null, xga: null, sample: 0 };
  }
}

async function fetchInjuries(teamId: number, key: string) {
  try {
    const j = await apiFootball(`/injuries?team=${teamId}&season=${SEASON}`, key);
    const list = (j?.response || []).map((x: any) => ({
      player: x?.player?.name,
      type: x?.player?.type,
      reason: x?.player?.reason,
    }));
    return list;
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("API_FOOTBALL_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API_FOOTBALL_KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const from = new Date();
    const to = new Date(Date.now() + HORIZON_DAYS * 86400_000);
    const dateFrom = from.toISOString().slice(0, 10);
    const dateTo = to.toISOString().slice(0, 10);

    const fixturesResp = await apiFootball(
      `/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=${SEASON}&from=${dateFrom}&to=${dateTo}`,
      apiKey,
    );
    const fixtures = fixturesResp?.response || [];
    console.log(`[copa-sync] ${fixtures.length} fixtures Copa 2026 entre ${dateFrom} e ${dateTo}`);

    let upserts = 0;
    for (const fx of fixtures) {
      const fixtureId = String(fx?.fixture?.id);
      const home = fx?.teams?.home?.name;
      const away = fx?.teams?.away?.name;
      const homeId = fx?.teams?.home?.id;
      const awayId = fx?.teams?.away?.id;
      const commence = fx?.fixture?.date;
      const round = fx?.league?.round;
      if (!fixtureId || !home || !away || !commence) continue;

      const phase = phaseFromRound(round, commence);
      const groupMatch = (round || "").match(/Group\s+([A-Z])/i);
      const groupLetter = groupMatch ? groupMatch[1].toUpperCase() : null;

      const fifaH = getFifa(home);
      const fifaA = getFifa(away);

      const [xgH, xgA, injH, injA] = await Promise.all([
        fetchLast5OfficialStats(homeId, apiKey),
        fetchLast5OfficialStats(awayId, apiKey),
        fetchInjuries(homeId, apiKey),
        fetchInjuries(awayId, apiKey),
      ]);

      const { error } = await supabase.from("copa_fixtures").upsert({
        fixture_id: fixtureId,
        home, away,
        commence_time: commence,
        phase,
        group_letter: groupLetter,
        home_fifa_rank: fifaH?.rank ?? null,
        away_fifa_rank: fifaA?.rank ?? null,
        home_fifa_pts: fifaH?.pts ?? null,
        away_fifa_pts: fifaA?.pts ?? null,
        injuries: { home: injH, away: injA },
        xg_last5: {
          home: xgH, away: xgA,
        },
        raw: fx,
        updated_at: new Date().toISOString(),
      }, { onConflict: "fixture_id" });

      if (error) console.error(`[copa-sync] upsert ${fixtureId}:`, error.message);
      else upserts++;
    }

    await supabase.from("cron_logs").insert({
      tipo: "copa_fixtures_sync",
      mensagem: `Sincronizou ${upserts}/${fixtures.length} fixtures Copa 2026`,
      detalhes: { dateFrom, dateTo, total: fixtures.length, upserts },
    });

    return new Response(JSON.stringify({ ok: true, fixtures: fixtures.length, upserts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[copa-sync] erro:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
