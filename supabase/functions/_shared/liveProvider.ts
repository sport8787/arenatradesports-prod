// liveProvider — Sportmonks (primário) + Futodds (Copa 2026 + lacunas) + API-Football (fallback).
// COPA_FUTODDS_PRIMARY=true → Futodds cobre Copa do Mundo com prioridade máxima sobre AF/SM.
// Modo merge: Futodds Copa → SM (outras ligas) → Futodds gaps → AF fallback.

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
import { getApiFootballLive, getApiFootballStats } from "./apiFootballProvider.ts";

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
  source: "futodds" | "sportmonks" | "apifootball";
  fallback_reason?: string;
  count: number;
  sm_count?: number;
  sm_error?: string;
  fd_count?: number;
}

async function tryFutodds(): Promise<LiveResult> {
  const r = await getFutoddsLive();
  console.log(`[liveProvider] source=futodds count=${r.count}`);
  return { fixtures: r.fixtures, source: "futodds", count: r.count };
}

async function tryApiFootball(): Promise<{ fixtures: any[]; leagues: number[] }> {
  const r = await getApiFootballLive();
  return { fixtures: r.fixtures, leagues: r.leagues };
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

const MODE = (Deno.env.get("LIVE_PROVIDER_MODE") || "merge").toLowerCase(); // merge | fallback
// Quando true, Futodds tem prioridade máxima para Copa do Mundo (SM/AF ficam como fallback para Copa).
const COPA_FUTODDS_PRIMARY = (Deno.env.get("COPA_FUTODDS_PRIMARY") || "false").toLowerCase() === "true";

function isCopaCompetition(f: any): boolean {
  return /world.?cup|copa.?do.?mundo|mundial|copa.?mundo|fifa.?world/i.test(f?.league?.name ?? "");
}

function normTeam(s: any): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
}

function fixtureKey(f: any): string {
  const lid = f?.league?.id ?? "";
  const h = normTeam(f?.teams?.home?.name);
  const a = normTeam(f?.teams?.away?.name);
  const d = String(f?.fixture?.date ?? "").slice(0, 10);
  return `${lid}|${h}|${a}|${d}`;
}


async function mergeProviders(): Promise<LiveResult> {
  // Busca os 3 provedores em paralelo — API-Football tem chave? tenta. Falha silenciosa.
  const hasAfKey = !!Deno.env.get("API_FOOTBALL_KEY");
  const [smR, fdR, afR] = await Promise.allSettled([
    trySportmonks(),
    tryFutodds(),
    hasAfKey ? tryApiFootball() : Promise.reject(new Error("API_FOOTBALL_KEY not set")),
  ]);

  const sm = smR.status === "fulfilled" ? smR.value.fixtures : [];
  const fd = fdR.status === "fulfilled" ? fdR.value.fixtures : [];
  const af = afR.status === "fulfilled" ? afR.value.fixtures : [];
  const afLeagues = afR.status === "fulfilled" ? new Set(afR.value.leagues) : new Set<number>();

  const smErr = smR.status === "rejected" ? (smR.reason as Error)?.message : null;
  const fdErr = fdR.status === "rejected" ? (fdR.reason as Error)?.message : null;
  const afErr = afR.status === "rejected" ? (afR.reason as Error)?.message : null;

  if (!sm.length && !fd.length && !af.length) {
    throw new Error(`all_providers_empty: sm=${smErr ?? "0"} fd=${fdErr ?? "0"} af=${afErr ?? "0"}`);
  }

  function teamDayKey(f: any): string {
    const h = normTeam(f?.teams?.home?.name);
    const a = normTeam(f?.teams?.away?.name);
    const d = String(f?.fixture?.date ?? "").slice(0, 10);
    return `${h}|${a}|${d}`;
  }

  const seen = new Set<string>();
  const merged: any[] = [];
  let addedFromFutodds = 0;
  let skippedDup = 0;
  const filledLeagues = new Set<number>();

  // === 0) COPA_FUTODDS_PRIMARY: Futodds cobre Copa do Mundo com prioridade máxima ===
  // SM e AF não cobrem Copa 2026 com stats completas (pressure, xg, momentum).
  const fdCopaTeamDay = new Set<string>();
  if (COPA_FUTODDS_PRIMARY) {
    for (const f of fd) {
      if (!isCopaCompetition(f)) continue;
      const k = fixtureKey(f);
      if (seen.has(k)) continue;
      seen.add(k);
      fdCopaTeamDay.add(teamDayKey(f));
      merged.push(f);
      addedFromFutodds++;
      filledLeagues.add(Number(f?.league?.id ?? -1));
    }
    if (fdCopaTeamDay.size > 0) {
      console.log(`[liveProvider] ⚽ COPA_FUTODDS_PRIMARY: Futodds cobriu ${fdCopaTeamDay.size} jogos Copa 2026`);
    }
  }

  // === 1) API-Football — PRIORIDADE ALTA para suas ligas; pula Copa se Futodds já cobriu ===
  const afTeamDay = new Set<string>();
  let addedFromAf = 0;
  for (const f of af) {
    // Se COPA_FUTODDS_PRIMARY e Futodds já cobriu este jogo Copa → pula AF
    if (COPA_FUTODDS_PRIMARY && (isCopaCompetition(f) || fdCopaTeamDay.has(teamDayKey(f)))) continue;
    const k = fixtureKey(f);
    if (seen.has(k)) continue;
    seen.add(k);
    afTeamDay.add(teamDayKey(f));
    merged.push(f);
    addedFromAf++;
  }

  // === 2) Sportmonks — cobre demais ligas; pula jogos já cobertos por AF ou Futodds Copa ===
  const smLeagues = new Set<number>();
  const smTeamDay = new Set<string>();
  for (const f of sm) {
    const lid = Number(f?.league?.id ?? -1);
    if (afLeagues.has(lid)) continue;
    if (afTeamDay.has(teamDayKey(f))) continue;
    // Pula Copa se Futodds já cobriu (COPA_FUTODDS_PRIMARY)
    if (fdCopaTeamDay.has(teamDayKey(f))) continue;
    const k = fixtureKey(f);
    if (seen.has(k)) continue;
    seen.add(k);
    smTeamDay.add(teamDayKey(f));
    smLeagues.add(lid);
    merged.push(f);
  }

  // === 3) Futodds — preenche ligas não cobertas por SM nem AF (Copa já adicionada no passo 0) ===
  for (const f of fd) {
    const lid = Number(f?.league?.id ?? -1);
    // Copa já foi adicionada no passo 0 (COPA_FUTODDS_PRIMARY) — não duplicar
    if (COPA_FUTODDS_PRIMARY && fdCopaTeamDay.has(teamDayKey(f))) continue;
    if (smLeagues.has(lid)) continue;
    if (afLeagues.has(lid)) continue;
    if (smTeamDay.has(teamDayKey(f)) || afTeamDay.has(teamDayKey(f))) { skippedDup++; continue; }
    const k = fixtureKey(f);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(f);
    addedFromFutodds++;
    filledLeagues.add(lid);
  }

  // Cobertura de amistosos por provider (foco pré-Copa)
  const isFriendlyName = (s: string) => /friendl|amistos|international match/i.test(s || "");
  const smFriendlies = sm.filter((f: any) => isFriendlyName(f?.league?.name)).length;
  const fdFriendlies = fd.filter((f: any) => isFriendlyName(f?.league?.name)).length;

  const dominantSource = addedFromAf > 0 && addedFromAf >= sm.length
    ? "apifootball"
    : (sm.length >= fd.length ? "sportmonks" : "futodds");

  console.log(
    `[liveProvider] mode=merge af=${af.length}(+${addedFromAf}) sm=${sm.length} fd=${fd.length} → total=${merged.length} ` +
    `(futodds_added=${addedFromFutodds} skipped_dup=${skippedDup} leagues_filled=${[...filledLeagues].join(",") || "-"}) ` +
    `friendlies=sm:${smFriendlies}/fd:${fdFriendlies} ` +
    `afErr=${afErr ?? "ok"} smErr=${smErr ?? "ok"} fdErr=${fdErr ?? "ok"}`,
  );
  if (addedFromAf > 0) {
    console.log(`[liveProvider] ⚽ API-Football cobriu ${addedFromAf} jogos (ligas: ${[...afLeagues].join(",")})`);
  }
  if (COPA_FUTODDS_PRIMARY && fdCopaTeamDay.size === 0 && fd.length > 0) {
    console.log(`[liveProvider] ⚠️ COPA_FUTODDS_PRIMARY ativo mas Futodds não retornou jogos Copa — verificar cobertura`);
  }
  if (smFriendlies > 0 && fdFriendlies === 0) {
    console.log(`[liveProvider] 🤝 amistosos cobertos só por Sportmonks (Futodds=0) — fallback ativo`);
  } else if (fdFriendlies > 0 && smFriendlies === 0) {
    console.log(`[liveProvider] 🤝 amistosos cobertos só por Futodds (Sportmonks=0)`);
  }

  return {
    fixtures: merged,
    source: dominantSource as LiveResult["source"],
    count: merged.length,
    sm_count: sm.length,
    sm_error: smErr ?? undefined,
    fd_count: fd.length,
    fallback_reason: [
      addedFromAf > 0 ? `af_copa_${addedFromAf}` : null,
      addedFromFutodds > 0 ? `futodds_filled_${addedFromFutodds}` : null,
      smErr ? `sm_error:${smErr}` : null,
    ].filter(Boolean).join("+") || undefined,
  };
}

export async function getLiveMatches(): Promise<LiveResult> {
  if (MODE === "merge") {
    try {
      return await mergeProviders();
    } catch (e) {
      console.warn(`[liveProvider] merge failed → fallback sequencial. ${(e as Error).message}`);
    }
  }

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
  // === API-Football (Copa do Mundo) ===
  if (typeof fixtureRef === "object" && fixtureRef._source === "apifootball" && fixtureRef.af_id) {
    try {
      const stats = await getApiFootballStats(Number(fixtureRef.af_id));
      if (stats) return { stats, source: "apifootball" as any };
    } catch (e) {
      console.warn(`[liveProvider] apiFootball stats fail af_id=${fixtureRef.af_id}: ${(e as Error).message}`);
    }
  }

  // === Futodds (stats inline no fixture) ===
  if (typeof fixtureRef === "object" && fixtureRef._source === "futodds" && (fixtureRef as any).raw) {
    const stats = extractFutoddsStats({ _futodds_stats: (fixtureRef as any).raw._futodds_stats ?? null });
    if (stats) return { stats, source: "futodds" };
  }

  // === Sportmonks (raw inline) ===
  if (typeof fixtureRef === "object" && fixtureRef.raw && fixtureRef._source !== "futodds") {
    try {
      const stats = extractNormalizedStats(fixtureRef.raw);
      return { stats, source: "sportmonks" };
    } catch (e) {
      console.warn(`[liveProvider] extractStats falhou: ${(e as Error).message}`);
    }
  }

  // === Sportmonks (fetch por sm_id) ===
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

  return { stats: null, source: null, fallback_reason: "no_provider_data" };
}
