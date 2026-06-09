/**
 * apiFootballProvider — Provedor API-Football (v3.football.api-sports.io)
 *
 * Usado como provedor primário para Copa do Mundo (league_id=1) e quaisquer
 * outras ligas configuradas via API_FOOTBALL_LEAGUES env.
 *
 * Retorna fixtures no shape "API-Football compatível" nativo (sem transformação).
 * _source = "apifootball" para identificação downstream.
 */

const AF_BASE = "https://v3.football.api-sports.io";

// Liga IDs API-Football que devem ser roteados por este provedor
// (Copa do Mundo = 1; pode ser expandido via env API_FOOTBALL_LEAGUES="1,2,3")
const DEFAULT_LEAGUES = [1]; // FIFA World Cup

function getKey(): string {
  const k = Deno.env.get("API_FOOTBALL_KEY");
  if (!k) throw new Error("API_FOOTBALL_KEY missing");
  return k;
}

function getTargetLeagues(): Set<number> {
  const env = Deno.env.get("API_FOOTBALL_LEAGUES");
  if (env) {
    const ids = env.split(",").map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite);
    if (ids.length > 0) return new Set(ids);
  }
  return new Set(DEFAULT_LEAGUES);
}

async function afFetch(path: string): Promise<any> {
  const key = getKey();
  const url = `${AF_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "x-apisports-key": key,
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`apifootball_${res.status}: ${path}`);
  return res.json();
}

/**
 * Busca todos os jogos ao vivo e filtra pelas ligas alvo.
 * Retorna fixtures no shape API-Football nativo.
 */
export async function getApiFootballLive(): Promise<{
  fixtures: any[];
  count: number;
  leagues: number[];
}> {
  const target = getTargetLeagues();
  const json = await afFetch("/fixtures?live=all");
  const all: any[] = json?.response ?? [];

  const filtered = all.filter((f: any) => {
    const lid = Number(f?.league?.id ?? -1);
    return target.has(lid);
  });

  // Normaliza para garantir _source e shape consistente
  const fixtures = filtered.map((f: any) => ({
    fixture: {
      id: f.fixture.id,
      date: f.fixture.date,
      status: {
        short: f.fixture.status?.short ?? "LIVE",
        long: f.fixture.status?.long ?? "Live",
        elapsed: f.fixture.status?.elapsed ?? 0,
      },
    },
    league: {
      id: f.league.id,
      name: f.league.name,
      country: f.league.country ?? null,
      logo: f.league.logo ?? null,
      flag: f.league.flag ?? null,
    },
    teams: {
      home: {
        id: f.teams?.home?.id ?? 0,
        name: f.teams?.home?.name ?? "?",
        logo: f.teams?.home?.logo ?? null,
      },
      away: {
        id: f.teams?.away?.id ?? 0,
        name: f.teams?.away?.name ?? "?",
        logo: f.teams?.away?.logo ?? null,
      },
    },
    goals: {
      home: f.goals?.home ?? 0,
      away: f.goals?.away ?? 0,
    },
    score: f.score ?? null,
    _source: "apifootball",
    _af_league_id: f.league.id,
  }));

  const leagues = [...new Set(filtered.map((f: any) => Number(f.league.id)))];
  console.log(`[apiFootball] live fixtures total=${all.length} filtered=${fixtures.length} leagues=[${leagues.join(",")}]`);
  return { fixtures, count: fixtures.length, leagues };
}

/**
 * Busca estatísticas de um fixture específico (shots, possession, etc.)
 * Retorna no shape NormalizedStats (subset).
 */
export async function getApiFootballStats(fixtureId: number): Promise<any | null> {
  try {
    const json = await afFetch(`/fixtures/statistics?fixture=${fixtureId}`);
    const teams: any[] = json?.response ?? [];
    if (teams.length < 2) return null;

    const parse = (teamStats: any[], type: string): number => {
      const entry = teamStats.find((s: any) =>
        (s.type || "").toLowerCase().replace(/\s+/g, "_") === type.toLowerCase().replace(/\s+/g, "_")
      );
      const v = entry?.value;
      if (v == null || v === "") return 0;
      return typeof v === "string" ? parseFloat(v.replace("%", "")) || 0 : Number(v) || 0;
    };

    const [homeTeam, awayTeam] = teams;
    const hStats: any[] = homeTeam?.statistics ?? [];
    const aStats: any[] = awayTeam?.statistics ?? [];

    return {
      shots_home: parse(hStats, "Total Shots"),
      shots_away: parse(aStats, "Total Shots"),
      shots_on_target_home: parse(hStats, "Shots on Goal"),
      shots_on_target_away: parse(aStats, "Shots on Goal"),
      possession_home: parse(hStats, "Ball Possession"),
      possession_away: parse(aStats, "Ball Possession"),
      corners_home: parse(hStats, "Corner Kicks"),
      corners_away: parse(aStats, "Corner Kicks"),
      fouls_home: parse(hStats, "Fouls"),
      fouls_away: parse(aStats, "Fouls"),
      cards_home: parse(hStats, "Yellow Cards") + parse(hStats, "Red Cards"),
      cards_away: parse(aStats, "Yellow Cards") + parse(aStats, "Red Cards"),
      dangerous_attacks_home: 0,
      dangerous_attacks_away: 0,
      passes_home: parse(hStats, "Total passes"),
      passes_away: parse(aStats, "Total passes"),
      passes_accurate_home: parse(hStats, "Passes accurate"),
      passes_accurate_away: parse(aStats, "Passes accurate"),
      attacks_home: 0,
      attacks_away: 0,
      source: "apifootball",
    };
  } catch (e) {
    console.warn(`[apiFootball] stats fail fixture=${fixtureId}: ${(e as Error).message}`);
    return null;
  }
}
