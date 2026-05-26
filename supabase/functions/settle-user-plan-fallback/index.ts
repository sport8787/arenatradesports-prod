// Liquida sinais pendentes 1X2 / OVER_UNDER / BTTS do "Meu Plano" do Trader Sports
// usando Futodds (matches-ended por data) → Sportmonks (findFixtureByTeamsAndDate)
// como fontes de fallback quando live_matches está incompleto/stale.
// Escopo: usuário liquida apenas o próprio histórico; admin liquida todos.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { findFixtureByTeamsAndDate } from "../_shared/sportmonks.ts";
import { getFutoddsEnded } from "../_shared/futoddsProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const BTTS_FALLBACK_ODD = 1.82;

function normalize(n: string) {
  return (n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|sc|cf|rc|ac|ss|ssc|sv|vfb|vfl|rb|bsc|afc|fk|sk|nk|rsc|ec|ad|cd|club|deportivo|sporting|sport|de|do|da|the|w|fem|feminino|feminina)\b/gi, " ")
    .replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, " ");
}
function teamsMatch(a: string, b: string): boolean {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.includes(na)) return true;
  if (nb.length >= 4 && na.includes(nb)) return true;
  const wa = na.split(/\s+/), wb = nb.split(/\s+/);
  return wa[0] === wb[0] && wa.filter((w) => wb.includes(w) && w.length > 2).length > 0;
}

interface FinalScore { home: number; away: number; source: string; }

const fdCache = new Map<string, any[]>();
async function fdEnded(dateStr: string): Promise<any[]> {
  if (fdCache.has(dateStr)) return fdCache.get(dateStr)!;
  try { const list = await getFutoddsEnded({ date: dateStr }); fdCache.set(dateStr, list || []); return list || []; }
  catch { fdCache.set(dateStr, []); return []; }
}

function findInFutodds(list: any[], home: string, away: string): FinalScore | null {
  for (const m of list) {
    const fh = m.home_name || m.home || ""; const fa = m.away_name || m.away || "";
    if (!teamsMatch(fh, home) || !teamsMatch(fa, away)) continue;
    let gh = NaN, ga = NaN;
    if (m.score && typeof m.score === "object") {
      gh = Number(m.score.ft_home); ga = Number(m.score.ft_away);
    }
    if (isNaN(gh) && typeof m.scores === "string" && m.scores.includes("-")) {
      const [x, y] = m.scores.split("-"); gh = Number(x); ga = Number(y);
    }
    if (isNaN(gh)) gh = Number(m.home_goals);
    if (isNaN(ga)) ga = Number(m.away_goals);
    if (isNaN(gh) || isNaN(ga)) continue;
    return { home: gh, away: ga, source: "futodds" };
  }
  return null;
}

async function lookupScore(home: string, away: string, isoDate: string): Promise<FinalScore | null> {
  const base = new Date(isoDate); if (isNaN(base.getTime())) return null;
  for (const off of [0, -1, 1]) {
    const d = new Date(base); d.setUTCDate(d.getUTCDate() + off);
    const ymd = d.toISOString().slice(0, 10);
    const list = await fdEnded(ymd);
    const hit = findInFutodds(list, home, away);
    if (hit) return hit;
  }
  try {
    const f = await findFixtureByTeamsAndDate(home, away, isoDate);
    if (!f) return null;
    if (f.goalsHome == null || f.goalsAway == null) return null;
    return { home: Number(f.goalsHome), away: Number(f.goalsAway), source: "sportmonks" };
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing_authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_jwt" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const uid = userData.user.id;
    const svc = createClient(SUPABASE_URL, SVC_KEY);
    const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", uid);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");

    // Cutoff: só tenta liquidar jogos que já deveriam ter encerrado (>3h após placed_at)
    const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    let q = svc.from("user_trader_plan_signals")
      .select("id,user_id,match_id,market,outcome,line,selected_odd,placed_at,match_name")
      .eq("status", "pending")
      .in("market", ["1x2", "over_under", "btts"])
      .lt("placed_at", cutoff)
      .limit(500);
    if (!isAdmin) q = q.eq("user_id", uid);
    const { data: signals, error: sErr } = await q;
    if (sErr) throw sErr;
    if (!signals?.length) {
      return new Response(JSON.stringify({ settled: 0, no_data: 0, total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const matchIds = Array.from(new Set(signals.map((s: any) => s.match_id)));
    const { data: lm } = await svc.from("live_matches")
      .select("match_id,home_team,away_team,score_home,score_away,status,updated_at,created_at,commence_time")
      .in("match_id", matchIds);
    const byId = new Map((lm ?? []).map((m: any) => [m.match_id, m]));

    const scoreCache = new Map<string, FinalScore | null>();
    async function getScore(s: any): Promise<FinalScore | null> {
      if (scoreCache.has(s.match_id)) return scoreCache.get(s.match_id)!;
      const m = byId.get(s.match_id);
      // 1) se live_matches já tem placar final, usa direto
      if (m && m.status === "finished" && m.score_home != null && m.score_away != null) {
        const fs = { home: Number(m.score_home), away: Number(m.score_away), source: "live_matches" };
        scoreCache.set(s.match_id, fs); return fs;
      }
      // 2) fallback Futodds → Sportmonks (usa nomes da live_matches OU do match_name "Casa x Fora")
      let home = m?.home_team as string | undefined;
      let away = m?.away_team as string | undefined;
      if ((!home || !away) && typeof s.match_name === "string" && s.match_name.includes(" x ")) {
        const parts = s.match_name.split(" x ");
        home = home ?? parts[0]?.trim(); away = away ?? parts[1]?.trim();
      }
      const iso = (m?.commence_time || m?.updated_at || m?.created_at || s.placed_at) as string;
      if (!home || !away || !iso) { scoreCache.set(s.match_id, null); return null; }
      const fs = await lookupScore(home, away, iso);
      scoreCache.set(s.match_id, fs); return fs;
    }

    let settled = 0, noData = 0, skipped = 0;
    for (const s of signals as any[]) {
      const fs = await getScore(s);
      if (!fs) { noData++; continue; }
      const gh = fs.home, ga = fs.away, tot = gh + ga;
      const market = s.market, outcome = String(s.outcome || "").toLowerCase();
      let won: boolean | null = null;
      if (market === "1x2") {
        if (outcome === "home")  won = gh >  ga;
        else if (outcome === "away") won = ga >  gh;
        else if (outcome === "draw") won = gh === ga;
      } else if (market === "over_under") {
        const line = Number(s.line ?? 2.5);
        if (outcome === "over")  won = tot >  line;
        else if (outcome === "under") won = tot <  line;
      } else if (market === "btts") {
        if (outcome === "yes") won = gh > 0 && ga > 0;
        else if (outcome === "no")  won = gh === 0 || ga === 0;
      }
      if (won == null) { skipped++; continue; }
      const odd = Number(s.selected_odd ?? (market === "btts" ? BTTS_FALLBACK_ODD : 1));
      const pnl = won ? Number((odd - 1).toFixed(4)) : -1;
      const { error: uErr } = await svc.from("user_trader_plan_signals")
        .update({ status: won ? "green" : "red", profit_loss: pnl, settled_at: new Date().toISOString() })
        .eq("id", s.id).eq("status", "pending");
      if (!uErr) settled++;
    }

    return new Response(
      JSON.stringify({ settled, no_data: noData, skipped, total: signals.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[settle-user-plan-fallback]", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
