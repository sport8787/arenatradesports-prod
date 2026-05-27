// Cliente Sportmonks v3 (Pro Advanced) — fonte primária para análise ao vivo do Mycroft.
// Normaliza saída para o mesmo shape consumido hoje pelas edges (compatível com API-Football).

import { resilientFetch } from "./resilientFetch.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const TOKEN = Deno.env.get("SPORTMONKS_API_KEY") ?? "";
const BASE = "https://api.sportmonks.com/v3";

// TTL do cache compartilhado de /livescores/inplay (em segundos).
// Quando o último resultado teve ≥1 jogos, TTL curto para não perder eventos;
// quando estava vazio, estendemos para economizar cota.
const INPLAY_CACHE_TTL_HOT = 75;
const INPLAY_CACHE_TTL_COLD = 180;

let _sbInplay: any = null;
function getInplaySb() {
  if (_sbInplay) return _sbInplay;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  _sbInplay = createClient(url, key);
  return _sbInplay;
}

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
// 83=Red Cards, 56=Fouls, 80=Passes, 81=Accurate Passes, 44=Dangerous Attacks
// xG real vive no include "xgfixture" com type_ids 5304 e 5305 (ambos = Expected Goals,
// um por participante). O location ("home"/"away") indica o lado correto.
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
  5304: "xg",
  5305: "xg",
  5321: "xg", // legado — mantido por segurança caso o plano antigo ainda retorne
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

  // Junta statistics + xgfixture (xG mora num include separado em planos Pro+)
  const sList = [
    ...((fixture.statistics as any[]) || []),
    ...((fixture.xgfixture as any[]) || []),
  ];
  for (const s of sList) {
    const key = SM_STAT_MAP[s.type_id];
    if (!key) continue;
    // location explícito do payload tem prioridade; fallback por participant_id
    const loc = (s.location || "").toLowerCase();
    const isHome = loc === "home" || (!loc && s.participant_id === homeId);
    const isAway = loc === "away" || (!loc && s.participant_id === awayId);
    if (!isHome && !isAway) continue;
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

export async function fetchInplay(
  opts: { forceRefresh?: boolean } = {},
): Promise<{ fixtures: any[]; raw: number; cached?: boolean }> {
  if (!TOKEN) throw new Error("SPORTMONKS_API_KEY missing");

  // 1) Tenta cache compartilhado (DB) — evita múltiplas edges (cron-live-matches Round1/Round2,
  //    update-live-scores, fetch-live-matches, sinais-alavanca-live etc.) baterem no mesmo
  //    endpoint dentro da mesma janela curta.
  const sb = getInplaySb();
  if (sb && !opts.forceRefresh) {
    try {
      const { data: cached } = await sb
        .from("sportmonks_inplay_cache")
        .select("payload, fixture_count, fetched_at")
        .eq("cache_key", "global")
        .maybeSingle();
      if (cached) {
        const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
        const ttl = (cached.fixture_count > 0 ? INPLAY_CACHE_TTL_HOT : INPLAY_CACHE_TTL_COLD) * 1000;
        if (ageMs < ttl) {
          const fixtures = Array.isArray(cached.payload) ? cached.payload : [];
          console.log(`[sportmonks] inplay CACHE hit age=${Math.round(ageMs / 1000)}s count=${fixtures.length} ttl=${ttl / 1000}s`);
          return { fixtures, raw: fixtures.length, cached: true };
        }
      }
    } catch (e) {
      console.warn(`[sportmonks] inplay cache read fail: ${(e as Error).message}`);
    }
  }

  // 2) Cache miss → bate na Sportmonks
  const url = smUrl("/football/livescores/inplay", {
    include: "scores;participants;state;league;statistics;xgfixture;periods;inplayodds",
    per_page: "100",
  });
  const res = await resilientFetch(url, {
    breakerKey: "sportmonks",
    timeoutMs: 12_000,
    retries: 2,
  });
  if (!res.ok) throw new Error(`sportmonks_inplay_${res.status}`);
  const json = await res.json();
  const fixtures = json.data || [];

  // 3) Grava cache (fire-and-forget) — falhas não devem quebrar o fluxo
  if (sb) {
    sb.from("sportmonks_inplay_cache")
      .upsert(
        {
          cache_key: "global",
          payload: fixtures,
          fixture_count: fixtures.length,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "cache_key" },
      )
      .then((r: any) => {
        if (r?.error) console.warn(`[sportmonks] inplay cache write fail: ${r.error.message}`);
      });
  }

  console.log(`[sportmonks] inplay LIVE fetch count=${fixtures.length}`);
  return { fixtures, raw: fixtures.length };
}

export async function fetchFixtureById(smId: number): Promise<any | null> {
  if (!TOKEN) throw new Error("SPORTMONKS_API_KEY missing");
  const url = smUrl(`/football/fixtures/${smId}`, {
    include: "scores;participants;state;league;statistics;xgfixture;periods",
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

// Bookmakers conhecidos (id Sportmonks). Quanto menor a margem (overround),
// melhor a odd para o apostador. Betano e Superbet costumam pagar acima da média
// quando disponíveis no plano contratado.
const BOOKMAKER_NAMES: Record<number, string> = {
  2: "bet365",
  9: "betfair",
  20: "pinnacle",
  // Quando o plano expandir, basta acrescentar IDs aqui:
  // 271: "betano", 999: "superbet", etc. (descobrir via /odds/bookmakers)
};

// Ordem de preferência por NOME (case-insensitive). Como o produto é trader
// ao vivo e só Betfair oferece exchange (back/lay com liquidez real), ela é
// SEMPRE a 1ª opção. Demais casas servem de fallback quando o mercado/outcome
// não estiver disponível na exchange.
const BOOKMAKER_PREFERENCE = [
  "betfair",    // exchange — prioridade absoluta para trader ao vivo
  "pinnacle",   // margem ~2-3%, melhor referência matemática
  "betano",
  "superbet",
  "bet365",     // muito líquida, base sólida
];

interface OddRow {
  market_id?: number;
  marketId?: number;
  bookmaker_id?: number;
  bookmakerId?: number;
  label?: string;
  name?: string;
  value?: string | number;
  market_description?: string;
  suspended?: boolean;
  stopped?: boolean;
}

// Normaliza label para "1" | "X" | "2"
function normalizeOutcome(o: OddRow): "1" | "X" | "2" | null {
  const raw = String(o.label ?? o.name ?? "").trim().toLowerCase();
  if (raw === "1" || raw === "home") return "1";
  if (raw === "x" || raw === "draw") return "X";
  if (raw === "2" || raw === "away") return "2";
  return null;
}

// Para cada outcome (1/X/2), escolhe o MAIOR valor disponível seguindo a
// preferência de bookmaker. Se a casa preferida não tem aquele outcome
// (ou está suspended/stopped), tenta a próxima da lista. Como último recurso,
// usa qualquer casa restante (melhor odd entre as válidas).
function pickBestForOutcome(
  ft: OddRow[],
  outcome: "1" | "X" | "2",
): { value: number; bookmakerId: number; bookmakerName: string } | null {
  const pool = ft.filter((o) => {
    if (o.suspended || o.stopped) return false;
    return normalizeOutcome(o) === outcome;
  });
  if (pool.length === 0) return null;

  const validVal = (o: OddRow): number => {
    const v = Number(o.value);
    return Number.isFinite(v) && v > 1 ? v : NaN;
  };

  // Tenta cada casa preferida em ordem
  for (const prefName of BOOKMAKER_PREFERENCE) {
    const matches = pool.filter((o) => {
      const id = o.bookmaker_id ?? o.bookmakerId ?? -1;
      return (BOOKMAKER_NAMES[id] || "").toLowerCase() === prefName;
    });
    const valid = matches.map(validVal).filter((v) => !isNaN(v));
    if (valid.length > 0) {
      // Dentro da mesma casa, pega o maior (raramente mais de um)
      return {
        value: Number(Math.max(...valid).toFixed(2)),
        bookmakerId: matches[0].bookmaker_id ?? matches[0].bookmakerId ?? -1,
        bookmakerName: prefName,
      };
    }
  }

  // Fallback: qualquer casa válida — pega a MAIOR odd (melhor para o apostador)
  let bestVal = -1;
  let bestRow: OddRow | null = null;
  for (const o of pool) {
    const v = validVal(o);
    if (!isNaN(v) && v > bestVal) {
      bestVal = v;
      bestRow = o;
    }
  }
  if (!bestRow) return null;
  const id = bestRow.bookmaker_id ?? bestRow.bookmakerId ?? -1;
  return {
    value: Number(bestVal.toFixed(2)),
    bookmakerId: id,
    bookmakerName: BOOKMAKER_NAMES[id] || `bm_${id}`,
  };
}

// Extrai odds 1X2 (Fulltime Result) do payload inplayodds da Sportmonks.
// Cada outcome (1/X/2) é resolvido independentemente: se a casa preferida
// não cobrir aquele outcome, cai para a próxima casa da lista de preferência.
// =============================================================================
// SETTLEMENT — Busca fixture finalizado por data + nomes dos times.
// Usa /football/fixtures/date/{YYYY-MM-DD} (plano Pro Advanced) e tenta
// offsets ±1d. Útil para liquidação pré-live do Arena Punter.
// =============================================================================
export interface SmSettlementFixture {
  smId: number;
  homeTeam: string;
  awayTeam: string;
  goalsHome: number;
  goalsAway: number;
  status: string;          // "FT" | "HT" | etc (mapeado)
  cornersHome?: number;
  cornersAway?: number;
  htHome?: number | null;
  htAway?: number | null;
}

function smNormalize(n: string): string {
  return (n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|sc|cf|rc|ac|ss|ssc|sv|vfb|vfl|rb|bsc|afc|fk|sk|nk|rsc|ec|ad|cd|club|deportivo|sporting|sport|de|do|da|the)\b/gi, " ")
    .replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, " ");
}
function smTeamsMatch(a: string, b: string): boolean {
  const na = smNormalize(a), nb = smNormalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.includes(na)) return true;
  if (nb.length >= 4 && na.includes(nb)) return true;
  const wa = na.split(/\s+/), wb = nb.split(/\s+/);
  return wa[0] === wb[0] && wa.filter((w) => wb.includes(w) && w.length > 2).length > 0;
}

async function smFetchFixturesByDate(dateYmd: string): Promise<any[]> {
  if (!TOKEN) return [];
  const url = smUrl(`/football/fixtures/date/${dateYmd}`, {
    include: "scores;participants;state;statistics",
    per_page: "100",
  });
  try {
    const res = await resilientFetch(url, { breakerKey: "sportmonks", timeoutMs: 12_000, retries: 1 });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

function smParseFixture(f: any): SmSettlementFixture | null {
  const participants = f.participants || [];
  const home = participants.find((p: any) => p.meta?.location === "home") || participants[0];
  const away = participants.find((p: any) => p.meta?.location === "away") || participants[1];
  if (!home || !away) return null;
  const scores = f.scores || [];
  // CURRENT (placar atual / final se FT)
  let gh: number | null = null, ga: number | null = null;
  for (const s of scores) {
    const desc = String(s.description || "").toUpperCase();
    if (desc !== "CURRENT") continue;
    if (s.score?.participant === "home") gh = s.score.goals;
    if (s.score?.participant === "away") ga = s.score.goals;
  }
  if (gh === null || ga === null) {
    // fallback "FT" description
    for (const s of scores) {
      const desc = String(s.description || "").toUpperCase();
      if (desc !== "FT" && desc !== "2ND_HALF") continue;
      if (s.score?.participant === "home" && gh === null) gh = s.score.goals;
      if (s.score?.participant === "away" && ga === null) ga = s.score.goals;
    }
  }
  if (gh === null || ga === null) return null;
  const stateName = f.state?.short_name || f.state?.name || "";
  const status = mapStateToShort(stateName).short;

  // HT score (description "1ST_HALF")
  let htH: number | null = null, htA: number | null = null;
  for (const s of scores) {
    const desc = String(s.description || "").toUpperCase();
    if (desc !== "1ST_HALF") continue;
    if (s.score?.participant === "home" && htH === null) htH = Number(s.score.goals);
    if (s.score?.participant === "away" && htA === null) htA = Number(s.score.goals);
  }

  // Corners (statistics inline)
  let ch = 0, ca = 0, hasCorners = false;
  const stats = f.statistics || [];
  for (const s of stats) {
    if (s.type_id !== 34) continue; // 34 = corners
    hasCorners = true;
    const isHome = s.participant_id === home.id;
    const v = Number(s.data?.value ?? 0);
    if (isHome) ch = v; else ca = v;
  }

  return {
    smId: f.id,
    homeTeam: home.name || "",
    awayTeam: away.name || "",
    goalsHome: gh,
    goalsAway: ga,
    status,
    cornersHome: hasCorners ? ch : undefined,
    cornersAway: hasCorners ? ca : undefined,
    htHome: htH,
    htAway: htA,
  };
}

export async function findFixtureByTeamsAndDate(
  homeTeam: string,
  awayTeam: string,
  isoDate: string,
): Promise<SmSettlementFixture | null> {
  if (!TOKEN) return null;
  const baseDate = new Date(isoDate);
  if (isNaN(baseDate.getTime())) return null;
  for (const offset of [0, -1, 1]) {
    const d = new Date(baseDate);
    d.setUTCDate(d.getUTCDate() + offset);
    const ymd = d.toISOString().slice(0, 10);
    const fixtures = await smFetchFixturesByDate(ymd);
    for (const f of fixtures) {
      const parsed = smParseFixture(f);
      if (!parsed) continue;
      if (parsed.status !== "FT") continue; // só finalizados
      if (smTeamsMatch(parsed.homeTeam, homeTeam) && smTeamsMatch(parsed.awayTeam, awayTeam)) {
        return parsed;
      }
    }
  }
  return null;
}

export function extractOdds1X2(smFixture: any): OddsLive1X2 | null {
  const odds: OddRow[] = smFixture?.inplayodds || smFixture?.inplayOdds || smFixture?.inplay_odds || smFixture?.odds || [];
  if (!Array.isArray(odds) || odds.length === 0) return null;

  // Filtra Fulltime Result (1X2)
  const ft = odds.filter((o) => {
    const mid = o.market_id ?? o.marketId;
    const mname = String(o.market_description || "").toLowerCase();
    return mid === 1 || mname.includes("fulltime result") || mname.includes("match winner") || mname === "1x2";
  });
  if (ft.length === 0) return null;

  const home = pickBestForOutcome(ft, "1");
  const draw = pickBestForOutcome(ft, "X");
  const away = pickBestForOutcome(ft, "2");
  if (!home && !draw && !away) return null;

  // Bookmaker reportado: o mais frequente entre os 3 outcomes (informativo)
  const tally: Record<string, number> = {};
  for (const p of [home, draw, away]) {
    if (!p) continue;
    tally[p.bookmakerName] = (tally[p.bookmakerName] || 0) + 1;
  }
  const dominantBm = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    home: home?.value ?? null,
    draw: draw?.value ?? null,
    away: away?.value ?? null,
    bookmaker: dominantBm,
    updated_at: new Date().toISOString(),
  };
}
