// liquidar-sinais-ao-vivo
// Roda a cada 10min via pg_cron. Liquida live_sinais pendentes.
// Provedores: Futodds /matches-ended (primário) → Sportmonks (fallback) → SofaScore (fallback 2).
// Liquidação 100% delegada à RPC settle_signal (fonte única de verdade).
// Fase 2 (18/05/2026): API-Football removida.
// 24/05/2026: SofaScore adicionado como fallback final (cobertura ampla + HT score nativo).
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
  approved_at_score: string | null;
  approved_at_period: string | null;
  goals_home: number | null;
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

async function sendTelegramSettlement(home: string, away: string, market: string, result: "green" | "red", odd: number, finalHome: number, finalAway: number, approvedMinute: number | null) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chatId) return;
  const emoji = result === "green" ? "🟢 GREEN" : "🔴 RED";
  const flag = result === "green" ? "✅" : "❌";
  const msg = `${flag} *${home.toUpperCase()} x ${away.toUpperCase()} — ${emoji}*\n`
    + `Mercado: ${market} @ ${odd.toFixed(2)}\n`
    + `Placar final: ${finalHome}x${finalAway}`
    + (approvedMinute ? ` | Aprovado: ${approvedMinute}'` : "");
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "Markdown" }),
    });
  } catch (e) {
    console.warn("[liquidar] telegram notify falhou:", (e as Error).message);
  }
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

async function futoddsByDate(ymd: string): Promise<any[]> {
  const KEY = Deno.env.get("FUTODDS_API_KEY");
  if (!KEY) return [];
  try {
    const res = await fetch(`${FUTODDS_BASE}/matches-ended?date_from=${ymd}&date_to=${ymd}&limit=100`, {
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
    let hth: number | null = null, hta: number | null = null;

    // Formato atual (2026): score: { ft_home, ft_away, ht_home, ht_away }
    if (m.score && typeof m.score === "object") {
      const fh = Number(m.score.ft_home); const fa = Number(m.score.ft_away);
      if (!isNaN(fh) && !isNaN(fa)) { gh = fh; ga = fa; }
      const hh = Number(m.score.ht_home); const ha = Number(m.score.ht_away);
      if (!isNaN(hh)) hth = hh;
      if (!isNaN(ha)) hta = ha;
    }
    // Formato legado: "1-2"
    if ((gh == null || isNaN(gh)) && typeof m.scores === "string" && m.scores.includes("-")) {
      const [x, y] = m.scores.split("-"); gh = Number(x); ga = Number(y);
    }
    if (gh == null || isNaN(gh)) gh = Number(m.home_goals);
    if (ga == null || isNaN(ga)) ga = Number(m.away_goals);
    if (gh == null || isNaN(gh) || ga == null || isNaN(ga)) continue;

    if (hth == null) {
      const hts = m.ht_score || m.ht_scores || m.score_ht;
      if (typeof hts === "string" && hts.includes("-")) {
        const [x, y] = hts.split("-"); const hh = Number(x); const ha = Number(y);
        if (!isNaN(hh)) hth = hh;
        if (!isNaN(ha)) hta = ha;
      }
    }
    return { home: gh, away: ga, ht_home: hth, ht_away: hta, status: m.status || "FT", source: "futodds" };
  }
  return null;
}

// Fallback: Sportmonks via helper compartilhado (1 lookup por home/away/dia).
async function smFallback(home: string, away: string, isoDate: string): Promise<FinalScore | null> {
  try {
    const sm = await findFixtureByTeamsAndDate(home, away, isoDate);
    if (!sm) return null;
    if (sm.goalsHome == null || sm.goalsAway == null) return null;
    return {
      home: Number(sm.goalsHome),
      away: Number(sm.goalsAway),
      ht_home: sm.htHome ?? null,
      ht_away: sm.htAway ?? null,
      status: sm.status || "FT",
      source: "sportmonks",
    };
  } catch (e) {
    console.error("[sm-fallback]", e);
    return null;
  }
}

// Fallback 2: SofaScore — cobertura ampla + HT score nativo (period1).
// API pública (não documentada): https://api.sofascore.com/api/v1
const SOFA_BASE = "https://api.sofascore.com/api/v1";
const SOFA_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Referer": "https://www.sofascore.com/",
  "Origin": "https://www.sofascore.com",
};
const NOISE_TOKENS = new Set([
  "fc","cf","sc","ac","club","clube","cd","sd","ud","rcd","fk","aa","ec","ca","se","cr","rb","afc","cfc",
  "city","united","de","do","da","of","the","w","fem","feminino","feminina",
]);
function sofaSimplify(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean)
    .filter((t) => !NOISE_TOKENS.has(t)).join("");
}
function sofaTeamsMatch(eventName: string, target: string): boolean {
  const e = sofaSimplify(eventName); const t = sofaSimplify(target);
  if (!e || !t) return false;
  if (e === t) return true;
  if (e.length >= 4 && t.includes(e)) return true;
  if (t.length >= 4 && e.includes(t)) return true;
  return false;
}
async function sofaFetch(path: string): Promise<any | null> {
  const url = `${SOFA_BASE}${path}`;
  try {
    const r = await fetch(url, { headers: SOFA_HEADERS });
    if (r.ok) return await r.json();
    if (r.status !== 403 && r.status !== 429) return null;
  } catch {}
  // Fallback: Firecrawl (alguns IPs do edge runtime caem em 403 direto)
  const fcKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!fcKey) return null;
  try {
    const fr = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { "Authorization": `Bearer ${fcKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["rawHtml"], onlyMainContent: false, waitFor: 800 }),
    });
    if (!fr.ok) return null;
    const fd = await fr.json();
    const raw: string = fd?.data?.rawHtml || fd?.rawHtml || "";
    const jsonStr = raw.replace(/<[^>]+>/g, "").trim();
    if (!jsonStr.startsWith("{")) return null;
    return JSON.parse(jsonStr);
  } catch { return null; }
}
const sofaScheduledCache = new Map<string, any[]>();
async function sofaScheduledByDate(ymd: string): Promise<any[]> {
  if (sofaScheduledCache.has(ymd)) return sofaScheduledCache.get(ymd)!;
  const data = await sofaFetch(`/sport/football/scheduled-events/${ymd}`);
  const events = (data?.events ?? []) as any[];
  sofaScheduledCache.set(ymd, events);
  return events;
}
async function sofaFallback(home: string, away: string, isoDate: string): Promise<FinalScore | null> {
  try {
    const base = new Date(isoDate);
    if (isNaN(base.getTime())) return null;
    for (const offset of [0, -1, 1]) {
      const d = new Date(base); d.setUTCDate(d.getUTCDate() + offset);
      const ymd = d.toISOString().slice(0, 10);
      const events = await sofaScheduledByDate(ymd);
      for (const ev of events) {
        const eHome = ev.homeTeam?.name || "";
        const eAway = ev.awayTeam?.name || "";
        if (!sofaTeamsMatch(eHome, home) || !sofaTeamsMatch(eAway, away)) continue;
        const statusType = ev.status?.type || "";
        if (statusType !== "finished") continue;
        const gh = ev.homeScore?.current;
        const ga = ev.awayScore?.current;
        if (gh == null || ga == null) continue;
        const hth = ev.homeScore?.period1 ?? null;
        const hta = ev.awayScore?.period1 ?? null;
        return {
          home: Number(gh), away: Number(ga),
          ht_home: hth == null ? null : Number(hth),
          ht_away: hta == null ? null : Number(hta),
          status: "FT", source: "sofascore",
        };
      }
    }
    return null;
  } catch (e) {
    console.error("[sofa-fallback]", e);
    return null;
  }
}

// Fallback 3: live_matches (DB próprio) — usa match_id para buscar placar final gravado em tempo real.
// Aceita como "final" se status = finished/FT/AET ou se minute >= 88 no 2T.
async function liveMatchesFallback(
  supabase: ReturnType<typeof createClient>,
  matchId: string,
): Promise<(FinalScore & { home_team: string; away_team: string }) | null> {
  if (!matchId) return null;
  try {
    const { data } = await supabase
      .from("live_matches")
      .select("score_home, score_away, minute, period, status, home_team, away_team")
      .eq("match_id", matchId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data || data.score_home == null || data.score_away == null) return null;
    const isFinal =
      data.status === "finished" || data.status === "FT" || data.status === "AET" ||
      (Number(data.minute) >= 88 && ["Second Half", "Extra Time", "ET"].includes(data.period ?? ""));
    if (!isFinal) return null;
    return {
      home: Number(data.score_home),
      away: Number(data.score_away),
      ht_home: null,
      ht_away: null,
      status: data.status || "FT",
      source: "live_matches",
      home_team: data.home_team || "",
      away_team: data.away_team || "",
    };
  } catch (e) {
    console.error("[live_matches-fallback]", e);
    return null;
  }
}

/**
 * Deriva o resultado (green/red) de um sinal aprovado com base no mercado e placar final.
 * Cobre os principais mercados do motor determinístico.
 */
function deriveMarketResult(
  market: string,
  finalHome: number,
  finalAway: number,
  htHome: number | null,
  htAway: number | null,
  approvedHome: number,
  approvedAway: number,
): "green" | "red" | null {
  const m = (market || "").toLowerCase().trim();
  const total = finalHome + finalAway;
  const htTotal = (htHome ?? 0) + (htAway ?? 0);
  const isHT = m.includes(" ht") || m.includes("(ht)") || m.includes("1t") || m.includes("primeiro tempo") || m.includes("half time");

  // Over X.5
  const overMatch = m.match(/over\s+(\d+(?:[.,]\d+)?)/);
  if (overMatch) {
    const line = parseFloat(overMatch[1].replace(",", "."));
    const goals = isHT ? htTotal : total;
    return goals > line ? "green" : "red";
  }

  // Under X.5
  const underMatch = m.match(/under\s+(\d+(?:[.,]\d+)?)/);
  if (underMatch) {
    const line = parseFloat(underMatch[1].replace(",", "."));
    const goals = isHT ? htTotal : total;
    return goals < line ? "green" : "red";
  }

  // BTTS / Ambas Marcam
  if (m.includes("btts") || m.includes("ambas") || m.includes("both teams to score") || m.includes("gg")) {
    const bttsSim = finalHome > 0 && finalAway > 0;
    const isNao = m.includes("não") || m.includes("nao") || m.includes(" no") || m.includes("ng");
    return (isNao ? !bttsSim : bttsSim) ? "green" : "red";
  }

  // 1X2 / Match Odds
  if (m.includes("vitória casa") || m.includes("home win") || m === "1" || m.includes("1x2 casa") || m.includes("back casa")) {
    return finalHome > finalAway ? "green" : "red";
  }
  if (m.includes("vitória fora") || m.includes("away win") || m === "2" || m.includes("1x2 fora") || m.includes("back fora")) {
    return finalHome < finalAway ? "green" : "red";
  }
  if (m.includes("empate") || m.includes("draw") || m === "x" || m.includes("back empate")) {
    return finalHome === finalAway ? "green" : "red";
  }

  // Double Chance (DC)
  if (m.includes("1x") || m.includes("dc 1x")) return finalHome >= finalAway ? "green" : "red";
  if (m.includes("x2") || m.includes("dc x2")) return finalHome <= finalAway ? "green" : "red";
  if (m.includes("12") || m.includes("dc 12")) return finalHome !== finalAway ? "green" : "red";

  // Asian Handicap
  const ahMatch = m.match(/ah?\s*([-+]?\d+(?:[.,]\d+)?)\s*(casa|fora|home|away)?/);
  if (ahMatch) {
    const line = parseFloat(ahMatch[1].replace(",", "."));
    const side = ahMatch[2] || (m.includes("fora") || m.includes("away") ? "away" : "home");
    const isAway = side === "fora" || side === "away";
    const handicap = isAway ? finalAway - finalHome + line : finalHome - finalAway + line;
    if (handicap > 0) return "green";
    if (handicap < 0) return "red";
    return null; // push/void (linha exata)
  }

  // Próximo Gol / Gols Restantes
  if (m.includes("próximo gol") || m.includes("proximo gol") || m.includes("gols restantes") || m.includes("next goal")) {
    const newHome = finalHome - approvedHome;
    const newAway = finalAway - approvedAway;
    const anyGoal = newHome + newAway > 0;
    if (!anyGoal) return null; // jogo não teve mais gols ainda
    if (m.includes("casa") || m.includes("home")) return newHome > 0 ? "green" : "red";
    if (m.includes("fora") || m.includes("away")) return newAway > 0 ? "green" : "red";
    return anyGoal ? "green" : "red"; // fallback: qualquer gol = green
  }

  // BACK 0x0
  if (m.includes("0x0") || m.includes("0-0") || m.includes("back 0")) {
    return (finalHome === 0 && finalAway === 0) ? "green" : "red";
  }

  // LAY markets (inverso)
  if (m.startsWith("lay ")) {
    const inner = m.slice(4).trim();
    const r = deriveMarketResult(inner, finalHome, finalAway, htHome, htAway, approvedHome, approvedAway);
    if (r === "green") return "red";
    if (r === "red") return "green";
    return null;
  }

  return null; // mercado não reconhecido
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
    .select("id, match_id, home_team, away_team, market, market_key, odd, stake, match_date, approved_at_score, approved_at_period, goals_home")
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
      let sourceTag = fs ? "futodds" : null;
      if (!fs) {
        fs = await smFallback(home, away, sig.match_date);
        if (fs) sourceTag = "sportmonks";
      }
      if (!fs) {
        fs = await sofaFallback(home, away, sig.match_date);
        if (fs) sourceTag = "sofascore";
      }
      if (!fs && sig.match_id) {
        const lm = await liveMatchesFallback(supabase, sig.match_id);
        if (lm) {
          fs = { home: lm.home, away: lm.away, ht_home: lm.ht_home, ht_away: lm.ht_away, status: lm.status, source: lm.source };
          // Para mercados de HT sem placar de 1T: deriva do placar no momento da aprovação
          // (aprovado no 1T com X gols já marcados → HT teve pelo menos X gols = seguro para OVER_HT)
          if (fs.ht_home == null && sig.approved_at_period === "First Half" && sig.approved_at_score) {
            const parts = sig.approved_at_score.split("-").map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) &&
                sig.market_key.startsWith("OVER_") && sig.market_key.endsWith("_HT")) {
              fs = { ...fs, ht_home: parts[0], ht_away: parts[1] };
            }
          }
          sourceTag = "live_matches";
        }
      }
      if (fs && sourceTag) {
        console.log(`[liquidar] ✅ score via ${sourceTag}: ${home} ${fs.home}-${fs.away} ${away} (ht ${fs.ht_home ?? "?"}-${fs.ht_away ?? "?"})`);
      } else if (!fs) {
        console.log(`[liquidar] ⚠️ sem placar: ${home} vs ${away} @ ${signalDay}`);
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

    // goals_home/away: só sobrescreve se ainda não tiver valor (aprovação pode já ter preenchido)
    const goalsUpdate = sig.goals_home == null
      ? { goals_home: fs.home, goals_away: fs.away }
      : {};
    const { error: uErr } = await supabase
      .from("live_sinais")
      .update({
        result: row.result,
        profit_loss: row.profit_loss,
        ...goalsUpdate,
        settled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sig.id)
      .is("result", null);

    if (uErr) { console.error("[liquidar] update", sig.id, uErr.message); continue; }
    settled++;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PASSO 2 — Liquida mycroft_analyses (sinais aprovados ao vivo pelo motor IA)
  // mycroft_analyses nunca tinha o result preenchido porque o passo 1 só toca live_sinais.
  // ─────────────────────────────────────────────────────────────────────────
  const APPROVED_VERDICTS = ["APROVADO", "APROVADO_SITUACIONAL", "LABAREDA"];

  const { data: pendingAnalyses, error: aErr } = await supabase
    .from("mycroft_analyses")
    .select("id, match_id, market, odd, approved_at_score_home, approved_at_score_away, created_at, stats_snapshot")
    .in("verdict", APPROVED_VERDICTS)
    .is("result", null)
    .gte("created_at", windowStart)
    .lte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(300);

  if (aErr) {
    console.error("[liquidar] mycroft_analyses query error", aErr.message);
  }

  let settledAnalyses = 0;
  let stillPendingAnalyses = 0;

  for (const analysis of pendingAnalyses ?? []) {
    // Extrai times do stats_snapshot (único lugar onde temos home/away team no mycroft_analyses)
    const snap = analysis.stats_snapshot || {};
    const home: string = snap.home_team || snap.home || "";
    const away: string = snap.away_team || snap.away || "";
    const signalDay = new Date(analysis.created_at).toISOString().slice(0, 10);

    if (!home || !away) {
      // Fallback: busca times e placar diretamente em live_matches pelo match_id
      const lm = await liveMatchesFallback(supabase, analysis.match_id);
      if (!lm || !lm.home_team || !lm.away_team) {
        stillPendingAnalyses++;
        continue;
      }
      const lmFs: FinalScore = { home: lm.home, away: lm.away, ht_home: lm.ht_home, ht_away: lm.ht_away, status: lm.status, source: lm.source };
      const lmResult = deriveMarketResult(
        analysis.market, lmFs.home, lmFs.away, lmFs.ht_home, lmFs.ht_away,
        Number(analysis.approved_at_score_home ?? 0), Number(analysis.approved_at_score_away ?? 0),
      );
      if (!lmResult) {
        console.log(`[liquidar] ⚠️ mycroft mercado sem lógica (live_matches): ${analysis.market}`);
        stillPendingAnalyses++;
        continue;
      }
      const { error: lmUpErr } = await supabase.from("mycroft_analyses")
        .update({ result: lmResult.toUpperCase(), final_score_home: lmFs.home, final_score_away: lmFs.away, settled_at: new Date().toISOString() })
        .eq("id", analysis.id).is("result", null);
      if (lmUpErr) { console.error("[liquidar] mycroft live_matches update error", analysis.id, lmUpErr.message); continue; }
      console.log(`[liquidar] ✅ mycroft via live_matches: ${lm.home_team} ${lmFs.home}-${lmFs.away} ${lm.away_team} | ${analysis.market} → ${lmResult}`);
      settledAnalyses++;
      continue;
    }

    const cacheKey = `${signalDay}|${norm(home)}|${norm(away)}`;
    let fs: FinalScore | null;
    if (fsCache.has(cacheKey)) {
      fs = fsCache.get(cacheKey)!;
    } else {
      if (!futoddsByDayCache.has(signalDay)) {
        futoddsByDayCache.set(signalDay, await futoddsByDate(signalDay));
      }
      fs = findFutodds(futoddsByDayCache.get(signalDay) ?? [], home, away);
      if (!fs) fs = await smFallback(home, away, analysis.created_at);
      if (!fs) fs = await sofaFallback(home, away, analysis.created_at);
      if (!fs) {
        const lmFallback = await liveMatchesFallback(supabase, analysis.match_id);
        if (lmFallback) fs = { home: lmFallback.home, away: lmFallback.away, ht_home: lmFallback.ht_home, ht_away: lmFallback.ht_away, status: lmFallback.status, source: lmFallback.source };
      }
      fsCache.set(cacheKey, fs);
    }

    if (!fs) { stillPendingAnalyses++; continue; }

    // Deriva o resultado com base no mercado e placar final
    const result = deriveMarketResult(
      analysis.market,
      fs.home, fs.away,
      fs.ht_home, fs.ht_away,
      Number(analysis.approved_at_score_home ?? 0),
      Number(analysis.approved_at_score_away ?? 0),
    );

    if (!result) {
      console.log(`[liquidar] ⚠️ mercado sem lógica: ${analysis.market}`);
      continue;
    }

    const odd = Number(analysis.odd ?? DEFAULT_SETTLEMENT_ODD);
    const profit_loss = result === "green" ? (odd - 1) : -1; // em unidades de stake

    const { error: upErr } = await supabase
      .from("mycroft_analyses")
      .update({
        result: result.toUpperCase(),
        final_score_home: fs.home,
        final_score_away: fs.away,
        settled_at: new Date().toISOString(),
      })
      .eq("id", analysis.id)
      .is("result", null);

    if (upErr) {
      console.error("[liquidar] mycroft_analyses update error", analysis.id, upErr.message);
      continue;
    }

    console.log(`[liquidar] ✅ mycroft_analyses liquidado: ${home} ${fs.home}-${fs.away} ${away} | ${analysis.market} → ${result}`);
    settledAnalyses++;

    // Notificação push via Telegram
    await sendTelegramSettlement(
      home, away, analysis.market, result, odd,
      fs.home, fs.away,
      snap.minute ?? null,
    );
  }

  const elapsed = Date.now() - startedAt;
  console.log(`[liquidar] today=${today} days_back=${daysBack}`
    + ` live_sinais: pendentes=${list.length} liquidados=${settled} sem_placar=${stillPending} mercado_desconhecido=${unknownMarket}`
    + ` | mycroft_analyses: liquidados=${settledAnalyses} sem_placar=${stillPendingAnalyses}`
    + ` (${elapsed}ms)`);

  return new Response(JSON.stringify({
    ok: true, today,
    days_back: daysBack,
    live_sinais: { pending_total: list.length, settled, no_score_yet: stillPending, unknown_market: unknownMarket, examples },
    mycroft_analyses: { pending_total: pendingAnalyses?.length ?? 0, settled: settledAnalyses, no_score_yet: stillPendingAnalyses },
    elapsed_ms: elapsed,
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
