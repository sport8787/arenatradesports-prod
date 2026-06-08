// Hórus Auto-Bet GLOBAL: roda a cada 5 minutos via cron.
// Para cada sinal Punter APROVADO + stake_confirmed das últimas 4h,
// insere uma virtual_bets_punter para CADA usuário com banca,
// se o usuário ainda não tiver apostado naquele match. Stake 2% da banca.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const startedAt = Date.now();
  let totalSignals = 0, totalUsers = 0, totalInserted = 0, totalSkipped = 0;

  try {
    // 1) Sinais APROVADOS confirmados das últimas 4h, ainda não começaram OU em andamento
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: signals, error: sigErr } = await supabase
      .from('punter_signals')
      .select('id, analysis_id, match_id, market, odd, commence_time, created_at, stake_confirmed, status, dismissed')
      .eq('stake_confirmed', true)
      .neq('dismissed', true)
      .in('status', ['pending', 'sent'])
      .gte('created_at', fourHoursAgo)
      .order('created_at', { ascending: false });

    if (sigErr) throw sigErr;
    totalSignals = signals?.length || 0;
    if (!signals || signals.length === 0) {
      return new Response(JSON.stringify({ ok: true, totalSignals, totalUsers, totalInserted, durationMs: Date.now() - startedAt }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Buscar nomes dos times via punter_analyses (uma vez)
    const analysisIds = [...new Set(signals.map(s => s.analysis_id).filter(Boolean))];
    const { data: analyses } = await supabase
      .from('punter_analyses')
      .select('id, home_team, away_team')
      .in('id', analysisIds);
    const analysisMap = new Map((analyses || []).map(a => [a.id, a]));

    // 3) Todos os usuários com banca > 0
    const { data: bankrolls, error: brErr } = await supabase
      .from('user_bankroll')
      .select('user_id, balance')
      .gt('balance', 1); // mínimo R$ 1

    if (brErr) throw brErr;
    totalUsers = bankrolls?.length || 0;
    if (!bankrolls || bankrolls.length === 0) {
      return new Response(JSON.stringify({ ok: true, totalSignals, totalUsers, totalInserted, durationMs: Date.now() - startedAt }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4) Para cada (signal × user), inserir bet se ainda não existir
    for (const sig of signals) {
      const analysis = analysisMap.get(sig.analysis_id);
      if (!analysis) continue;
      const matchName = `${analysis.home_team} vs ${analysis.away_team}`;
      const normalizedMatchId = String(sig.match_id).replace(/\+00:00/g, 'Z');

      // Buscar quais user_ids JÁ apostaram neste match+market (consulta única por sinal)
      // Filtra por market para permitir Over 1.5, Over 2.5 e Vitória coexistirem no mesmo jogo
      const { data: existing } = await supabase
        .from('virtual_bets_punter')
        .select('user_id')
        .eq('match_id', normalizedMatchId)
        .eq('market', sig.market)
        .in('status', ['pending', 'green', 'red']);

      const userIdsWithBet = new Set((existing || []).map(b => b.user_id));

      for (const br of bankrolls) {
        if (userIdsWithBet.has(br.user_id)) { totalSkipped++; continue; }

        const stake = Math.max(1, Math.min(50, +(Number(br.balance) * 0.02).toFixed(2))); // 2% banca, [1, 50]
        if (stake > Number(br.balance)) { totalSkipped++; continue; }

        const { error: insErr } = await supabase
          .from('virtual_bets_punter')
          .insert({
            user_id: br.user_id,
            signal_id: sig.id,
            analysis_id: sig.analysis_id,
            match_id: normalizedMatchId,
            match_name: matchName,
            market: sig.market,
            odd: Number(sig.odd),
            stake,
            status: 'pending',
            commence_time: sig.commence_time,
          } as any);

        if (insErr) {
          if (insErr.code === '23505') { totalSkipped++; continue; }
          console.warn('[HorusAutoBetAll] insert err', br.user_id, insErr.message);
          continue;
        }

        // Deduzir banca atomicamente
        await supabase.rpc('deduct_bankroll', { p_user_id: br.user_id, p_amount: stake });
        totalInserted++;
      }
    }

    const summary = { ok: true, totalSignals, totalUsers, totalInserted, totalSkipped, durationMs: Date.now() - startedAt };
    console.log('[HorusAutoBetAll]', JSON.stringify(summary));
    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[HorusAutoBetAll] FATAL', e);
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
