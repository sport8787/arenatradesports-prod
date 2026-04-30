// Cliente Sportmonks v3 (Pro Advanced) — fonte primária para análise ao vivo do Mycroft.
// Normaliza saída para o mesmo shape consumido hoje pelas edges (compatível com API-Football).

import { resilientFetch } from "./resilientFetch.ts";

const TOKEN = Deno.env.get("SPORTMONKS_API_KEY") ?? "";
const BASE = "https://api.sportmonks.com/v3";

export interface NormalizedFixture {
  fixture: {
    id: string;            // sempre o ID API-Football quando houver mapeamento; senão prefixado "sm_"
    sm_id?: number;        // ID nativo Sportmonks
    af_id?: number;        // ID API-Football (quando mapeado/disponível)
    date: string;
    status: { short: string; long: string; elapsed: number | null };
  };
  league: { id: number; name: string; sm_id?: number };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
  source: "sportmonks" | "api-football";
}

export interface NormalizedStats {
  possession_home: number;
  possession_away: number;
  shots_total_home: number;
  shots_total_away: number;
  shots_on_target_home: number;
  shots_on_target_away: number;
  attacks_home: number;
  attacks_away: number;
  corners_home: number;
  corners_away: number;
  fouls_home: number;
  fouls_away: number;
  cards_home: number;
  cards_away: number;
  passes_home: number;
  passes_away: number;
  passes_accurate_home: number;
  passes_accurate_away: number;
  xG_home: number | null;
  xG_away: number | null;
  source: "sportmonks" | "api-football";
}

export interface OddsLive1X2 {
  home: number | null;
  draw: number | null;
  away: number | null;
  bookmaker?: string | null;
  updated_at: string;
}

function smUrl(path: string, params: Record<string, string> = {}): string {
  const u = new URL(BASE + path);
  u.searchParams.set("api_token", TOKEN);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

// Mapa Sportmonks "type_id" para nomes API-Football padrão (ajustar conforme probe)
// IDs comuns: 41=Shots Total, 42=Shots On Target, 45=Possession, 34=Corners, 84=Yellow Cards,
// 83=Red Cards, 56=Fouls, 80=Passes, 81=Accurate Passes, 44=Dangerous Attacks, 5321=xG
const SM_STAT_MAP: Record<number, string> = {
  41: "shots_total",
  42: "shots_on_target",
  45: "possession",
  34: "corners",
  84: "yellow",
  83: "red",
  56: "fouls",
  80: "passes",
  81: "passes_accurate",
  44: "attacks",
  5321: "xg",
};

function extractStats(fixture: any): NormalizedStats {
  const stats: any = {
    possession_home: 0, possession_away: 0,
    shots_total_home: 0, shots_total_away: 0,
    shots_on_target_home: 0, shots_on_target_away: 0,
    attacks_home: 0, attacks_away: 0,
    corners_home: 0, corners_away: 0,
    fouls_home: 0, fouls_away: 0,
    cards_home: 0, cards_away: 0,
    passes_home: 0, passes_away: 0,
    passes_accurate_home: 0, passes_accurate_away: 0,
    xG_home: null, xG_away: null,
  };

  const participants = fixture.participants || [];
  const homeId = participants.find((p: any) => p.meta?.location === "home")?.id;
  const awayId = participants.find((p: any) => p.meta?.location === "away")?.id;

  const sList = fixture.statistics || [];
  for (const s of sList) {
    const key = SM_STAT_MAP[s.type_id];
    if (!key) continue;
    const isHome = s.participant_id === homeId;
    const suffix = isHome ? "_home" : "_away";
    const val = Number(s.data?.value ?? 0);

    switch (key) {
      case "shots_total":     stats[`shots_total${suffix}`] = val; break;
      case "shots_on_target": stats[`shots_on_target${suffix}`] = val; break;
      case "possession":      stats[`possession${suffix}`] = val; break;
      case "corners":         stats[`corners${suffix}`] = val; break;
      case "fouls":           stats[`fouls${suffix}`] = val; break;
      case "passes":          stats[`passes${suffix}`] = val; break;
      case "passes_accurate": stats[`passes_accurate${suffix}`] = val; break;
      case "attacks":         stats[`attacks${suffix}`] = val; break;
      case "yellow":          stats[`cards${suffix}`] += val; break;
      case "red":             stats[`cards${suffix}`] += val; break;
      case "xg":              stats[isHome ? "xG_home" : "xG_away"] = val; break;
    }
  }
  stats.source = "sportmonks";
  return stats;
}

function extractMinute(fixture: any): number | null {
  const periods = fixture.periods || [];
  const live = periods.find((p: any) => p.ticking) || periods[periods.length - 1];
  return live?.minutes ?? null;
}

function mapStateToShort(stateName: string): { short: string; long: string } {
  const s = (stateName || "").toLowerCase();
  if (s.includes("ht") || s.includes("half")) return { short: "HT", long: "Halftime" };
  if (s.includes("ft") || s.includes("finished") || s.includes("ended")) return { short: "FT", long: "Match Finished" };
  if (s.includes("inplay") || s.includes("live") || s.includes("1st") || s.includes("2nd")) return { short: "1H", long: "First Half" };
  if (s.includes("not") || s.includes("ns")) return { short: "NS", long: "Not Started" };
  return { short: s.toUpperCase().slice(0, 4) || "LIVE", long: stateName };
}

export async function fetchInplay(): Promise<{ fixtures: any[]; raw: number }> {
  if (!TOKEN) throw new Error("SPORTMONKS_API_KEY missing");
  const url = smUrl("/football/livescores/inplay", {
    include: "scores;participants;state;league;statistics;periods;inplayodds",
    per_page: "100",
  });
  const res = await resilientFetch(url, {
    breakerKey: "sportmonks",
    timeoutMs: 12_000,
    retries: 2,
  });
  if (!res.ok) throw new Error(`sportmonks_inplay_${res.status}`);
  const json = await res.json();
  return { fixtures: json.data || [], raw: (json.data || []).length };
}

export async function fetchFixtureById(smId: number): Promise<any | null> {
  if (!TOKEN) throw new Error("SPORTMONKS_API_KEY missing");
  const url = smUrl(`/football/fixtures/${smId}`, {
    include: "scores;participants;state;league;statistics;periods",
  });
  const res = await resilientFetch(url, { breakerKey: "sportmonks", timeoutMs: 10_000, retries: 1 });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data || null;
}

export function normalizeFixture(smFixture: any, leagueMap: Map<number, number>): NormalizedFixture {
  const participants = smFixture.participants || [];
  const home = participants.find((p: any) => p.meta?.location === "home") || participants[0];
  const away = participants.find((p: any) => p.meta?.location === "away") || participants[1];

  // scores: pega o "CURRENT" para placar atual
  const scores = smFixture.scores || [];
  const cur = scores.find((s: any) => (s.description || "").toUpperCase() === "CURRENT");
  const goalsHome = cur?.score?.participant === "home" ? cur.score.goals
    : scores.find((s: any) => s.score?.participant === "home")?.score?.goals ?? null;
  const goalsAway = cur?.score?.participant === "away" ? cur.score.goals
    : scores.find((s: any) => s.score?.participant === "away")?.score?.goals ?? null;

  // state
  const stateName = smFixture.state?.short_name || smFixture.state?.name || "";
  const status = mapStateToShort(stateName);
  const minute = extractMinute(smFixture);

  // league mapping (sm -> af)
  const smLeagueId = smFixture.league?.id;
  let afLeagueId = 0;
  for (const [af, sm] of leagueMap.entries()) {
    if (sm === smLeagueId) { afLeagueId = af; break; }
  }

  // ID estratégia: usa o af_id quando mapeado (preserva settlement); senão prefixa
  const fixtureId = smFixture.af_id ? String(smFixture.af_id) : `sm_${smFixture.id}`;

  return {
    fixture: {
      id: fixtureId,
      sm_id: smFixture.id,
      af_id: smFixture.af_id,
      date: smFixture.starting_at || new Date().toISOString(),
      status: { short: status.short, long: status.long, elapsed: minute },
    },
    league: { id: afLeagueId || smLeagueId, name: smFixture.league?.name || "?", sm_id: smLeagueId },
    teams: {
      home: { id: home?.id ?? 0, name: home?.name ?? "?" },
      away: { id: away?.id ?? 0, name: away?.name ?? "?" },
    },
    goals: { home: goalsHome, away: goalsAway },
    source: "sportmonks",
  };
}

export function extractNormalizedStats(smFixture: any): NormalizedStats {
  return extractStats(smFixture);
}

// Extrai odds 1X2 (Fulltime Result) do payload inplayOdds da Sportmonks.
// Sportmonks v3: market_id=1 = Fulltime Result. Cada entrada traz {label, value, bookmaker_id, market_id}.
// Estratégia: prioriza Bet365 (bookmaker_id=2); fallback para mediana das casas disponíveis.
export function extractOdds1X2(smFixture: any): OddsLive1X2 | null {
  const odds = smFixture?.inplayodds || smFixture?.inplayOdds || smFixture?.inplay_odds || smFixture?.odds || [];
  if (!Array.isArray(odds) || odds.length === 0) return null;

  // Filtra somente Fulltime Result (1X2)
  const ft = odds.filter((o: any) => {
    const mid = o?.market_id ?? o?.marketId;
    const mname = String(o?.market_description || o?.market?.name || o?.market_name || "").toLowerCase();
    return mid === 1 || mname.includes("fulltime result") || mname.includes("match winner") || mname === "1x2";
  });
  if (ft.length === 0) return null;

  // Tenta Bet365 (bookmaker_id=2)
  const bet365 = ft.filter((o: any) => (o.bookmaker_id ?? o.bookmakerId) === 2);
  const pool = bet365.length >= 3 ? bet365 : ft;

  const pick = (label: string): number | null => {
    const matches = pool.filter((o: any) => {
      const l = String(o?.label || o?.name || "").toLowerCase();
      return l === label.toLowerCase() || (label === "Home" && l === "1") || (label === "Draw" && (l === "x" || l === "draw")) || (label === "Away" && l === "2");
    });
    if (matches.length === 0) return null;
    const vals = matches.map((m: any) => Number(m.value)).filter((v: number) => Number.isFinite(v) && v > 1);
    if (vals.length === 0) return null;
    vals.sort((a, b) => a - b);
    // mediana
    const mid = Math.floor(vals.length / 2);
    return Number((vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2).toFixed(2));
  };

  const home = pick("Home");
  const draw = pick("Draw");
  const away = pick("Away");
  if (home == null && draw == null && away == null) return null;

  return {
    home, draw, away,
    bookmaker: bet365.length >= 3 ? "bet365" : "median",
    updated_at: new Date().toISOString(),
  };
}
