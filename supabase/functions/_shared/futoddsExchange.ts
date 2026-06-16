// futoddsExchange — Helper compartilhado para obter odd Betfair Exchange (back/lay/mid)
// pré-jogo via Futodds /matches-betfair-live-odds. Usado pelo Punter para recalcular
// edge contra preço justo de mercado (sem margem) em vez de bookmakers tradicionais.
//
// Fluxo:
//   1) lookup event_id Futodds via cached_odds_games (home/away/commence_time)
//   2) GET /matches-betfair-live-odds?event_id=...
//   3) extrai back/lay para o mercado pedido, calcula mid + fair_prob
//   4) cache em memória 30s por (event_id, market)

import { getFutoddsBetfairOdds } from "./futoddsProvider.ts";

type Side = "home" | "away" | "draw" | "over" | "under" | "yes" | "no";

export interface ExchangeQuote {
  event_id: string;
  market: string;
  side: Side;
  back_odd: number | null;
  lay_odd: number | null;
  mid_odd: number | null;       // (back+lay)/2 quando ambos disponíveis, senão back
  fair_prob: number | null;     // 1/mid_odd
  age_ms: number;
  source: "futodds";
}

const CACHE_TTL_MS = 10_000;
const cache = new Map<string, { at: number; payload: any }>();

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "").trim();
}

/** Resolve event_id Futodds a partir de (home, away, commence_time). */
export async function resolveFutoddsEventId(
  supabase: any, home: string, away: string, commenceISO?: string,
): Promise<string | null> {
  try {
    const nh = norm(home), na = norm(away);
    let q = supabase.from("cached_odds_games").select("event_id, home_team, away_team, commence_time")
      .ilike("home_team", `%${home.split(" ")[0]}%`).limit(50);
    const { data, error } = await q;
    if (error || !Array.isArray(data)) return null;
    const target = commenceISO ? new Date(commenceISO).getTime() : 0;
    let best: any = null; let bestDt = Infinity;
    for (const row of data) {
      if (norm(row.away_team) !== na && norm(row.home_team) !== nh) continue;
      if (norm(row.home_team) !== nh) continue;
      if (norm(row.away_team) !== na) continue;
      const dt = target ? Math.abs(new Date(row.commence_time).getTime() - target) : 0;
      if (dt < bestDt) { bestDt = dt; best = row; }
    }
    return best?.event_id ?? null;
  } catch { return null; }
}

/** Mapeia o market normalizado da IA → side esperado e categoria do payload Futodds. */
export function classifyMarket(marketRaw: string): { kind: "h2h" | "ou" | "btts" | "unknown"; side: Side; line?: number } {
  const m = (marketRaw || "").toLowerCase();
  if (/over\s*\d/.test(m)) return { kind: "ou", side: "over", line: parseFloat(m.match(/over\s*([0-9.]+)/)?.[1] || "2.5") };
  if (/under\s*\d/.test(m)) return { kind: "ou", side: "under", line: parseFloat(m.match(/under\s*([0-9.]+)/)?.[1] || "2.5") };
  if (/btts.*(yes|sim)|both.*score|ambas/.test(m)) return { kind: "btts", side: "yes" };
  if (/btts.*(no|n[ãa]o)|no goal/.test(m)) return { kind: "btts", side: "no" };
  if (/draw|empate/.test(m)) return { kind: "h2h", side: "draw" };
  if (/away|visitante|fora/.test(m)) return { kind: "h2h", side: "away" };
  if (/home|casa|mandante/.test(m)) return { kind: "h2h", side: "home" };
  return { kind: "unknown", side: "home" };
}

/** Extrai back/lay do payload Futodds (estrutura defensiva — varia por mercado). */
function extractQuote(payload: any, kind: string, side: Side, line?: number): { back: number | null; lay: number | null } {
  if (!payload) return { back: null, lay: null };
  // O payload Futodds devolve várias estruturas; tentamos algumas chaves comuns.
  const markets: any[] = Array.isArray(payload?.markets) ? payload.markets : Array.isArray(payload) ? payload : payload?.data ?? [];
  for (const mk of markets) {
    const name = String(mk?.market_type ?? mk?.name ?? mk?.market ?? "").toLowerCase();
    if (kind === "h2h" && !/match.?odds|h2h|1x2|moneyline/.test(name)) continue;
    if (kind === "ou" && !/over.?under|totals|goals/.test(name)) continue;
    if (kind === "btts" && !/btts|both.*score|ambas/.test(name)) continue;
    const runners: any[] = Array.isArray(mk?.runners) ? mk.runners : Array.isArray(mk?.selections) ? mk.selections : [];
    for (const r of runners) {
      const rname = String(r?.selection ?? r?.name ?? r?.runner ?? "").toLowerCase();
      const rline = Number(r?.handicap ?? r?.line ?? r?.point ?? NaN);
      let match = false;
      if (kind === "h2h") {
        if (side === "home" && /home|1\b|\bcasa/.test(rname)) match = true;
        if (side === "away" && /away|2\b|\bfora|visit/.test(rname)) match = true;
        if (side === "draw" && /draw|empate|x\b/.test(rname)) match = true;
      } else if (kind === "ou") {
        const lineOk = !line || !Number.isFinite(rline) || Math.abs(rline - line) < 0.01 || rname.includes(String(line));
        if (side === "over" && /over/.test(rname) && lineOk) match = true;
        if (side === "under" && /under/.test(rname) && lineOk) match = true;
      } else if (kind === "btts") {
        if (side === "yes" && /(yes|sim)/.test(rname)) match = true;
        if (side === "no" && /(no|n[ãa]o)/.test(rname)) match = true;
      }
      if (!match) continue;
      const back = Number(r?.back?.[0]?.price ?? r?.back_price ?? r?.back ?? r?.lay_back ?? NaN);
      const lay = Number(r?.lay?.[0]?.price ?? r?.lay_price ?? r?.lay ?? NaN);
      return { back: Number.isFinite(back) ? back : null, lay: Number.isFinite(lay) ? lay : null };
    }
  }
  return { back: null, lay: null };
}

/** Busca quote Exchange para um sinal (event_id + market). Cache 30s. */
export async function getExchangeQuote(
  eventId: string, marketRaw: string,
): Promise<ExchangeQuote | null> {
  if (!eventId) return null;
  const cls = classifyMarket(marketRaw);
  if (cls.kind === "unknown") return null;
  const cacheKey = `${eventId}:${cls.kind}`;
  const now = Date.now();
  let payload = cache.get(cacheKey);
  if (!payload || now - payload.at > CACHE_TTL_MS) {
    try {
      const raw = await getFutoddsBetfairOdds(eventId);
      payload = { at: now, payload: raw };
      cache.set(cacheKey, payload);
    } catch (e) {
      console.warn("[futoddsExchange] fetch fail:", (e as Error).message);
      return null;
    }
  }
  const { back, lay } = extractQuote(payload.payload, cls.kind, cls.side, cls.line);
  if (!back && !lay) return null;
  const mid = back && lay ? (back + lay) / 2 : (back ?? lay);
  const fair = mid ? 1 / mid : null;
  return {
    event_id: eventId, market: marketRaw, side: cls.side,
    back_odd: back, lay_odd: lay, mid_odd: mid, fair_prob: fair,
    age_ms: now - payload.at, source: "futodds",
  };
}

/** Calcula edge em pp contra a Exchange dado prob estimada (0-100). */
export function computeExchangeEdgePP(estimatedProbPct: number, midOdd: number | null): number | null {
  if (!midOdd || !Number.isFinite(estimatedProbPct)) return null;
  const p = Math.max(0, Math.min(1, estimatedProbPct / 100));
  return (p * midOdd - 1) * 100;
}
