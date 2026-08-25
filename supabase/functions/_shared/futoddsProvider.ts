// futoddsProvider — Adapter Futodds → shape "API-Football compatível".
// Provedor SECUNDÁRIO: usado quando Sportmonks não cobre a liga.
// Base: https://csv.futodds.com/functions/v1, Auth: Bearer <FUTODDS_API_KEY>
//
// ⚠️ FUTODDS_DISABLED=true desativa completamente (use quando a subscription vencer).

import { resilientFetch } from "./resilientFetch.ts";
import type { NormalizedStats } from "./sportmonks.ts";

const FUTODDS_BASE = "https://csv.futodds.com/functions/v1";

/** true quando a subscription Futodds está inativa — retorna dados vazios silenciosamente. */
export function isFutoddsDisabled(): boolean {
  return (Deno.env.get("FUTODDS_DISABLED") || "").toLowerCase() === "true";
}

function authHeaders() {
  const key = Deno.env.get("FUTODDS_API_KEY");
  if (!key) throw new Error("FUTODDS_API_KEY missing");
  return {
    Authorization: `Bearer ${key}`,
    "X-API-Key": key,
    Accept: "application/json",
  };
}

async function fdGet(path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(FUTODDS_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await resilientFetch(url.toString(), {
    headers: authHeaders(),
    breakerKey: "futodds",
    timeoutMs: 12_000,
    retries: 2,
  });
  if (!res.ok) throw new Error(`futodds_${path}_${res.status}`);
  const j = await res.json();
  if (j?.success === false) throw new Error(`futodds_${path}_failed: ${JSON.stringify(j)}`);
  return j;
}

// ---- Conversores ----

/** Converte um item /matches-betfair-live (ou /matches-live-full) → shape API-Football compatível. */
function toAfFixture(m: any): any {
  // Stats: /matches-betfair-live usa arrays [home, away].
  // /matches-ended e alguns live retornam objetos { home: x, away: y }.
  // Suporta ambos os formatos + aliases de campo.
  const stats = m.stats || {};
  function pair(keys: string[]): [number | null, number | null] {
    for (const k of keys) {
      const v = stats[k];
      if (Array.isArray(v)) return [v[0] ?? null, v[1] ?? null];
      if (v !== null && v !== undefined && typeof v === 'object')
        return [v.home ?? null, v.away ?? null];
    }
    return [null, null];
  }
  const [posH, posA] = pair(["possession"]);
  const [atkH, atkA] = pair(["attacks"]);
  const [datkH, datkA] = pair(["dangerous_attacks"]);
  const [onH, onA] = pair(["on_target", "shots_on_target"]);
  const [offH, offA] = pair(["off_target", "shots_off_target"]);
  const [corH, corA] = pair(["corners"]);
  const [xgH, xgA] = pair(["xg", "expected_goals"]);
  const xgHome = Number(xgH) || 0;
  const xgAway = Number(xgA) || 0;

  const minute = parseInt(String(m.elapsed ?? 0)) || 0;
  const timeStatus = String(m.time_status ?? "1");
  // BetsAPI time_status: 0 NS, 1 InPlay, 3 Ended
  let short = "LIVE";
  let long = "Live";
  if (timeStatus === "0") { short = "NS"; long = "Not Started"; }
  else if (timeStatus === "3") { short = "FT"; long = "Match Finished"; }
  else if (minute === 45) { short = "HT"; long = "Halftime"; }

  const totalShotsH = (Number(onH) || 0) + (Number(offH) || 0);
  const totalShotsA = (Number(onA) || 0) + (Number(offA) || 0);

  return {
    fixture: {
      id: m.eventId ?? m.event_id ?? m.id,
      date: m.date,
      status: { short, long, elapsed: minute },
      futodds_event_id: m.eventId ?? m.event_id,
    },
    league: {
      id: m.league_id,
      name: m.competition_name ?? m.league_name,
    },
    teams: {
      home: { id: m.home_id, name: m.home_name },
      away: { id: m.away_id, name: m.away_name },
    },
    goals: {
      home: m.home_goals ?? Number(String(m.scores ?? "0-0").split("-")[0]),
      away: m.away_goals ?? Number(String(m.scores ?? "0-0").split("-")[1]),
    },
    score: { halftime: parseHt(m.ht_score) },
    _source: "futodds",
    _raw: m,
    _futodds_stats: {
      possession_home: Number(posH) || 0,
      possession_away: Number(posA) || 0,
      shots_total_home: totalShotsH,
      shots_total_away: totalShotsA,
      shots_on_target_home: Number(onH) || 0,
      shots_on_target_away: Number(onA) || 0,
      attacks_home: Number(atkH) || 0,
      attacks_away: Number(atkA) || 0,
      dangerous_attacks_home: Number(datkH) || 0,
      dangerous_attacks_away: Number(datkA) || 0,
      corners_home: Number(corH) || 0,
      corners_away: Number(corA) || 0,
      xg_home: xgHome,
      xg_away: xgAway,
      pressure_home: m.pressure_indices?.home ?? null,
      pressure_away: m.pressure_indices?.away ?? null,
      pressure_total: m.pressure_indices?.total ?? null,
      last5min: m.last5min_stats ?? null,
      last10min: m.last10min_stats ?? null,
      last15min: m.last15min_stats ?? null,
      last20min: m.last20min_stats ?? null,
    },
  } as any;
}

function parseHt(s: any) {
  if (!s || typeof s !== "string") return { home: null, away: null };
  const [h, a] = s.split("-");
  return { home: Number(h) || 0, away: Number(a) || 0 };
}

// ---- API pública ----

export interface FutoddsLiveResult {
  fixtures: any[];
  source: "futodds";
  count: number;
}

/** Busca jogos ao vivo Betfair (com pressão e stats por janela). */
export async function getFutoddsLive(): Promise<FutoddsLiveResult> {
  if (isFutoddsDisabled()) {
    console.log("[futoddsProvider] FUTODDS_DISABLED=true — retornando lista vazia");
    return { fixtures: [], source: "futodds", count: 0 };
  }
  const j = await fdGet("/matches-betfair-live");
  const data: any[] = Array.isArray(j?.data) ? j.data : [];
  const fixtures = data.map(toAfFixture);
  console.log(`[futoddsProvider] live count=${fixtures.length}`);
  return { fixtures, source: "futodds", count: fixtures.length };
}

/** Extrai stats normalizadas de um fixture já carregado por getFutoddsLive. */
export function extractFutoddsStats(fixture: any): NormalizedStats | null {
  const s = fixture?._futodds_stats;
  if (!s) return null;
  // Futodds retorna {} (vazio) para ligas sem cobertura — todos os campos ficam 0.
  // Retorna null para indicar ausência de dados e evitar análise com stats zeradas.
  const hasData = s.possession_home || s.possession_away || s.shots_on_target_home ||
                  s.shots_on_target_away || s.dangerous_attacks_home || s.dangerous_attacks_away;
  if (!hasData) return null;
  return {
    possession_home: s.possession_home,
    possession_away: s.possession_away,
    shots_total_home: s.shots_total_home,
    shots_total_away: s.shots_total_away,
    shots_on_target_home: s.shots_on_target_home,
    shots_on_target_away: s.shots_on_target_away,
    attacks_home: s.dangerous_attacks_home || s.attacks_home,
    attacks_away: s.dangerous_attacks_away || s.attacks_away,
    corners_home: s.corners_home,
    corners_away: s.corners_away,
    fouls_home: 0,
    fouls_away: 0,
    cards_home: 0,
    cards_away: 0,
    passes_home: 0,
    passes_away: 0,
    passes_accurate_home: 0,
    passes_accurate_away: 0,
    xG_home: null,
    xG_away: null,
    source: "futodds",
    // Campos adicionais Futodds (consumidos por gráfico de pressão)
    pressure_home: s.pressure_home,
    pressure_away: s.pressure_away,
    pressure_total: s.pressure_total,
    last5min_stats: s.last5min,
    last10min_stats: s.last10min,
    last15min_stats: s.last15min,
    last20min_stats: s.last20min,
  } as any;
}

/** Lista compacta para mapear event_ids Betfair (cache 30s no servidor Futodds). */
export async function getFutoddsCompact(): Promise<any[]> {
  const j = await fdGet("/matches-betfair-live-compact");
  return Array.isArray(j?.data) ? j.data : [];
}

/** Odds reais Betfair (back/lay com volume) por event_id. */
export async function getFutoddsBetfairOdds(eventId: number | string, marketType?: string): Promise<any> {
  const params: Record<string, string> = { event_id: String(eventId) };
  if (marketType) params.market_type = marketType;
  const j = await fdGet("/matches-betfair-live-odds", params);
  return j?.data ?? null;
}

/** Resultados encerrados (liquidação). */
export async function getFutoddsEnded(params: Record<string, string> = {}): Promise<any[]> {
  const j = await fdGet("/matches-ended", params);
  return Array.isArray(j?.data) ? j.data : [];
}

/** Eventos ao vivo (gols/cartões). */
export async function getFutoddsLiveEvents(eventId?: number | string): Promise<any> {
  const params: Record<string, string> = {};
  if (eventId) params.event_id = String(eventId);
  const j = await fdGet("/matches-live-events", params);
  return j?.data ?? null;
}

// ── Endpoints pré-live ────────────────────────────────────────────────────────

/** Projeções CS (Computer Simulations) para Poisson. Retorna projected_home/away_goals_ft. */
export async function getFutoddsCS(params: Record<string, string> = {}): Promise<any[]> {
  if (isFutoddsDisabled()) return [];
  const j = await fdGet("/matches-cs", { with_projections_only: "true", ...params });
  return Array.isArray(j?.data) ? j.data : [];
}

/** Detalhes de jogo pré-live: probabilidades, DNB, Asian HC, Corners, standings. */
export async function getFutoddsUpcomingDetail(eventId: number | string): Promise<any> {
  if (isFutoddsDisabled()) return null;
  const j = await fdGet("/matches-upcoming-detail", { event_id: String(eventId) });
  return j?.data ?? null;
}

/** Jogos futuros com mercados Betfair. Retorna lista com event_id Betfair. */
export async function getFutoddsUpcoming(params: Record<string, string> = {}): Promise<any[]> {
  if (isFutoddsDisabled()) return [];
  const j = await fdGet("/matches-betfair-upcoming", params);
  return Array.isArray(j?.data) ? j.data : [];
}

/** Odds Betfair pré-live (back/lay) por event_id. Usar /matches-betfair-upcoming para obter event_ids. */
export async function getFutoddsPreliveOdds(eventId: number | string, marketType?: string): Promise<any> {
  const params: Record<string, string> = { event_id: String(eventId) };
  if (marketType) params.market_type = marketType;
  const j = await fdGet("/matches-betfair-prelive-odds", params);
  return j?.data ?? null;
}

// ── Detalhe ao vivo (opta_data) ───────────────────────────────────────────────

/**
 * Detalhes completos de um jogo ao vivo via game_id (obtido de /matches-live).
 * Inclui opta_data avançado. ~50-200KB por jogo — usar seletivamente.
 */
export async function getFutoddsLiveDetail(gameId: number | string): Promise<any> {
  if (isFutoddsDisabled()) return null;
  const j = await fdGet("/matches-live-detail", { game_id: String(gameId) });
  return j?.data ?? null;
}

/** Lista básica /matches-live com id (game_id) para lookup de detalhe. */
export async function getFutoddsLiveBasic(params: Record<string, string> = {}): Promise<any[]> {
  if (isFutoddsDisabled()) return [];
  const j = await fdGet("/matches-live", params);
  return Array.isArray(j?.data) ? j.data : [];
}
