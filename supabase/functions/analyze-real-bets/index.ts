// Edge Function: analyze-real-bets
// Cruza apostas REAIS do usuário (bets_history source='betfair') com sinais Mycroft (mycroft_analyses)
// Identifica:
//   1) Apostas REDs que iam contra um sinal APROVADO (ignorou veto)
//   2) Apostas REDs sem suporte de nenhum sinal (entrada cega)
//   3) Apostas GREENs alinhadas com APROVADO (boas decisões)
//   4) CLV (Closing Line Value) — odd entrada vs odd close
//   5) Padrões de erro: odds fora de range, tilt streak, mercados problemáticos
//   6) Sugestões personalizadas geradas via Lovable AI Gateway

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_AI_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

// Janela de tolerância entre horário da aposta e horário da análise (minutos)
const TIME_WINDOW_MIN = 30;

interface RealBet {
  id: string;
  match_id: string | null;
  home_team: string | null;
  away_team: string | null;
  league: string | null;
  market: string;
  odd: number;
  odd_close: number | null;
  stake: number;
  result: string | null;
  profit_loss: number | null;
  placed_at: string | null;
  created_at: string;
  bookmaker: string | null;
  source: string;
}

interface MycroftSignal {
  id: string;
  match_id: string;
  market: string;
  verdict: string;
  odd: number | null;
  confidence: number | null;
  thesis: string;
  created_at: string;
}

interface MatchedBet extends RealBet {
  matched_signal: MycroftSignal | null;
  alignment: 'aligned_won' | 'aligned_lost' | 'against_signal' | 'no_signal' | 'pending';
  clv_pct: number | null;
  error_tags: string[];
}

function normalizeMarket(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function marketsEquivalent(a: string, b: string): boolean {
  const na = normalizeMarket(a);
  const nb = normalizeMarket(b);
  if (na === nb) return true;
  // Match parcial robusto: se um contém o outro como token
  const ta = na.split(" ");
  const tb = nb.split(" ");
  const overlap = ta.filter(t => tb.includes(t)).length;
  return overlap >= Math.min(2, Math.min(ta.length, tb.length));
}

function findMatchingSignal(bet: RealBet, signals: MycroftSignal[]): MycroftSignal | null {
  if (!bet.placed_at && !bet.created_at) return null;
  const betTime = new Date(bet.placed_at || bet.created_at).getTime();
  const homeNorm = (bet.home_team || "").toLowerCase().slice(0, 8);
  const awayNorm = (bet.away_team || "").toLowerCase().slice(0, 8);

  // 1) Tenta match estrito por match_id + mercado equivalente
  if (bet.match_id) {
    const exact = signals.find(s => s.match_id === bet.match_id && marketsEquivalent(s.market, bet.market));
    if (exact) return exact;
  }

  // 2) Match por times + janela de tempo + mercado equivalente
  return signals.find(s => {
    const sigTime = new Date(s.created_at).getTime();
    const diffMin = Math.abs(betTime - sigTime) / 60000;
    if (diffMin > TIME_WINDOW_MIN * 60) return false; // janela ampla 30h para sinais pré-jogo
    const sigMatchLower = s.match_id.toLowerCase();
    const teamsMatch = (homeNorm && sigMatchLower.includes(homeNorm)) ||
                       (awayNorm && sigMatchLower.includes(awayNorm));
    return teamsMatch && marketsEquivalent(s.market, bet.market);
  }) || null;
}

function classifyAlignment(bet: RealBet, signal: MycroftSignal | null): MatchedBet['alignment'] {
  if (!bet.result || bet.result === 'pending') return 'pending';
  if (!signal) return 'no_signal';
  const isApproved = ['APROVADO', 'APROVADO_SITUACIONAL', 'LABAREDA'].includes(signal.verdict);
  const isVetoed = signal.verdict === 'VETADO';
  const won = bet.result === 'green' || bet.result === 'won';

  if (isApproved && won) return 'aligned_won';
  if (isApproved && !won) return 'aligned_lost';
  if (isVetoed) return 'against_signal';
  return 'no_signal';
}

function detectErrorTags(bet: RealBet, signal: MycroftSignal | null): string[] {
  const tags: string[] = [];
  if (bet.odd < 1.50) tags.push('odd_baixa');
  if (bet.odd > 3.50) tags.push('odd_alta_risco');
  if (signal?.verdict === 'VETADO') tags.push('ignorou_veto');
  if (!signal && (bet.result === 'red' || bet.result === 'lost')) tags.push('entrada_cega');
  if (bet.stake > 0 && bet.profit_loss != null && bet.profit_loss < -bet.stake * 0.9) tags.push('perda_total');
  return tags;
}

function calculateCLV(bet: RealBet): number | null {
  if (!bet.odd_close || bet.odd_close <= 1 || bet.odd <= 1) return null;
  // CLV = (probEntrada - probClose) / probClose
  const pEntry = 1 / bet.odd;
  const pClose = 1 / bet.odd_close;
  return ((pEntry - pClose) / pClose) * 100;
}

async function generateInsights(matched: MatchedBet[]): Promise<string> {
  if (!LOVABLE_AI_KEY) return "IA indisponível — adicione LOVABLE_API_KEY.";

  const reds = matched.filter(m => ['aligned_lost', 'against_signal', 'no_signal'].includes(m.alignment) && (m.result === 'red' || m.result === 'lost'));
  const greens = matched.filter(m => m.alignment === 'aligned_won');
  const ignoredVetoes = matched.filter(m => m.error_tags.includes('ignorou_veto'));
  const blindEntries = matched.filter(m => m.error_tags.includes('entrada_cega'));

  const summary = {
    total: matched.length,
    reds: reds.length,
    greens: greens.length,
    ignored_vetoes: ignoredVetoes.length,
    blind_entries: blindEntries.length,
    avg_odd_red: reds.length ? (reds.reduce((s, m) => s + m.odd, 0) / reds.length).toFixed(2) : '0',
    sample_reds: reds.slice(0, 5).map(r => ({
      market: r.market,
      odd: r.odd,
      teams: `${r.home_team} vs ${r.away_team}`,
      tags: r.error_tags,
      had_signal: !!r.matched_signal,
      signal_verdict: r.matched_signal?.verdict,
    })),
  };

  const prompt = `Você é o Hórus Punter, IA analista de apostas esportivas. Analise o histórico real do usuário na Betfair e gere recomendações curtas e práticas em PT-BR.

DADOS:
${JSON.stringify(summary, null, 2)}

Gere uma resposta em markdown com:
1. **Diagnóstico** (2 linhas) — padrão dominante de erro
2. **3 Sugestões Acionáveis** — bullets curtos, específicos
3. **Alerta principal** (1 linha) — o erro mais caro a evitar

Tom: direto, dedutivo, sem rodeios. Máximo 200 palavras.`;

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_AI_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) return `Erro IA (${r.status})`;
    const data = await r.json();
    return data.choices?.[0]?.message?.content || "Sem resposta da IA.";
  } catch (e: any) {
    return `Erro IA: ${e.message}`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Carrega apostas REAIS do usuário (Betfair) — últimos 60 dias
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
    const { data: bets, error: betsErr } = await sb
      .from("bets_history")
      .select("id, match_id, home_team, away_team, league, market, odd, odd_close, stake, result, profit_loss, placed_at, created_at, bookmaker, source")
      .eq("user_id", user.id)
      .eq("source", "betfair")
      .gte("created_at", sixtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(500);

    if (betsErr) throw betsErr;
    const realBets = (bets || []) as RealBet[];

    // 2) Carrega sinais Mycroft do mesmo período
    const { data: signals, error: sigErr } = await sb
      .from("mycroft_analyses")
      .select("id, match_id, market, verdict, odd, confidence, thesis, created_at")
      .gte("created_at", sixtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (sigErr) throw sigErr;
    const mycroftSignals = (signals || []) as MycroftSignal[];

    // 3) Cruza
    const matched: MatchedBet[] = realBets.map(bet => {
      const sig = findMatchingSignal(bet, mycroftSignals);
      return {
        ...bet,
        matched_signal: sig,
        alignment: classifyAlignment(bet, sig),
        clv_pct: calculateCLV(bet),
        error_tags: detectErrorTags(bet, sig),
      };
    });

    // 4) Stats agregadas
    const settled = matched.filter(m => m.alignment !== 'pending');
    const totalPL = settled.reduce((s, m) => s + (m.profit_loss || 0), 0);
    const totalStake = settled.reduce((s, m) => s + (m.stake || 0), 0);
    const roi = totalStake > 0 ? (totalPL / totalStake) * 100 : 0;
    const clvAvg = matched.filter(m => m.clv_pct != null).reduce((s, m, _, arr) => s + (m.clv_pct! / arr.length), 0);

    const stats = {
      total_bets: matched.length,
      settled: settled.length,
      pending: matched.length - settled.length,
      greens: settled.filter(m => m.result === 'green' || m.result === 'won').length,
      reds: settled.filter(m => m.result === 'red' || m.result === 'lost').length,
      total_pl: Number(totalPL.toFixed(2)),
      total_stake: Number(totalStake.toFixed(2)),
      roi_pct: Number(roi.toFixed(2)),
      avg_clv_pct: Number(clvAvg.toFixed(2)),
      aligned_won: matched.filter(m => m.alignment === 'aligned_won').length,
      aligned_lost: matched.filter(m => m.alignment === 'aligned_lost').length,
      against_signal: matched.filter(m => m.alignment === 'against_signal').length,
      no_signal: matched.filter(m => m.alignment === 'no_signal').length,
      ignored_vetoes: matched.filter(m => m.error_tags.includes('ignorou_veto')).length,
      blind_entries: matched.filter(m => m.error_tags.includes('entrada_cega')).length,
    };

    // 5) Insights via IA (apenas se houver dados suficientes)
    const insights = matched.length >= 5 ? await generateInsights(matched) : "Importe pelo menos 5 apostas para receber insights da IA.";

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        insights,
        bets: matched.slice(0, 100), // limita payload
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[analyze-real-bets] erro:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
