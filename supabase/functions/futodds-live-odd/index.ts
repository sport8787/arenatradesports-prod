// futodds-live-odd — Odd ao vivo via Futodds.
// 1) Usa /matches-betfair-live-odds?event_id=X (10s TTL) para odds Exchange reais.
// 2) Fallback: /matches-live-full (30s TTL) campo odds_live/odds (atualiza ~1min no lado FutOdds).
import { fetchFutoddsList, fetchFutoddsCached } from "../_shared/futoddsCache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  fixture_id?: number | string; // id Futodds (campo `id` em /matches-live)
  event_id?: number | string;   // id Betfair (campo `event_id` em /matches-live)
  home?: string;
  away?: string;
  market: string;
}

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "").trim();
}

// Extrai odd do payload Exchange (/matches-betfair-live-odds): { markets: [{ market_type, runners: [...] }] }
function pickFromExchangePayload(payload: any, market: string): { odd: number | null; key: string } {
  if (!payload) return { odd: null, key: "no_exchange_payload" };
  const m = market.toLowerCase().trim();

  const markets: any[] = Array.isArray(payload?.markets) ? payload.markets
    : Array.isArray(payload?.data?.markets) ? payload.data.markets
    : Array.isArray(payload) ? payload
    : [];

  const lineMatch = m.match(/(\d+(?:\.\d+)?)/);
  const lineNum = lineMatch ? parseFloat(lineMatch[1]) : null;

  for (const mk of markets) {
    const mType = String(mk?.market_type ?? mk?.name ?? mk?.type ?? "").toLowerCase();
    const runners: any[] = Array.isArray(mk?.runners) ? mk.runners
      : Array.isArray(mk?.selections) ? mk.selections : [];

    // 1X2 / Match Odds
    if (/match.?odds|h2h|1x2|moneyline/.test(mType)) {
      for (const r of runners) {
        const rn = String(r?.selection ?? r?.runner_name ?? r?.name ?? "").toLowerCase();
        const back = r?.back?.[0]?.price ?? r?.back_price ?? r?.back ?? null;
        if (back == null || Number(back) <= 1) continue;

        const isHome = /\b(home|casa)\b/.test(m) && !/goals|gols|over|under/.test(m);
        const isAway = /\b(away|fora|visitante)\b/.test(m) && !/goals|gols|over|under/.test(m);
        const isDraw = /\b(draw|empate|x)\b/.test(m);

        if (isHome && /home|1\b|casa/.test(rn)) return { odd: Number(back), key: `exchange.${mType}.home` };
        if (isAway && /away|2\b|fora|visit/.test(rn)) return { odd: Number(back), key: `exchange.${mType}.away` };
        if (isDraw && /draw|empate|\bx\b/.test(rn)) return { odd: Number(back), key: `exchange.${mType}.draw` };
      }
    }

    // Over/Under gols
    if (/over.?under|totals|goals/i.test(mType)) {
      const isOver = /\bover\b|\bo\b/.test(m);
      const isUnder = /\bunder\b|\bu\b/.test(m);
      if (!isOver && !isUnder) continue;

      for (const r of runners) {
        const rn = String(r?.selection ?? r?.runner_name ?? r?.name ?? "").toLowerCase();
        const rLine = parseFloat(String(r?.handicap ?? r?.line ?? r?.point ?? "NaN"));
        const lineOk = lineNum == null || isNaN(rLine) || Math.abs(rLine - lineNum) < 0.01 || rn.includes(String(lineNum));
        const back = r?.back?.[0]?.price ?? r?.back_price ?? r?.back ?? null;
        if (back == null || Number(back) <= 1) continue;

        if (isOver && /over/.test(rn) && lineOk) return { odd: Number(back), key: `exchange.${mType}.over${lineNum}` };
        if (isUnder && /under/.test(rn) && lineOk) return { odd: Number(back), key: `exchange.${mType}.under${lineNum}` };
      }
    }

    // BTTS
    if (/btts|both.*score|ambas/i.test(mType)) {
      const isYes = /\b(sim|yes)\b/.test(m);
      const isNo = /\b(n[ãa]o|no)\b/.test(m);
      for (const r of runners) {
        const rn = String(r?.selection ?? r?.runner_name ?? r?.name ?? "").toLowerCase();
        const back = r?.back?.[0]?.price ?? r?.back_price ?? r?.back ?? null;
        if (back == null || Number(back) <= 1) continue;
        if (isYes && /(yes|sim)/.test(rn)) return { odd: Number(back), key: `exchange.${mType}.btts_yes` };
        if (isNo && /(no|n[ãa]o)/.test(rn)) return { odd: Number(back), key: `exchange.${mType}.btts_no` };
      }
    }

    // Asian Handicap
    if (/asian.?handicap|ah\b/i.test(mType)) {
      const isHome = /\b(home|casa)\b/.test(m);
      const isAway = /\b(away|fora)\b/.test(m);
      for (const r of runners) {
        const rn = String(r?.selection ?? r?.runner_name ?? r?.name ?? "").toLowerCase();
        const rLine = parseFloat(String(r?.handicap ?? r?.line ?? r?.point ?? "NaN"));
        const lineOk = lineNum == null || isNaN(rLine) || Math.abs(Math.abs(rLine) - Math.abs(lineNum ?? 0)) < 0.26;
        const back = r?.back?.[0]?.price ?? r?.back_price ?? r?.back ?? null;
        if (back == null || Number(back) <= 1) continue;
        if (isHome && /home|1\b|casa/.test(rn) && lineOk) return { odd: Number(back), key: `exchange.${mType}.ah_home${lineNum}` };
        if (isAway && /away|2\b|fora/.test(rn) && lineOk) return { odd: Number(back), key: `exchange.${mType}.ah_away${lineNum}` };
      }
    }
  }

  return { odd: null, key: "no_exchange_match" };
}

function pickFromOddsLive(odds: any, market: string): { odd: number | null; key: string } {
  const m = market.toLowerCase().trim();
  const lineMatch = m.match(/(\d+(?:\.\d+)?)/);
  const line = lineMatch ? lineMatch[1].replace(".", "") : null;
  const lineKey = line ? (line.length === 1 ? line + "5" : line) : null;

  const isOver = /\bover\b|\bo\b/.test(m);
  const isUnder = /\bunder\b|\bu\b/.test(m);
  const is1H = /1h|primeiro\s*tempo|first\s*half|ht/.test(m);
  const is2H = /2h|segundo\s*tempo|second\s*half/.test(m);
  const isHomeGoals = /\b(home|casa)\s+goals|gols\s*da\s*casa/.test(m);
  const isAwayGoals = /\b(away|fora)\s+goals|gols\s*do\s*visitante|gols\s*do\s*fora/.test(m);
  const isBtts = /btts|ambas\s*marcam|both\s*teams\s*to\s*score/.test(m);
  const isCorners = /corner|escanteio/.test(m);

  if (/\b(home|casa)\b/.test(m) && !isHomeGoals && !isOver && !isUnder) {
    const v = odds?.ft_result?.home; if (v) return { odd: Number(v), key: "ft_result.home" };
  }
  if (/\b(away|fora)\b/.test(m) && !isAwayGoals && !isOver && !isUnder) {
    const v = odds?.ft_result?.away; if (v) return { odd: Number(v), key: "ft_result.away" };
  }
  if (/\b(draw|empate)\b/.test(m)) {
    const v = odds?.ft_result?.draw; if (v) return { odd: Number(v), key: "ft_result.draw" };
  }

  if (isBtts) {
    const yes = /\b(sim|yes)\b/.test(m); const no = /\b(n[ãa]o|no)\b/.test(m);
    const bucket = is1H ? odds?.btts_1h : is2H ? odds?.btts_2h : odds?.btts;
    if (yes && bucket?.yes) return { odd: Number(bucket.yes), key: (is1H?"btts_1h":is2H?"btts_2h":"btts")+".yes" };
    if (no  && bucket?.no)  return { odd: Number(bucket.no),  key: (is1H?"btts_1h":is2H?"btts_2h":"btts")+".no"  };
  }

  if ((isOver || isUnder) && lineKey) {
    const sideKey = `${isOver ? "over" : "under"}_${lineKey}`;
    if (isCorners) {
      const v = odds?.corners?.[sideKey]; if (v) return { odd: Number(v), key: `corners.${sideKey}` };
    }
    if (isHomeGoals) {
      const v = odds?.home_goals?.[sideKey]; if (v) return { odd: Number(v), key: `home_goals.${sideKey}` };
    }
    if (isAwayGoals) {
      const v = odds?.away_goals?.[sideKey]; if (v) return { odd: Number(v), key: `away_goals.${sideKey}` };
    }
    const bucketName = is1H ? "total_goals_1h" : is2H ? "total_goals_2h" : "total_goals";
    const v = odds?.[bucketName]?.[sideKey];
    if (v) return { odd: Number(v), key: `${bucketName}.${sideKey}` };
  }

  return { odd: null, key: "no_match" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const KEY = Deno.env.get("FUTODDS_API_KEY");
  if (!KEY) {
    return new Response(JSON.stringify({ odd: null, source: "no_key" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ odd: null, source: "bad_body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { fixture_id, event_id, home, away, market } = body;
  if (!market || (!fixture_id && !event_id && !(home && away))) {
    return new Response(JSON.stringify({ odd: null, source: "missing_args" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Carrega lista de jogos ao vivo (30s TTL — apenas para localizar o jogo e obter event_id)
    let list: any[];
    try {
      list = await fetchFutoddsList("/matches-live-full", { ttlMs: 30_000 });
    } catch (e) {
      return new Response(JSON.stringify({ odd: null, source: String((e as Error).message) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let match: any = null;
    if (fixture_id) match = list.find((m) => String(m.id) === String(fixture_id));
    if (!match && event_id) match = list.find((m) => String(m.event_id) === String(event_id) || String(m.id_betfair) === String(event_id));
    if (!match && home && away) {
      const h = norm(home), a = norm(away);
      match = list.find((m) => norm(m.home_name || "").includes(h) && norm(m.away_name || "").includes(a))
           || list.find((m) => h.includes(norm(m.home_name || "")) && a.includes(norm(m.away_name || "")));
    }

    if (!match) {
      return new Response(JSON.stringify({ odd: null, source: "match_not_found", searched: list.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Tenta /matches-betfair-live-odds (Exchange real-time, 10s TTL — preços back/lay reais)
    const betfairEventId = String(match.event_id ?? match.id_betfair ?? "").trim();
    if (betfairEventId) {
      try {
        const exchangeRaw = await fetchFutoddsCached(
          "/matches-betfair-live-odds",
          { event_id: betfairEventId },
          { ttlMs: 10_000 },
        );
        const exchangePayload = exchangeRaw?.data ?? exchangeRaw;
        const exchangePick = pickFromExchangePayload(exchangePayload, market);
        if (exchangePick.odd != null && exchangePick.odd > 1) {
          return new Response(JSON.stringify({
            odd: exchangePick.odd,
            source: "futodds_exchange",
            key: exchangePick.key,
            match_id: match.id,
            event_id: betfairEventId,
            minute: match.elapsed,
            score: match.scores,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (e) {
        console.warn(`[futodds-live-odd] exchange fallback: ${(e as Error).message}`);
      }
    }

    // 2. Fallback: odds_live do /matches-live-full (atualiza ~1min no lado FutOdds)
    let pick = pickFromOddsLive(match.odds_live, market);
    let bucket = "odds_live";
    if (pick.odd == null) {
      pick = pickFromOddsLive(match.odds, market);
      bucket = "odds";
    }

    return new Response(JSON.stringify({
      odd: pick.odd,
      source: pick.odd ? `futodds_${bucket}` : "not_found",
      key: pick.key,
      match_id: match.id,
      event_id: match.event_id,
      minute: match.elapsed,
      score: match.scores,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ odd: null, source: "exception", error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
