// =============================================================================
// MYCROFT PUNTER — Liquidação Automática v3 (adaptada ao schema do projeto)
// Tabelas: punter_analyses (APROVADO/APROVADO_SITUACIONAL/LABAREDA), eventos_raros_sinais
// 3 camadas: API-Football por nome+data → Odds API → fallback
// Mercados: 1X2, Over/Under, BTTS, AH (-1.0 a +1.5), vitória por nome do time
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
const ODDS_API_KEY = Deno.env.get("THE_ODDS_API_KEY") || Deno.env.get("ODDS_API_KEY") || "";
const AF_BASE = "https://v3.football.api-sports.io";

type Resultado = "GREEN" | "RED" | "VOID" | "MEIO_GREEN" | "MEIO_RED" | "REEMBOLSO";
interface FixtureResult {
  homeTeam: string; awayTeam: string; goalsHome: number; goalsAway: number; status: string;
}

// ───────── Normalização ─────────
function normalizeTeamName(n: string): string {
  return n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
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

// ───────── API-Football ─────────
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
async function buscarPorNomeEData(home: string, away: string, isoDate: string): Promise<FixtureResult | null> {
  const localDate = new Date(isoDate).toLocaleDateString("en-CA", { timeZone: "America/Recife" });
  // tenta data local e ±1 dia
  for (const offset of [0, -1, 1]) {
    const d = new Date(localDate); d.setUTCDate(d.getUTCDate() + offset);
    const dateStr = d.toISOString().slice(0, 10);
    const data = await afFetch("/fixtures", { date: dateStr, timezone: "America/Recife" });
    if (!data) continue;
    for (const f of data) {
      const fx = parseFixture(f);
      if (!fx || !isFinished(fx.status)) continue;
      if (teamsMatch(fx.homeTeam, home) && teamsMatch(fx.awayTeam, away)) return fx;
    }
  }
  return null;
}

// ───────── The Odds API (fallback) ─────────
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

// ───────── Cálculo do mercado ─────────
function calcularResultado(market: string, homeTeam: string, awayTeam: string, fx: FixtureResult): Resultado | null {
  const m = market.toLowerCase().trim();
  const gh = fx.goalsHome, ga = fx.goalsAway, total = gh + ga;
  const mn = normalizeTeamName(market);
  const nh = normalizeTeamName(homeTeam), na = normalizeTeamName(awayTeam);

  // Over / Under
  const ov = m.match(/over\s*(\d+(?:\.\d+)?)/);
  if (ov) { const t = parseFloat(ov[1]); return total > t ? "GREEN" : total < t ? "RED" : "VOID"; }
  const un = m.match(/under\s*(\d+(?:\.\d+)?)/);
  if (un) { const t = parseFloat(un[1]); return total < t ? "GREEN" : total > t ? "RED" : "VOID"; }

  // BTTS
  if (m.includes("ambas marcam") || /btts\s*(sim)?$/.test(m) || m === "btts" || m.includes("btts sim")) return (gh >= 1 && ga >= 1) ? "GREEN" : "RED";
  if (m.includes("btts não") || m.includes("btts nao") || m.includes("ambas não marcam") || m.includes("ambas nao marcam")) return (gh === 0 || ga === 0) ? "GREEN" : "RED";

  // 1X2 / Dupla chance
  if (m === "casa" || m === "1" || /vitória\s*casa|vitoria\s*casa|home win/.test(m)) return gh > ga ? "GREEN" : "RED";
  if (m === "fora" || m === "2" || /vitória\s*fora|vitoria\s*fora|away win/.test(m)) return ga > gh ? "GREEN" : "RED";
  if (m === "empate" || m === "x" || m === "draw") return gh === ga ? "GREEN" : "RED";
  if (m.includes("1x") || m.includes("casa ou empate")) return gh >= ga ? "GREEN" : "RED";
  if (m.includes("x2") || m.includes("fora ou empate")) return ga >= gh ? "GREEN" : "RED";
  if (m.includes("12") || m.includes("casa ou fora")) return gh !== ga ? "GREEN" : "RED";

  // Handicap Asiático
  const ah = m.match(/(?:ah|handicap[^\d+\-]*)\s*([+\-]?\d+(?:\.\d+)?)\s*(home|away|casa|fora)?/);
  if (ah) {
    const line = parseFloat(ah[1]);
    const sideHint = ah[2];
    const isHome = sideHint ? (sideHint === "home" || sideHint === "casa") : mn.includes(nh);
    const diff = isHome ? gh - ga : ga - gh;
    const adj = diff + line;
    // Linhas 1/4 (0.25, 0.75): split → mapeamos para MEIO_GREEN/MEIO_RED
    const frac = Math.abs(line * 4) % 4;
    if (frac === 1 || frac === 3) {
      // .25 ou .75
      if (adj > 0.5) return "GREEN";
      if (adj < -0.5) return "RED";
      if (adj === 0.25 || adj === 0.5) return "MEIO_GREEN";
      if (adj === -0.25 || adj === -0.5) return "MEIO_RED";
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

function pnl(res: Resultado, stakeUnits: number, odd: number): number {
  switch (res) {
    case "GREEN": return stakeUnits * (odd - 1);
    case "RED": return -stakeUnits;
    case "MEIO_GREEN": return (stakeUnits * (odd - 1)) / 2;
    case "MEIO_RED": return -stakeUnits / 2;
    case "REEMBOLSO":
    case "VOID": return 0;
  }
}
// Normaliza para o constraint do BD (GREEN/RED/VOID)
function dbResult(res: Resultado): "GREEN" | "RED" | "VOID" {
  if (res === "MEIO_GREEN") return "GREEN";
  if (res === "MEIO_RED") return "RED";
  if (res === "REEMBOLSO") return "VOID";
  return res;
}

// ───────── Handler ─────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: pending, error } = await sb
    .from("punter_analyses")
    .select("id, match_id, home_team, away_team, league, commence_time, market, odd, stake_percentage, settle_attempts")
    .in("verdict", ["APROVADO", "APROVADO_SITUACIONAL", "LABAREDA"])
    .is("result", null)
    .lt("commence_time", cutoff)
    .lt("settle_attempts", 30)
    .order("commence_time", { ascending: true })
    .limit(200);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const items = pending || [];
  let settled = 0, notFound = 0, unsupported = 0;
  const results: any[] = [];

  for (const a of items) {
    try {
      let fx = await buscarPorNomeEData(a.home_team, a.away_team, a.commence_time);
      let fonte = "api-football";
      if (!fx) { fx = await buscarPorOddsAPI(a.home_team, a.away_team); fonte = "the-odds-api"; }

      await sb.from("punter_analyses").update({
        settle_attempts: (a.settle_attempts || 0) + 1,
        last_settle_attempt_at: new Date().toISOString(),
      }).eq("id", a.id);

      if (!fx) { notFound++; results.push({ id: a.id, status: "fixture_not_found", match: `${a.home_team} x ${a.away_team}` }); continue; }

      const res = calcularResultado(a.market, a.home_team, a.away_team, fx);
      if (!res) {
        unsupported++;
        await sb.from("punter_analyses").update({ final_score_home: fx.goalsHome, final_score_away: fx.goalsAway }).eq("id", a.id);
        results.push({ id: a.id, status: "market_unsupported", market: a.market, score: `${fx.goalsHome}-${fx.goalsAway}` });
        continue;
      }

      const stake = a.stake_percentage ?? 1;
      const profit = pnl(res, stake, Number(a.odd));

      await sb.from("punter_analyses").update({
        result: dbResult(res),
        final_score_home: fx.goalsHome,
        final_score_away: fx.goalsAway,
        settled_at: new Date().toISOString(),
        profit_loss: Number(profit.toFixed(4)),
      }).eq("id", a.id);

      // Cascata virtual_bets
      try {
        const lower = dbResult(res).toLowerCase();
        const { data: vbp } = await sb.from("virtual_bets_punter").select("id, stake, odd").eq("analysis_id", a.id).eq("status", "pending");
        for (const b of (vbp || [])) {
          const bp = pnl(res, Number(b.stake) || 0, Number(b.odd) || Number(a.odd));
          await sb.from("virtual_bets_punter").update({
            status: "settled", result: lower, profit_loss: bp,
            score_home: fx.goalsHome, score_away: fx.goalsAway, updated_at: new Date().toISOString(),
          }).eq("id", b.id);
        }
        const { data: vbm } = await sb.from("virtual_bets_manual").select("id, stake, odd, market").eq("match_id", a.match_id).eq("status", "pending");
        for (const b of (vbm || [])) {
          if (normalizeTeamName(b.market || "") !== normalizeTeamName(a.market)) continue;
          const bp = pnl(res, Number(b.stake) || 0, Number(b.odd) || Number(a.odd));
          await sb.from("virtual_bets_manual").update({
            status: "settled", result: lower, profit_loss: bp,
            score_home: fx.goalsHome, score_away: fx.goalsAway, updated_at: new Date().toISOString(),
          }).eq("id", b.id);
        }
      } catch (e) { console.error("cascade err:", e); }

      settled++;
      results.push({ id: a.id, match: `${a.home_team} ${fx.goalsHome}-${fx.goalsAway} ${a.away_team}`, market: a.market, result: res, fonte, pnl: profit });
    } catch (e) {
      results.push({ id: a.id, status: "error", error: String(e) });
    }
  }

  return new Response(JSON.stringify({ success: true, checked: items.length, settled, not_found: notFound, unsupported, results }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
