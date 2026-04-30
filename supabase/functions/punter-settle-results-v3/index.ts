// =============================================================================
// MYCROFT PUNTER — Liquidação Automática v3
// Liquida punter_signals (pending/awaiting_stake) usando punter_analyses para
// recuperar home/away/league. 3 camadas: API-Football (nome+data ±1d) → The Odds API.
// Mercados: 1X2, Over/Under, BTTS, Dupla Chance, AH (-1.0 a +1.5 incl. .25/.75),
// vitória pelo nome do time, escanteios Over/Under.
// Resultado salvo conforme constraint do BD: GREEN/RED (e green/red em punter_signals).
// =============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_FOOTBALL_KEY = Deno.env.get("API_FOOTBALL_KEY")!;
const ODDS_API_KEY = Deno.env.get("THE_ODDS_API_KEY") || "";
const AF_BASE = "https://v3.football.api-sports.io";

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

async function afFetch(path: string, params: Record<string, string | number>) {
  const url = new URL(`${AF_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  try {
    const r = await fetch(url.toString(), { headers: { "x-apisports-key": API_FOOTBALL_KEY } });
    if (!r.ok) return null;
    const d = await r.json();
    return d.response ?? null;
  } catch { return null; }
}
function isFinished(s: string) { return ["FT", "AET", "PEN", "AWD", "WO"].includes(s); }
function parseFixture(f: any): FixtureResult | null {
  const status = f.fixture?.status?.short ?? "";
  const gh = f.goals?.home, ga = f.goals?.away;
  if (gh === null || gh === undefined || ga === null || ga === undefined) return null;
  return { homeTeam: f.teams?.home?.name ?? "", awayTeam: f.teams?.away?.name ?? "", goalsHome: gh, goalsAway: ga, status };
}

async function buscarPorNomeEData(home: string, away: string, isoDate: string): Promise<{ fx: FixtureResult; fixtureId: number } | null> {
  const baseDate = new Date(isoDate);
  for (const offset of [0, -1, 1]) {
    const d = new Date(baseDate); d.setUTCDate(d.getUTCDate() + offset);
    const dateStr = d.toISOString().slice(0, 10);
    const data = await afFetch("/fixtures", { date: dateStr, timezone: "America/Recife" });
    if (!data) continue;
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

  // 1X2 / Dupla chance
  if (m === "casa" || m === "1" || /vit[óo]ria\s*casa|home win/.test(m)) return gh > ga ? "GREEN" : "RED";
  if (m === "fora" || m === "2" || /vit[óo]ria\s*fora|away win/.test(m)) return ga > gh ? "GREEN" : "RED";
  if (m === "empate" || m === "x" || m === "draw") return gh === ga ? "GREEN" : "RED";
  if (m.includes("1x") || m.includes("casa ou empate")) return gh >= ga ? "GREEN" : "RED";
  if (m.includes("x2") || m.includes("fora ou empate")) return ga >= gh ? "GREEN" : "RED";
  if (/\b12\b/.test(m) || m.includes("casa ou fora")) return gh !== ga ? "GREEN" : "RED";

  // Handicap Asiático
  const ah = m.match(/(?:ah|handicap[^\d+\-]*)\s*([+\-]?\d+(?:\.\d+)?)\s*(home|away|casa|fora)?/);
  if (ah) {
    const line = parseFloat(ah[1]);
    const sideHint = ah[2];
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

  // Vitória pelo nome do time
  if (nh && (mn === nh || mn.includes(nh))) return gh > ga ? "GREEN" : "RED";
  if (na && (mn === na || mn.includes(na))) return ga > gh ? "GREEN" : "RED";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // Busca punter_signals pendentes (incluindo awaiting_stake) já com analise vinculada
  const { data: pending, error } = await sb
    .from("punter_signals")
    .select(`
      id, match_id, market, odd, stake_percentage, stake_amount, status, commence_time, match_date,
      analysis_id,
      punter_analyses!inner ( id, home_team, away_team, league, commence_time )
    `)
    .in("status", ["pending", "awaiting_stake"])
    .is("result", null)
    .lt("commence_time", cutoff)
    .order("commence_time", { ascending: true })
    .limit(200);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const items = (pending || []) as any[];
  let settled = 0, notFound = 0, unsupported = 0;
  const results: any[] = [];

  for (const s of items) {
    const a = s.punter_analyses;
    const home = a?.home_team || "";
    const away = a?.away_team || "";
    const startIso = s.commence_time || a?.commence_time || (s.match_date ? `${s.match_date}T00:00:00Z` : new Date().toISOString());

    try {
      // 1) API-Football
      let fx: FixtureResult | null = null;
      let fonte = "api-football";
      let fixtureId: number | undefined;
      const af = await buscarPorNomeEData(home, away, startIso);
      if (af) { fx = af.fx; fixtureId = af.fixtureId; }

      // 2) Se mercado de escanteios e temos fixtureId, busca corners
      if (fx && fixtureId && /escante|corner/i.test(s.market)) {
        const c = await fetchCorners(fixtureId);
        if (c) { fx.cornersHome = c.home; fx.cornersAway = c.away; }
      }

      // 3) Fallback Odds API
      if (!fx) { fx = await buscarPorOddsAPI(home, away); fonte = "the-odds-api"; }

      if (!fx) {
        notFound++;
        results.push({ id: s.id, status: "fixture_not_found", match: `${home} x ${away}` });
        continue;
      }

      const res = calcularResultado(s.market, home, away, fx);
      if (!res) {
        unsupported++;
        // salva placar mesmo sem liquidar
        await sb.from("punter_signals").update({
          score_home: fx.goalsHome, score_away: fx.goalsAway, updated_at: new Date().toISOString(),
        }).eq("id", s.id);
        results.push({ id: s.id, status: "market_unsupported", market: s.market, score: `${fx.goalsHome}-${fx.goalsAway}` });
        continue;
      }

      const stake = Number(s.stake_amount) || Number(s.stake_percentage) || 1;
      const profit = calcPnl(res, stake, Number(s.odd));
      const dbR = dbResult(res);

      // Atualiza punter_signals
      await sb.from("punter_signals").update({
        result: dbR,
        status: "settled",
        score_home: fx.goalsHome,
        score_away: fx.goalsAway,
        profit_loss: Number(profit.toFixed(2)),
        resulted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", s.id);

      // Atualiza punter_analyses (constraint aceita GREEN/RED/VOID)
      if (s.analysis_id) {
        await sb.from("punter_analyses").update({
          result: dbR.toUpperCase(),
          final_score_home: fx.goalsHome,
          final_score_away: fx.goalsAway,
          settled_at: new Date().toISOString(),
          profit_loss: Number(profit.toFixed(4)),
        }).eq("id", s.analysis_id).is("result", null);
      }

      // Cascata virtual_bets_punter
      try {
        const { data: vbp } = await sb.from("virtual_bets_punter")
          .select("id, stake, odd").eq("signal_id", s.id).eq("status", "pending");
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
        market: s.market, result: res, fonte, pnl: profit,
      });
    } catch (e) {
      console.error("err signal", s.id, e);
      results.push({ id: s.id, status: "error", error: String(e) });
    }
  }

  return new Response(
    JSON.stringify({ success: true, checked: items.length, settled, not_found: notFound, unsupported, results }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
