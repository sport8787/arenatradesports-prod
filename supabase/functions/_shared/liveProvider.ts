// liveProvider — Sportmonks primário (Pro Advanced + Odds & Predictions) → Futodds fallback.
// API-Football REMOVIDA do projeto (decisão usuário Fase 1).
// Mantém o shape "API-Football compatível" para não quebrar consumers existentes.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  fetchInplay,
  fetchFixtureById,
  normalizeFixture,
  extractNormalizedStats,
  type NormalizedFixture,
  type NormalizedStats,
} from "./sportmonks.ts";
import { getFutoddsLive, extractFutoddsStats } from "./futoddsProvider.ts";

const PRIMARY = (Deno.env.get("LIVE_PROVIDER_PRIMARY") || "sportmonks").toLowerCase();

let _leagueMap: Map<number, number> | null = null;
let _leagueMapAt = 0;

async function getLeagueMap(): Promise<Map<number, number>> {
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

// ---- Public API ----

export interface LiveResult {
  fixtures: any[];           // API-Football compatible shape (legacy)
  source: "futodds" | "sportmonks";
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

export async function getLiveMatches(): Promise<LiveResult> {
  const order: Array<"futodds" | "sportmonks"> =
    PRIMARY === "futodds" ? ["futodds", "sportmonks"] : ["sportmonks", "futodds"];

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
  source: "futodds" | "sportmonks" | null;
  fallback_reason?: string;
}

/**
 * fixtureRef:
 *  - { sm_id?, raw?, futodds?: any, _source?: string }
 * (af_id e fallback API-Football foram removidos)
 */
export async function getFixtureStats(
  fixtureRef: string | { sm_id?: number; af_id?: string; raw?: any; _source?: string },
): Promise<StatsResult> {
  if (typeof fixtureRef === "object" && fixtureRef._source === "futodds" && (fixtureRef as any).raw) {
    const stats = extractFutoddsStats({ _futodds_stats: (fixtureRef as any).raw._futodds_stats ?? null });
    if (stats) return { stats, source: "futodds" };
  }

  if (typeof fixtureRef === "object" && fixtureRef.raw && fixtureRef._source !== "futodds") {
    try {
      const stats = extractNormalizedStats(fixtureRef.raw);
      return { stats, source: "sportmonks" };
    } catch (e) {
      console.warn(`[liveProvider] extractStats falhou: ${(e as Error).message}`);
    }
  }

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

  return { stats: null, source: null, fallback_reason: "no_sportmonks_data" };
}
