// liveProvider — Sportmonks primário (plano Pro Advanced + Odds&Predictions) → Futodds fallback → API-Football.
// Mantém o shape "API-Football compatível" para não quebrar consumers existentes.

import { createClient } from "npm:@supabase/supabase-js@2";
import { resilientFetch } from "./resilientFetch.ts";
import {
  fetchInplay,
  fetchFixtureById,
  normalizeFixture,
  extractNormalizedStats,
  type NormalizedFixture,
  type NormalizedStats,
} from "./sportmonks.ts";
import { getFutoddsLive, extractFutoddsStats } from "./futoddsProvider.ts";

const AF_BASE = "https://v3.football.api-sports.io";
const PRIMARY = (Deno.env.get("LIVE_PROVIDER_PRIMARY") || "sportmonks").toLowerCase();

let _leagueMap: Map<number, number> | null = null;
let _leagueMapAt = 0;

async function getLeagueMap(): Promise<Map<number, number>> {
  // cache 5min na isolate
  if (_leagueMap && Date.now() - _leagueMapAt < 5 * 60 * 1000) return _leagueMap;
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data } = await sb.from("league_id_map").select("api_football_id, sportmonks_id, enabled");
  const m = new Map<number, number>();
  for (const r of data || []) {
    if (r.enabled !== false) m.set(r.api_football_id, r.sportmonks_id);
  }
  _leagueMap = m;
  _leagueMapAt = Date.now();
  return m;
}

// ---- API-Football helpers (fallback) ----

async function afFetchLive(): Promise<any[]> {
  const key = Deno.env.get("API_FOOTBALL_KEY");
  if (!key) throw new Error("API_FOOTBALL_KEY missing");
  const res = await resilientFetch(`${AF_BASE}/fixtures?live=all`, {
    headers: { "x-apisports-key": key },
    breakerKey: "api-football",
    timeoutMs: 12_000,
    retries: 2,
  });
  if (!res.ok) throw new Error(`af_live_${res.status}`);
  const j = await res.json();
  return j.response || [];
}

async function afFetchFixtureStats(fixtureId: string): Promise<NormalizedStats | null> {
  const key = Deno.env.get("API_FOOTBALL_KEY");
  if (!key) return null;
  try {
    const res = await fetch(`${AF_BASE}/fixtures/statistics?fixture=${fixtureId}`, {
      headers: { "x-apisports-key": key },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const teams = data.response || [];
    if (teams.length < 2) return null;
    const get = (arr: any[], type: string) => arr.find((s: any) => s.type === type)?.value ?? null;
    const parsePoss = (v: any) => v == null ? 0 : (parseInt(String(v).replace("%", "")) || 0);
    const home = teams[0]?.statistics || [];
    const away = teams[1]?.statistics || [];
    return {
      possession_home: parsePoss(get(home, "Ball Possession")),
      possession_away: parsePoss(get(away, "Ball Possession")),
      shots_total_home: get(home, "Total Shots") ?? 0,
      shots_total_away: get(away, "Total Shots") ?? 0,
      shots_on_target_home: get(home, "Shots on Goal") ?? 0,
      shots_on_target_away: get(away, "Shots on Goal") ?? 0,
      attacks_home: get(home, "Dangerous Attacks") ?? get(home, "Shots insidebox") ?? 0,
      attacks_away: get(away, "Dangerous Attacks") ?? get(away, "Shots insidebox") ?? 0,
      corners_home: get(home, "Corner Kicks") ?? 0,
      corners_away: get(away, "Corner Kicks") ?? 0,
      fouls_home: get(home, "Fouls") ?? 0,
      fouls_away: get(away, "Fouls") ?? 0,
      cards_home: (get(home, "Yellow Cards") ?? 0) + (get(home, "Red Cards") ?? 0),
      cards_away: (get(away, "Yellow Cards") ?? 0) + (get(away, "Red Cards") ?? 0),
      passes_home: get(home, "Total passes") ?? 0,
      passes_away: get(away, "Total passes") ?? 0,
      passes_accurate_home: get(home, "Passes accurate") ?? 0,
      passes_accurate_away: get(away, "Passes accurate") ?? 0,
      xG_home: parseFloat(get(home, "expected_goals") || "0") || null,
      xG_away: parseFloat(get(away, "expected_goals") || "0") || null,
      source: "api-football",
    };
  } catch {
    return null;
  }
}

// ---- Public API ----

export interface LiveResult {
  fixtures: any[];           // API-Football compatible shape
  source: "futodds" | "sportmonks" | "api-football";
  fallback_reason?: string;
  count: number;
}

async function tryFutodds(): Promise<LiveResult> {
  const r = await getFutoddsLive();
  console.log(`[liveProvider] source=futodds count=${r.count}`);
  return { fixtures: r.fixtures, source: "futodds", count: r.count };
}

async function trySportmonks(): Promise<LiveResult> {
  const map = await getLeagueMap();
  const { fixtures } = await fetchInplay();
  const normalized = fixtures.map((f) => normalizeFixture(f, map));
  const compat = normalized.map((n) => ({
    fixture: {
      id: n.fixture.id,
      date: n.fixture.date,
      status: { short: n.fixture.status.short, long: n.fixture.status.long, elapsed: n.fixture.status.elapsed },
      sm_id: n.fixture.sm_id,
    },
    league: { id: n.league.id, name: n.league.name, sm_id: n.league.sm_id },
    teams: n.teams,
    goals: n.goals,
    _source: "sportmonks",
    _raw: fixtures.find((rf: any) => rf.id === n.fixture.sm_id),
  }));
  console.log(`[liveProvider] source=sportmonks count=${compat.length}`);
  return { fixtures: compat, source: "sportmonks", count: compat.length };
}

async function tryApiFootball(reason: string): Promise<LiveResult> {
  const fixtures = await afFetchLive();
  const tagged = fixtures.map((f: any) => ({ ...f, _source: "api-football" }));
  console.log(`[liveProvider] source=api-football count=${tagged.length} reason=${reason}`);
  return { fixtures: tagged, source: "api-football", fallback_reason: reason, count: tagged.length };
}

export async function getLiveMatches(): Promise<LiveResult> {
  // API-Football REMOVIDA da cadeia de fallback (decisão usuário 16/05/2026).
  // Apenas Futodds + Sportmonks.
  const order: Array<"futodds" | "sportmonks"> =
    PRIMARY === "sportmonks" ? ["sportmonks", "futodds"] : ["futodds", "sportmonks"];

  let lastErr = "no_provider";
  for (const p of order) {
    try {
      if (p === "futodds") return await tryFutodds();
      return await trySportmonks();
    } catch (e) {
      lastErr = `${p}: ${(e as Error).message}`;
      console.warn(`[liveProvider] ${p} failed → next. ${lastErr}`);
    }
  }
  throw new Error(`all_providers_failed: ${lastErr}`);
}

export interface StatsResult {
  stats: NormalizedStats | null;
  source: "futodds" | "sportmonks" | "api-football" | null;
  fallback_reason?: string;
}

/**
 * fixtureRef pode ser:
 *  - string id "12345" (API-Football) — fallback usa direto
 *  - { sm_id?, af_id?, raw?, futodds?: any } — tenta Futodds (raw) → Sportmonks → API-Football
 */
export async function getFixtureStats(
  fixtureRef: string | { sm_id?: number; af_id?: string; raw?: any; _source?: string },
): Promise<StatsResult> {
  // Futodds: raw vem do getFutoddsLive já normalizado em _futodds_stats no fixture inteiro,
  // mas para chamadas via _raw aqui, tentamos extrair direto se _source=futodds
  if (typeof fixtureRef === "object" && fixtureRef._source === "futodds" && (fixtureRef as any).raw) {
    const stats = extractFutoddsStats({ _futodds_stats: (fixtureRef as any).raw._futodds_stats ?? null });
    if (stats) return { stats, source: "futodds" };
  }

  // Se já temos o objeto raw do Sportmonks (vindo de getLiveMatches), extrai direto
  if (typeof fixtureRef === "object" && fixtureRef.raw && fixtureRef._source !== "futodds") {
    try {
      const stats = extractNormalizedStats(fixtureRef.raw);
      return { stats, source: "sportmonks" };
    } catch (e) {
      console.warn(`[liveProvider] extractStats falhou: ${(e as Error).message}`);
    }
  }

  // Sportmonks por sm_id
  if (typeof fixtureRef === "object" && fixtureRef.sm_id) {
    try {
      const f = await fetchFixtureById(fixtureRef.sm_id);
      if (f) {
        const stats = extractNormalizedStats(f);
        return { stats, source: "sportmonks" };
      }
    } catch (e) {
      console.warn(`[liveProvider] sportmonks stats fail sm_id=${fixtureRef.sm_id}: ${(e as Error).message}`);
    }
  }

  // Fallback API-Football
  const afId = typeof fixtureRef === "string" ? fixtureRef : fixtureRef.af_id;
  if (!afId) return { stats: null, source: null, fallback_reason: "no_af_id" };
  const stats = await afFetchFixtureStats(afId);
  return {
    stats,
    source: stats ? "api-football" : null,
    fallback_reason: typeof fixtureRef === "object" ? "sportmonks_unavailable" : undefined,
  };
}
