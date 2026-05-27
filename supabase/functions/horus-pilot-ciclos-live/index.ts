// Hórus Pilota Ciclos — consome sinais APROVADO/LABAREDA do Arena Trader Sports ao vivo
// e executa entradas usando o stake do ciclo (banca isolada R$ 200).
// Cron: a cada 1 minuto.
//
// Critérios (defaults):
//   - verdict IN ('APROVADO', 'LABAREDA')
//   - confidence >= 70
//   - odd >= 2.00 (one-shot: 1 green bate a meta de dobrar)
//   - result IS NULL (ainda não liquidado)
//   - created_at >= now() - 30min
//   - 1 entrada por vez por usuário (banca R$ 200 trava até liquidar)
//
// Stake = user_cycles_bankroll.current_stake (não toca user_bankroll).
// Liquidação → trigger trg_horus_pilot_autobind_trader registra a entrada no ciclo.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MIN_CONFIDENCE = 70;
const MIN_ODD = 2.0;
const SIGNAL_WINDOW_MIN = 30;
const ALLOWED_VERDICTS = ['APROVADO', 'LABAREDA'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const t0 = Date.now();
  const summary: any = { users_active: 0, candidates: 0, placed: 0, skipped: [] as any[] };

  try {
    // 1. Usuários com piloto ativo
    const { data: pilots, error: pErr } = await sb
      .from('user_cycles_bankroll')
      .select('user_id, current_stake, current_balance, current_cycle, horus_pilot_mode, status')
      .eq('horus_pilot_enabled', true)
      .eq('auto_paused', false)
      .eq('status', 'active');

    if (pErr) throw pErr;
    summary.users_active = pilots?.length ?? 0;

    if (!pilots || pilots.length === 0) {
      return new Response(JSON.stringify({ ok: true, ...summary, ms: Date.now() - t0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Sinais aprovados ao vivo (janela 30min, não liquidados)
    const since = new Date(Date.now() - SIGNAL_WINDOW_MIN * 60_000).toISOString();
    const { data: signals, error: sErr } = await sb
      .from('mycroft_analyses')
      .select('id, match_id, verdict, market, odd, confidence, thesis, created_at, result')
      .in('verdict', ALLOWED_VERDICTS)
      .gte('confidence', MIN_CONFIDENCE)
      .gte('odd', MIN_ODD)
      .is('result', null)
      .gte('created_at', since)
      .order('confidence', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (sErr) throw sErr;
    summary.candidates = signals?.length ?? 0;

    if (!signals || signals.length === 0) {
      return new Response(JSON.stringify({ ok: true, ...summary, ms: Date.now() - t0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Enriquecer com nomes dos times via live_matches
    const matchIds = [...new Set(signals.map((s) => s.match_id))];
    const { data: matches } = await sb
      .from('live_matches')
      .select('match_id, home_team, away_team, status')
      .in('match_id', matchIds);
    const matchMap = new Map<string, any>(
      (matches ?? []).map((m: any) => [m.match_id, m]),
    );

    // 4. Para cada usuário, tentar 1 entrada
    for (const bk of pilots) {
      try {
        // Concorrência: 1 por vez
        const { count: pending } = await sb
          .from('virtual_bets')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', bk.user_id)
          .eq('via_horus_ciclos', true)
          .eq('status', 'pending');

        if ((pending ?? 0) > 0) {
          summary.skipped.push({ user: bk.user_id, reason: 'already_has_pending' });
          continue;
        }

        // Banca suficiente
        const stake = Number(bk.current_stake ?? 0);
        if (stake <= 0) {
          summary.skipped.push({ user: bk.user_id, reason: 'no_stake' });
          continue;
        }

        // Acha primeiro sinal elegível ainda não usado por este usuário
        let chosen: any = null;
        for (const s of signals) {
          const m = matchMap.get(s.match_id);
          if (!m) continue;
          // Só jogo ainda vivo (não finalizado)
          if (m.status && ['FT', 'AET', 'PEN', 'CANC', 'PST', 'ABD'].includes(String(m.status).toUpperCase())) continue;

          // Dedup: usuário já apostou nesse signal_id?
          const { count: dup } = await sb
            .from('virtual_bets')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', bk.user_id)
            .eq('signal_id', s.id);
          if ((dup ?? 0) > 0) continue;

          chosen = { signal: s, match: m };
          break;
        }

        if (!chosen) {
          summary.skipped.push({ user: bk.user_id, reason: 'no_eligible_signal' });
          continue;
        }

        // Insere bet (NÃO toca user_bankroll — banca é virtual via ciclo)
        const matchName = `${chosen.match.home_team} vs ${chosen.match.away_team}`;
        const { data: bet, error: bErr } = await sb
          .from('virtual_bets')
          .insert({
            user_id: bk.user_id,
            signal_id: chosen.signal.id,
            match_id: chosen.signal.match_id,
            match_name: matchName,
            market: chosen.signal.market,
            odd: chosen.signal.odd,
            stake,
            status: 'pending',
            via_horus_ciclos: true,
          })
          .select('id')
          .single();

        if (bErr) {
          summary.skipped.push({ user: bk.user_id, reason: 'insert_error', err: bErr.message });
          continue;
        }

        summary.placed += 1;
        summary.skipped.push({
          user: bk.user_id,
          placed_bet: bet?.id,
          match: matchName,
          market: chosen.signal.market,
          odd: chosen.signal.odd,
          stake,
        });
      } catch (e: any) {
        summary.skipped.push({ user: bk.user_id, reason: 'exception', err: String(e?.message ?? e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, ...summary, ms: Date.now() - t0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[horus-pilot-ciclos-live] fatal', e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
