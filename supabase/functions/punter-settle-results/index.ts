import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_FOOTBALL_KEY = Deno.env.get("API_FOOTBALL_KEY")!;
const API_BASE = "https://v3.football.api-sports.io";

interface Analysis {
  id: string;
  match_id: string;
  home_team: string;
  away_team: string;
  league: string;
  commence_time: string;
  market: string;
  odd: number;
  stake_percentage: number | null;
  settle_attempts: number;
}

// Normaliza nome para matching (remove acentos, lowercase, espaços extras)
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|sc|ec|club|de|cd|afc|ac)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function teamsMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  // partial match: um contém o outro (mín 4 chars)
  if (na.length >= 4 && nb.includes(na)) return true;
  if (nb.length >= 4 && na.includes(nb)) return true;
  return false;
}

async function fetchFixture(home: string, away: string, isoDate: string) {
  const date = isoDate.slice(0, 10); // YYYY-MM-DD
  const url = `${API_BASE}/fixtures?date=${date}`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": API_FOOTBALL_KEY },
  });
  if (!res.ok) {
    console.error(`API-Football erro: ${res.status}`);
    return null;
  }
  const data = await res.json();
  const fixtures = data.response || [];
  const match = fixtures.find((f: any) => {
    const h = f.teams?.home?.name || "";
    const a = f.teams?.away?.name || "";
    return teamsMatch(h, home) && teamsMatch(a, away);
  });
  return match || null;
}

// Liquida o mercado dado o placar final + nomes dos times (para reconhecer "Botafogo para vencer" etc.)
function settleMarket(
  market: string,
  scoreH: number,
  scoreA: number,
  homeTeam = "",
  awayTeam = "",
): "GREEN" | "RED" | "VOID" | null {
  const m = market.toLowerCase().trim();
  const total = scoreH + scoreA;
  const nh = normalize(homeTeam);
  const na = normalize(awayTeam);
  const mn = normalize(market);

  // Vitória casa / fora / empate
  if (m === "casa" || m === "1" || m.includes("vitória casa") || m.includes("vitoria casa")) {
    return scoreH > scoreA ? "GREEN" : "RED";
  }
  if (m === "fora" || m === "2" || m.includes("vitória fora") || m.includes("vitoria fora")) {
    return scoreA > scoreH ? "GREEN" : "RED";
  }
  if (m === "empate" || m === "x" || m === "draw") {
    return scoreH === scoreA ? "GREEN" : "RED";
  }

  // Over / Under
  const overMatch = m.match(/over\s*(\d+(?:\.\d+)?)/);
  if (overMatch) {
    const line = parseFloat(overMatch[1]);
    if (total > line) return "GREEN";
    if (total < line) return "RED";
    return "VOID";
  }
  const underMatch = m.match(/under\s*(\d+(?:\.\d+)?)/);
  if (underMatch) {
    const line = parseFloat(underMatch[1]);
    if (total < line) return "GREEN";
    if (total > line) return "RED";
    return "VOID";
  }

  // BTTS
  if (m.includes("ambas marcam") || m.includes("btts sim") || m === "btts") {
    return scoreH >= 1 && scoreA >= 1 ? "GREEN" : "RED";
  }
  if (m.includes("btts não") || m.includes("btts nao") || m.includes("ambas não marcam")) {
    return scoreH === 0 || scoreA === 0 ? "GREEN" : "RED";
  }

  // Dupla chance
  if (m.includes("1x") || m.includes("casa ou empate")) {
    return scoreH >= scoreA ? "GREEN" : "RED";
  }
  if (m.includes("x2") || m.includes("fora ou empate")) {
    return scoreA >= scoreH ? "GREEN" : "RED";
  }
  if (m.includes("12") || m.includes("casa ou fora")) {
    return scoreH !== scoreA ? "GREEN" : "RED";
  }

  // Asian Handicap simples — ex: "AH +0.5 Away", "AH -1 Home", "Handicap Asiático -0.5 Casa"
  // Só linhas inteiras/meias (não 1/4); para 1/4 retorna null para evitar erro
  const ahMatch = m.match(/(?:ah|handicap[^\d-+]*)\s*([+-]?\d+(?:\.\d+)?)\s*(home|away|casa|fora)/);
  if (ahMatch) {
    const line = parseFloat(ahMatch[1]);
    const side = ahMatch[2];
    if ((line * 4) % 1 !== 0) return null; // linhas tipo 0.25, 0.75 → não suportado
    const isHome = side === "home" || side === "casa";
    const adjusted = isHome ? scoreH + line - scoreA : scoreA + line - scoreH;
    if (adjusted > 0) return "GREEN";
    if (adjusted < 0) return "RED";
    // adjusted === 0 → push em linha inteira
    if (line % 1 === 0) return "VOID";
    // linha .5 nunca empata
    return "RED";
  }

  // Vitória do time pelo NOME — ex: "Botafogo para vencer", "Getafe", "Vitória Arouca", "SC Telstar para vencer"
  if (nh && (mn === nh || mn.includes(nh))) {
    return scoreH > scoreA ? "GREEN" : "RED";
  }
  if (na && (mn === na || mn.includes(na))) {
    return scoreA > scoreH ? "GREEN" : "RED";
  }

  console.warn(`Mercado não reconhecido para liquidação: ${market}`);
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Busca sinais aprovados (todos os verdicts ativos), jogo terminou há +2h, ainda não liquidados.
    // Inclui APROVADO_SITUACIONAL e LABAREDA — antes só pegava APROVADO, deixando milhares pendentes.
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: pending, error } = await supabase
      .from("punter_analyses")
      .select("id, match_id, home_team, away_team, league, commence_time, market, odd, stake_percentage, settle_attempts")
      .in("verdict", ["APROVADO", "APROVADO_SITUACIONAL", "LABAREDA"])
      .is("result", null)
      .lt("commence_time", cutoff)
      .lt("settle_attempts", 8)
      .order("commence_time", { ascending: true })
      .limit(120);

    if (error) throw error;

    const items = (pending || []) as Analysis[];
    console.log(`🎯 ${items.length} sinais para liquidar`);

    let settled = 0;
    let notFound = 0;
    let unsupported = 0;
    const results: any[] = [];

    for (const a of items) {
      try {
        const fixture = await fetchFixture(a.home_team, a.away_team, a.commence_time);

        // Atualiza tentativa
        await supabase
          .from("punter_analyses")
          .update({
            settle_attempts: (a.settle_attempts || 0) + 1,
            last_settle_attempt_at: new Date().toISOString(),
          })
          .eq("id", a.id);

        if (!fixture) {
          notFound++;
          results.push({ id: a.id, status: "fixture_not_found" });
          continue;
        }

        const status = fixture.fixture?.status?.short;
        // Só liquida se jogo terminou: FT (full time), AET (after extra time), PEN (penalties)
        if (!["FT", "AET", "PEN"].includes(status)) {
          results.push({ id: a.id, status: `not_finished_${status}` });
          continue;
        }

        const scoreH = fixture.goals?.home ?? 0;
        const scoreA = fixture.goals?.away ?? 0;

        const result = settleMarket(a.market, scoreH, scoreA, a.home_team, a.away_team);
        if (!result) {
          unsupported++;
          results.push({ id: a.id, status: "market_unsupported", market: a.market });
          continue;
        }

        // Calcula PnL em unidades (1u = 1% banca)
        const stake = a.stake_percentage ?? 1;
        const pnl =
          result === "GREEN"
            ? stake * (Number(a.odd) - 1)
            : result === "RED"
            ? -stake
            : 0;

        await supabase
          .from("punter_analyses")
          .update({
            result,
            final_score_home: scoreH,
            final_score_away: scoreA,
            settled_at: new Date().toISOString(),
            profit_loss: pnl,
          })
          .eq("id", a.id);

        settled++;
        results.push({
          id: a.id,
          match: `${a.home_team} ${scoreH}-${scoreA} ${a.away_team}`,
          market: a.market,
          result,
          pnl,
        });
      } catch (e) {
        console.error(`Erro ao liquidar ${a.id}:`, e);
        results.push({ id: a.id, status: "error", error: String(e) });
      }
    }

    // Dispara envio dos resultados pro Telegram
    if (settled > 0) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/punter-telegram-results`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({}),
        });
      } catch (e) {
        console.error("Erro ao chamar punter-telegram-results:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: items.length,
        settled,
        not_found: notFound,
        unsupported,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("punter-settle-results error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
