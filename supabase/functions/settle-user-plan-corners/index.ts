// Liquida sinais pendentes de ESCANTEIOS do "Meu Plano" do Trader Sports.
// Busca total de escanteios via Futodds (matches-ended por data) → Sportmonks
// (findFixtureByTeamsAndDate). Escopo: o próprio usuário; admin liquida todos.
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

function normalize(n: string) {
  return (n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|sc|cf|rc|ac|ss|ssc|sv|vfb|vfl|rb|bsc|afc|fk|sk|nk|rsc|ec|ad|cd|club|deportivo|sporting|sport|de|do|da|the)\b/gi, " ")
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

// Cache por dia da resposta /matches-ended (1 chamada por data única)
const fdCache = new Map<string, any[]>();
async function fdEnded(dateStr: string): Promise<any[]> {
  if (fdCache.has(dateStr)) return fdCache.get(dateStr)!;
  try {
    const list = await getFutoddsEnded({ date: dateStr });
    fdCache.set(dateStr, list || []);
    return list || [];
  } catch {
    fdCache.set(dateStr, []);
    return [];
  }
}

async function lookupCornersFutodds(home: string, away: string, isoDate: string): Promise<number | null> {
  const base = new Date(isoDate);
  if (isNaN(base.getTime())) return null;
  for (const off of [0, -1, 1]) {
    const d = new Date(base); d.setUTCDate(d.getUTCDate() + off);
    const ymd = d.toISOString().slice(0, 10);
    const list = await fdEnded(ymd);
    for (const m of list) {
      const fh = m.home_name || m.home || "";
      const fa = m.away_name || m.away || "";
      if (!teamsMatch(fh, home) || !teamsMatch(fa, away)) continue;
      let ch = NaN, ca = NaN;
      if (m.corners && typeof m.corners === "object") {
        ch = Number(m.corners.ft_home); ca = Number(m.corners.ft_away);
      }
      if (isNaN(ch)) ch = Number(m.home_corners ?? m.corners_home);
      if (isNaN(ca)) ca = Number(m.away_corners ?? m.corners_away);
      if (!isNaN(ch) && !isNaN(ca) && (ch + ca) > 0) return ch + ca;
    }
  }
  return null;
}

async function lookupCornersSportmonks(home: string, away: string, isoDate: string): Promise<number | null> {
  try {
    const f = await findFixtureByTeamsAndDate(home, away, isoDate);
    if (!f) return null;
    const ch = Number(f.cornersHome ?? NaN);
    const ca = Number(f.cornersAway ?? NaN);
    if (isNaN(ch) || isNaN(ca)) return null;
    const tot = ch + ca;
    return tot > 0 ? tot : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing_authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Identifica usuário (e se é admin) a partir do JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_jwt" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const uid = userData.user.id;

    const svc = createClient(SUPABASE_URL, SVC_KEY);
    const { data: roles } = await svc
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");

    // Carrega pendentes de escanteios COM placar final disponível
    let query = svc
      .from("user_trader_plan_signals")
      .select("id,user_id,match_id,market,outcome,line,selected_odd")
      .eq("status", "pending")
      .eq("market", "corners")
      .limit(500);
    if (!isAdmin) query = query.eq("user_id", uid);
    const { data: signals, error: sErr } = await query;
    if (sErr) throw sErr;
    if (!signals || signals.length === 0) {
      return new Response(JSON.stringify({ settled: 0, no_data: 0, total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Busca metadados dos jogos (apenas finished)
    const matchIds = Array.from(new Set(signals.map((s: any) => s.match_id)));
    const { data: matches } = await svc
      .from("live_matches")
      .select("match_id,home_team,away_team,status,updated_at,created_at")
      .in("match_id", matchIds)
      .eq("status", "finished");
    const byId = new Map((matches ?? []).map((m: any) => [m.match_id, m]));

    // Cache de total de escanteios por match_id (vários sinais podem compartilhar fixture)
    const cornersCache = new Map<string, number | null>();
    async function getCorners(matchId: string): Promise<number | null> {
      if (cornersCache.has(matchId)) return cornersCache.get(matchId)!;
      const lm = byId.get(matchId);
      if (!lm) { cornersCache.set(matchId, null); return null; }
      const iso = (lm.updated_at || lm.created_at || new Date().toISOString()) as string;
      let tot = await lookupCornersFutodds(lm.home_team, lm.away_team, iso);
      if (tot == null) tot = await lookupCornersSportmonks(lm.home_team, lm.away_team, iso);
      cornersCache.set(matchId, tot);
      return tot;
    }

    let settled = 0, noData = 0, skipped = 0;
    for (const s of signals as any[]) {
      const tot = await getCorners(s.match_id);
      if (tot == null) { noData++; continue; }
      const line = Number(s.line ?? 8.5);
      const outcome = String(s.outcome || "").toLowerCase();
      let won: boolean | null = null;
      if (outcome.includes("over"))  won = tot >  line;
      else if (outcome.includes("under")) won = tot <  line;
      if (won == null) { skipped++; continue; }
      const odd = Number(s.selected_odd ?? 1);
      const pnl = won ? Number((odd - 1).toFixed(4)) : -1;
      const { error: uErr } = await svc
        .from("user_trader_plan_signals")
        .update({
          status: won ? "green" : "red",
          profit_loss: pnl,
          settled_at: new Date().toISOString(),
        })
        .eq("id", s.id);
      if (!uErr) settled++;
    }

    return new Response(
      JSON.stringify({ settled, no_data: noData, skipped, total: signals.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[settle-user-plan-corners]", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
