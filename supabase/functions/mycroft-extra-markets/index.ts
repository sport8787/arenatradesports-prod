// ============================================================================
// mycroft-extra-markets — Sportmonks
// Gera sinais de Dupla Chance, Handicap Asiático e Handicap Europeu
// Usa a infra Poisson/Dixon-Coles + Sportmonks Odds API para encontrar valor
// Salva como punter_analyses normal (mesma tabela do Punter)
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SPORTMONKS_API_KEY = Deno.env.get("SPORTMONKS_API_KEY") || "";
const POISSON_URL = `${SUPABASE_URL}/functions/v1/poisson-dixon-coles`;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

// Constantes ajustadas para aprovar mais sinais
const TIME_GUARD_MS = 180_000; // 3 minutos (antes 100s)
const MAX_GAMES = 25;
const MIN_EDGE = 3; // Handicap Asiático tem margem menor (antes 4 ou 5)
const MIN_ODD = 1.30; // AH pode ter odds 1.25–1.45
const MAX_ODD = 2.80; // AH raramente ultrapassa 2.50

const FACTORIAL_CACHE: number[] = [1];

// ============================================================================
// TIPOS
// ============================================================================

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  league?: string;
}

interface PoissonResult {
  home_lambda: number;
  away_lambda: number;
  home_win: number;
  draw: number;
  away_win: number;
}

interface OddMarket {
  market_id: number;
  bookmaker_id: number;
  label: string;
  value: string;
  name: string;
  handicap?: string;
  market_description: string;
  probability?: string;
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function factorial(n: number): number {
  if (n <= 1) return 1;
  if (FACTORIAL_CACHE[n]) return FACTORIAL_CACHE[n];
  let result = FACTORIAL_CACHE[FACTORIAL_CACHE.length - 1] || 1;
  for (let i = FACTORIAL_CACHE.length; i <= n; i++) {
    result *= i;
    FACTORIAL_CACHE[i] = result;
  }
  return result;
}

// Probabilidade de handicap usando distribuição de Poisson (sem score_matrix)
function probAHFromLambda(
  lambdaHome: number,
  lambdaAway: number,
  line: number,
  side: "home" | "away"
): number {
  const maxGols = 8;
  let prob = 0;
  for (let h = 0; h <= maxGols; h++) {
    for (let a = 0; a <= maxGols; a++) {
      const margin = h - a;
      let condition = false;
      if (side === "home") {
        condition = margin + line > 0;
      } else {
        condition = margin - line < 0;
      }
      if (condition) {
        const probHome = Math.exp(-lambdaHome) * Math.pow(lambdaHome, h) / factorial(h);
        const probAway = Math.exp(-lambdaAway) * Math.pow(lambdaAway, a) / factorial(a);
        prob += probHome * probAway;
      }
    }
  }
  return Math.min(0.99, prob);
}

// ============================================================================
// SPORTMONKS API
// ============================================================================

async function smFetch<T = any>(path: string): Promise<T | null> {
  const url = `https://api.sportmonks.com/v3/football${path}&api_token=${SPORTMONKS_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data.data ?? null;
  } catch (error) {
    console.error(`[Sportmonks] Erro ${path}:`, error);
    return null;
  }
}

// Busca jogos do dia usando o endpoint /fixtures/date
async function buscarJogosDoDia(): Promise<Game[]> {
  const hoje = new Date().toISOString().split("T")[0];
  const data = await smFetch(`/fixtures/date/${hoje}?include=participants;league`);
  if (!data || !Array.isArray(data)) return [];
  const now = Date.now();
  const horizon = now + 36 * 3600 * 1000;
  return data
    .filter((f: any) => {
      const t = new Date(f.starting_at).getTime();
      return t > now && t < horizon;
    })
    .slice(0, MAX_GAMES)
    .map((f: any) => ({
      id: f.id.toString(),
      home_team: f.participants?.find((p: any) => p.meta?.location === "home")?.name ?? "Home",
      away_team: f.participants?.find((p: any) => p.meta?.location === "away")?.name ?? "Away",
      commence_time: f.starting_at,
      league: f.league?.name ?? "Football",
    }));
}

// Busca odds para um jogo específico
async function buscarOdds(fixtureId: string): Promise<OddMarket[] | null> {
  const data = await smFetch(`/odds/pre-match/fixtures/${fixtureId}`);
  return data;
}

// Busca médias de gols via Sportmonks (API-Football descontinuada — Fase 2)
async function buscarMediaGolsFallback(teamName: string, _season: number) {
  try {
    const { smSearchTeam, getRecentFixturesSM } = await import("../_shared/sportmonks-af-adapter.ts");
    const team = await smSearchTeam(teamName);
    if (!team) return null;
    const fixtures = await getRecentFixturesSM(team.id, 12);
    if (fixtures.length < 5) return null;
    let scored = 0, conceded = 0;
    for (const f of fixtures) {
      const isHome = f.teams?.home?.id === team.id;
      scored += isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
      conceded += isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0);
    }
    return {
      avg_scored: scored / fixtures.length,
      avg_conceded: conceded / fixtures.length,
      sample: fixtures.length,
    };
  } catch (e) {
    console.warn("[extra-markets-SM] buscarMediaGolsFallback err:", (e as Error).message);
    return null;
  }
}

// ============================================================================
// CÁLCULO DE PROBABILIDADES VIA POISSON
// ============================================================================

async function calcularPoisson(
  home: string,
  away: string,
  homeAvg: number | null,
  awayAvg: number | null
): Promise<PoissonResult | null> {
  const body: any = { home_team: home, away_team: away };
  if (homeAvg && awayAvg) {
    body.home_goals_avg = homeAvg;
    body.away_goals_avg = awayAvg;
    body.home_goals_conceded_avg = 1.3;
    body.away_goals_conceded_avg = 1.3;
  }
  try {
    const response = await fetch(POISSON_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      home_lambda: data.home_lambda ?? 1.2,
      away_lambda: data.away_lambda ?? 1.2,
      home_win: data.home_win ?? 33.33,
      draw: data.draw ?? 33.33,
      away_win: data.away_win ?? 33.33,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// AVALIAÇÃO DE MERCADOS
// ============================================================================

function avaliarDuplaChance(p: PoissonResult, oddsList: OddMarket[]) {
  // Filtra odds do mercado Double Chance (market_id: 63)
  const doubleOdds = oddsList.filter((odd) => odd.market_id === 63);
  const probHome = p.home_win / 100;
  const probDraw = p.draw / 100;
  const probAway = p.away_win / 100;
  const candidatos = [
    { code: "1X", label: "Dupla Chance Casa ou Empate", prob: probHome + probDraw },
    { code: "X2", label: "Dupla Chance Empate ou Fora", prob: probDraw + probAway },
    { code: "12", label: "Dupla Chance Casa ou Fora", prob: probHome + probAway },
  ];
  let best: any = null;
  for (const cand of candidatos) {
    const oddEntry = doubleOdds.find((o) => {
      const label = o.label?.toLowerCase() || "";
      if (cand.code === "1X") return label.includes("home") && label.includes("draw");
      if (cand.code === "X2") return label.includes("draw") && label.includes("away");
      if (cand.code === "12") return label.includes("home") && label.includes("away");
      return false;
    });
    if (!oddEntry) continue;
    const odd = parseFloat(oddEntry.value);
    if (isNaN(odd) || odd < MIN_ODD || odd > MAX_ODD) continue;
    const edge = (cand.prob * odd - 1) * 100;
    if (edge < MIN_EDGE) continue;
    if (!best || edge > best.edge) {
      best = {
        market: cand.label,
        odd,
        fair_odd: Number((1 / cand.prob).toFixed(2)),
        prob: cand.prob,
        edge: Number(edge.toFixed(2)),
        bookmaker: "Sportmonks",
      };
    }
  }
  return best;
}

function avaliarHandicap(p: PoissonResult, oddsList: OddMarket[]) {
  const asianOdds = oddsList.filter((odd) => odd.market_id === 28);
  const handicapCandidates: { name: string; side: "home" | "away"; line: number }[] = [
    { name: "AH +0.5 Home", side: "home", line: 0.5 },
    { name: "AH -0.5 Home", side: "home", line: -0.5 },
    { name: "AH +0.5 Away", side: "away", line: 0.5 },
    { name: "AH -0.5 Away", side: "away", line: -0.5 },
    { name: "AH +1.0 Home", side: "home", line: 1.0 },
    { name: "AH -1.0 Home", side: "home", line: -1.0 },
    { name: "AH +1.0 Away", side: "away", line: 1.0 },
    { name: "AH -1.0 Away", side: "away", line: -1.0 },
  ];
  let best: any = null;
  for (const cand of handicapCandidates) {
    const oddEntry = asianOdds.find((o) => {
      const isHome = o.label?.toLowerCase().includes("home") ||
                     o.name?.toLowerCase().includes("home");
      const isAway = o.label?.toLowerCase().includes("away") ||
                     o.name?.toLowerCase().includes("away");
      if (cand.side === "home" && !isHome) return false;
      if (cand.side === "away" && !isAway) return false;
      const point = parseFloat(o.handicap ?? "");
      if (isNaN(point)) return false;
      return Math.abs(point - cand.line) < 0.05;
    });
    if (!oddEntry) continue;
    const odd = parseFloat(oddEntry.value);
    if (isNaN(odd) || odd < MIN_ODD || odd > MAX_ODD) continue;
    const prob = probAHFromLambda(p.home_lambda, p.away_lambda, cand.line, cand.side);
    if (prob <= 0.01 || prob >= 0.99) continue;
    const edge = (prob * odd - 1) * 100;
    if (edge < MIN_EDGE) continue;
    if (!best || edge > best.edge) {
      best = {
        market: cand.name,
        odd,
        fair_odd: Number((1 / prob).toFixed(2)),
        prob,
        edge: Number(edge.toFixed(2)),
        bookmaker: "Sportmonks",
      };
    }
  }
  return best;
}

// ============================================================================
// PERSISTÊNCIA
// ============================================================================

async function salvarSinal(sb: any, game: Game, sinal: any, tipo: string, p: PoissonResult) {
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
    thesis: `${tipo} via Poisson — prob estimada ${(sinal.prob * 100).toFixed(1)}% vs odd ${sinal.odd} = edge ${sinal.edge}%`,
    analysis: `λ Casa: ${p.home_lambda} | λ Fora: ${p.away_lambda} | 1X2 modelo: ${p.home_win}/${p.draw}/${p.away_win}%`,
    risk_factors: tipo === "Handicap" ? "Handicap Asiático depende de margens exatas — sensível a expulsões e gols tardios" : "Dupla Chance é defensiva — odd mais baixa exige edge consistente",
    analyzed_by: `${tier} - mycroft-extra-markets (Sportmonks)`,
  };

  const { error } = await sb.from("punter_sinais").upsert(
    { ...row, status: "pending", dismissed: false },
    { onConflict: "match_id,market", ignoreDuplicates: true },
  );
  if (error) console.error("[extra-markets] insert error:", error.message);
}

// ============================================================================
// MAIN
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const games = await buscarJogosDoDia();
    console.log(`[extra-markets] ${games.length} jogos para analisar`);

    let aprovados = 0;
    const season = new Date().getFullYear();

    for (const game of games) {
      if (Date.now() - startedAt > TIME_GUARD_MS) {
        console.warn("[extra-markets] Time guard atingido");
        break;
      }

      try {
        // Médias via fallback (sem API-Football principal)
        const [homeMedias, awayMedias] = await Promise.all([
          buscarMediaGolsFallback(game.home_team, season),
          buscarMediaGolsFallback(game.away_team, season),
        ]);

        const poisson = await calcularPoisson(
          game.home_team,
          game.away_team,
          homeMedias?.avg_scored ?? null,
          awayMedias?.avg_scored ?? null
        );
        if (!poisson) continue;

        const oddsList = await buscarOdds(game.id);
        if (!oddsList || oddsList.length === 0) continue;

        const doubleChance = avaliarDuplaChance(poisson, oddsList);
        if (doubleChance) {
          await salvarSinal(sb, game, doubleChance, "Dupla Chance", poisson);
          aprovados++;
        }

        const handicap = avaliarHandicap(poisson, oddsList);
        if (handicap) {
          await salvarSinal(sb, game, handicap, "Handicap", poisson);
          aprovados++;
        }
      } catch (err) {
        console.error(`[extra-markets] erro em ${game.home_team} vs ${game.away_team}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed: games.length,
        approved: aprovados,
        elapsed_ms: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[extra-markets] erro fatal:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});