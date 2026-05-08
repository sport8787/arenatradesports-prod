// Cache em memória do registry de ligas do Trader Sports.
// Lê da tabela public.trader_leagues (PRIMARY KEY league_id).
// Reload a cada 30 minutos.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export type LeagueTier = "A" | "B" | "C";

export interface LeagueRow {
  league_id: number;
  name: string;
  country: string | null;
  region: string;
  tier: LeagueTier;
  enabled: boolean;
  odds_sport_key: string | null;
}

const TTL_MS = 30 * 60 * 1000;
let cache: { ts: number; rows: LeagueRow[] } | null = null;
let inflight: Promise<LeagueRow[]> | null = null;

function getAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function loadFresh(): Promise<LeagueRow[]> {
  const sb = getAdmin();
  const { data, error } = await sb
    .from("trader_leagues")
    .select("league_id,name,country,region,tier,enabled,odds_sport_key")
    .eq("enabled", true);
  if (error) {
    console.warn("[leaguesRegistry] load error:", error.message);
    return cache?.rows ?? [];
  }
  return (data || []) as LeagueRow[];
}

export async function getLeagues(forceRefresh = false): Promise<LeagueRow[]> {
  const now = Date.now();
  if (!forceRefresh && cache && now - cache.ts < TTL_MS) return cache.rows;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const rows = await loadFresh();
      cache = { ts: now, rows };
      return rows;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function getAllowedLeagueIds(): Promise<Set<number>> {
  const rows = await getLeagues();
  return new Set(rows.map((r) => r.league_id));
}

export async function getLeaguesByTier(tier: LeagueTier): Promise<LeagueRow[]> {
  const rows = await getLeagues();
  return rows.filter((r) => r.tier === tier);
}

export async function getLeagueTier(leagueId: number): Promise<LeagueTier | null> {
  const rows = await getLeagues();
  return rows.find((r) => r.league_id === leagueId)?.tier ?? null;
}

export async function getOddsSportKeyMap(): Promise<Record<number, string>> {
  const rows = await getLeagues();
  const map: Record<number, string> = {};
  for (const r of rows) if (r.odds_sport_key) map[r.league_id] = r.odds_sport_key;
  return map;
}

/** Modelo Gemini por tier. C nunca chega aqui (sem IA). */
export function geminiModelForTier(tier: LeagueTier): string {
  if (tier === "A") return "gemini-2.5-flash";
  if (tier === "B") return "gemini-2.5-flash-lite";
  return "gemini-2.5-flash-lite";
}

/** Limite de jogos analisados por tier nas edges pré-live (HA / favorito). */
export function maxGamesForTier(tier: LeagueTier): number {
  if (tier === "A") return 25;
  if (tier === "B") return 20;
  return 0; // C não passa por IA pré-live
}
