// liquidar-sinais-ao-vivo
// Roda a cada 10min via pg_cron. Liquida live_sinais pendentes de HOJE.
// Provedores: Futodds /matches-ended (primário) → Sportmonks (fallback).
// Liquidação 100% delegada à RPC settle_signal (fonte única de verdade).
// Fase 2 (18/05/2026): API-Football removida.
import { createClient } from "npm:@supabase/supabase-js@2";
import { findFixtureByTeamsAndDate } from "../_shared/sportmonks.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUTODDS_BASE = "https://csv.futodds.com/functions/v1";

interface PendingSignal {
  id: string;
  match_id: string;
  home_team: string | null;
  away_team: string | null;
  market: string;
  market_key: string;
  odd: number | null;
  stake: number;
  match_date: string;
}

interface FinalScore {
  home: number;
  away: number;
  ht_home: number | null;
  ht_away: number | null;
  status: string;
  source: string;
}

const DEFAULT_SETTLEMENT_ODD = 1.7;

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function teamMatches(a: string, b: string): boolean {
  const A = norm(a);
  const B = norm(b);
  if (!A || !B) return false;
  if (A === B) return true;
  const aw = A.split(" ").filter((w) => w.length > 2);
  const bw = B.split(" ").filter((w) => w.length > 2);
  if (!aw.length || !bw.length) return false;
  return aw.some((w) => B.includes(w)) && bw.some((w) => A.includes(w));
}

async function futoddsByDate(ymd: string): Promise<any[]> {
  const KEY = Deno.env.get("FUTODDS_API_KEY");
  if (!KEY) return [];
  try {
    const res = await fetch(`${FUTODDS_BASE}/matches-ended?date=${ymd}`, {
      headers: { Authorization: `Bearer ${KEY}`, "X-API-Key": KEY, Accept: "application/json" },
    });
    if (!res.ok) { await res.text(); return []; }
    const j = await res.json();
    return Array.isArray(j) ? j : (j?.data ?? []);
  } catch (e) { console.error("[futodds]", e); return []; }
}

function findFutodds(ended: any[], home: string, away: string): FinalScore | null {
  for (const m of ended) {
    const h = m.home_name || m.home_team || m.home || "";
    const a = m.away_name || m.away_team || m.away || "";
    if (!teamMatches(home, h) || !teamMatches(away, a)) continue;
    let gh: number | null = null, ga: number | null = null;
    if (typeof m.scores === "string" && m.scores.includes("-")) {
      const [x, y] = m.scores.split("-"); gh = Number(x); ga = Number(y);
    }
    if (gh == null || isNaN(gh)) gh = Number(m.home_goals);
    if (ga == null || isNaN(ga)) ga = Number(m.away_goals);
    if (gh == null || isNaN(gh) || ga == null || isNaN(ga)) continue;

    let hth: number | null = null, hta: number | null = null;
    const hts = m.ht_score || m.ht_scores || m.score_ht;
    if (typeof hts === "string" && hts.includes("-")) {
      const [x, y] = hts.split("-"); hth = Number(x); hta = Number(y);
      if (isNaN(hth)) hth = null; if (isNaN(hta)) hta = null;
    }
    return { home: gh, away: ga, ht_home: hth, ht_away: hta, status: m.status || "FT", source: "futodds" };
  }
  return null;
}

async function apiFootballByDate(ymd: string): Promise<any[]> {
  const KEY = Deno.env.get("API_FOOTBALL_KEY");
  if (!KEY) return [];
  try {
    const res = await fetch(`${AF_BASE}/fixtures?date=${ymd}`, { headers: { "x-apisports-key": KEY } });
    if (!res.ok) { await res.text(); return []; }
    const j = await res.json();
    return Array.isArray(j?.response) ? j.response : [];
  } catch (e) { console.error("[af]", e); return []; }
}

function findAf(fixtures: any[], home: string, away: string): FinalScore | null {
  for (const f of fixtures) {
    const h = f?.teams?.home?.name || "";
    const a = f?.teams?.away?.name || "";
    if (!teamMatches(home, h) || !teamMatches(away, a)) continue;
    const status = f?.fixture?.status?.short || "";
    if (!["FT", "AET", "PEN", "AWD", "WO"].includes(status)) continue;
    const gh = f?.goals?.home, ga = f?.goals?.away;
    if (gh == null || ga == null) continue;
    return {
      home: Number(gh), away: Number(ga),
      ht_home: f?.score?.halftime?.home ?? null,
      ht_away: f?.score?.halftime?.away ?? null,
      status, source: "api-football",
    };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const startedAt = Date.now();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const reqBody = await req.json().catch(() => ({}));
  const requestedDays = Number(reqBody?.days_back ?? reqBody?.daysBack ?? 3);
  const daysBack = Number.isFinite(requestedDays) ? Math.min(Math.max(Math.trunc(requestedDays), 1), 14) : 3;
  const windowStart = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

  const { data: pendings, error: pErr } = await supabase
    .from("live_sinais")
    .select("id, match_id, home_team, away_team, market, market_key, odd, stake, match_date")
    .is("result", null)
    .not("market_key", "is", null)
    .gte("match_date", windowStart)
    .lte("match_date", cutoff)
    .order("match_date", { ascending: false })
    .limit(500);

  if (pErr) {
    console.error("[liquidar] select error", pErr);
    return new Response(JSON.stringify({ error: pErr.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const list = (pendings ?? []) as PendingSignal[];
  if (!list.length) {
    return new Response(JSON.stringify({ ok: true, processed: 0, message: "no pending" }),
      { headers: { ...cors, "Content-Type": "application/json" } });
  }

  const fsCache = new Map<string, FinalScore | null>();
  const futoddsByDayCache = new Map<string, any[]>();
  const afByDayCache = new Map<string, any[]>();

  let settled = 0, stillPending = 0, unknownMarket = 0;
  const examples: any[] = [];

  for (const sig of list) {
    const home = sig.home_team || "", away = sig.away_team || "";
    const signalDay = new Date(sig.match_date).toISOString().slice(0, 10);
    const cacheKey = `${signalDay}|${norm(home)}|${norm(away)}`;
    let fs: FinalScore | null;
    if (fsCache.has(cacheKey)) fs = fsCache.get(cacheKey)!;
    else {
      if (!futoddsByDayCache.has(signalDay)) {
        futoddsByDayCache.set(signalDay, await futoddsByDate(signalDay));
      }
      fs = findFutodds(futoddsByDayCache.get(signalDay) ?? [], home, away);
      if (!fs) {
        if (!afByDayCache.has(signalDay)) {
          afByDayCache.set(signalDay, await apiFootballByDate(signalDay));
        }
        fs = findAf(afByDayCache.get(signalDay) ?? [], home, away);
      }
      fsCache.set(cacheKey, fs);
    }

    if (!fs) { stillPending++; continue; }

    const { data: rpcRows, error: rpcErr } = await supabase.rpc("settle_signal", {
      _market_key: sig.market_key,
      _gh: fs.home, _ga: fs.away,
      _htgh: fs.ht_home, _htga: fs.ht_away,
      _odd: Number(sig.odd ?? DEFAULT_SETTLEMENT_ODD), _stake: Number(sig.stake ?? 5),
    });
    if (rpcErr) { console.error("[liquidar] settle rpc", sig.id, rpcErr.message); continue; }

    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!row || !row.result) {
      unknownMarket++;
      if (examples.length < 5) examples.push({
        market: sig.market, key: sig.market_key, score: `${fs.home}-${fs.away}`,
      });
      continue;
    }

    const { error: uErr } = await supabase
      .from("live_sinais")
      .update({
        result: row.result,
        profit_loss: row.profit_loss,
        goals_home: fs.home,
        goals_away: fs.away,
        settled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sig.id)
      .is("result", null);

    if (uErr) { console.error("[liquidar] update", sig.id, uErr.message); continue; }
    settled++;
  }

  const elapsed = Date.now() - startedAt;
  console.log(`[liquidar] today=${today} days_back=${daysBack} pendentes=${list.length} liquidados=${settled} sem_placar=${stillPending} mercado_desconhecido=${unknownMarket} (${elapsed}ms)`);

  return new Response(JSON.stringify({
    ok: true, today,
    days_back: daysBack,
    pending_total: list.length,
    settled, no_score_yet: stillPending, unknown_market: unknownMarket,
    examples, elapsed_ms: elapsed,
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
