// Edge Function: mycroft-players-punter
// Análise de mercado de JOGADORES (gols, chutes, chutes ao gol, assistências)
// 1) Para cada jogo, identifica top 2 jogadores por time (titulares com mais participação)
// 2) Calcula média estatística dos últimos N jogos via API-Football (/players)
// 3) Tenta odds via The Odds API (markets player_goal_scorer_anytime, player_shots_on_target, player_shots, player_assists)
// 4) Sem odd → APROVADO_SITUACIONAL (informativo). Com odd e edge ≥ 5% → APROVADO.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_KEY = Deno.env.get("API_FOOTBALL_KEY") || "";
const ODDS_KEY = Deno.env.get("THE_ODDS_API_KEY") || "";
const BASE = "https://v3.football.api-sports.io";

const TIME_GUARD_MS = 100_000;
const MAX_GAMES = 15;       // jogadores consome mais API → limite menor
const MIN_EDGE = 5;          // mercado de jogadores é mais ruidoso → exigência maior
const MIN_SAMPLE = 4;
const MIN_MARGIN_PROB = 0.08; // diferença mínima entre prob estimada e implícita

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  league?: string;
  sport_key?: string;
}

interface PlayerStats {
  player_id: number;
  name: string;
  team_id: number;
  appearances: number;
  goals_per90: number;
  shots_per90: number;
  shots_on_target_per90: number;
  assists_per90: number;
  minutes_avg: number;
}

// ═════════════════════════════════════════════════════
// API-Football helpers
// ═════════════════════════════════════════════════════
async function findTeam(name: string) {
  if (!API_KEY) {
    console.error("[players] API_FOOTBALL_KEY ausente!");
    return null;
  }
  try {
    const r = await fetch(`${BASE}/teams?search=${encodeURIComponent(name)}`, {
      headers: { "x-apisports-key": API_KEY },
    });
    if (!r.ok) {
      console.warn(`[players] findTeam ${name} → HTTP ${r.status}`);
      return null;
    }
    const d = await r.json();
    const team = d.response?.[0]?.team || null;
    if (!team) console.warn(`[players] findTeam ${name} → 0 results, errors=${JSON.stringify(d.errors)}`);
    return team;
  } catch (e) {
    console.error(`[players] findTeam ${name} EXC:`, e);
    return null;
  }
}

// Top jogadores do time na temporada (busca squad + stats)
// Tenta temporada atual; se vazia, tenta anterior
async function buscarTopJogadores(teamId: number, season: number): Promise<PlayerStats[]> {
  try {
    let items: any[] = [];
    for (const s of [season, season - 1]) {
      const r = await fetch(
        `${BASE}/players?team=${teamId}&season=${s}`,
        { headers: { "x-apisports-key": API_KEY } },
      );
      const d = await r.json();
      items = d.response || [];
      if (items.length >= 3) {
        console.log(`[players] team=${teamId} usando season=${s} (${items.length} jogadores)`);
        break;
      }
    }
    if (!items.length) {
      console.warn(`[players] team=${teamId} SEM dados em ${season} ou ${season - 1}`);
      return [];
    }
    const players: PlayerStats[] = [];

    for (const it of items) {
      const player = it.player;
      // pega o stat do clube principal (primeiro stats com appearences)
      const stat = (it.statistics || []).find((s: any) => (s.games?.appearences ?? 0) > 0);
      if (!stat) continue;

      const apps = stat.games?.appearences || 0;
      const mins = stat.games?.minutes || 0;
      const goals = stat.goals?.total || 0;
      const assists = stat.goals?.assists || 0;
      const shotsTotal = stat.shots?.total || 0;
      const shotsOn = stat.shots?.on || 0;

      if (apps < 3 || mins < 120) continue; // amostra mínima reduzida

      const per90 = (n: number) => (mins > 0 ? (n * 90) / mins : 0);

      players.push({
        player_id: player.id,
        name: player.name,
        team_id: teamId,
        appearances: apps,
        goals_per90: per90(goals),
        shots_per90: per90(shotsTotal),
        shots_on_target_per90: per90(shotsOn),
        assists_per90: per90(assists),
        minutes_avg: mins / apps,
      });
    }

    // top 3 por (gols + assistências) per90
    players.sort((a, b) =>
      (b.goals_per90 + b.assists_per90) - (a.goals_per90 + a.assists_per90)
    );
    return players.slice(0, 3);
  } catch (e) {
    console.error("[players] buscarTopJogadores erro:", e);
    return [];
  }
}

// ═════════════════════════════════════════════════════
// Odds de jogadores (The Odds API)
// ═════════════════════════════════════════════════════
async function buscarOddsJogadores(eventId: string, sportKey: string) {
  if (!ODDS_KEY) return null;
  try {
    const markets = [
      "player_goal_scorer_anytime",
      "player_shots_on_target",
      "player_shots",
      "player_assists",
    ].join(",");
    const url =
      `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds?regions=eu,uk&markets=${markets}&apiKey=${ODDS_KEY}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function findPlayerOdd(
  oddsBlob: any,
  marketKey: string,
  playerName: string,
  line?: number,
): { odd: number; bookmaker: string } | null {
  if (!oddsBlob?.bookmakers?.length) return null;
  const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const target = norm(playerName);

  for (const bk of oddsBlob.bookmakers || []) {
    const m = (bk.markets || []).find((x: any) => x.key === marketKey);
    if (!m) continue;
    const oc = (m.outcomes || []).find((o: any) => {
      const desc = norm(o.description || o.name || "");
      const matchName = desc.includes(target) || target.includes(desc);
      const matchLine = line == null || (o.point != null && Math.abs(parseFloat(o.point) - line) < 0.01);
      // Para anytime scorer, name = "Yes" e description = jogador
      return matchName && matchLine;
    });
    if (oc?.price) return { odd: oc.price, bookmaker: bk.title };
  }
  return null;
}

// ═════════════════════════════════════════════════════
// Avalia sinais por jogador (Poisson)
// ═════════════════════════════════════════════════════
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
const poissonPmf = (lambda: number, k: number) =>
  (Math.pow(lambda, k) * Math.exp(-lambda)) / fact(k);
const poissonAtLeast1 = (lambda: number) => 1 - Math.exp(-lambda);

interface Sinal {
  market: string;
  player: string;
  prob: number;
  odd: number | null;
  bookmaker: string;
  rationale: string;
  line?: number;
  lado?: "Over" | "Under";
}

function avaliarJogador(p: PlayerStats, oddsBlob: any): Sinal[] {
  const sinais: Sinal[] = [];
  // Estimativa de minutos jogados nesse jogo (assume titularidade se média ≥ 70min)
  const minutosEsperados = Math.min(90, p.minutes_avg);
  const fatorMin = minutosEsperados / 90;

  // 1) Marcar a qualquer momento (anytime goal scorer)
  const lambdaGoals = p.goals_per90 * fatorMin;
  if (lambdaGoals >= 0.25) {
    const prob = poissonAtLeast1(lambdaGoals);
    const odd = findPlayerOdd(oddsBlob, "player_goal_scorer_anytime", p.name);
    sinais.push({
      market: `${p.name} — Marcar a Qualquer Momento`,
      player: p.name,
      prob,
      odd: odd?.odd ?? null,
      bookmaker: odd?.bookmaker ?? "—",
      rationale: `${p.goals_per90.toFixed(2)} gols/90 em ${p.appearances} jogos`,
    });
  }

  // 2) Chutes ao gol — linhas 0.5, 1.5
  for (const linha of [0.5, 1.5]) {
    const lambda = p.shots_on_target_per90 * fatorMin;
    if (lambda < 0.4) continue;
    let pUnder = 0;
    for (let k = 0; k <= Math.floor(linha); k++) pUnder += poissonPmf(lambda, k);
    const pOver = 1 - pUnder;
    const lado: "Over" | "Under" = pOver > 0.55 ? "Over" : pUnder > 0.65 ? "Under" : "Over";
    const prob = lado === "Over" ? pOver : pUnder;
    if (prob < 0.5) continue;
    const odd = findPlayerOdd(oddsBlob, "player_shots_on_target", p.name, linha);
    sinais.push({
      market: `${p.name} — ${lado} ${linha} Chutes ao Gol`,
      player: p.name,
      prob,
      odd: odd?.odd ?? null,
      bookmaker: odd?.bookmaker ?? "—",
      rationale: `${p.shots_on_target_per90.toFixed(2)} chutes ao gol/90`,
      line: linha,
      lado,
    });
  }

  // 3) Chutes totais — linhas 1.5, 2.5
  for (const linha of [1.5, 2.5]) {
    const lambda = p.shots_per90 * fatorMin;
    if (lambda < 0.8) continue;
    let pUnder = 0;
    for (let k = 0; k <= Math.floor(linha); k++) pUnder += poissonPmf(lambda, k);
    const pOver = 1 - pUnder;
    const lado: "Over" | "Under" = pOver > 0.55 ? "Over" : pUnder > 0.65 ? "Under" : "Over";
    const prob = lado === "Over" ? pOver : pUnder;
    if (prob < 0.5) continue;
    const odd = findPlayerOdd(oddsBlob, "player_shots", p.name, linha);
    sinais.push({
      market: `${p.name} — ${lado} ${linha} Chutes Totais`,
      player: p.name,
      prob,
      odd: odd?.odd ?? null,
      bookmaker: odd?.bookmaker ?? "—",
      rationale: `${p.shots_per90.toFixed(2)} chutes/90`,
      line: linha,
      lado,
    });
  }

  // 4) Assistências (anytime)
  const lambdaA = p.assists_per90 * fatorMin;
  if (lambdaA >= 0.2) {
    const prob = poissonAtLeast1(lambdaA);
    const odd = findPlayerOdd(oddsBlob, "player_assists", p.name, 0.5);
    sinais.push({
      market: `${p.name} — Dar Assistência`,
      player: p.name,
      prob,
      odd: odd?.odd ?? null,
      bookmaker: odd?.bookmaker ?? "—",
      rationale: `${p.assists_per90.toFixed(2)} assistências/90`,
    });
  }

  return sinais;
}

// ═════════════════════════════════════════════════════
// Buscar jogos
// ═════════════════════════════════════════════════════
async function buscarJogos(): Promise<Game[]> {
  if (!ODDS_KEY) return [];
  const url =
    `https://api.the-odds-api.com/v4/sports/soccer/odds/?regions=eu,uk&markets=h2h&apiKey=${ODDS_KEY}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  const now = Date.now();
  const horizon = now + 36 * 3600 * 1000;
  return (data || [])
    .filter((g: any) => {
      const t = new Date(g.commence_time).getTime();
      return t > now && t < horizon;
    })
    .slice(0, MAX_GAMES);
}

// ═════════════════════════════════════════════════════
// Persistência
// ═════════════════════════════════════════════════════
async function salvar(sb: any, g: Game, p: PlayerStats, sinal: Sinal) {
  const hasOdd = sinal.odd != null && sinal.odd > 1.3;
  let edge = 0;
  let verdict = "APROVADO_SITUACIONAL";

  if (hasOdd) {
    edge = ((sinal.prob * (sinal.odd as number)) - 1) * 100;
    if (edge < MIN_EDGE) return false;
    const impl = 1 / (sinal.odd as number);
    if (sinal.prob - impl < MIN_MARGIN_PROB) return false;
    verdict = "APROVADO";
  }

  const conf = Math.min(78, Math.max(55, Math.round(sinal.prob * 100)));
  const stake = edge >= 8 ? 3 : edge >= 6 ? 2.5 : 2;
  const tier = edge >= 8 ? "Tier 1" : edge >= 6 ? "Tier 2" : "Tier 3";

  const row = {
    match_id: g.id,
    home_team: g.home_team,
    away_team: g.away_team,
    league: g.league || "Football",
    commence_time: g.commence_time,
    market: sinal.market,
    bookmaker: sinal.bookmaker,
    odd: hasOdd ? sinal.odd : 0,
    fair_odd: Number((1 / sinal.prob).toFixed(2)),
    implied_probability: hasOdd ? Number((1 / (sinal.odd as number)).toFixed(4)) : null,
    estimated_probability: Number(sinal.prob.toFixed(4)),
    value_percentage: hasOdd ? Number(edge.toFixed(2)) : 0,
    verdict,
    confidence: conf,
    stake_percentage: hasOdd ? stake : 1,
    thesis: hasOdd
      ? `Jogador ${p.name} — ${sinal.rationale}. Edge ${edge.toFixed(1)}% sobre odd ${sinal.odd}`
      : `Sinal informativo — ${p.name}: ${sinal.rationale}. Procure odd na sua casa.`,
    analysis: `${p.appearances} jogos | ${p.minutes_avg.toFixed(0)}min/jogo | gols/90=${p.goals_per90.toFixed(2)} | chutes/90=${p.shots_per90.toFixed(2)} | SOG/90=${p.shots_on_target_per90.toFixed(2)} | ass/90=${p.assists_per90.toFixed(2)}`,
    risk_factors:
      "Mercado de jogadores depende de escalação confirmada — confira até 1h antes do jogo",
    analyzed_by: `${tier} - mycroft-players-punter`,
  };

  const { error } = await sb.from("punter_analyses").upsert(row, {
    onConflict: "match_id,market",
    ignoreDuplicates: true,
  });
  if (error) {
    console.error("[players] insert error:", error.message);
    return false;
  }
  return true;
}

// ═════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const games = await buscarJogos();
    console.log(`[players] ${games.length} jogos para analisar`);
    const season = new Date().getFullYear();
    let aprovados = 0, informativos = 0, jogadoresAnalisados = 0;

    for (const g of games) {
      if (Date.now() - startedAt > TIME_GUARD_MS) {
        console.warn("[players] Time guard atingido");
        break;
      }

      try {
        const [th, ta] = await Promise.all([
          findTeam(g.home_team),
          findTeam(g.away_team),
        ]);
        if (!th || !ta) {
          console.warn(`[players] times não encontrados: ${g.home_team} / ${g.away_team}`);
          continue;
        }

        const [topHome, topAway] = await Promise.all([
          buscarTopJogadores(th.id, season),
          buscarTopJogadores(ta.id, season),
        ]);
        const todos = [...topHome, ...topAway];
        console.log(`[players] ${g.home_team} vs ${g.away_team}: ${topHome.length}+${topAway.length} jogadores`);
        if (!todos.length) continue;

        const oddsBlob = await buscarOddsJogadores(g.id, g.sport_key || "soccer_epl");

        for (const p of todos) {
          if (p.appearances < MIN_SAMPLE) continue;
          jogadoresAnalisados++;
          const sinais = avaliarJogador(p, oddsBlob);
          // Salva no máximo 2 melhores sinais por jogador (por prob)
          const ordenados = sinais.sort((a, b) => b.prob - a.prob).slice(0, 2);
          for (const s of ordenados) {
            const ok = await salvar(sb, g, p, s);
            if (ok) {
              if (s.odd) aprovados++;
              else informativos++;
            }
          }
        }
      } catch (err) {
        console.error(`[players] erro em ${g.home_team} vs ${g.away_team}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_games: games.length,
        analyzed_players: jogadoresAnalisados,
        approved: aprovados,
        informative: informativos,
        elapsed_ms: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[players] erro fatal:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
