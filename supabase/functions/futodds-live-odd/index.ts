// futodds-live-odd — Odd ao vivo via Futodds /matches-live-full (campo odds_live).
// Mapeia mercado livre ("Over 2.5 Total", "BTTS Sim", "Casa", "Asian Handicap Home -1")
// para a odd correta. Substitui fetch-sportmonks-live-odd como provedor primário.
// Usa cache 30s compartilhado (_shared/futoddsCache.ts) para evitar bursts no provedor.
import { fetchFutoddsList } from "../_shared/futoddsCache.ts";

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

function authHeaders(key: string) {
  return { Authorization: `Bearer ${key}`, "X-API-Key": key, Accept: "application/json" };
}

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "").trim();
}

function pickFromOddsLive(odds: any, market: string): { odd: number | null; key: string } {
  const m = market.toLowerCase().trim();
  const lineMatch = m.match(/(\d+(?:\.\d+)?)/);
  const line = lineMatch ? lineMatch[1].replace(".", "") : null; // "2.5" -> "25"
  const lineKey = line ? (line.length === 1 ? line + "5" : line) : null;
  // ex: 2.5 -> "25", 0.5 -> "05", 1.5 -> "15"

  const isOver = /\bover\b|\bo\b/.test(m);
  const isUnder = /\bunder\b|\bu\b/.test(m);
  const is1H = /1h|primeiro\s*tempo|first\s*half|ht/.test(m);
  const is2H = /2h|segundo\s*tempo|second\s*half/.test(m);
  const isHomeGoals = /\b(home|casa)\s+goals|gols\s*da\s*casa/.test(m);
  const isAwayGoals = /\b(away|fora)\s+goals|gols\s*do\s*visitante|gols\s*do\s*fora/.test(m);
  const isBtts = /btts|ambas\s*marcam|both\s*teams\s*to\s*score/.test(m);
  const isCorners = /corner|escanteio/.test(m);

  // 1X2
  if (/\b(home|casa)\b/.test(m) && !isHomeGoals && !isOver && !isUnder) {
    const v = odds?.ft_result?.home; if (v) return { odd: Number(v), key: "ft_result.home" };
  }
  if (/\b(away|fora)\b/.test(m) && !isAwayGoals && !isOver && !isUnder) {
    const v = odds?.ft_result?.away; if (v) return { odd: Number(v), key: "ft_result.away" };
  }
  if (/\b(draw|empate)\b/.test(m)) {
    const v = odds?.ft_result?.draw; if (v) return { odd: Number(v), key: "ft_result.draw" };
  }

  // BTTS
  if (isBtts) {
    const yes = /\b(sim|yes)\b/.test(m); const no = /\b(n[ãa]o|no)\b/.test(m);
    const bucket = is1H ? odds?.btts_1h : is2H ? odds?.btts_2h : odds?.btts;
    if (yes && bucket?.yes) return { odd: Number(bucket.yes), key: (is1H?"btts_1h":is2H?"btts_2h":"btts")+".yes" };
    if (no  && bucket?.no)  return { odd: Number(bucket.no),  key: (is1H?"btts_1h":is2H?"btts_2h":"btts")+".no"  };
  }

  // Over/Under (corners → escanteios)
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

    // Tenta odds_live primeiro (atualiza a cada minuto), cai em odds (pré + ajustada por minuto)
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
