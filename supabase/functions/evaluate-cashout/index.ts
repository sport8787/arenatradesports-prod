import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: positions, error: posErr } = await supabase
      .from('virtual_bets')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (posErr || !positions || positions.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhuma posição aberta', evaluated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[evaluate-cashout] ${positions.length} positions`);

    let evaluated = 0, autoCashedOut = 0;
    const results: any[] = [];

    for (const pos of positions) {
      try {
        const { data: liveMatch } = await supabase.from('live_matches').select('*').eq('match_id', pos.match_id).maybeSingle();
        if (!liveMatch || (liveMatch.status !== 'live' && liveMatch.status !== 'halftime')) continue;

        const stats = liveMatch.stats as any || {};
        const entryOdd = pos.entry_odd || pos.odd;
        const minute = liveMatch.minute || 0;

        const evalPrompt = buildEvalPrompt({
          matchName: pos.match_name, market: pos.market, entryOdd, stake: pos.stake, minute,
          scoreHome: liveMatch.score_home ?? 0, scoreAway: liveMatch.score_away ?? 0,
          homeTeam: liveMatch.home_team, awayTeam: liveMatch.away_team, stats, championship: liveMatch.championship,
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

        if (!aiResponse.ok) { console.error(`[evaluate-cashout] AI error ${pos.match_name}: ${aiResponse.status}`); continue; }

        const aiData = await aiResponse.json();
        const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let evaluation;
        try { evaluation = JSON.parse(rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch { continue; }

        const currentOdd = Math.max(1.01, evaluation.current_odd || entryOdd);
        const cashoutValue = parseFloat((pos.stake * (entryOdd / currentOdd)).toFixed(2));

        console.log(`[evaluate-cashout] ${pos.match_name} | @${entryOdd}→${currentOdd} | R$${cashoutValue} | ${evaluation.position_health} | signal=${evaluation.should_cashout}`);

        // Update position
        await supabase.from('virtual_bets').update({
          current_odd: currentOdd, cashout_value: cashoutValue, cashout_odd: currentOdd,
          odd_fonte: 'estimada',
          mycroft_cashout_signal: evaluation.should_cashout,
          mycroft_cashout_reason: evaluation.should_cashout ? evaluation.cashout_reason : null,
          last_cashout_update: new Date().toISOString(),
        }).eq('id', pos.id);

        evaluated++;

        // Log signal if WARNING or CRITICAL
        if (evaluation.should_cashout || evaluation.position_health !== 'HEALTHY') {
          await supabase.from('cashout_signals_log').insert({
            bet_id: pos.id, user_id: pos.user_id, match_id: pos.match_id,
            match_name: pos.match_name, market: pos.market,
            entry_odd: entryOdd, current_odd: currentOdd,
            cashout_value: cashoutValue, stake: pos.stake,
            signal_type: evaluation.position_health,
            position_health: evaluation.position_health,
            mycroft_reason: evaluation.cashout_reason,
            confidence: evaluation.confidence,
          });
        }

        results.push({
          bet_id: pos.id, match: pos.match_name, entry_odd: entryOdd,
          current_odd: currentOdd, cashout_value: cashoutValue, stake: pos.stake,
          pnl: parseFloat((cashoutValue - pos.stake).toFixed(2)),
          health: evaluation.position_health, signal: evaluation.should_cashout,
        });

        // Auto cash out with min value protection
        if (pos.auto_cashout_enabled && evaluation.should_cashout) {
          const minValue = pos.auto_cashout_min_value ?? (pos.stake * 0.5); // default 50% protection
          if (cashoutValue < minValue) {
            console.log(`[evaluate-cashout] AUTO BLOCKED: ${pos.match_name} cashout R$${cashoutValue} < min R$${minValue}`);
            continue;
          }

          console.log(`[evaluate-cashout] AUTO CASHOUT: ${pos.match_name} → R$${cashoutValue}`);

          const { data: bankrollData } = await supabase.from('sports_bankroll').select('*').eq('user_id', pos.user_id).single();
          if (bankrollData) {
            const profitLoss = parseFloat((cashoutValue - pos.stake).toFixed(2));
            const isProfit = profitLoss >= 0;

            await supabase.from('virtual_bets').update({
              status: 'cashed_out', profit_loss: profitLoss, cashed_out_at: new Date().toISOString(),
            }).eq('id', pos.id);

            await supabase.from('sports_bankroll').update({
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
            }).eq('user_id', pos.user_id);

            // Log signal as accepted
            await supabase.from('cashout_signals_log').update({
              was_accepted: true, accepted_at: new Date().toISOString(),
            }).eq('bet_id', pos.id).is('was_accepted', null).order('created_at', { ascending: false }).limit(1);

            autoCashedOut++;
          }
        }
      } catch (e) { console.error(`[evaluate-cashout] Error ${pos.match_name}:`, e); }
    }

    return new Response(JSON.stringify({
      message: `${evaluated} avaliadas, ${autoCashedOut} auto-cashouts`,
      evaluated, auto_cashed_out: autoCashedOut, results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[evaluate-cashout] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildEvalPrompt(ctx: {
  matchName: string; market: string; entryOdd: number; stake: number; minute: number;
  scoreHome: number; scoreAway: number; homeTeam: string; awayTeam: string; stats: any; championship: string;
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
- Ataques Perigosos: ${ctx.stats.dangerous_attacks_home ?? '?'} vs ${ctx.stats.dangerous_attacks_away ?? '?'}
- Chutes (Total): ${ctx.stats.shots_total_home ?? ctx.stats.shots_home ?? '?'} vs ${ctx.stats.shots_total_away ?? ctx.stats.shots_away ?? '?'}
- Chutes no Gol: ${ctx.stats.shots_on_target_home ?? '?'} vs ${ctx.stats.shots_on_target_away ?? '?'}
- xG: ${ctx.stats.xG_home ?? '?'} vs ${ctx.stats.xG_away ?? '?'}

## TAREFA
1. **Estime a odd ATUAL** do mercado "${ctx.market}" considerando placar, minuto e stats.
2. **Avalie se deve recomendar CASH OUT** — o padrão de entrada se mantém?
3. **Classifique a saúde**: HEALTHY / WARNING / CRITICAL

IMPORTANTE: Seja realista na estimativa da odd. Na Betfair Exchange:
- Jogo 0x0 no minuto 70': Over 2.5 @ ~6.0
- Time dominando 1x0 no minuto 60': Back Casa @ ~1.25
- Empate 1x1 no minuto 80': Draw @ ~2.80

Retorne APENAS JSON válido.`;
}
