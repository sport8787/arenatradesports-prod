// steamDetection — Detecta movimentação significativa de odds (steam/sharp money)
// usando Futodds Exchange como fonte. Captura snapshots e compara com janela
// histórica para detectar drift relevante (>= 4% em <= 15min).
//
// drift_pct = (open_mid/close_mid - 1) * 100
//   > 0  → odd CAIU (mercado entrou no lado) → in_favor se nosso pick é o mesmo lado
//   < 0  → odd SUBIU (mercado saiu) → against se nosso pick é o mesmo lado

import { getExchangeQuote, ExchangeQuote } from "./futoddsExchange.ts";

export const STEAM_THRESHOLD_PCT = 4.0;       // drift mínimo para sinalizar
export const STEAM_WINDOW_MIN = 15;            // janela máxima para análise
export const STEAM_VETO_PCT = 7.0;             // drift contra >= 7pp ⇒ recomenda VETO

export interface SteamResult {
  direction: "in_favor" | "against" | "neutral";
  drift_pct: number;
  open_mid_odd: number | null;
  close_mid_odd: number | null;
  window_minutes: number;
  source: "futodds";
}

/** Captura snapshot atual e grava em punter_steam_snapshots. */
export async function captureSteamSnapshot(
  supabase: any, eventId: string, market: string,
): Promise<ExchangeQuote | null> {
  const q = await getExchangeQuote(eventId, market);
  if (!q || !q.mid_odd) return null;
  await supabase.from("punter_steam_snapshots").insert({
    futodds_event_id: eventId, market, side: q.side,
    back_odd: q.back_odd, lay_odd: q.lay_odd, mid_odd: q.mid_odd,
  });
  return q;
}

/** Busca o snapshot mais antigo dentro da janela [now-windowMin, now-1min]. */
async function fetchOldestInWindow(
  supabase: any, eventId: string, market: string, windowMin = STEAM_WINDOW_MIN,
): Promise<{ mid_odd: number; captured_at: string } | null> {
  const since = new Date(Date.now() - windowMin * 60_000).toISOString();
  const until = new Date(Date.now() - 60_000).toISOString();
  const { data } = await supabase.from("punter_steam_snapshots")
    .select("mid_odd, captured_at")
    .eq("futodds_event_id", eventId).eq("market", market)
    .gte("captured_at", since).lte("captured_at", until)
    .order("captured_at", { ascending: true }).limit(1);
  return data?.[0] ?? null;
}

/** Calcula steam comparando snapshot mais antigo na janela com a quote atual. */
export async function detectSteam(
  supabase: any, eventId: string, market: string, pickedSide?: string,
): Promise<SteamResult | null> {
  if (!eventId || !market) return null;
  const current = await getExchangeQuote(eventId, market);
  if (!current?.mid_odd) return null;
  const oldest = await fetchOldestInWindow(supabase, eventId, market);
  if (!oldest?.mid_odd) return { direction: "neutral", drift_pct: 0, open_mid_odd: null, close_mid_odd: current.mid_odd, window_minutes: 0, source: "futodds" };
  const open = Number(oldest.mid_odd);
  const close = current.mid_odd;
  const driftPct = (open / close - 1) * 100; // odd caiu ⇒ positivo
  const windowMin = Math.round((Date.now() - new Date(oldest.captured_at).getTime()) / 60_000);
  let direction: SteamResult["direction"] = "neutral";
  if (Math.abs(driftPct) >= STEAM_THRESHOLD_PCT) {
    // pickedSide igual ao side da quote? Se sim e drift positivo (odd caiu), mercado concorda → in_favor.
    const sameSide = !pickedSide || pickedSide.toLowerCase() === current.side;
    direction = driftPct > 0 ? (sameSide ? "in_favor" : "against") : (sameSide ? "against" : "in_favor");
  }
  return { direction, drift_pct: Number(driftPct.toFixed(2)), open_mid_odd: open, close_mid_odd: close, window_minutes: windowMin, source: "futodds" };
}

/** Persiste resultado da detecção em punter_steam_signals (só se direction != neutral). */
export async function persistSteamSignal(
  supabase: any, matchId: string, market: string, eventId: string | null, res: SteamResult,
) {
  if (res.direction === "neutral") return;
  try {
    await supabase.from("punter_steam_signals").insert({
      match_id: matchId, futodds_event_id: eventId, market,
      direction: res.direction, drift_pct: res.drift_pct,
      window_minutes: res.window_minutes,
      open_mid_odd: res.open_mid_odd, close_mid_odd: res.close_mid_odd,
    });
  } catch (e) { console.warn("[steam] persist fail:", (e as Error).message); }
}
