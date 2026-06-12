// ─────────────────────────────────────────────────────────────────────
// copa-fixtures-sync
// Sincroniza diariamente fixtures da Copa do Mundo 2026 e enriquece
// com ranking FIFA, xG das últimas 5 oficiais, desfalques e status
// de classificação/eliminação. Persiste em public.copa_fixtures.
// Cron: 09:00 UTC.
//
// λ priority: Futodds CS projections → FootyStats copa_2026_stats → API-Football L5
// ─────────────────────────────────────────────────────────────────────
import { createClient } from "npm:@supabase/supabase-js@2";
import { getFifa } from "../_shared/fifaRanking.ts";
import { getFutoddsCS, isFutoddsDisabled } from "../_shared/futoddsProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WORLD_CUP_LEAGUE_ID = 1; // API-Football: World Cup
const SEASON = 2026;
const HORIZON_DAYS = 5;
const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

function _normTeam(s: string): string {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "").trim();
}
function _teamMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  return shorter.length >= 3 && longer.includes(shorter) && shorter.length / longer.length >= 0.5;
}

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

    // Pré-fetch Futodds CS (1 chamada para todos os jogos)
    let futoddsCSList: any[] = [];
    if (!isFutoddsDisabled()) {
      try {
        futoddsCSList = await getFutoddsCS({ date_from: dateFrom, date_to: dateTo });
        console.log(`[copa-sync] Futodds CS: ${futoddsCSList.length} projeções`);
      } catch (e) {
        console.warn("[copa-sync] Futodds CS falhou:", (e as Error).message);
      }
    }

    // Pré-fetch copa_2026_stats (FootyStats) para todos os times
    const { data: footyStatsAll } = await supabase
      .from("copa_2026_stats")
      .select("team_name, avg_goals_scored_last5, avg_goals_conceded_last5, form_last5, matches_data");
    const footyMap = new Map<string, any>();
    for (const row of footyStatsAll || []) {
      footyMap.set(_normTeam(row.team_name), row);
    }

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

      // ── λ resolution: Futodds CS → FootyStats → API-Football ──────────
      const normH = _normTeam(home);
      const normA = _normTeam(away);

      // 1. Futodds CS projections (melhor fonte — já é λ do modelo)
      const csMatch = futoddsCSList.find((c: any) => {
        const ch = _normTeam(c.home_team || c.home_name || "");
        const ca = _normTeam(c.away_team || c.away_name || "");
        return _teamMatch(ch, normH) && _teamMatch(ca, normA);
      });

      let xgH: any, xgA: any;
      if (csMatch?.projected_home_goals_ft != null) {
        xgH = {
          xg: csMatch.projected_home_goals_ft,
          xga: csMatch.projected_away_goals_ft,
          source: "futodds_cs",
          sample: null,
        };
        xgA = {
          xg: csMatch.projected_away_goals_ft,
          xga: csMatch.projected_home_goals_ft,
          source: "futodds_cs",
          sample: null,
        };
        console.log(`[copa-sync] 🔵 CS λ: ${home}=${csMatch.projected_home_goals_ft} ${away}=${csMatch.projected_away_goals_ft}`);
      } else {
        // 2. FootyStats copa_2026_stats
        const fsH = [...footyMap.entries()].find(([k]) => _teamMatch(k, normH))?.[1];
        const fsA = [...footyMap.entries()].find(([k]) => _teamMatch(k, normA))?.[1];
        if (fsH?.avg_goals_scored_last5 != null) {
          xgH = { xg: fsH.avg_goals_scored_last5, xga: fsH.avg_goals_conceded_last5, form: fsH.form_last5, source: "footystats", sample: 5 };
          console.log(`[copa-sync] 🟡 FootyStats: ${home} xg=${fsH.avg_goals_scored_last5}`);
        } else {
          // 3. API-Football historical (fallback original)
          xgH = await fetchLast5OfficialStats(homeId, apiKey);
          xgH = { ...xgH, source: "api_football" };
        }
        if (fsA?.avg_goals_scored_last5 != null) {
          xgA = { xg: fsA.avg_goals_scored_last5, xga: fsA.avg_goals_conceded_last5, form: fsA.form_last5, source: "footystats", sample: 5 };
        } else {
          xgA = await fetchLast5OfficialStats(awayId, apiKey);
          xgA = { ...xgA, source: "api_football" };
        }
      }

      const [injH, injA] = await Promise.all([
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
