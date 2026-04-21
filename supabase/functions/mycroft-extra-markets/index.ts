// Edge Function: mycroft-extra-markets
// Gera sinais de Dupla Chance, Handicap Asiático e Handicap Europeu
// Usa a infra Poisson/Dixon-Coles + The Odds API para encontrar valor
// Salva como punter_analyses normal (mesma tabela do Punter)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ODDS_KEY = Deno.env.get("THE_ODDS_API_KEY") || "";
const API_FOOTBALL_KEY = Deno.env.get("API_FOOTBALL_KEY") || "";
const POISSON_URL = `${SUPABASE_URL}/functions/v1/poisson-dixon-coles`;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  sport_key?: string;
  league?: string;
  bookmakers?: any[];
}

const TIME_GUARD_MS = 100_000;
const MAX_GAMES = 25;
const MIN_EDGE = 4;
const MIN_ODD = 1.45;
const MAX_ODD = 3.0;

// ═════════════════════════════════════════════════════
// Buscar média de gols via API-Football (best effort)
// ═════════════════════════════════════════════════════
async function buscarMediaGols(teamName: string, season: number) {
  if (!API_FOOTBALL_KEY) return null;
  try {
    const r = await fetch(
      `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(teamName)}`,
      { headers: { "x-apisports-key": API_FOOTBALL_KEY } },
    );
    const d = await r.json();
    const team = d.response?.[0]?.team;
    if (!team) return null;
    const fr = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=${team.id}&season=${season}&last=10&status=FT`,
      { headers: { "x-apisports-key": API_FOOTBALL_KEY } },
    );
    const fd = await fr.json();
    const fixtures = fd.response || [];
    if (!fixtures.length) return null;
    let scored = 0, conceded = 0;
    for (const f of fixtures) {
      const isHome = f.teams?.home?.id === team.id;
      scored += isHome ? f.goals.home : f.goals.away;
      conceded += isHome ? f.goals.away : f.goals.home;
    }
    return {
      avg_scored: scored / fixtures.length,
      avg_conceded: conceded / fixtures.length,
      sample: fixtures.length,
    };
  } catch {
    return null;
  }
}

// ═════════════════════════════════════════════════════
// Buscar jogos do dia via The Odds API
// ═════════════════════════════════════════════════════
async function buscarJogosDoDia(): Promise<Game[]> {
  if (!ODDS_KEY) return [];
  const url = `https://api.the-odds-api.com/v4/sports/soccer/odds/?regions=eu,uk&markets=h2h&apiKey=${ODDS_KEY}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  const now = Date.now();
  const horizon = now + 36 * 3600 * 1000;
  return (data || []).filter((g: any) => {
    const t = new Date(g.commence_time).getTime();
    return t > now && t < horizon;
  }).slice(0, MAX_GAMES);
}

// ═════════════════════════════════════════════════════
// Buscar odds extras (Dupla Chance, AH, EH)
// ═════════════════════════════════════════════════════
async function buscarOddsExtras(eventId: string, sportKey: string) {
  if (!ODDS_KEY) return null;
  const url =
    `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds?regions=eu,uk&markets=h2h,double_chance,spreads&apiKey=${ODDS_KEY}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ═════════════════════════════════════════════════════
// Calcular probabilidades via Poisson
// ═════════════════════════════════════════════════════
async function calcularPoisson(
  home: string,
  away: string,
  homeAvg: number | null,
  awayAvg: number | null,
  homeAvgConc: number | null,
  awayAvgConc: number | null,
) {
  const body: any = {
    home_team: home,
    away_team: away,
  };
  if (homeAvg && awayAvg) {
    body.home_goals_avg = homeAvg;
    body.away_goals_avg = awayAvg;
    body.home_goals_conceded_avg = homeAvgConc ?? 1.3;
    body.away_goals_conceded_avg = awayAvgConc ?? 1.3;
  }
  const r = await fetch(POISSON_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON}`,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) return null;
  return await r.json();
}

// ═════════════════════════════════════════════════════
// Avaliar Dupla Chance — derivado de 1X2
// ═════════════════════════════════════════════════════
function avaliarDuplaChance(p: any, oddsBlob: any) {
  // p tem home_win, draw, away_win em %
  const candidatos = [
    { code: "1X", label: "Dupla Chance Casa ou Empate", prob: (p.home_win + p.draw) / 100 },
    { code: "X2", label: "Dupla Chance Empate ou Fora", prob: (p.draw + p.away_win) / 100 },
    { code: "12", label: "Dupla Chance Casa ou Fora (sem empate)", prob: (p.home_win + p.away_win) / 100 },
  ];

  // procura odds
  const dcMarket = oddsBlob?.bookmakers?.[0]?.markets?.find((m: any) => m.key === "double_chance");
  const outcomes = dcMarket?.outcomes || [];

  let best: any = null;
  for (const c of candidatos) {
    // matching loose: outcome.name pode vir "Home or Draw", "Draw or Away", "Home or Away"
    const oc = outcomes.find((o: any) => {
      const n = (o.name || "").toLowerCase();
      if (c.code === "1X") return n.includes("home") && n.includes("draw");
      if (c.code === "X2") return n.includes("draw") && n.includes("away");
      if (c.code === "12") return n.includes("home") && n.includes("away");
      return false;
    });
    if (!oc?.price) continue;
    const odd = oc.price;
    if (odd < MIN_ODD || odd > MAX_ODD) continue;
    const fair = 1 / c.prob;
    const edge = ((c.prob * odd) - 1) * 100;
    if (edge < MIN_EDGE) continue;
    if (!best || edge > best.edge) {
      best = {
        market: c.label,
        odd,
        fair_odd: Number(fair.toFixed(2)),
        prob: c.prob,
        edge: Number(edge.toFixed(2)),
        bookmaker: oddsBlob.bookmakers?.[0]?.title || "?",
      };
    }
  }
  return best;
}

// ═════════════════════════════════════════════════════
// Avaliar Handicap Asiático ±0.5 e ±1.0 e Europeu
// ═════════════════════════════════════════════════════
function avaliarHandicap(p: any, scoreMatrix: number[][], oddsBlob: any) {
  // calcula prob de cada handicap a partir do score_matrix
  // score_matrix[i][j] = prob de placar i-j (em %)
  const probAH = (line: number, side: "home" | "away") => {
    // AH +0.5: side ganha se (side - other) > -0.5 → side wins or draw
    let prob = 0;
    for (let i = 0; i < scoreMatrix.length; i++) {
      for (let j = 0; j < scoreMatrix[i].length; j++) {
        const margin = side === "home" ? i - j : j - i;
        if (margin + line > 0) prob += scoreMatrix[i][j];
      }
    }
    return prob / 100;
  };

  const candidatos: any[] = [];
  // AH 0.5
  candidatos.push({ key: "AH +0.5 Home", prob: probAH(0.5, "home"), tag: "spreads", target: 0.5, side: "home" });
  candidatos.push({ key: "AH +0.5 Away", prob: probAH(0.5, "away"), tag: "spreads", target: 0.5, side: "away" });
  candidatos.push({ key: "AH -0.5 Home", prob: probAH(-0.5, "home"), tag: "spreads", target: -0.5, side: "home" });
  candidatos.push({ key: "AH -0.5 Away", prob: probAH(-0.5, "away"), tag: "spreads", target: -0.5, side: "away" });
  candidatos.push({ key: "AH +1.0 Home", prob: probAH(1.0, "home"), tag: "spreads", target: 1.0, side: "home" });
  candidatos.push({ key: "AH +1.0 Away", prob: probAH(1.0, "away"), tag: "spreads", target: 1.0, side: "away" });
  candidatos.push({ key: "AH -1.0 Home", prob: probAH(-1.0, "home"), tag: "spreads", target: -1.0, side: "home" });
  candidatos.push({ key: "AH -1.0 Away", prob: probAH(-1.0, "away"), tag: "spreads", target: -1.0, side: "away" });

  const spreadMarket = oddsBlob?.bookmakers?.[0]?.markets?.find((m: any) => m.key === "spreads");
  const outcomes = spreadMarket?.outcomes || [];

  let best: any = null;
  for (const c of candidatos) {
    const oc = outcomes.find((o: any) => {
      const isHomeName = (o.name || "").toLowerCase().includes("home") ||
        (o.name || "") === oddsBlob.home_team;
      const isAwayName = (o.name || "").toLowerCase().includes("away") ||
        (o.name || "") === oddsBlob.away_team;
      const point = parseFloat(o.point);
      if (c.side === "home" && !isHomeName) return false;
      if (c.side === "away" && !isAwayName) return false;
      return Math.abs(point - c.target) < 0.01;
    });
    if (!oc?.price) continue;
    const odd = oc.price;
    if (odd < MIN_ODD || odd > MAX_ODD) continue;
    const edge = ((c.prob * odd) - 1) * 100;
    if (edge < MIN_EDGE) continue;
    if (!best || edge > best.edge) {
      best = {
        market: c.key,
        odd,
        fair_odd: Number((1 / c.prob).toFixed(2)),
        prob: c.prob,
        edge: Number(edge.toFixed(2)),
        bookmaker: oddsBlob.bookmakers?.[0]?.title || "?",
      };
    }
  }
  return best;
}

// ═════════════════════════════════════════════════════
// Salvar como punter_analyses
// ═════════════════════════════════════════════════════
async function salvarSinal(sb: any, game: Game, sinal: any, tipo: string, p: any) {
  const conf = Math.min(85, Math.max(55, Math.round(sinal.prob * 100)));
  const stake = sinal.edge >= 8 ? 4 : sinal.edge >= 6 ? 3 : 2;
  const tier = sinal.edge >= 8 ? "Tier 1" : sinal.edge >= 6 ? "Tier 2" : "Tier 3";

  const row = {
    match_id: game.id,
    home_team: game.home_team,
    away_team: game.away_team,
    league: game.league || "Football",
    commence_time: game.commence_time,
    market: sinal.market,
    bookmaker: sinal.bookmaker,
    odd: sinal.odd,
    fair_odd: sinal.fair_odd,
    implied_probability: Number((1 / sinal.odd).toFixed(4)),
    estimated_probability: Number(sinal.prob.toFixed(4)),
    value_percentage: sinal.edge,
    verdict: "APROVADO",
    confidence: conf,
    stake_percentage: stake,
    thesis:
      `${tipo} via Poisson — prob estimada ${(sinal.prob * 100).toFixed(1)}% vs odd ${sinal.odd} = edge ${sinal.edge}%`,
    analysis:
      `λ Casa: ${p.home_lambda} | λ Fora: ${p.away_lambda} | 1X2 modelo: ${p.home_win}/${p.draw}/${p.away_win}%`,
    risk_factors:
      tipo === "Handicap"
        ? "Handicap depende de margens exatas — sensível a expulsões e gols tardios"
        : "Dupla chance é defensiva — odd mais baixa exige edge consistente",
    analyzed_by: `${tier} - mycroft-extra-markets`,
  };

  const { error } = await sb.from("punter_analyses").upsert(row, {
    onConflict: "match_id,market",
    ignoreDuplicates: true,
  });
  if (error) console.error("[extra-markets] insert error:", error.message);
}

// ═════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const games = await buscarJogosDoDia();
    console.log(`[extra-markets] ${games.length} jogos para analisar`);

    let aprovados = 0;
    const season = new Date().getFullYear();

    for (const g of games) {
      if (Date.now() - startedAt > TIME_GUARD_MS) {
        console.warn("[extra-markets] Time guard atingido");
        break;
      }

      try {
        // 1) buscar médias (best effort)
        const [mh, ma] = await Promise.all([
          buscarMediaGols(g.home_team, season),
          buscarMediaGols(g.away_team, season),
        ]);

        // 2) calcular Poisson
        const p = await calcularPoisson(
          g.home_team,
          g.away_team,
          mh?.avg_scored ?? null,
          ma?.avg_scored ?? null,
          mh?.avg_conceded ?? null,
          ma?.avg_conceded ?? null,
        );
        if (!p) continue;

        // 3) buscar odds extras
        const sportKey = g.sport_key || "soccer_epl";
        const oddsBlob = await buscarOddsExtras(g.id, sportKey);
        if (!oddsBlob) continue;

        // 4) avaliar dupla chance
        const dc = avaliarDuplaChance(p, oddsBlob);
        if (dc) {
          await salvarSinal(sb, g, dc, "Dupla Chance", p);
          aprovados++;
        }

        // 5) avaliar handicap (asiático)
        const ah = avaliarHandicap(p, p.score_matrix, oddsBlob);
        if (ah) {
          await salvarSinal(sb, g, ah, "Handicap", p);
          aprovados++;
        }
      } catch (err) {
        console.error(`[extra-markets] erro em ${g.home_team} vs ${g.away_team}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed: games.length,
        approved: aprovados,
        elapsed_ms: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[extra-markets] erro fatal:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
