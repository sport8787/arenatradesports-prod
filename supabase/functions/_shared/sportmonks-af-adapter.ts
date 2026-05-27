// =============================================================================
// Sportmonks → API-Football shape adapter
// Permite que edges escritas para o shape API-Football consumam dados Sportmonks
// sem mudar lógica/scoring. Ativado por flag `data_source: 'sportmonks'`.
// =============================================================================
//
// Cobre os 3 endpoints usados pelas edges pré-live (plano-favorito,
// handicap-asiatico, mycroft-corners-punter):
//   - getUpcomingFixturesSM(): jogos das próximas 36h em ligas mapeadas
//   - getRecentFixturesSM(team_id, last):  últimos N jogos do time
//   - getTeamStatsSM(team_id): agregação tipo /teams/statistics (home/away)
//
// IMPORTANTE: usa SPORTMONKS_API_KEY. Se faltar token, retorna [] / null e
// a edge cai automaticamente no fluxo API-Football (graceful degradation).
// =============================================================================

const TOKEN = Deno.env.get("SPORTMONKS_API_KEY") ?? "";
const BASE = "https://api.sportmonks.com/v3";

function smUrl(path: string, params: Record<string, string> = {}): string {
  const u = new URL(BASE + path);
  u.searchParams.set("api_token", TOKEN);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

// =============================================================================
// MAPA DE LIGAS (Sportmonks ID ↔ API-Football ID)
// Sincronizar com SM_PROBE periodicamente. Cobertura: ligas usadas pelas edges.
// =============================================================================
// SM IDs (Pro Advanced) — confirmados via /football/leagues
export const LEAGUE_AF_TO_SM: Record<number, number> = {
  39: 8,    // Premier League
  140: 564, // La Liga
  135: 384, // Serie A
  78: 82,   // Bundesliga
  61: 301,  // Ligue 1
  71: 648,  // Brasileirão Série A
  72: 649,  // Brasileirão Série B
  88: 72,   // Eredivisie
  94: 462,  // Primeira Liga (PT)
  144: 208, // Jupiler Pro League (BE)
  179: 501, // Scottish Premiership
  203: 600, // Süper Lig (TR)
  253: 779, // MLS
  262: 743, // Liga MX
  197: 271, // Super League Grécia
  307: 932, // Saudi Pro League
  40: 9,    // Championship
  79: 109,  // 2. Bundesliga
  // Sul-América + Copas Brasil (Trial Pro inclui International Tournaments)
  13: 1122,  // Copa Libertadores
  11: 1116,  // Copa Sudamericana
  73: 654,   // Copa do Brasil
  75: 654,   // Copa do Brasil (alias)
  624: 1294, // Copa do Nordeste
  628: 1386, // Copa Verde
  671: 1798, // Supercopa do Brasil
};
export const LEAGUE_SM_TO_AF: Record<number, number> = Object.fromEntries(
  Object.entries(LEAGUE_AF_TO_SM).map(([af, sm]) => [sm, Number(af)]),
);

// =============================================================================
// TIPOS NORMALIZADOS (espelho parcial do shape API-Football)
// =============================================================================
export interface AFShapeFixture {
  fixture: { id: number; date: string; status: { short: string }; timestamp?: number };
  league: { id: number; name: string; season: number };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
}

export interface AFShapeTeamStats {
  fixtures: { played: { home: number; away: number; total: number } };
  goals: {
    for: { average: { home: string; away: string; total: string }; total: { home: number; away: number; total: number } };
    against: { average: { home: string; away: string; total: string }; total: { home: number; away: number; total: number } };
  };
  clean_sheet: { home: number; away: number; total: number };
  failed_to_score: { home: number; away: number; total: number };
  form: string;
}

// =============================================================================
// HELPERS
// =============================================================================
function parseScores(scores: any[]): { home: number | null; away: number | null } {
  let home: number | null = null, away: number | null = null;
  for (const s of (scores || [])) {
    if ((s.description || "").toUpperCase() !== "CURRENT") continue;
    if (s.score?.participant === "home") home = s.score.goals;
    if (s.score?.participant === "away") away = s.score.goals;
  }
  if (home === null || away === null) {
    for (const s of (scores || [])) {
      const d = (s.description || "").toUpperCase();
      if (d !== "FT" && d !== "2ND_HALF") continue;
      if (s.score?.participant === "home" && home === null) home = s.score.goals;
      if (s.score?.participant === "away" && away === null) away = s.score.goals;
    }
  }
  return { home, away };
}

function isFinished(f: any): boolean {
  const s = (f.state?.short_name || f.state?.name || "").toUpperCase();
  return s.includes("FT") || s.includes("FIN") || s.includes("END") || s.includes("AET") || s.includes("PEN");
}

// =============================================================================
// 1) UPCOMING FIXTURES — próximas 36h em ligas alvo
// Retorna no shape API-Football (compatível com getUpcomingFixtures original).
// =============================================================================
export async function getUpcomingFixturesSM(
  afLeagueIds: number[],
  hoursAhead = 120,
): Promise<AFShapeFixture[]> {
  if (!TOKEN) return [];
  const out: AFShapeFixture[] = [];
  const now = Date.now();
  const horizon = now + hoursAhead * 3_600_000;
  const today = new Date(now).toISOString().slice(0, 10);
  const limit = new Date(horizon).toISOString().slice(0, 10);

  // Sportmonks: /football/fixtures/between/{from}/{to}
  // Filtra explicitamente pelas ligas SM que mapeamos — sem o filtro, o endpoint
  // devolve só uma amostra (~25) majoritariamente em ligas exóticas que não usamos.
  try {
    const smLeagueIds = afLeagueIds
      .map((af) => LEAGUE_AF_TO_SM[af])
      .filter((id): id is number => typeof id === "number");
    const params: Record<string, string> = {
      include: "scores;participants;state;league",
      per_page: "200",
    };
    if (smLeagueIds.length) {
      params["filters"] = `fixtureLeagues:${smLeagueIds.join(",")}`;
    }
    const url = smUrl(`/football/fixtures/between/${today}/${limit}`, params);
    const r = await fetch(url);
    if (!r.ok) {
      console.warn(`[SM-Adapter] upcoming HTTP ${r.status}`);
      return [];
    }

    const j = await r.json();
    const fixtures = j.data || [];
    for (const f of fixtures) {
      const smLeagueId = f.league?.id ?? f.league_id;
      const afLeagueId = LEAGUE_SM_TO_AF[smLeagueId];
      if (!afLeagueId || !afLeagueIds.includes(afLeagueId)) continue;

      const t = new Date(f.starting_at || f.starting_at_timestamp * 1000).getTime();
      if (t < now || t > horizon) continue;
      if (isFinished(f)) continue;
      const stateShort = (f.state?.short_name || "").toUpperCase();
      if (stateShort && !["NS", "TBD"].includes(stateShort)) continue;

      const parts = f.participants || [];
      const home = parts.find((p: any) => p.meta?.location === "home") || parts[0];
      const away = parts.find((p: any) => p.meta?.location === "away") || parts[1];
      if (!home || !away) continue;

      out.push({
        fixture: {
          id: f.id,
          date: f.starting_at,
          status: { short: stateShort || "NS" },
          timestamp: Math.floor(t / 1000),
        },
        league: {
          id: afLeagueId,
          name: f.league?.name || "?",
          season: new Date(t).getUTCFullYear(),
        },
        teams: {
          home: { id: home.id, name: home.name },
          away: { id: away.id, name: away.name },
        },
        goals: { home: null, away: null },
      });
    }
    console.log(`[SM-Adapter] upcoming raw=${fixtures.length} → mapeados=${out.length} (alvo=${afLeagueIds.length} ligas AF)`);
  } catch (e) {
    console.warn(`[SM-Adapter] upcoming err`, (e as Error).message);
  }
  return out;
}



// =============================================================================
// 2) BUSCAR TIME POR NOME — usado quando a edge tem só home_team_name
// =============================================================================
function normalizeTeamName(name: string): string[] {
  const variants = new Set<string>();
  variants.add(name);
  let v = name.replace(/\s*[-/]\s*(SP|RJ|MG|BA|RS|PR|PE|CE|GO|DF|ES|SC|MT|MS|PA|PB|RN|AL|MA|PI|TO|AM|RO|AC|RR|AP|SE)\b/i, "").trim();
  variants.add(v);
  v = v.replace(/^(CA|SC|FC|CD|CR|EC|AA|SE|AD|RB|CF|SD|UD|CS|AS|US|FK|SK|HC|GD)\s+/i, "").trim();
  variants.add(v);
  const first = v.split(/\s+/)[0];
  if (first.length >= 4) variants.add(first);
  return Array.from(variants).filter(Boolean);
}

export async function smSearchTeam(name: string): Promise<{ id: number; name: string } | null> {
  if (!TOKEN) return null;
  for (const variant of normalizeTeamName(name)) {
    try {
      const url = smUrl(`/football/teams/search/${encodeURIComponent(variant)}`);
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      const t = j.data?.[0];
      if (t) return { id: t.id, name: t.name };
    } catch { /* try next */ }
  }
  return null;
}

// =============================================================================
// 3) RECENT FIXTURES (últimos N FT) no shape API-Football
// =============================================================================
export async function getRecentFixturesSM(teamId: number, last = 10): Promise<any[]> {
  if (!TOKEN) return [];
  try {
    const today = new Date().toISOString().slice(0, 10);
    const sixMonthsAgo = new Date(Date.now() - 240 * 86400_000).toISOString().slice(0, 10);
    const url = smUrl(`/football/fixtures/between/${sixMonthsAgo}/${today}/${teamId}`, {
      include: "scores;participants;state",
      per_page: "100",
    });
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    const list = (j.data || []).filter(isFinished);
    // Mais recentes primeiro
    list.sort((a: any, b: any) => new Date(b.starting_at).getTime() - new Date(a.starting_at).getTime());
    const slice = list.slice(0, last);
    // Map para shape API-Football
    return slice.map((f: any) => {
      const parts = f.participants || [];
      const home = parts.find((p: any) => p.meta?.location === "home") || parts[0];
      const away = parts.find((p: any) => p.meta?.location === "away") || parts[1];
      const { home: gh, away: ga } = parseScores(f.scores || []);
      return {
        fixture: { id: f.id, date: f.starting_at, status: { short: "FT" } },
        teams: {
          home: { id: home?.id ?? 0, name: home?.name ?? "?" },
          away: { id: away?.id ?? 0, name: away?.name ?? "?" },
        },
        goals: { home: gh, away: ga },
      };
    });
  } catch {
    return [];
  }
}

// =============================================================================
// 4) TEAM STATS — agregação local-aware no shape API-Football
// =============================================================================
export async function getTeamStatsSM(teamId: number, last = 20): Promise<AFShapeTeamStats | null> {
  const fixtures = await getRecentFixturesSM(teamId, last);
  if (fixtures.length === 0) return null;

  let pH = 0, pA = 0;
  let gfH = 0, gfA = 0, gaH = 0, gaA = 0;
  let csH = 0, csA = 0, ftsH = 0, ftsA = 0;
  const formArr: string[] = [];

  for (const f of fixtures) {
    const isHome = f.teams.home.id === teamId;
    const myGoals = isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
    const opGoals = isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0);

    if (isHome) {
      pH++;
      gfH += myGoals; gaH += opGoals;
      if (opGoals === 0) csH++;
      if (myGoals === 0) ftsH++;
    } else {
      pA++;
      gfA += myGoals; gaA += opGoals;
      if (opGoals === 0) csA++;
      if (myGoals === 0) ftsA++;
    }

    if (myGoals > opGoals) formArr.push("W");
    else if (myGoals < opGoals) formArr.push("L");
    else formArr.push("D");
  }

  const tot = pH + pA;
  const fmt = (v: number) => (v).toFixed(2);

  return {
    fixtures: { played: { home: pH, away: pA, total: tot } },
    goals: {
      for: {
        average: {
          home: pH ? fmt(gfH / pH) : "0.00",
          away: pA ? fmt(gfA / pA) : "0.00",
          total: tot ? fmt((gfH + gfA) / tot) : "0.00",
        },
        total: { home: gfH, away: gfA, total: gfH + gfA },
      },
      against: {
        average: {
          home: pH ? fmt(gaH / pH) : "0.00",
          away: pA ? fmt(gaA / pA) : "0.00",
          total: tot ? fmt((gaH + gaA) / tot) : "0.00",
        },
        total: { home: gaH, away: gaA, total: gaH + gaA },
      },
    },
    clean_sheet: { home: csH, away: csA, total: csH + csA },
    failed_to_score: { home: ftsH, away: ftsA, total: ftsH + ftsA },
    form: formArr.slice(0, 10).reverse().join(""), // mais antigo → mais recente
  };
}

// =============================================================================
// 5) CORNER STATS por fixture — usado pelo mycroft-corners-punter
// Retorna nº de escanteios do time no fixture (0 se não houver dado)
// =============================================================================
export async function getCornersForFixtureSM(fixtureId: number, teamId: number): Promise<number> {
  if (!TOKEN) return 0;
  try {
    const url = smUrl(`/football/fixtures/${fixtureId}`, {
      include: "statistics",
    });
    const r = await fetch(url);
    if (!r.ok) return 0;
    const j = await r.json();
    const stats = j.data?.statistics || [];
    // type_id 34 = corners
    const row = stats.find((s: any) => s.type_id === 34 && s.participant_id === teamId);
    return Number(row?.data?.value ?? 0) || 0;
  } catch {
    return 0;
  }
}

// =============================================================================
// 5b) CARDS AVG — média de cartões (amarelos+vermelhos) por jogo
// Usa fixtures recentes com include=statistics; type_id 84=yellow, 83=red.
// Retorna { avg_total_jogo, avg_recebidos, sample } ou null.
// =============================================================================
export async function getTeamCardsAvgSM(
  teamId: number,
  last = 10,
): Promise<{ avg_total_jogo: number; avg_recebidos: number; sample: number } | null> {
  if (!TOKEN) return null;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - 240 * 86400_000).toISOString().slice(0, 10);
    const url = smUrl(`/football/fixtures/between/${since}/${today}/${teamId}`, {
      include: "participants;state;statistics",
      per_page: "100",
    });
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const list = (j.data || []).filter(isFinished);
    list.sort((a: any, b: any) => new Date(b.starting_at).getTime() - new Date(a.starting_at).getTime());
    const slice = list.slice(0, last);
    if (slice.length < 3) return null;

    let totalJogo = 0;
    let recebidos = 0;
    let sample = 0;
    for (const f of slice) {
      const stats = f.statistics || [];
      if (!stats.length) continue;
      let jogo = 0;
      let meu = 0;
      for (const s of stats) {
        if (s.type_id !== 84 && s.type_id !== 83) continue;
        const v = Number(s?.data?.value ?? 0) || 0;
        jogo += v;
        if (Number(s.participant_id) === teamId) meu += v;
      }
      totalJogo += jogo;
      recebidos += meu;
      sample++;
    }
    if (sample < 3) return null;
    return {
      avg_total_jogo: totalJogo / sample,
      avg_recebidos: recebidos / sample,
      sample,
    };
  } catch {
    return null;
  }
}

// =============================================================================
// 6) LIVE STATS por nome de time — usado pelo analyze-live-matches
// Busca o fixture LIVE pelos nomes dos times e retorna xG/shots/possession/corners
// no formato consumido pelo enrichedStats. Retorna null se não encontrado.
// =============================================================================
// Type IDs Sportmonks (statistics):
//   5118 = Expected Goals (xG)
//   34   = Corners
//   41   = Shots Total
//   42   = Shots On Target (Shots on goal)
//   43   = Shots Off Target
//   45   = Ball Possession %
//   44   = Fouls
//   84   = Yellow Cards
//   83   = Red Cards
//   80   = Passes
//   58   = Attacks
//   59   = Dangerous Attacks
//   86   = Big Chances Created
// =============================================================================

interface SMLiveStats {
  found: boolean;
  source: "sportmonks";
  xg_home: number;
  xg_away: number;
  shots_total_home: number;
  shots_total_away: number;
  shots_on_target_home: number;
  shots_on_target_away: number;
  possession_home: number;
  possession_away: number;
  corners_home: number;
  corners_away: number;
  dangerous_attacks_home: number;
  dangerous_attacks_away: number;
  big_chances_home: number;
  big_chances_away: number;
}

function _normName(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|sc|ac|cd|club|de|do|da)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function _readStat(stats: any[], typeId: number, participantId: number): number {
  const row = stats.find(
    (s: any) => Number(s.type_id) === typeId && Number(s.participant_id) === participantId
  );
  const v = Number(row?.data?.value ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export async function getLiveStatsSM(homeName: string, awayName: string): Promise<SMLiveStats | null> {
  if (!TOKEN) return null;
  try {
    // Reusa o cache compartilhado do fetchInplay (TTL 75s/180s) — evita que cada
    // chamada do Sinais Alavanca queime uma nova request da cota Sportmonks.
    const { fetchInplay } = await import("./sportmonks.ts");
    const { fixtures } = await fetchInplay();
    const nh = _normName(homeName);
    const na = _normName(awayName);


    // Match by name (both teams must align)
    const fix = fixtures.find((f: any) => {
      const parts = f.participants || [];
      const h = parts.find((p: any) => p.meta?.location === "home") || parts[0];
      const a = parts.find((p: any) => p.meta?.location === "away") || parts[1];
      const phn = _normName(h?.name || "");
      const pan = _normName(a?.name || "");
      const homeOk = phn.includes(nh) || nh.includes(phn);
      const awayOk = pan.includes(na) || na.includes(pan);
      return homeOk && awayOk;
    });
    if (!fix) return null;

    const parts = fix.participants || [];
    const home = parts.find((p: any) => p.meta?.location === "home") || parts[0];
    const away = parts.find((p: any) => p.meta?.location === "away") || parts[1];
    if (!home || !away) return null;
    const stats = fix.statistics || [];

    return {
      found: true,
      source: "sportmonks",
      xg_home: _readStat(stats, 5118, home.id),
      xg_away: _readStat(stats, 5118, away.id),
      shots_total_home: _readStat(stats, 41, home.id),
      shots_total_away: _readStat(stats, 41, away.id),
      shots_on_target_home: _readStat(stats, 42, home.id),
      shots_on_target_away: _readStat(stats, 42, away.id),
      possession_home: _readStat(stats, 45, home.id),
      possession_away: _readStat(stats, 45, away.id),
      corners_home: _readStat(stats, 34, home.id),
      corners_away: _readStat(stats, 34, away.id),
      dangerous_attacks_home: _readStat(stats, 59, home.id),
      dangerous_attacks_away: _readStat(stats, 59, away.id),
      big_chances_home: _readStat(stats, 86, home.id),
      big_chances_away: _readStat(stats, 86, away.id),
    };
  } catch {
    return null;
  }
}
