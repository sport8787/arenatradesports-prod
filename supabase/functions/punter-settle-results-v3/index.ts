// =============================================================================
// MYCROFT PUNTER — Liquidação Automática v3
// Liquida sinais unificados do Arena Punter em public.punter_sinais,
// além de Plano Favorito e Eventos Raros. 3 camadas: API-Football
// (nome+data ±1d) → The Odds API. Mercados: 1X2, Over/Under, BTTS,
// Dupla Chance, AH (-1.0 a +1.5 incl. .25/.75), vitória pelo nome do time,
// escanteios Over/Under.
// =============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { findFixtureByTeamsAndDate } from "../_shared/sportmonks.ts";
import { getFutoddsEnded } from "../_shared/futoddsProvider.ts";

// Cache compartilhado por dia: 1 chamada Futodds /matches-ended por data.
const fdEndedCache = new Map<string, any[]>();
async function getFutoddsEndedByDate(dateStr: string): Promise<any[]> {
  if (fdEndedCache.has(dateStr)) return fdEndedCache.get(dateStr)!;
  try {
    const data = await getFutoddsEnded({ date: dateStr });
    fdEndedCache.set(dateStr, data || []);
    return data || [];
  } catch (e) {
    console.warn("[settle-v3] futodds /matches-ended falhou:", (e as Error)?.message);
    fdEndedCache.set(dateStr, []);
    return [];
  }
}

async function buscarPorFutoddsEnded(home: string, away: string, isoDate: string): Promise<FixtureResult | null> {
  const baseDate = new Date(isoDate);
  if (isNaN(baseDate.getTime())) return null;
  for (const offset of [0, -1, 1]) {
    const d = new Date(baseDate); d.setUTCDate(d.getUTCDate() + offset);
    const dateStr = d.toISOString().slice(0, 10);
    const list = await getFutoddsEndedByDate(dateStr);
    for (const m of list) {
      const fhome = m.home_name || m.home || "";
      const faway = m.away_name || m.away || "";
      if (!teamsMatch(fhome, home) || !teamsMatch(faway, away)) continue;
      // scores: pode vir em "scores" ("2-1") ou home_goals/away_goals
      let gh: number | null = null, ga: number | null = null;
      if (typeof m.scores === "string" && m.scores.includes("-")) {
        const [a, b] = m.scores.split("-");
        gh = Number(a); ga = Number(b);
      }
      if (gh == null || isNaN(gh)) gh = Number(m.home_goals);
      if (ga == null || isNaN(ga)) ga = Number(m.away_goals);
      if (gh == null || isNaN(gh) || ga == null || isNaN(ga)) continue;
      // corners se o provedor expuser
      const ch = Number(m.home_corners ?? m.corners_home);
      const ca = Number(m.away_corners ?? m.corners_away);
      return {
        homeTeam: fhome, awayTeam: faway,
        goalsHome: gh, goalsAway: ga,
        status: "FT",
        cornersHome: isNaN(ch) ? undefined : ch,
        cornersAway: isNaN(ca) ? undefined : ca,
      };
    }
  }
  return null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// [Fase 2 migração] API-Football removida. Liquidação usa Futodds → Sportmonks → The Odds API.
const ODDS_API_KEY = Deno.env.get("THE_ODDS_API_KEY") || "";

type Resultado = "GREEN" | "RED" | "VOID" | "MEIO_GREEN" | "MEIO_RED" | "REEMBOLSO";
interface FixtureResult {
  homeTeam: string; awayTeam: string; goalsHome: number; goalsAway: number;
  cornersHome?: number; cornersAway?: number; status: string;
}

// ───────── Normalização ─────────
function normalizeTeamName(n: string): string {
  return (n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|sc|cf|rc|ac|ss|ssc|sv|vfb|vfl|rb|bsc|afc|fk|sk|nk|rsc|ec|ad|cd|club|deportivo|sporting|sport|de|do|da|the)\b/gi, " ")
    .replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, " ");
}
function teamsMatch(a: string, b: string): boolean {
  const na = normalizeTeamName(a), nb = normalizeTeamName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.includes(na)) return true;
  if (nb.length >= 4 && na.includes(nb)) return true;
  const wa = na.split(/\s+/), wb = nb.split(/\s+/);
  return wa[0] === wb[0] && wa.filter(w => wb.includes(w) && w.length > 2).length > 0;
}

async function afFetch(_path: string, _params: Record<string, string | number>) {
  // [Fase 2 migração] API-Football desativada. Retorna null para neutralizar caminhos legados.
  return null as any;
}
function isFinished(s: string) { return ["FT", "AET", "PEN", "AWD", "WO"].includes(s); }
function parseFixture(f: any): FixtureResult | null {
  const status = f.fixture?.status?.short ?? "";
  const gh = f.goals?.home, ga = f.goals?.away;
  if (gh === null || gh === undefined || ga === null || ga === undefined) return null;
  return { homeTeam: f.teams?.home?.name ?? "", awayTeam: f.teams?.away?.name ?? "", goalsHome: gh, goalsAway: ga, status };
}

// Cache por DATA (compartilhado entre todos os sinais da execução).
// Reduz drasticamente o número de chamadas: em vez de 1 fetch por sinal,
// faz 1 fetch por dia único.
const afDateCache = new Map<string, any[] | null>();
const smDateCache = new Map<string, any | null>(); // gerenciado em outro helper se necessário

async function getAfDateFixtures(dateStr: string): Promise<any[]> {
  if (afDateCache.has(dateStr)) return afDateCache.get(dateStr) || [];
  const data = await afFetch("/fixtures", { date: dateStr, timezone: "America/Recife" });
  afDateCache.set(dateStr, data);
  return data || [];
}

async function buscarPorNomeEData(home: string, away: string, isoDate: string): Promise<{ fx: FixtureResult; fixtureId: number } | null> {
  const baseDate = new Date(isoDate);
  if (isNaN(baseDate.getTime())) return null;
  // Tenta apenas o dia exato; só recorre a ±1d se não encontrar.
  const offsets = [0, -1, 1];
  for (const offset of offsets) {
    const d = new Date(baseDate); d.setUTCDate(d.getUTCDate() + offset);
    const dateStr = d.toISOString().slice(0, 10);
    const data = await getAfDateFixtures(dateStr);
    if (!data || data.length === 0) continue;
    for (const f of data) {
      const fx = parseFixture(f);
      if (!fx || !isFinished(fx.status)) continue;
      if (teamsMatch(fx.homeTeam, home) && teamsMatch(fx.awayTeam, away)) {
        return { fx, fixtureId: f.fixture?.id };
      }
    }
  }
  return null;
}

// Busca eventos (gols/cartões) via /fixtures/events — usado para mercados de jogador
interface PlayerEvent { type: string; detail: string; playerName: string; assistName: string | null; teamName: string; }
async function fetchEvents(fixtureId: number): Promise<PlayerEvent[]> {
  const data = await afFetch("/fixtures/events", { fixture: fixtureId });
  if (!data || !Array.isArray(data)) return [];
  return data.map((e: any) => ({
    type: e.type || "",
    detail: e.detail || "",
    playerName: e.player?.name || "",
    assistName: e.assist?.name || null,
    teamName: e.team?.name || "",
  }));
}

function normalizePlayer(n: string): string {
  return (n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s\.]/g, "").trim().replace(/\s+/g, " ");
}
// "L. Höler" matches "Lucas Höler", "L Höler", etc.
function playerMatches(target: string, candidate: string): boolean {
  const t = normalizePlayer(target); const c = normalizePlayer(candidate);
  if (!t || !c) return false;
  if (t === c) return true;
  if (c.includes(t)) return true;
  // expansão de inicial: "l. holer" vira regex /^l\w*\s+holer/
  const tParts = t.split(/\s+/);
  const cParts = c.split(/\s+/);
  if (tParts.length >= 2 && cParts.length >= tParts.length) {
    let ok = true;
    for (let i = 0; i < tParts.length; i++) {
      const tp = tParts[i].replace(/\.$/, "");
      const cp = cParts[i] || "";
      if (tp.length === 1) { if (!cp.startsWith(tp)) { ok = false; break; } }
      else if (cp !== tp && !cp.includes(tp) && !tp.includes(cp)) { ok = false; break; }
    }
    if (ok) return true;
  }
  // sobrenome (último token)
  return tParts[tParts.length - 1] === cParts[cParts.length - 1] && tParts[tParts.length - 1].length >= 4;
}

function resolvePlayerMarket(market: string, events: PlayerEvent[]): Resultado | null {
  // Formatos: "L. Höler — Marcar a Qualquer Momento", "Diego Moreira — Dar Assistência"
  const m = market.toLowerCase();
  const sep = market.split(/\s+[—\-–]\s+/);
  if (sep.length < 2) return null;
  const playerName = sep[0].trim();
  const isGoal = /marcar|gol\s|to\s+score|anytime/i.test(market);
  const isAssist = /assist|assistência|assistencia/i.test(market);
  if (!isGoal && !isAssist) return null;
  if (isGoal) {
    const scored = events.some(e => /goal/i.test(e.type) && !/own goal/i.test(e.detail) && playerMatches(playerName, e.playerName));
    return scored ? "GREEN" : "RED";
  }
  // assist
  const assisted = events.some(e => /goal/i.test(e.type) && e.assistName && playerMatches(playerName, e.assistName));
  return assisted ? "GREEN" : "RED";
}

// Busca escanteios via /fixtures/statistics
async function fetchCorners(fixtureId: number): Promise<{ home: number; away: number } | null> {
  const data = await afFetch("/fixtures/statistics", { fixture: fixtureId });
  if (!data || !Array.isArray(data) || data.length < 2) return null;
  let h = 0, a = 0;
  for (const team of data) {
    const stat = (team.statistics || []).find((s: any) => /corner/i.test(s.type));
    const val = stat ? Number(stat.value) || 0 : 0;
    if (team === data[0]) h = val; else a = val;
  }
  return { home: h, away: a };
}

const ODDS_SPORTS = [
  "soccer_epl","soccer_spain_la_liga","soccer_italy_serie_a","soccer_germany_bundesliga","soccer_france_ligue_one",
  "soccer_brazil_campeonato","soccer_netherlands_eredivisie","soccer_portugal_primeira_liga","soccer_germany_bundesliga2",
  "soccer_italy_serie_b","soccer_france_ligue_two","soccer_turkey_super_league","soccer_belgium_first_div",
  "soccer_scotland_premiership","soccer_greece_super_league","soccer_saudi_pro_league","soccer_argentina_primera_division",
  "soccer_mexico_ligamx","soccer_usa_mls","soccer_uefa_champs_league","soccer_uefa_europa_league",
];
async function buscarPorOddsAPI(home: string, away: string): Promise<FixtureResult | null> {
  if (!ODDS_API_KEY) return null;
  for (const sport of ODDS_SPORTS) {
    try {
      const r = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/scores/?apiKey=${ODDS_API_KEY}&daysFrom=3`);
      if (!r.ok) continue;
      const data = await r.json() as any[];
      for (const g of data) {
        if (!g.completed || !g.scores) continue;
        if (!teamsMatch(g.home_team, home) || !teamsMatch(g.away_team, away)) continue;
        const hs = g.scores.find((s: any) => s.name === g.home_team);
        const as = g.scores.find((s: any) => s.name === g.away_team);
        if (!hs || !as) continue;
        return { homeTeam: g.home_team, awayTeam: g.away_team, goalsHome: parseInt(hs.score), goalsAway: parseInt(as.score), status: "FT" };
      }
    } catch { continue; }
  }
  return null;
}

// Cache Sportmonks por data — 1 fetch /fixtures/date/{ymd} por dia único.
// findFixtureByTeamsAndDate original faz isso internamente sem cache,
// então usamos um wrapper que serializa as chamadas por chave home|away|date
// e ainda agrupa por dia base.
const smLookupCache = new Map<string, Awaited<ReturnType<typeof findFixtureByTeamsAndDate>>>();
async function findFixtureCached(home: string, away: string, isoDate: string) {
  const key = `${normalizeTeamName(home)}|${normalizeTeamName(away)}|${isoDate.slice(0, 10)}`;
  if (smLookupCache.has(key)) return smLookupCache.get(key)!;
  const r = await findFixtureByTeamsAndDate(home, away, isoDate);
  smLookupCache.set(key, r);
  return r;
}

function calcularResultado(market: string, homeTeam: string, awayTeam: string, fx: FixtureResult): Resultado | null {
  const m = (market || "").toLowerCase().trim();
  const gh = fx.goalsHome, ga = fx.goalsAway, total = gh + ga;
  const ch = fx.cornersHome ?? 0, ca = fx.cornersAway ?? 0, totalCorners = ch + ca;
  const hasCorners = fx.cornersHome != null && fx.cornersAway != null;
  const mn = normalizeTeamName(market);
  const nh = normalizeTeamName(homeTeam), na = normalizeTeamName(awayTeam);
  const isCorners = /escante|corner/i.test(market);

  // Over/Under (escanteios ou gols)
  const ov = m.match(/over\s*(\d+(?:\.\d+)?)/);
  if (ov) {
    const t = parseFloat(ov[1]);
    if (isCorners) {
      if (!hasCorners) return null;
      return totalCorners > t ? "GREEN" : totalCorners < t ? "RED" : "VOID";
    }
    return total > t ? "GREEN" : total < t ? "RED" : "VOID";
  }
  const un = m.match(/under\s*(\d+(?:\.\d+)?)/);
  if (un) {
    const t = parseFloat(un[1]);
    if (isCorners) {
      if (!hasCorners) return null;
      return totalCorners < t ? "GREEN" : totalCorners > t ? "RED" : "VOID";
    }
    return total < t ? "GREEN" : total > t ? "RED" : "VOID";
  }

  // BTTS
  if (m.includes("ambas marcam") || /btts\s*(sim)?$/.test(m) || m === "btts" || m.includes("btts sim")) return (gh >= 1 && ga >= 1) ? "GREEN" : "RED";
  if (m.includes("btts não") || m.includes("btts nao") || m.includes("ambas não") || m.includes("ambas nao")) return (gh === 0 || ga === 0) ? "GREEN" : "RED";

  // 1X2 / Dupla chance — aceita "1X2 Casa", "1X2 - Casa"
  const m1x2 = m.replace(/^1x2\s*[-:–—]?\s*/, "").trim();
  if (m === "casa" || m === "1" || m1x2 === "casa" || /vit[óo]ria\s*casa|home win/.test(m)) return gh > ga ? "GREEN" : "RED";
  if (m === "fora" || m === "2" || m1x2 === "fora" || /vit[óo]ria\s*fora|away win/.test(m)) return ga > gh ? "GREEN" : "RED";
  if (m === "empate" || m === "x" || m === "draw" || m1x2 === "empate") return gh === ga ? "GREEN" : "RED";
  if (m.includes("1x") || m.includes("casa ou empate")) return gh >= ga ? "GREEN" : "RED";
  if (m.includes("x2") || m.includes("fora ou empate")) return ga >= gh ? "GREEN" : "RED";
  if (/\b12\b/.test(m) || m.includes("casa ou fora")) return gh !== ga ? "GREEN" : "RED";

  // Handicap Asiático — "AH +0.5 Away", "HA Casa -1.0", "Handicap -1 Home"
  const ahCasaFora = m.match(/^(?:ah|ha|handicap)\s+(casa|fora|home|away)\s*([+\-]?\d+(?:\.\d+)?)/);
  const ahPadrao = m.match(/(?:ah|ha|handicap[^\d+\-]*)\s*([+\-]?\d+(?:\.\d+)?)\s*(home|away|casa|fora)?/);
  const ah = ahCasaFora
    ? { line: parseFloat(ahCasaFora[2]), sideHint: ahCasaFora[1] }
    : ahPadrao
      ? { line: parseFloat(ahPadrao[1]), sideHint: ahPadrao[2] }
      : null;
  if (ah) {
    const { line, sideHint } = ah;
    const isHome = sideHint ? (sideHint === "home" || sideHint === "casa") : mn.includes(nh);
    const diff = isHome ? gh - ga : ga - gh;
    const adj = diff + line;
    const isQuarter = Math.abs((line * 4) % 1) > 0.001 ? false : Math.abs(line * 4) % 2 === 1;
    if (isQuarter) {
      if (adj >= 0.5) return "GREEN";
      if (adj <= -0.5) return "RED";
      if (adj > 0) return "MEIO_GREEN";
      return "MEIO_RED";
    }
    if (adj > 0) return "GREEN";
    if (adj < 0) return "RED";
    return line % 1 === 0 ? "REEMBOLSO" : "RED";
  }

  // "<Team> para vencer" / "Vitória <Team>" / nome do time direto
  const teamFromMarket = m.replace(/^vit[óo]ria\s+(de\s+|do\s+|da\s+)?/, "")
    .replace(/\s+para\s+vencer$/, "")
    .replace(/\s+vence(r)?$/, "").trim();
  const tn = normalizeTeamName(teamFromMarket);
  if (tn && nh && (tn === nh || nh.includes(tn) || (tn.length >= 4 && tn.includes(nh)))) return gh > ga ? "GREEN" : "RED";
  if (tn && na && (tn === na || na.includes(tn) || (tn.length >= 4 && tn.includes(na)))) return ga > gh ? "GREEN" : "RED";

  return null;
}

function calcPnl(res: Resultado, stake: number, odd: number): number {
  switch (res) {
    case "GREEN": return stake * (odd - 1);
    case "RED": return -stake;
    case "MEIO_GREEN": return (stake * (odd - 1)) / 2;
    case "MEIO_RED": return -stake / 2;
    case "REEMBOLSO":
    case "VOID": return 0;
  }
}
function dbResult(res: Resultado): "green" | "red" | "void" {
  if (res === "GREEN" || res === "MEIO_GREEN") return "green";
  if (res === "RED" || res === "MEIO_RED") return "red";
  return "void";
}

// ─── Resolver de fixture (sem API-Football) ──────────────────────────────
// Ordem [Fase 2 migração]:
//  1) Futodds /matches-ended (cobre 70-80% dos casos com gols/escanteios)
//  2) Sportmonks (reforço com corners + status FT)
//  3) The Odds API (fallback final)
// Mercados de jogador permanecem desabilitados; corners caem para Sportmonks.
function marketIsCorners(market: string): boolean {
  return /escante|corner/i.test(market || "");
}
async function resolveFixtureForSettlement(
  home: string, away: string, startIso: string, _market: string,
): Promise<{ fx: FixtureResult | null; fixtureId?: number; fonte: string }> {
  let fx: FixtureResult | null = null;
  let fonte = "futodds-ended";

  // 1) Futodds primeiro
  try {
    const fdEnd = await buscarPorFutoddsEnded(home, away, startIso);
    if (fdEnd) fx = fdEnd;
  } catch (_) { /* ignore */ }



  // 2) Sportmonks reforço
  if (!fx) {
    try {
      const sm = await findFixtureCached(home, away, startIso);
      if (sm) {
        fx = {
          homeTeam: sm.homeTeam, awayTeam: sm.awayTeam,
          goalsHome: sm.goalsHome, goalsAway: sm.goalsAway,
          status: sm.status,
          cornersHome: sm.cornersHome, cornersAway: sm.cornersAway,
        };
        fonte = "sportmonks";
      }
    } catch (_) { /* ignore */ }
  }

  // 3) The Odds API fallback final
  if (!fx) {
    try {
      const oa = await buscarPorOddsAPI(home, away);
      if (oa) { fx = oa; fonte = "the-odds-api"; }
    } catch (_) { /* ignore */ }
  }

  return { fx, fonte };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const [{ data: pending, error }, { data: favoritoPending, error: favoritoError }, { data: rarosPending, error: rarosError }, { data: manualPending, error: manualError }, { data: punterBetsPending, error: punterBetsError }] = await Promise.all([
    sb
      .from("punter_sinais")
      .select("id, legacy_signal_id, match_id, home_team, away_team, league, market, odd, stake_percentage, stake_amount, status, commence_time, match_date")
      .in("status", ["pending", "awaiting_stake", "stake_calculated", "confirmed"])
      .is("resultado", null)
      .eq("dismissed", false)
      .lt("commence_time", cutoff)
      .order("commence_time", { ascending: true })
      .limit(50),
    sb
      .from("sinais_favorito_prelive")
      .select("id, fixture_id, home_team, away_team, league_name, match_date, favorito, fav_odd, score_vitoria, score_over15, score_over25, resultado_vitoria, resultado_over15, resultado_over25")
      .or("resultado_vitoria.is.null,resultado_over15.is.null,resultado_over25.is.null")
      .lt("match_date", cutoff)
      .order("match_date", { ascending: true })
      .limit(50),
    sb
      .from("eventos_raros_sinais")
      .select("id, candidato_id, match_id, placar_alvo, odd_entrada, resultado, status, created_at")
      .or("resultado.is.null,resultado.eq.PENDENTE,resultado.eq.pendente")
      .order("created_at", { ascending: true })
      .limit(50),
    sb
      .from("virtual_bets_manual")
      .select("id, user_id, match_id, match_name, market, odd, stake, status, commence_time, created_at")
      .eq("status", "pending")
      .is("result", null)
      .lt("commence_time", cutoff)
      .order("commence_time", { ascending: true })
      .limit(100),
    sb
      .from("virtual_bets_punter")
      .select("id, user_id, signal_id, match_id, match_name, market, odd, stake, status, commence_time, created_at")
      .eq("status", "pending")
      .is("result", null)
      .lt("commence_time", cutoff)
      .order("commence_time", { ascending: true })
      .limit(150),
  ]);

  if (error || favoritoError || rarosError || manualError || punterBetsError) {
    return new Response(JSON.stringify({ error: (error || favoritoError || rarosError || manualError || punterBetsError)?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const items = (pending || []) as any[];
  let settled = 0, notFound = 0, unsupported = 0;
  const results: any[] = [];

  for (const s of items) {
    const home = s.home_team || "";
    const away = s.away_team || "";
    const startIso = s.commence_time || (s.match_date ? `${s.match_date}T00:00:00Z` : new Date().toISOString());

    try {
      // Resolver: Futodds → Sportmonks → Odds API (sem API-Football)
      const resolved = await resolveFixtureForSettlement(home, away, startIso, s.market);
      let fx = resolved.fx;
      const fixtureId = resolved.fixtureId; // sempre undefined (AF removida)
      let fonte = resolved.fonte;

      if (!fx) {
        notFound++;
        // Marca como VOID para não ficar pendente para sempre
        await sb.from("punter_sinais").update({
          resultado: "void",
          status: "settled",
          profit_loss: 0,
          settled_at: new Date().toISOString(),
          resulted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          fonte_liquidacao: "nao_encontrado",
          void_reason: "Jogo não encontrado em Futodds, Sportmonks ou The Odds API",
        }).eq("id", s.id);
        results.push({ id: s.id, status: "void_not_found", match: `${home} x ${away}` });
        continue;
      }

      let res = calcularResultado(s.market, home, away, fx);
      // Mercados de jogador desativados (Sportmonks não tem granularidade)
      if (!res && fixtureId && /(marcar|gol\s|to\s+score|anytime|assist|assistência|assistencia)/i.test(s.market)) {
        const events = await fetchEvents(fixtureId);
        res = resolvePlayerMarket(s.market, events);
      }

      if (!res) {
        unsupported++;
        // Mercado não suportado → marca VOID definitivo
        await sb.from("punter_sinais").update({
          resultado: "void",
          status: "settled",
          profit_loss: 0,
          score_home: fx.goalsHome, score_away: fx.goalsAway,
          final_score_home: fx.goalsHome, final_score_away: fx.goalsAway,
          settled_at: new Date().toISOString(),
          resulted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          fonte_liquidacao: fonte,
          void_reason: `Mercado não suportado pela liquidação automática: ${s.market}`,
        }).eq("id", s.id);
        results.push({ id: s.id, status: "void_unsupported", market: s.market, score: `${fx.goalsHome}-${fx.goalsAway}` });
        continue;
      }

      const stake = Number(s.stake_amount) || Number(s.stake_percentage) || 1;
      const profit = calcPnl(res, stake, Number(s.odd));
      const dbR = dbResult(res);

      await sb.from("punter_sinais").update({
        resultado: dbR,
        status: "settled",
        final_score_home: fx.goalsHome,
        final_score_away: fx.goalsAway,
        profit_loss: Number(profit.toFixed(2)),
        resulted_at: new Date().toISOString(),
        settled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        fonte_liquidacao: fonte,
      }).eq("id", s.id);

      // Cascata virtual_bets_punter
      try {
        const { data: vbp } = await sb.from("virtual_bets_punter")
          .select("id, stake, odd").in("signal_id", [s.id, s.legacy_signal_id].filter(Boolean)).eq("status", "pending");
        for (const b of (vbp || [])) {
          const bp = calcPnl(res, Number(b.stake) || 0, Number(b.odd) || Number(s.odd));
          await sb.from("virtual_bets_punter").update({
            status: "settled", result: dbR, profit_loss: bp,
            score_home: fx.goalsHome, score_away: fx.goalsAway, updated_at: new Date().toISOString(),
          }).eq("id", b.id);
        }
      } catch (e) { console.error("cascade err:", e); }

      settled++;
      results.push({
        id: s.id, match: `${home} ${fx.goalsHome}-${fx.goalsAway} ${away}`,
        market: s.market, result: res, fonte, pnl: profit, source: "punter_sinais",
      });
    } catch (e) {
      console.error("err signal", s.id, e);
      results.push({ id: s.id, status: "error", error: String(e) });
    }
  }

  for (const s of (favoritoPending || []) as any[]) {
    const home = s.home_team || "";
    const away = s.away_team || "";
    const startIso = s.match_date || new Date().toISOString();

    try {
      // Favorito não tem mercado de jogador/escanteios — Futodds resolve direto
      const resolved = await resolveFixtureForSettlement(home, away, startIso, "favorito_pre");
      let fx = resolved.fx;
      let fonte = resolved.fonte;

      if (!fx) {
        notFound++;
        results.push({ id: s.id, status: "fixture_not_found", match: `${home} x ${away}`, source: "sinais_favorito_prelive" });
        continue;
      }

      const favorito = String(s.favorito || "");
      const mercadoVitoria = favorito && normalizeTeamName(favorito) === normalizeTeamName(home) ? "casa" : "fora";
      const updates: Record<string, string> = {};

      if (s.resultado_vitoria == null) updates.resultado_vitoria = dbResult(calcularResultado(mercadoVitoria, home, away, fx) || "VOID").toUpperCase();
      if (s.resultado_over15 == null) updates.resultado_over15 = dbResult(calcularResultado("over 1.5", home, away, fx) || "VOID").toUpperCase();
      if (s.resultado_over25 == null) updates.resultado_over25 = dbResult(calcularResultado("over 2.5", home, away, fx) || "VOID").toUpperCase();

      await sb.from("sinais_favorito_prelive").update({
        ...updates,
        gols_ft: fx.goalsHome + fx.goalsAway,
        fav_venceu: favorito ? normalizeTeamName(favorito) === normalizeTeamName(home) ? fx.goalsHome > fx.goalsAway : fx.goalsAway > fx.goalsHome : null,
        updated_at: new Date().toISOString(),
      }).eq("id", s.id);

      settled++;
      results.push({ id: s.id, match: `${home} ${fx.goalsHome}-${fx.goalsAway} ${away}`, source: "sinais_favorito_prelive", updates, fonte });
    } catch (e) {
      console.error("err favorito", s.id, e);
      results.push({ id: s.id, status: "error", error: String(e), source: "sinais_favorito_prelive" });
    }
  }

  if ((rarosPending || []).length) {
    const candidatoIds = Array.from(new Set((rarosPending || []).map((r: any) => r.candidato_id).filter(Boolean)));
    let candidatosMap = new Map<string, any>();
    if (candidatoIds.length) {
      const { data: candidatos } = await sb
        .from("eventos_raros_candidatos")
        .select("id, home_team, away_team, league_name, match_date")
        .in("id", candidatoIds);
      candidatosMap = new Map((candidatos || []).map((c: any) => [c.id, c]));
    }

    for (const s of (rarosPending || []) as any[]) {
      const c = candidatosMap.get(s.candidato_id);
      const home = c?.home_team || "";
      const away = c?.away_team || "";
      const startIso = c?.match_date || s.created_at || new Date().toISOString();

      try {
        const resolved = await resolveFixtureForSettlement(home, away, startIso, "eventos_raros_lay");
        let fx = resolved.fx;
        let fonte = resolved.fonte;
        if (!fx) {
          notFound++;
          results.push({ id: s.id, status: "fixture_not_found", match: `${home} x ${away}`, source: "eventos_raros_sinais" });
          continue;
        }

        // LAY = perde se o placar exato/condição alvo acontecer
        const gh = fx.goalsHome, ga = fx.goalsAway;
        const alvo = String(s.placar_alvo || "").toLowerCase();
        let resultadoRaro: "GREEN" | "RED" | null = null;
        if (/lay_2x2/.test(alvo))         resultadoRaro = (gh === 2 && ga === 2) ? "RED" : "GREEN";
        else if (/lay_1x3/.test(alvo))    resultadoRaro = (gh === 1 && ga === 3) ? "RED" : "GREEN";
        else if (/lay_3x1/.test(alvo))    resultadoRaro = (gh === 3 && ga === 1) ? "RED" : "GREEN";
        else if (/lay_goleada/.test(alvo))resultadoRaro = (Math.abs(gh - ga) >= 3) ? "RED" : "GREEN";

        if (!resultadoRaro) {
          unsupported++;
          results.push({ id: s.id, status: "market_unsupported", market: s.placar_alvo, source: "eventos_raros_sinais" });
          continue;
        }

        // PnL simulado: LAY com 1u de liability. GREEN = +1, RED = -(odd-1)
        const oddLay = Number(s.odd_entrada) || 2;
        const pl = resultadoRaro === "GREEN" ? 1 : -(oddLay - 1);

        await sb.from("eventos_raros_sinais").update({
          resultado: resultadoRaro,
          status: "ENCERRADO",
          placar_saida: `${fx.goalsHome}x${fx.goalsAway}`,
          motivo_saida: "Liquidação automática",
          profit_loss: Number(pl.toFixed(2)),
          updated_at: new Date().toISOString(),
        }).eq("id", s.id);

        settled++;
        results.push({ id: s.id, match: `${home} ${fx.goalsHome}-${fx.goalsAway} ${away}`, source: "eventos_raros_sinais", result: resultadoRaro, fonte });
      } catch (e) {
        console.error("err raro", s.id, e);
        results.push({ id: s.id, status: "error", error: String(e), source: "eventos_raros_sinais" });
      }
    }
  }

  // ====== Helper compartilhado: liquida uma aposta de virtual_bets_{manual|punter} ======
  async function settleVirtualBet(table: "virtual_bets_manual" | "virtual_bets_punter", b: any) {
    const parts = String(b.match_name || "").split(/\s+vs\s+/i);
    const home = parts[0]?.trim() || "";
    const away = parts[1]?.trim() || "";
    const startIso = b.commence_time || b.created_at || new Date().toISOString();

    if (!home || !away) {
      results.push({ id: b.id, status: "no_teams", source: table });
      return;
    }

    try {
      const resolved = await resolveFixtureForSettlement(home, away, startIso, b.market || "");
      let fx = resolved.fx;
      const fixtureId = resolved.fixtureId;
      let fonte = resolved.fonte;
      if (!fx) {
        notFound++;
        // Marca como void para não ficar pendente para sempre se já passou >24h
        const ageHours = (Date.now() - new Date(startIso).getTime()) / 36e5;
        if (ageHours > 24) {
          await sb.from(table).update({
            status: "settled", result: "void", profit_loss: 0,
            updated_at: new Date().toISOString(),
          }).eq("id", b.id);
        }
        results.push({ id: b.id, status: "fixture_not_found", match: `${home} x ${away}`, source: table, voided: ageHours > 24 });
        return;
      }

      // Escanteios / mercados de jogador via AF — desativado (Fase 2 migração).
      // Corners agora vêm de Futodds/Sportmonks; mercados de jogador estão off.
      let res = calcularResultado(b.market, home, away, fx);

      if (!res && fixtureId && /(marcar|gol\s|to\s+score|anytime|assist|assistência|assistencia)/i.test(b.market)) {
        const events = await fetchEvents(fixtureId);
        res = resolvePlayerMarket(b.market, events);
      }



      if (!res) {
        unsupported++;
        // void após 24h para não ficar pendente eternamente
        const ageHours = (Date.now() - new Date(startIso).getTime()) / 36e5;
        if (ageHours > 24) {
          await sb.from(table).update({
            status: "settled", result: "void", profit_loss: 0,
            score_home: fx.goalsHome, score_away: fx.goalsAway,
            updated_at: new Date().toISOString(),
          }).eq("id", b.id);
        }
        results.push({ id: b.id, status: "market_unsupported", market: b.market, source: table, voided: ageHours > 24 });
        return;
      }

      const stake = Number(b.stake) || 0;
      const odd = Number(b.odd) || 0;
      const pl = calcPnl(res, stake, odd);
      const dbR = dbResult(res);

      await sb.from(table).update({
        status: "settled",
        result: dbR,
        profit_loss: Number(pl.toFixed(2)),
        score_home: fx.goalsHome,
        score_away: fx.goalsAway,
        updated_at: new Date().toISOString(),
      }).eq("id", b.id);

      settled++;
      results.push({ id: b.id, match: `${home} ${fx.goalsHome}-${fx.goalsAway} ${away}`, market: b.market, result: res, fonte, pnl: pl, source: table });
    } catch (e) {
      console.error("err bet", table, b.id, e);
      results.push({ id: b.id, status: "error", error: String(e), source: table });
    }
  }

  for (const b of (manualPending || []) as any[]) {
    await settleVirtualBet("virtual_bets_manual", b);
  }
  for (const b of (punterBetsPending || []) as any[]) {
    await settleVirtualBet("virtual_bets_punter", b);
  }

  return new Response(
    JSON.stringify({
      success: true,
      checked: items.length,
      settled,
      not_found: notFound,
      unsupported,
      af_dates_fetched: afDateCache.size,
      sm_lookups_cached: smLookupCache.size,
      results,
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
