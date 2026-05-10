// update-live-odds — Job dedicado de odds AO VIVO (Betfair Exchange).
//
// Para CADA live_match ativo, popula `odds_live` (1X2 + Over/Under 2.5) usando:
//   1) Betfair Exchange via Futodds /matches-betfair-live-odds (REAL, ao vivo)
//      - Resolve event_id via /matches-betfair-live-compact (cache 60s)
//      - Busca odds back reais (last_price_traded → availableToBack[0])
//   2) Fallback: cached_odds_games (Pinnacle pré-jogo) — marcado como
//      "Betfair (pré-jogo)" para o usuário entender que NÃO é odd ao vivo.
//
// Marca a fonte como "Betfair" (ao vivo) ou "Betfair (pré-jogo)" (fallback).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FUTODDS_BASE = "https://csv.futodds.com/functions/v1";
const FUTODDS_KEY = Deno.env.get("FUTODDS_API_KEY") || "";

// Caches em memória (TTL curto)
const BF_COMPACT_CACHE: { ts: number; data: any[] } = { ts: 0, data: [] };
const BF_ODDS_CACHE = new Map<string, { ts: number; data: any }>();

function normTeam(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|sc|ac|afc|cfc|sk|bk|if|fk|aff|club|cd|ud|ca|cs|gc|do|de|el|la|os|kfum)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pairMatch(a: string, b: string): boolean {
  if (!a || !b || a.length < 4 || b.length < 4) return false;
  if (a === b) return true;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.includes(shorter) && shorter.length / longer.length >= 0.55) return true;
  const aw = a.split(" ")[0], bw = b.split(" ")[0];
  if (aw && bw && aw === bw && aw.length >= 5) return true;
  return false;
}

async function fdGet(path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(FUTODDS_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${FUTODDS_KEY}`, "X-API-Key": FUTODDS_KEY, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`${path}_${r.status}`);
  return r.json();
}

async function getBetfairCompact(): Promise<any[]> {
  const now = Date.now();
  if (now - BF_COMPACT_CACHE.ts < 60_000 && BF_COMPACT_CACHE.data.length > 0) {
    return BF_COMPACT_CACHE.data;
  }
  try {
    const j = await fdGet("/matches-betfair-live-compact");
    const list = Array.isArray(j?.data) ? j.data : [];
    BF_COMPACT_CACHE.ts = now;
    BF_COMPACT_CACHE.data = list;
    return list;
  } catch (e) {
    console.warn("[UpdateLiveOdds] compact fail:", (e as Error).message);
    return BF_COMPACT_CACHE.data;
  }
}

async function getBetfairOdds(eventId: string): Promise<any | null> {
  const now = Date.now();
  const cached = BF_ODDS_CACHE.get(eventId);
  if (cached && now - cached.ts < 25_000) return cached.data;
  try {
    const j = await fdGet("/matches-betfair-live-odds", { event_id: String(eventId) });
    const data = j?.data ?? j;
    BF_ODDS_CACHE.set(eventId, { ts: now, data });
    return data;
  } catch (e) {
    console.warn(`[UpdateLiveOdds] odds fetch fail event=${eventId}:`, (e as Error).message);
    return null;
  }
}

/** Extrai odd back real (last_price_traded → availableToBack[0]). */
function pickRunnerOdd(runner: any): number | null {
  if (!runner) return null;
  const lpt = Number(runner?.last_price_traded);
  if (lpt && lpt > 1.01) return lpt;
  const back = runner?.ex?.availableToBack?.[0]?.price ?? runner?.back?.[0]?.price ?? runner?.back_odds?.[0]?.price;
  const n = Number(back);
  return n && n > 1.01 ? n : null;
}

function extractLiveOdds(payload: any, homeName: string, awayName: string):
  | { home: number | null; draw: number | null; away: number | null; over25: number | null; under25: number | null }
  | null {
  if (!payload) return null;
  const markets: any[] = Array.isArray(payload?.markets) ? payload.markets : Array.isArray(payload) ? payload : [];
  if (markets.length === 0) return null;
  const homeN = normTeam(homeName), awayN = normTeam(awayName);

  const out = { home: null as number | null, draw: null as number | null, away: null as number | null, over25: null as number | null, under25: null as number | null };

  // 1X2 (MATCH_ODDS)
  const mk1x2 = markets.find((x: any) => /MATCH_ODDS|1X2|FT_RESULT/i.test(String(x?.market_type || x?.market_name || "")));
  if (mk1x2?.runners) {
    for (const r of mk1x2.runners) {
      const nm = String(r?.runner_name || r?.name || r?.selection_name || "");
      const odd = pickRunnerOdd(r);
      if (!odd) continue;
      if (/^draw$|^empate$|^x$/i.test(nm)) out.draw = odd;
      else {
        const nn = normTeam(nm);
        if (pairMatch(nn, homeN)) out.home = odd;
        else if (pairMatch(nn, awayN)) out.away = odd;
      }
    }
  }

  // Over/Under 2.5
  const mkOU = markets.find((x: any) => {
    const nm = String(x?.market_type || x?.market_name || "");
    return /OVER_UNDER|TOTAL_GOALS|OVER\/UNDER|GOALS/i.test(nm) && /2\.?5/.test(nm);
  });
  if (mkOU?.runners) {
    for (const r of mkOU.runners) {
      const nm = String(r?.runner_name || r?.name || "");
      const odd = pickRunnerOdd(r);
      if (!odd) continue;
      if (/over/i.test(nm)) out.over25 = odd;
      else if (/under/i.test(nm)) out.under25 = odd;
    }
  }

  if (!out.home && !out.draw && !out.away && !out.over25 && !out.under25) return null;
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = performance.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: matches, error } = await supabase
      .from("live_matches")
      .select("match_id, home_team, away_team, status, minute, odds_live")
      .eq("status", "live")
      .gt("minute", 0);

    if (error) throw error;
    if (!matches || matches.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, updated: 0, breakdown: {}, ms: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega lista compacta Betfair (event_id ↔ team names)
    const compact = await getBetfairCompact();

    // OTIMIZAÇÃO: cached_odds_games é carregado SOB DEMANDA (lazy), apenas se algum
    // jogo realmente precisar de fallback. Antes era carregado sempre (payload JSON pesado).
    let cachedList: any[] | null = null;
    const loadCachedList = async (): Promise<any[]> => {
      if (cachedList !== null) return cachedList;
      const { data } = await supabase
        .from("cached_odds_games")
        .select("home_team, away_team, bookmakers")
        .gt("expires_at", new Date().toISOString())
        .gt("commence_time", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
        .lt("commence_time", new Date(Date.now() + 30 * 60 * 1000).toISOString());
      cachedList = data || [];
      return cachedList;
    };

    let updated = 0;
    const breakdown: Record<string, number> = { betfair_live: 0, cached_pre: 0, miss: 0, skipped_fresh: 0 };
    const updates: Array<{ match_id: string; payload: any }> = [];

    for (const m of matches) {
      const existing: any = m.odds_live;
      // Se já tem odd ao vivo Betfair atualizada há <40s, pula. Pré-jogo NÃO conta como fresh.
      if (existing?.updated_at && existing?.bookmaker === "Betfair") {
        const age = Date.now() - new Date(existing.updated_at).getTime();
        if (age < 40_000) { breakdown.skipped_fresh++; continue; }
      }

      const homeN = normTeam(m.home_team || "");
      const awayN = normTeam(m.away_team || "");

      let payload: any = null;

      // 1) Betfair Exchange ao vivo via event_id
      const bfMatch = compact.find((x: any) => {
        const ch = normTeam(x?.home_name || x?.home || "");
        const ca = normTeam(x?.away_name || x?.away || "");
        return pairMatch(ch, homeN) && pairMatch(ca, awayN);
      });
      if (bfMatch?.event_id) {
        const oddsData = await getBetfairOdds(String(bfMatch.event_id));
        const live = extractLiveOdds(oddsData, m.home_team || "", m.away_team || "");
        if (live) {
          payload = {
            ...live,
            bookmaker: "Betfair",
            event_id: String(bfMatch.event_id),
            updated_at: new Date().toISOString(),
          };
          breakdown.betfair_live++;
        }
      }

      // 2) Fallback pré-jogo (cached_odds_games / Pinnacle) — lazy load
      if (!payload) {
        const list = await loadCachedList();
        const cd = list.find((x: any) => {
          const ch = normTeam(x?.home_team || "");
          const ca = normTeam(x?.away_team || "");
          return pairMatch(ch, homeN) && pairMatch(ca, awayN);
        });
        if (cd?.bookmakers) {
          const sorted = [...cd.bookmakers].sort((a: any, b: any) =>
            (a?.key === "pinnacle" ? 0 : 1) - (b?.key === "pinnacle" ? 0 : 1)
          );
          for (const bk of sorted) {
            const markets = bk?.markets || [];
            const h2h = markets.find((mm: any) => mm?.key === "h2h");
            const totals = markets.find((mm: any) => mm?.key === "totals");
            let home: number | null = null, draw: number | null = null, away: number | null = null;
            if (h2h?.outcomes) {
              for (const o of h2h.outcomes) {
                const nm = String(o?.name || "");
                const nn = normTeam(nm);
                if (/^draw$|^empate$/i.test(nm)) draw = Number(o.price) || null;
                else if (pairMatch(nn, homeN)) home = Number(o.price) || null;
                else if (pairMatch(nn, awayN)) away = Number(o.price) || null;
              }
            }
            let over25: number | null = null, under25: number | null = null;
            if (totals?.outcomes) {
              const ov = totals.outcomes.find((x: any) => x?.name === "Over" && Number(x?.point) === 2.5);
              const un = totals.outcomes.find((x: any) => x?.name === "Under" && Number(x?.point) === 2.5);
              if (ov?.price) over25 = Number(ov.price);
              if (un?.price) under25 = Number(un.price);
            }
            if (home || draw || away || over25) {
              payload = {
                home, draw, away, over25, under25,
                bookmaker: "Betfair (pré-jogo)",
                updated_at: new Date().toISOString(),
              };
              breakdown.cached_pre++;
              break;
            }
          }
        }
      }

      if (!payload) { breakdown.miss++; continue; }
      updates.push({ match_id: m.match_id, payload });
    }

    for (const u of updates) {
      const { error: upErr } = await supabase
        .from("live_matches")
        .update({ odds_live: u.payload })
        .eq("match_id", u.match_id);
      if (!upErr) updated++;
      else console.warn(`[UpdateLiveOdds] update fail ${u.match_id}: ${upErr.message}`);
    }

    const ms = Math.round(performance.now() - t0);
    console.log(
      `[UpdateLiveOdds] ✅ processed=${matches.length} updated=${updated} ` +
      `betfair_live=${breakdown.betfair_live} cached_pre=${breakdown.cached_pre} ` +
      `miss=${breakdown.miss} skipped_fresh=${breakdown.skipped_fresh} ms=${ms}`,
    );

    return new Response(
      JSON.stringify({ ok: true, processed: matches.length, updated, breakdown, ms }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    console.error("[UpdateLiveOdds] FATAL:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
