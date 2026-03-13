import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CASHOUT_MODE = Deno.env.get('CASHOUT_MODE') || 'simulado';
const BETFAIR_APP_KEY = Deno.env.get('BETFAIR_APP_KEY') || '';
const BETFAIR_SESSION = Deno.env.get('BETFAIR_SESSION_TOKEN') || '';

// ═══════════════════════════════════════════════════
// MÓDULO 1 — ESTIMATIVA DETERMINÍSTICA DE ODD
// Fórmula baseada em fatores: placar, tempo, stats
// ═══════════════════════════════════════════════════
function estimarOdd(bet: any, stats: any): { odd: number; fatores: any; confianca: number } {
  const oddEntrada = bet.entry_odd || bet.odd;
  const mercado = bet.market || 'Casa';
  const minuto = stats?.minute ?? 45;
  const scoreH = stats?.score_home ?? 0;
  const scoreA = stats?.score_away ?? 0;
  const diff = scoreH - scoreA;

  // ── FATOR PLACAR ──
  let fp = 1.0;
  if (mercado === 'Casa' || mercado === 'Back Casa') {
    fp = diff >= 2 ? 0.55 : diff === 1 ? 0.75 : diff === 0 ? 1.0 : diff === -1 ? 1.50 : 2.10;
  } else if (mercado === 'Fora' || mercado === 'Back Fora') {
    fp = diff <= -2 ? 0.55 : diff === -1 ? 0.75 : diff === 0 ? 1.0 : diff === 1 ? 1.50 : 2.10;
  } else if (mercado === 'Empate' || mercado === 'Back Empate') {
    fp = diff === 0 ? 0.85 : 1.40;
  } else if (mercado?.startsWith('Over')) {
    const gols = scoreH + scoreA;
    const linha = parseFloat(mercado.replace(/Over\s?/, '')) || 2.5;
    fp = gols >= Math.ceil(linha) ? 0.10 : gols === Math.floor(linha) ? 0.65 : 1.20;
  } else if (mercado?.startsWith('Under')) {
    const gols = scoreH + scoreA;
    const linha = parseFloat(mercado.replace(/Under\s?/, '')) || 2.5;
    fp = gols >= Math.ceil(linha) ? 3.50 : gols === Math.floor(linha) - 1 ? 1.30 : 0.80;
  }

  // ── FATOR TEMPO ──
  let ft = minuto < 30 ? 1.0 : minuto < 45 ? 0.97 : minuto < 60 ? 0.95 : minuto < 70 ? 0.92 : minuto < 80 ? 0.88 : minuto < 85 ? 0.84 : minuto < 90 ? 0.80 : 0.76;
  if (mercado?.startsWith('Under') && fp < 1.5) ft = 1.0 + (1.0 - ft);

  // ── FATOR STATS ──
  let fs = 1.0;
  const xgH = stats?.xg_home ?? 0, xgA = stats?.xg_away ?? 0;
  const atH = stats?.dangerous_attacks_home ?? stats?.attacks_home ?? 0;
  const atA = stats?.dangerous_attacks_away ?? stats?.attacks_away ?? 0;
  const shH = stats?.shots_on_target_home ?? stats?.shots_on_goal_home ?? 0;
  const shA = stats?.shots_on_target_away ?? stats?.shots_on_goal_away ?? 0;

  if (mercado === 'Casa' || mercado === 'Back Casa') {
    const dom = (xgH > xgA * 1.3) || (atH > atA * 1.5) || (shH > shA * 1.5);
    const press = (xgA > xgH * 1.3) || (atA > atH * 1.5);
    fs = dom ? 0.93 : press ? 1.10 : 1.0;
  } else if (mercado === 'Fora' || mercado === 'Back Fora') {
    const dom = (xgA > xgH * 1.3) || (atA > atH * 1.5);
    const press = (xgH > xgA * 1.3) || (atH > atA * 1.5);
    fs = dom ? 0.93 : press ? 1.10 : 1.0;
  } else if (mercado?.startsWith('Over')) {
    fs = (xgH + xgA > 2.0 || atH + atA > 30) ? 0.92 : 1.05;
  } else if (mercado?.startsWith('Under')) {
    fs = (xgH + xgA < 1.0 && atH + atA < 15) ? 0.90 : 1.08;
  }

  // ── CÁLCULO FINAL ──
  let odd = Math.round(Math.max(1.01, Math.min(oddEntrada * fp * ft * fs, oddEntrada * 3.5)) * 100) / 100;

  let confianca = 60;
  if (xgH > 0 || xgA > 0) confianca += 15;
  if (atH > 0 || atA > 0) confianca += 10;
  if (shH > 0 || shA > 0) confianca += 10;
  if (minuto > 70) confianca += 5;
  confianca = Math.min(confianca, 92);

  return { odd, fatores: { placar: fp, tempo: ft, stats: fs, oddEntrada, minuto, scoreH, scoreA }, confianca };
}

// ═══════════════════════════════════════════════════
// MÓDULO 2 — ODD REAL (Betfair Live — futuro)
// ═══════════════════════════════════════════════════
async function buscarOddReal(bet: any): Promise<number | null> {
  if (!BETFAIR_APP_KEY || !BETFAIR_SESSION || !bet.betfair_market_id) return null;
  try {
    const r = await fetch('https://api.betfair.com/exchange/betting/rest/v1.0/listMarketBook/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Application': BETFAIR_APP_KEY, 'X-Authentication': BETFAIR_SESSION },
      body: JSON.stringify({ marketIds: [bet.betfair_market_id], priceProjection: { priceData: ['EX_BEST_OFFERS'] } }),
    });
    const data = await r.json();
    return data?.[0]?.runners?.find((x: any) => x.selectionId === bet.betfair_selection_id)?.ex?.availableToBack?.[0]?.price || null;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════
// MÓDULO 3 — CLASSIFICAÇÃO DE SAÚDE
// ═══════════════════════════════════════════════════
function classificarSaude(bet: any, oddAtual: number, minuto: number): { saude: string; sinal: boolean; motivo: string } {
  const oddEntrada = bet.entry_odd || bet.odd;
  const stake = bet.stake || 0;
  const cashoutPct = (oddEntrada / oddAtual); // >1 = profit, <1 = loss
  const mercado = bet.market || '';

  if (oddAtual > oddEntrada * 1.8) {
    return { saude: 'CRITICAL', sinal: true, motivo: `Odd subiu ${((oddAtual / oddEntrada - 1) * 100).toFixed(0)}% da entrada. Padrão possivelmente revertido.` };
  }
  if (minuto >= 80 && oddAtual > oddEntrada * 1.3) {
    return { saude: 'CRITICAL', sinal: true, motivo: `Minuto ${minuto} com posição negativa. Risco de perda total iminente.` };
  }
  if (mercado?.startsWith('Under') && oddAtual > oddEntrada * 2.5) {
    return { saude: 'CRITICAL', sinal: true, motivo: 'Mercado Under em risco crítico. Gols próximos do limite.' };
  }
  if (oddAtual > oddEntrada * 1.35) {
    return { saude: 'WARNING', sinal: false, motivo: `Odd subiu ${((oddAtual / oddEntrada - 1) * 100).toFixed(0)}%. Monitorar evolução.` };
  }
  if (minuto >= 82 && cashoutPct >= 1.5) {
    return { saude: 'HEALTHY', sinal: true, motivo: `GREEN de ${((cashoutPct - 1) * 100).toFixed(0)}% disponível nos minutos finais. Considere garantir o lucro.` };
  }
  return { saude: 'HEALTHY', sinal: false, motivo: 'Posição dentro do esperado.' };
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Support both cron (all pending) and on-demand (specific user/bet)
    let userId: string | null = null;
    let betId: string | null = null;
    try { const body = await req.json(); userId = body.user_id; betId = body.bet_id; } catch {}

    let query = supabase.from('virtual_bets').select('*').eq('status', 'pending').order('created_at', { ascending: true });
    if (userId) query = query.eq('user_id', userId);
    if (betId) query = query.eq('id', betId);

    const { data: positions, error: posErr } = await query;
    if (posErr || !positions?.length) {
      return new Response(JSON.stringify({ message: 'Nenhuma posição aberta', evaluated: 0, modo: CASHOUT_MODE }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[evaluate-cashout] ${positions.length} positions | mode=${CASHOUT_MODE}`);
    let evaluated = 0, autoCashedOut = 0;
    const results: any[] = [];

    for (const pos of positions) {
      try {
        // Get live stats from live_matches (already fetched by cron)
        const { data: liveMatch } = await supabase.from('live_matches').select('*').eq('match_id', pos.match_id).maybeSingle();
        if (!liveMatch || (liveMatch.status !== 'live' && liveMatch.status !== 'halftime')) continue;

        const stats = liveMatch.stats as any || {};
        const entryOdd = pos.entry_odd || pos.odd;
        const minuto = liveMatch.minute || 0;

        // Build stats object for estimation
        const statsCtx = {
          minute: minuto, score_home: liveMatch.score_home ?? 0, score_away: liveMatch.score_away ?? 0,
          xg_home: stats.xG_home ?? stats.xg_home ?? 0, xg_away: stats.xG_away ?? stats.xg_away ?? 0,
          dangerous_attacks_home: stats.dangerous_attacks_home ?? 0, dangerous_attacks_away: stats.dangerous_attacks_away ?? 0,
          shots_on_target_home: stats.shots_on_target_home ?? 0, shots_on_target_away: stats.shots_on_target_away ?? 0,
          possession_home: stats.possession_home ?? 50, possession_away: stats.possession_away ?? 50,
        };

        // Determine current odd
        let oddAtual: number;
        let oddFonte: 'real' | 'estimada';
        let confianca = 0;
        let fatores: any = null;

        if (CASHOUT_MODE === 'live') {
          const oddReal = await buscarOddReal(pos);
          if (oddReal) {
            oddAtual = oddReal; oddFonte = 'real'; confianca = 100;
          } else {
            const est = estimarOdd(pos, statsCtx);
            oddAtual = est.odd; oddFonte = 'estimada'; confianca = est.confianca; fatores = est.fatores;
          }
        } else {
          const est = estimarOdd(pos, statsCtx);
          oddAtual = est.odd; oddFonte = 'estimada'; confianca = est.confianca; fatores = est.fatores;
        }

        const cashoutValue = Math.round(Math.max(0, pos.stake * (entryOdd / oddAtual)) * 100) / 100;
        const { saude, sinal, motivo } = classificarSaude(pos, oddAtual, minuto);

        console.log(`[evaluate-cashout] ${pos.match_name} | @${entryOdd}→${oddAtual} | R$${cashoutValue} | ${saude} | signal=${sinal} | ${oddFonte}`);

        // Update position
        await supabase.from('virtual_bets').update({
          current_odd: oddAtual, cashout_value: cashoutValue, cashout_odd: oddAtual,
          odd_fonte: oddFonte,
          mycroft_cashout_signal: sinal,
          mycroft_cashout_reason: sinal ? motivo : null,
          last_cashout_update: new Date().toISOString(),
        }).eq('id', pos.id);

        evaluated++;

        // Log signal if WARNING/CRITICAL or cashout signal
        if (sinal || saude !== 'HEALTHY') {
          await supabase.from('cashout_signals_log').insert({
            bet_id: pos.id, user_id: pos.user_id, match_id: pos.match_id,
            match_name: pos.match_name, market: pos.market,
            entry_odd: entryOdd, current_odd: oddAtual,
            cashout_value: cashoutValue, stake: pos.stake,
            signal_type: saude, position_health: saude,
            mycroft_reason: motivo, confidence: confianca,
            odd_fonte: oddFonte, modo: CASHOUT_MODE,
            fatores: fatores, minuto: minuto,
            placar: `${statsCtx.score_home}-${statsCtx.score_away}`,
          });
        }

        const pnl = Math.round((cashoutValue - pos.stake) * 100) / 100;
        results.push({
          bet_id: pos.id, match: pos.match_name, entry_odd: entryOdd,
          current_odd: oddAtual, cashout_value: cashoutValue, stake: pos.stake,
          pnl, health: saude, signal: sinal, odd_fonte: oddFonte, confianca,
        });

        // Auto cash out with protection
        if (pos.auto_cashout_enabled && sinal) {
          const minValue = pos.auto_cashout_min_value ?? (pos.stake * 0.5);
          if (cashoutValue < minValue) {
            console.log(`[evaluate-cashout] AUTO BLOCKED: ${pos.match_name} R$${cashoutValue} < min R$${minValue}`);
            continue;
          }

          console.log(`[evaluate-cashout] AUTO CASHOUT: ${pos.match_name} → R$${cashoutValue}`);
          const { data: bankrollData } = await supabase.from('sports_bankroll').select('*').eq('user_id', pos.user_id).single();
          if (bankrollData) {
            const profitLoss = Math.round((cashoutValue - pos.stake) * 100) / 100;
            const isProfit = profitLoss >= 0;

            await supabase.from('virtual_bets').update({
              status: 'cashed_out', profit_loss: profitLoss, cashed_out_at: new Date().toISOString(),
              mycroft_cashout_reason: `[AUTO] ${motivo}`,
            }).eq('id', pos.id);

            const g = (bankrollData.green_bets || 0) + (isProfit ? 1 : 0);
            const r = (bankrollData.red_bets || 0) + (isProfit ? 0 : 1);
            await supabase.from('sports_bankroll').update({
              balance: Math.round(((bankrollData.balance || 0) + cashoutValue) * 100) / 100,
              total_profit: Math.round(((bankrollData.total_profit || 0) + profitLoss) * 100) / 100,
              green_bets: g, red_bets: r,
              win_rate: g + r > 0 ? (g / (g + r)) * 100 : 0,
              updated_at: new Date().toISOString(),
            }).eq('user_id', pos.user_id);

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
      evaluated, auto_cashed_out: autoCashedOut, modo: CASHOUT_MODE, results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[evaluate-cashout] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
