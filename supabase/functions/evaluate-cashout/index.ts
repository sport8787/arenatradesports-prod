import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Evaluate Cash Out values for pending virtual_bets (Sports Trading)
 * 
 * Betfair-style cashout formula:
 *   cashout_value = stake × (entry_odd / current_odd)
 * 
 * Mycroft evaluates whether conditions have changed and signals cashout.
 * If auto_cashout_enabled, executes automatically.
 */

interface OpenPosition {
  id: string;
  user_id: string;
  match_id: string;
  match_name: string;
  market: string;
  odd: number;
  stake: number;
  entry_odd: number | null;
  current_odd: number | null;
  signal_id: string | null;
  auto_cashout_enabled: boolean;
  created_at: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch all pending positions from virtual_bets (Sports Trading only)
    const { data: positions, error: posErr } = await supabase
      .from('virtual_bets')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (posErr || !positions || positions.length === 0) {
      return new Response(JSON.stringify({
        message: 'Nenhuma posição aberta para avaliar',
        evaluated: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[evaluate-cashout] ${positions.length} open positions to evaluate`);

    // 2. For each position, find the live match and evaluate
    let evaluated = 0;
    let autoCashedOut = 0;
    const results: any[] = [];

    for (const pos of positions) {
      try {
        // Find the live match for this position
        const { data: liveMatch } = await supabase
          .from('live_matches')
          .select('*, mycroft_analysis_id')
          .eq('match_id', pos.match_id)
          .maybeSingle();

        if (!liveMatch) {
          console.log(`[evaluate-cashout] No live match for ${pos.match_name} — skipping`);
          continue;
        }

        // Skip if match is not live anymore
        if (liveMatch.status !== 'live' && liveMatch.status !== 'halftime') {
          console.log(`[evaluate-cashout] Match ${pos.match_name} status=${liveMatch.status} — skipping`);
          continue;
        }

        const stats = liveMatch.stats as any || {};
        const entryOdd = pos.entry_odd || pos.odd;
        const minute = liveMatch.minute || 0;
        const scoreHome = liveMatch.score_home ?? 0;
        const scoreAway = liveMatch.score_away ?? 0;

        // 3. Ask Mycroft to evaluate current position and estimate current odd
        const evalPrompt = buildEvalPrompt({
          matchName: pos.match_name,
          market: pos.market,
          entryOdd: entryOdd,
          stake: pos.stake,
          minute,
          scoreHome,
          scoreAway,
          homeTeam: liveMatch.home_team,
          awayTeam: liveMatch.away_team,
          stats,
          championship: liveMatch.championship,
        });

        const aiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: evalPrompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: 'OBJECT',
                  properties: {
                    current_odd: { type: 'NUMBER' },
                    should_cashout: { type: 'BOOLEAN' },
                    cashout_reason: { type: 'STRING' },
                    confidence: { type: 'INTEGER' },
                    position_health: { type: 'STRING', enum: ['HEALTHY', 'WARNING', 'CRITICAL'] },
                  },
                  required: ['current_odd', 'should_cashout', 'cashout_reason', 'confidence', 'position_health'],
                },
                temperature: 0.3,
                maxOutputTokens: 1024,
              },
            }),
          }
        );

        if (!aiResponse.ok) {
          console.error(`[evaluate-cashout] AI error for ${pos.match_name}: ${aiResponse.status}`);
          continue;
        }

        const aiData = await aiResponse.json();
        const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let evaluation;
        try {
          evaluation = JSON.parse(rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
        } catch {
          console.error(`[evaluate-cashout] Failed to parse AI response for ${pos.match_name}`);
          continue;
        }

        const currentOdd = Math.max(1.01, evaluation.current_odd || entryOdd);
        // Betfair cashout formula: cashout_value = stake × (entry_odd / current_odd)
        const cashoutValue = parseFloat((pos.stake * (entryOdd / currentOdd)).toFixed(2));

        console.log(`[evaluate-cashout] ${pos.match_name} | entry@${entryOdd} → now@${currentOdd} | cashout=R$${cashoutValue} | health=${evaluation.position_health} | signal=${evaluation.should_cashout}`);

        // 4. Update position with cashout data
        await supabase
          .from('virtual_bets')
          .update({
            current_odd: currentOdd,
            cashout_value: cashoutValue,
            cashout_odd: currentOdd,
            mycroft_cashout_signal: evaluation.should_cashout,
            mycroft_cashout_reason: evaluation.should_cashout ? evaluation.cashout_reason : null,
            last_cashout_update: new Date().toISOString(),
          })
          .eq('id', pos.id);

        evaluated++;
        results.push({
          bet_id: pos.id,
          match: pos.match_name,
          entry_odd: entryOdd,
          current_odd: currentOdd,
          cashout_value: cashoutValue,
          stake: pos.stake,
          pnl: parseFloat((cashoutValue - pos.stake).toFixed(2)),
          health: evaluation.position_health,
          signal: evaluation.should_cashout,
          reason: evaluation.cashout_reason,
        });

        // 5. Auto cash out if enabled and signaled
        if (pos.auto_cashout_enabled && evaluation.should_cashout) {
          console.log(`[evaluate-cashout] AUTO CASHOUT: ${pos.match_name} → R$${cashoutValue}`);

          // Return cashout value to bankroll
          const { data: bankrollData } = await supabase
            .from('sports_bankroll')
            .select('*')
            .eq('user_id', pos.user_id)
            .single();

          if (bankrollData) {
            const profitLoss = parseFloat((cashoutValue - pos.stake).toFixed(2));
            const isProfit = profitLoss >= 0;

            await supabase
              .from('virtual_bets')
              .update({
                status: 'cashed_out',
                profit_loss: profitLoss,
                cashed_out_at: new Date().toISOString(),
              })
              .eq('id', pos.id);

            await supabase
              .from('sports_bankroll')
              .update({
                balance: parseFloat(((bankrollData.balance || 0) + cashoutValue).toFixed(2)),
                total_profit: parseFloat(((bankrollData.total_profit || 0) + profitLoss).toFixed(2)),
                green_bets: (bankrollData.green_bets || 0) + (isProfit ? 1 : 0),
                red_bets: (bankrollData.red_bets || 0) + (isProfit ? 0 : 1),
                win_rate: (() => {
                  const g = (bankrollData.green_bets || 0) + (isProfit ? 1 : 0);
                  const r = (bankrollData.red_bets || 0) + (isProfit ? 0 : 1);
                  return g + r > 0 ? (g / (g + r)) * 100 : 0;
                })(),
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', pos.user_id);

            autoCashedOut++;
          }
        }
      } catch (e) {
        console.error(`[evaluate-cashout] Error evaluating ${pos.match_name}:`, e);
      }
    }

    return new Response(JSON.stringify({
      message: `${evaluated} posições avaliadas, ${autoCashedOut} auto-cashouts`,
      evaluated,
      auto_cashed_out: autoCashedOut,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[evaluate-cashout] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildEvalPrompt(ctx: {
  matchName: string;
  market: string;
  entryOdd: number;
  stake: number;
  minute: number;
  scoreHome: number;
  scoreAway: number;
  homeTeam: string;
  awayTeam: string;
  stats: any;
  championship: string;
}): string {
  return `# MYCROFT — AVALIAÇÃO DE POSIÇÃO ABERTA (TRADING EXCHANGE)

Você é o Mycroft, avaliando uma posição aberta na Betfair Exchange.

## POSIÇÃO ATUAL
- Jogo: ${ctx.championship} — ${ctx.homeTeam} ${ctx.scoreHome} x ${ctx.scoreAway} ${ctx.awayTeam}
- Minuto: ${ctx.minute}'
- Mercado: ${ctx.market}
- Odd de Entrada: ${ctx.entryOdd}
- Stake: R$ ${ctx.stake}

## ESTATÍSTICAS AO VIVO
- Posse: ${ctx.stats.possession_home ?? '?'}% vs ${ctx.stats.possession_away ?? '?'}%
- Ataques Perigosos: ${ctx.stats.dangerous_attacks_home ?? ctx.stats.attacks_home ?? '?'} vs ${ctx.stats.dangerous_attacks_away ?? ctx.stats.attacks_away ?? '?'}
- Chutes (Total): ${ctx.stats.shots_total_home ?? ctx.stats.shots_home ?? '?'} vs ${ctx.stats.shots_total_away ?? ctx.stats.shots_away ?? '?'}
- Chutes no Gol: ${ctx.stats.shots_on_target_home ?? '?'} vs ${ctx.stats.shots_on_target_away ?? '?'}
- xG: ${ctx.stats.xG_home ?? '?'} vs ${ctx.stats.xG_away ?? '?'}

## TAREFA
1. **Estime a odd ATUAL** do mercado "${ctx.market}" considerando:
   - Placar atual e minuto do jogo
   - Se houve gol desde a entrada, a odd muda drasticamente
   - Mercados Over: se já alcançou a linha, odd cai para ~1.01
   - Mercados 1x2: se o time está vencendo, odd cai; se perdendo, sobe
   - Tempo restante: odds se aproximam de 1.01 (se ganhando) ou sobem (se perdendo) conforme o jogo avança
   
2. **Avalie se deve recomendar CASH OUT**:
   - O padrão que justificou a entrada ainda se mantém?
   - A assimetria estatística mudou?
   - O adversário começou a criar chances reais?
   - Há risco iminente (gol do adversário, pressão crescente)?

3. **Classifique a saúde da posição**:
   - HEALTHY: padrão se mantém, deixar correr
   - WARNING: sinais de deterioração, ficar atento
   - CRITICAL: padrão se desfez, recomenda sair

IMPORTANTE: Seja realista na estimativa da odd. Na Betfair Exchange:
- Jogo 0x0 no minuto 70': Over 2.5 @ ~6.0 (alta)
- Time dominando 1x0 no minuto 60': Back Casa @ ~1.25 (baixa)
- Empate 1x1 no minuto 80': Draw @ ~2.80

Retorne APENAS JSON válido.`;
}
