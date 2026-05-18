// Edge Function: mycroft-cards-punter
// Análise híbrida de mercado de CARTÕES (migrado para Sportmonks — Fase 2)
// 1) Calcula média estatística via Sportmonks (últimos 10 jogos finalizados)
// 2) Tenta odds via The Odds API (mercado cards_totals quando disponível)
// 3) Se não há odd → salva como sinal informativo (verdict APROVADO_SITUACIONAL)
// 4) Se há odd e edge ≥ 4% → APROVADO normal

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { smSearchTeam, getTeamCardsAvgSM } from "../_shared/sportmonks-af-adapter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ODDS_KEY = Deno.env.get("THE_ODDS_API_KEY") || "";

const TIME_GUARD_MS = 100_000;
const MAX_GAMES = 25;
const MIN_EDGE = 4;

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  league?: string;
  sport_key?: string;
}

// ═════════════════════════════════════════════════════
// Buscar team via Sportmonks
// ═════════════════════════════════════════════════════
async function findTeam(name: string) {
  return await smSearchTeam(name);
}

// ═════════════════════════════════════════════════════
// Média de cartões — Sportmonks
// ═════════════════════════════════════════════════════
async function buscarMediaCartoes(teamId: number) {
  return await getTeamCardsAvgSM(teamId, 10);
}

// ═════════════════════════════════════════════════════
// Buscar odds de cartões (raro, mas possível)
// ═════════════════════════════════════════════════════
async function buscarOddsCartoes(eventId: string, sportKey: string) {
  if (!ODDS_KEY) return null;
  try {
    // The Odds API tem 'totals' para cartões em algumas ligas como 'cards_totals'
    const url =
      `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds?regions=eu,uk&markets=cards_totals,cards_over_under&apiKey=${ODDS_KEY}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ═════════════════════════════════════════════════════
// Buscar jogos
// ═════════════════════════════════════════════════════
async function buscarJogos(): Promise<Game[]> {
  if (!ODDS_KEY) return [];
  const url =
    `https://api.the-odds-api.com/v4/sports/soccer/odds/?regions=eu,uk&markets=h2h&apiKey=${ODDS_KEY}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  const now = Date.now();
  const horizon = now + 36 * 3600 * 1000;
  return (data || [])
    .filter((g: any) => {
      const t = new Date(g.commence_time).getTime();
      return t > now && t < horizon;
    })
    .slice(0, MAX_GAMES);
}

// ═════════════════════════════════════════════════════
// Avaliar mercado de cartões
// ═════════════════════════════════════════════════════
function avaliarCartoes(media: any, oddsBlob: any) {
  // Linhas comuns: 4.5 / 5.5 / 6.5
  const total = media.avg_total_jogo;

  // Determinar recomendação
  let linha = 4.5;
  let lado: "Over" | "Under" = "Over";
  let margem = 0;

  const linhas = [3.5, 4.5, 5.5, 6.5];
  // Procura a linha com maior margem absoluta
  for (const L of linhas) {
    const m = Math.abs(total - L);
    if (m > margem) {
      margem = m;
      linha = L;
      lado = total > L ? "Over" : "Under";
    }
  }

  // Probabilidade aproximada via Poisson para cartões (lambda = total)
  const lambda = total;
  // Aproxima P(X > linha) usando soma de Poisson
  const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
  const pmf = (k: number) => (Math.pow(lambda, k) * Math.exp(-lambda)) / fact(k);
  let pUnder = 0;
  for (let k = 0; k <= Math.floor(linha); k++) pUnder += pmf(k);
  const pOver = 1 - pUnder;
  const prob = lado === "Over" ? pOver : pUnder;

  // Procura odd no blob
  let odd: number | null = null;
  let bookmaker = "—";
  if (oddsBlob?.bookmakers?.length) {
    for (const bk of oddsBlob.bookmakers) {
      const m = bk.markets?.find((x: any) =>
        x.key?.includes("cards") && x.key?.includes("total")
      );
      if (!m) continue;
      const oc = m.outcomes?.find((o: any) =>
        (o.name || "").toLowerCase() === lado.toLowerCase() &&
        Math.abs(parseFloat(o.point) - linha) < 0.01
      );
      if (oc?.price) {
        odd = oc.price;
        bookmaker = bk.title;
        break;
      }
    }
  }

  return {
    linha,
    lado,
    market: `${lado} ${linha} Cartões`,
    prob,
    odd,
    bookmaker,
    margem,
    media_total: total,
    media_amostra: media.sample,
  };
}

// ═════════════════════════════════════════════════════
// Salvar
// ═════════════════════════════════════════════════════
async function salvar(sb: any, g: Game, sinal: any) {
  const hasOdd = sinal.odd != null && sinal.odd > 1.4;
  let edge = 0;
  let verdict = "APROVADO_SITUACIONAL"; // sem odd = informativo
  if (hasOdd) {
    edge = ((sinal.prob * sinal.odd) - 1) * 100;
    if (edge < MIN_EDGE) return false;
    verdict = "APROVADO";
  }

  const conf = Math.min(80, Math.max(55, Math.round(sinal.prob * 100)));
  const stake = edge >= 8 ? 4 : edge >= 6 ? 3 : 2;
  const tier = edge >= 8 ? "Tier 1" : edge >= 6 ? "Tier 2" : "Tier 3";

  const row = {
    match_id: g.id,
    home_team: g.home_team,
    away_team: g.away_team,
    league: g.league || "Football",
    commence_time: g.commence_time,
    market: sinal.market,
    bookmaker: sinal.bookmaker,
    odd: hasOdd ? sinal.odd : 0,
    fair_odd: Number((1 / sinal.prob).toFixed(2)),
    implied_probability: hasOdd ? Number((1 / sinal.odd).toFixed(4)) : null,
    estimated_probability: Number(sinal.prob.toFixed(4)),
    value_percentage: hasOdd ? Number(edge.toFixed(2)) : 0,
    verdict,
    confidence: conf,
    stake_percentage: hasOdd ? stake : 1,
    thesis: hasOdd
      ? `Cartões — média histórica ${sinal.media_total.toFixed(1)} (n=${sinal.media_amostra}) sugere ${sinal.lado} ${sinal.linha} com edge ${edge.toFixed(1)}%`
      : `Sinal informativo — média ${sinal.media_total.toFixed(1)} cartões/jogo (n=${sinal.media_amostra}). Tese: ${sinal.lado} ${sinal.linha}. Procure odd na sua casa.`,
    analysis: `Margem entre média (${sinal.media_total.toFixed(2)}) e linha (${sinal.linha}) = ${sinal.margem.toFixed(2)}`,
    risk_factors:
      "Mercado de cartões é volátil — depende de árbitro, importância e estilo das equipes",
    analyzed_by: `${tier} - mycroft-cards-punter`,
  };

  const { error } = await sb.from("punter_analyses").upsert(row, {
    onConflict: "match_id,market",
    ignoreDuplicates: true,
  });
  if (error) {
    console.error("[cards] insert error:", error.message);
    return false;
  }
  return true;
}

// ═════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const games = await buscarJogos();
    console.log(`[cards] ${games.length} jogos para analisar`);
    let aprovados = 0, informativos = 0;

    for (const g of games) {
      if (Date.now() - startedAt > TIME_GUARD_MS) {
        console.warn("[cards] Time guard atingido");
        break;
      }

      try {
        const [th, ta] = await Promise.all([
          findTeam(g.home_team),
          findTeam(g.away_team),
        ]);
        if (!th || !ta) continue;

        const [mh, ma] = await Promise.all([
          buscarMediaCartoes(th.id),
          buscarMediaCartoes(ta.id),
        ]);
        if (!mh || !ma) continue;

        const mediaCombinada = {
          avg_total_jogo: (mh.avg_total_jogo + ma.avg_total_jogo) / 2,
          avg_recebidos: mh.avg_recebidos + ma.avg_recebidos,
          sample: Math.min(mh.sample, ma.sample),
        };

        const oddsBlob = await buscarOddsCartoes(g.id, g.sport_key || "soccer_epl");
        const sinal = avaliarCartoes(mediaCombinada, oddsBlob);

        // Publica se margem ≥ 0.5 cartões (mais permissivo)
        if (sinal.margem < 0.5) continue;

        const ok = await salvar(sb, g, sinal);
        if (ok) {
          if (sinal.odd) aprovados++;
          else informativos++;
        }
      } catch (err) {
        console.error(`[cards] erro em ${g.home_team} vs ${g.away_team}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed: games.length,
        approved: aprovados,
        informative: informativos,
        elapsed_ms: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[cards] erro fatal:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
