// liquidar-sinais-ao-vivo
// Roda a cada 10min via pg_cron. Liquida live_sinais pendentes de HOJE.
// Provedores: Futodds /matches-ended (primário) → API-Football (fallback).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUTODDS_BASE = "https://csv.futodds.com/functions/v1";
const AF_BASE = "https://v3.football.api-sports.io";

interface PendingSignal {
  id: string;
  match_id: string;
  home_team: string | null;
  away_team: string | null;
  market: string;
  odd: number | null;
  stake: number;
  match_date: string;
  approved_at_score: string | null;
}

interface FinalScore {
  home: number;
  away: number;
  ht_home: number | null;
  ht_away: number | null;
  status: string;
  source: string;
}

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

// ---------------------- Provedores ----------------------

async function futoddsByDate(ymd: string): Promise<any[]> {
  const KEY = Deno.env.get("FUTODDS_API_KEY");
  if (!KEY) return [];
  try {
    const res = await fetch(`${FUTODDS_BASE}/matches-ended?date=${ymd}`, {
      headers: { Authorization: `Bearer ${KEY}`, "X-API-Key": KEY, Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[futodds] ${ymd} status=${res.status}`);
      await res.text();
      return [];
    }
    const j = await res.json();
    return Array.isArray(j) ? j : (j?.data ?? []);
  } catch (e) {
    console.error("[futodds] error", e);
    return [];
  }
}

function findFutodds(ended: any[], home: string, away: string): FinalScore | null {
  for (const m of ended) {
    const h = m.home_name || m.home_team || m.home || "";
    const a = m.away_name || m.away_team || m.away || "";
    if (!teamMatches(home, h) || !teamMatches(away, a)) continue;
    let gh: number | null = null;
    let ga: number | null = null;
    if (typeof m.scores === "string" && m.scores.includes("-")) {
      const [x, y] = m.scores.split("-");
      gh = Number(x);
      ga = Number(y);
    }
    if (gh == null || isNaN(gh)) gh = Number(m.home_goals);
    if (ga == null || isNaN(ga)) ga = Number(m.away_goals);
    if (gh == null || isNaN(gh) || ga == null || isNaN(ga)) continue;

    let hth: number | null = null;
    let hta: number | null = null;
    const hts = m.ht_score || m.ht_scores || m.score_ht;
    if (typeof hts === "string" && hts.includes("-")) {
      const [x, y] = hts.split("-");
      hth = Number(x);
      hta = Number(y);
      if (isNaN(hth)) hth = null;
      if (isNaN(hta)) hta = null;
    }
    return {
      home: gh,
      away: ga,
      ht_home: hth,
      ht_away: hta,
      status: m.status || "FT",
      source: "futodds",
    };
  }
  return null;
}

async function apiFootballByDate(ymd: string): Promise<any[]> {
  const KEY = Deno.env.get("API_FOOTBALL_KEY");
  if (!KEY) return [];
  try {
    const res = await fetch(`${AF_BASE}/fixtures?date=${ymd}`, {
      headers: { "x-apisports-key": KEY },
    });
    if (!res.ok) {
      await res.text();
      return [];
    }
    const j = await res.json();
    return Array.isArray(j?.response) ? j.response : [];
  } catch (e) {
    console.error("[af] error", e);
    return [];
  }
}

function findAf(fixtures: any[], home: string, away: string): FinalScore | null {
  for (const f of fixtures) {
    const h = f?.teams?.home?.name || "";
    const a = f?.teams?.away?.name || "";
    if (!teamMatches(home, h) || !teamMatches(away, a)) continue;
    const status = f?.fixture?.status?.short || "";
    if (!["FT", "AET", "PEN", "AWD", "WO"].includes(status)) continue;
    const gh = f?.goals?.home;
    const ga = f?.goals?.away;
    if (gh == null || ga == null) continue;
    return {
      home: Number(gh),
      away: Number(ga),
      ht_home: f?.score?.halftime?.home ?? null,
      ht_away: f?.score?.halftime?.away ?? null,
      status,
      source: "api-football",
    };
  }
  return null;
}

// ---------------------- Calculadora de mercado ----------------------

type SettleResult = {
  result: "GREEN" | "RED" | "VOID" | "HALF_GREEN" | "HALF_RED";
  profit: number;
};

function settle(market: string, odd: number, stake: number, fs: FinalScore): SettleResult | null {
  const m = norm(market);
  const total = fs.home + fs.away;
  const htTotal =
    fs.ht_home != null && fs.ht_away != null ? fs.ht_home + fs.ht_away : null;

  const win = (): SettleResult => ({ result: "GREEN", profit: +(stake * (odd - 1)).toFixed(2) });
  const lose = (): SettleResult => ({ result: "RED", profit: -stake });
  const halfWin = (): SettleResult => ({
    result: "HALF_GREEN",
    profit: +((stake * (odd - 1)) / 2).toFixed(2),
  });
  const halfLose = (): SettleResult => ({ result: "HALF_RED", profit: +(-stake / 2).toFixed(2) });
  const voidR = (): SettleResult => ({ result: "VOID", profit: 0 });

  // Linha (ex.: 0.5, 1.5, 2.5)
  const lineMatch = m.match(/(\d+(?:\.\d+)?)/);
  const line = lineMatch ? Number(lineMatch[1]) : null;

  const isHt = /(\bht\b|primeiro\s*tempo|1\s*t|first\s*half|1h)/.test(m);
  const isOver = /\bover\b|mais\s*de|acima/.test(m);
  const isUnder = /\bunder\b|menos\s*de|abaixo/.test(m);

  // Over/Under
  if (line != null && (isOver || isUnder)) {
    const sumRef = isHt ? htTotal : total;
    if (sumRef == null) return null;
    if (isOver) return sumRef > line ? win() : lose();
    if (isUnder) return sumRef < line ? win() : lose();
  }

  // BTTS
  if (/btts|ambas\s*marcam|ambos\s*marcam/.test(m)) {
    const yes = /\bsim\b|\byes\b/.test(m);
    const no = /\bnao\b|\bno\b/.test(m);
    const both = fs.home > 0 && fs.away > 0;
    if (yes) return both ? win() : lose();
    if (no) return !both ? win() : lose();
  }

  // Empate / Draw
  if (/\bempate\b|\bdraw\b/.test(m) && !/handicap/.test(m)) {
    return fs.home === fs.away ? win() : lose();
  }

  // Resultado / 1X2 — "Casa", "Fora", "Vitória X", "Back X"
  const homeName = "casa|home|mandante";
  const awayName = "fora|away|visitante";
  if (
    /resultado\s*final|\b1x2\b|\bback\b|vitoria|vencer/.test(m) ||
    new RegExp(`\\b(${homeName}|${awayName})\\b`).test(m)
  ) {
    const isAway = new RegExp(`\\b(${awayName})\\b`).test(m);
    const isHome = new RegExp(`\\b(${homeName})\\b`).test(m);
    if (isHome && !isAway) return fs.home > fs.away ? win() : lose();
    if (isAway && !isHome) return fs.away > fs.home ? win() : lose();
  }

  // Handicap Asiático -0.5 / +0.5 / -1 / +1 / -1.5 / +1.5
  const hcMatch = m.match(/handicap[^-+]*([+-]?\d+(?:\.\d+)?)/);
  if (hcMatch) {
    const hc = Number(hcMatch[1]);
    const isAway = /\b(fora|away|visitante)\b/.test(m);
    const teamGoals = isAway ? fs.away : fs.home;
    const oppGoals = isAway ? fs.home : fs.away;
    const adj = teamGoals + hc - oppGoals;
    // Linhas inteiras → push parcial
    if (Number.isInteger(hc)) {
      if (adj > 0) return win();
      if (adj < 0) return lose();
      return voidR();
    }
    // Linhas .25 / .75 (split) — não suportadas com precisão; trate como meio
    if (adj > 0) return win();
    if (adj < 0) return lose();
    return voidR();
  }

  return null; // mercado não reconhecido — ficará pendente
}

// ---------------------- Handler ----------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const startedAt = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // Pendentes de hoje, jogo já começou há pelo menos 2h
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: pendings, error: pErr } = await supabase
    .from("live_sinais")
    .select("id, match_id, home_team, away_team, market, odd, stake, match_date, approved_at_score")
    .is("result", null)
    .gte("match_date", `${today}T00:00:00Z`)
    .lt("match_date", `${today}T23:59:59Z`)
    .lte("match_date", cutoff)
    .limit(500);

  if (pErr) {
    console.error("[liquidar] select error", pErr);
    return new Response(JSON.stringify({ error: pErr.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const list = (pendings ?? []) as PendingSignal[];
  if (!list.length) {
    return new Response(
      JSON.stringify({ ok: true, processed: 0, message: "no pending" }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Cache de placares finais por (date|home|away)
  const fsCache = new Map<string, FinalScore | null>();

  // Pré-carrega Futodds e API-Football para a data de hoje
  const futoddsToday = await futoddsByDate(today);
  let afToday: any[] | null = null;

  let settled = 0;
  let stillPending = 0;
  let unknownMarket = 0;
  const examples: any[] = [];

  for (const sig of list) {
    const home = sig.home_team || "";
    const away = sig.away_team || "";
    const cacheKey = `${today}|${norm(home)}|${norm(away)}`;

    let fs: FinalScore | null;
    if (fsCache.has(cacheKey)) {
      fs = fsCache.get(cacheKey)!;
    } else {
      fs = findFutodds(futoddsToday, home, away);
      if (!fs) {
        if (afToday == null) afToday = await apiFootballByDate(today);
        fs = findAf(afToday, home, away);
      }
      fsCache.set(cacheKey, fs);
    }

    if (!fs) {
      stillPending++;
      continue;
    }

    const calc = settle(sig.market, Number(sig.odd ?? 0), Number(sig.stake ?? 5), fs);
    if (!calc) {
      unknownMarket++;
      if (examples.length < 5) examples.push({ market: sig.market, score: `${fs.home}-${fs.away}` });
      continue;
    }

    const { error: uErr } = await supabase
      .from("live_sinais")
      .update({
        result: calc.result,
        profit_loss: calc.profit,
        goals_home: fs.home,
        goals_away: fs.away,
        settled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sig.id)
      .is("result", null); // race-safe

    if (uErr) {
      console.error("[liquidar] update error", sig.id, uErr.message);
      continue;
    }
    settled++;
  }

  const elapsed = Date.now() - startedAt;
  console.log(
    `[liquidar] today=${today} pendentes=${list.length} liquidados=${settled} sem_placar=${stillPending} mercado_desconhecido=${unknownMarket} (${elapsed}ms)`,
  );

  return new Response(
    JSON.stringify({
      ok: true,
      today,
      pending_total: list.length,
      settled,
      no_score_yet: stillPending,
      unknown_market: unknownMarket,
      examples,
      elapsed_ms: elapsed,
    }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
