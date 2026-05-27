// Hórus Pilota Ciclos — versão CORRIGIDA conforme metodologia original
// ---------------------------------------------------------------
// O Método dos Ciclos é ALOCAÇÃO de banca (stake & lucro-alvo), não estratégia de entrada.
//
// Regras-chave:
//   • Só Match Odds (Back/Lay 1X2) — nada de Over/Under, BTTS, Corners.
//   • Só APÓS o jogo começar e APÓS o 1º gol OU mudança de favoritismo.
//   • Pressão ≥ 2 (dominância 2x+ em dangerous_attacks) a favor.
//   • xG do lado ≥ 0.4 (proxy: stats.xG_* >= 0.4).
//   • Odd entre 1.15 e 1.40 (ideal 1.20–1.35).
//   • Stake = banca corrente do ciclo (current_balance).
//   • Lucro-alvo = stake * (5% * 0.975^green_streak).
//   • Target exit odd = entry_odd / (1 + target_pct).
//   • Concorrência: 1 entrada por vez por usuário.
//
// O fechamento no target / RED é responsabilidade do edge `horus-pilot-ciclos-monitor`.
// A liquidação dispara o trigger trg_horus_pilot_autobind_trader → _register_cycle_entry_for_user.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SIGNAL_WINDOW_MIN = 15; // sinal vivo (15min)
const ALLOWED_VERDICTS = ['APROVADO', 'LABAREDA'];
const ODD_MIN = 1.15;
const ODD_MAX = 1.40;
const XG_MIN_SIDE = 0.4;
const PRESSURE_DOMINANCE = 2.0; // 2x+ em dangerous attacks

// --- helpers de gate ---------------------------------------------------------
type Side = 'home' | 'away' | 'draw';

function detectSide(market: string): Side | null {
  const m = (market || '').toUpperCase();
  if (m.includes('BACK CASA') || m.includes('BACK HOME') || m.includes('1X2 HOME') || m.endsWith(' 1')) return 'home';
  if (m.includes('BACK FORA') || m.includes('BACK AWAY') || m.includes('1X2 AWAY') || m.endsWith(' 2')) return 'away';
  if (m.includes('EMPATE') || m.includes('DRAW') || m === 'X' || m.endsWith(' X')) return 'draw';
  return null;
}

function isMatchOddsMarket(market: string): boolean {
  const m = (market || '').toUpperCase();
  // Aceita Back Casa/Fora/Empate, "Match Odds", "1X2"
  const allowed = ['BACK CASA', 'BACK FORA', 'BACK HOME', 'BACK AWAY', 'BACK EMPATE', 'EMPATE',
                   'MATCH ODDS', '1X2', 'LAY CASA', 'LAY FORA', 'LAY EMPATE'];
  return allowed.some((tag) => m.includes(tag));
}

function num(v: any, d = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : d;
}

interface GateResult {
  passed: boolean;
  reason?: string;
  meta: {
    side: Side | null;
    minute: number;
    score: string;
    pressure_ratio: number;
    xg_side: number;
    odd: number;
    target_pct: number;
    target_exit_odd: number;
    stake: number;
  };
}

function runGate(params: {
  market: string;
  odd: number;
  match: any;
  bk: { current_balance: number; green_streak: number };
}): GateResult {
  const { market, odd, match, bk } = params;
  const stats = match?.stats ?? {};
  const side = detectSide(market);
  const minute = num(match?.minute);
  const sh = num(match?.score_home);
  const sa = num(match?.score_away);
  const score = `${sh}-${sa}`;
  const da_h = num(stats.dangerous_attacks_home);
  const da_a = num(stats.dangerous_attacks_away);
  const xg_h = num(stats.xG_home ?? stats.xg_home);
  const xg_a = num(stats.xG_away ?? stats.xg_away);

  const xg_side = side === 'home' ? xg_h : side === 'away' ? xg_a : (xg_h + xg_a) / 2;
  const da_side = side === 'home' ? da_h : side === 'away' ? da_a : Math.max(da_h, da_a);
  const da_opp = side === 'home' ? da_a : side === 'away' ? da_h : Math.min(da_h, da_a);
  const pressure_ratio = da_opp > 0 ? da_side / da_opp : da_side > 0 ? 99 : 0;

  // Target dinâmico
  const target_pct = +(5.0 * Math.pow(0.975, bk.green_streak)).toFixed(4);
  const stake = +bk.current_balance.toFixed(2);
  const target_exit_odd = +(odd / (1 + target_pct / 100)).toFixed(4);

  const meta = { side, minute, score, pressure_ratio: +pressure_ratio.toFixed(2), xg_side: +xg_side.toFixed(2), odd, target_pct, target_exit_odd, stake };

  // Gate 1 — mercado
  if (!isMatchOddsMarket(market)) return { passed: false, reason: 'gate1_market_not_match_odds', meta };
  if (!side) return { passed: false, reason: 'gate1_side_undetected', meta };

  // Gate 2 — momento (jogo vivo + 1º gol OU minuto>=15 com pressão dominante)
  if (minute < 1) return { passed: false, reason: 'gate2_pre_match', meta };
  const has_goal = (sh + sa) >= 1;
  const post_shift = minute >= 15 && pressure_ratio >= PRESSURE_DOMINANCE;
  if (!has_goal && !post_shift) return { passed: false, reason: 'gate2_no_goal_no_shift', meta };

  // Gate 3 — indicadores: pressão ≥ 2 a favor + xG_side ≥ 0.4
  if (pressure_ratio < PRESSURE_DOMINANCE) return { passed: false, reason: 'gate3_pressure_low', meta };
  if (xg_side < XG_MIN_SIDE) return { passed: false, reason: 'gate3_xg_low', meta };

  // Gate 4 — odd 1.15–1.40
  if (odd < ODD_MIN || odd > ODD_MAX) return { passed: false, reason: 'gate4_odd_out_of_band', meta };

  // Banca
  if (stake <= 0) return { passed: false, reason: 'no_stake', meta };

  return { passed: true, meta };
}

// --- handler -----------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const t0 = Date.now();
  const summary: any = { users_active: 0, candidates: 0, placed: 0, rejected: [] as any[] };

  try {
    // 1. Pilotos ativos
    const { data: pilots, error: pErr } = await sb
      .from('user_cycles_bankroll')
      .select('user_id, current_balance, current_stake, green_streak, current_cycle, horus_pilot_mode')
      .eq('horus_pilot_enabled', true)
      .eq('auto_paused', false)
      .eq('status', 'active');
    if (pErr) throw pErr;
    summary.users_active = pilots?.length ?? 0;
    if (!pilots?.length) {
      return new Response(JSON.stringify({ ok: true, ...summary, ms: Date.now() - t0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Sinais APROVADO/LABAREDA recentes (15min)
    const since = new Date(Date.now() - SIGNAL_WINDOW_MIN * 60_000).toISOString();
    const { data: signals } = await sb
      .from('mycroft_analyses')
      .select('id, match_id, verdict, market, odd, confidence, created_at, result')
      .in('verdict', ALLOWED_VERDICTS)
      .gte('odd', ODD_MIN)
      .lte('odd', ODD_MAX)
      .is('result', null)
      .gte('created_at', since)
      .order('confidence', { ascending: false })
      .limit(80);
    summary.candidates = signals?.length ?? 0;
    if (!signals?.length) {
      return new Response(JSON.stringify({ ok: true, ...summary, ms: Date.now() - t0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Live match snapshot
    const ids = [...new Set(signals.map((s: any) => s.match_id))];
    const { data: matches } = await sb
      .from('live_matches')
      .select('match_id, home_team, away_team, score_home, score_away, minute, status, stats, odds_live')
      .in('match_id', ids);
    const matchMap = new Map<string, any>((matches ?? []).map((m: any) => [m.match_id, m]));

    // 4. Loop por usuário
    for (const bk of pilots) {
      try {
        // Concorrência: 1 entrada pendente por vez
        const { count: pending } = await sb
          .from('virtual_bets')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', bk.user_id)
          .eq('via_horus_ciclos', true)
          .eq('status', 'pending');
        if ((pending ?? 0) > 0) {
          summary.rejected.push({ user: bk.user_id, reason: 'already_has_pending' });
          continue;
        }

        let chosen: any = null;
        let lastReject: any = null;
        for (const s of signals) {
          const m = matchMap.get(s.match_id);
          if (!m) { lastReject = { signal: s.id, reason: 'no_live_match' }; continue; }
          if (m.status && ['FT','AET','PEN','CANC','PST','ABD'].includes(String(m.status).toUpperCase())) {
            lastReject = { signal: s.id, reason: 'match_finished' };
            continue;
          }
          // dedup por usuário+signal
          const { count: dup } = await sb
            .from('virtual_bets')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', bk.user_id)
            .eq('signal_id', s.id);
          if ((dup ?? 0) > 0) { lastReject = { signal: s.id, reason: 'already_used' }; continue; }

          const gate = runGate({
            market: s.market,
            odd: num(s.odd),
            match: m,
            bk: { current_balance: num(bk.current_balance), green_streak: num(bk.green_streak) },
          });
          if (!gate.passed) { lastReject = { signal: s.id, reason: gate.reason, meta: gate.meta }; continue; }

          chosen = { signal: s, match: m, gate };
          break;
        }

        if (!chosen) {
          summary.rejected.push({ user: bk.user_id, reason: 'no_eligible_signal', last: lastReject });
          continue;
        }

        const matchName = `${chosen.match.home_team} vs ${chosen.match.away_team}`;
        const entry_odd = num(chosen.signal.odd);
        const stake = chosen.gate.meta.stake;
        const target_pct = chosen.gate.meta.target_pct;
        const target_exit_odd = chosen.gate.meta.target_exit_odd;

        const { data: bet, error: bErr } = await sb
          .from('virtual_bets')
          .insert({
            user_id: bk.user_id,
            signal_id: chosen.signal.id,
            match_id: chosen.signal.match_id,
            match_name: matchName,
            market: chosen.signal.market,
            odd: entry_odd,
            entry_odd,
            stake,
            status: 'pending',
            via_horus_ciclos: true,
            entry_stats: {
              ciclos: {
                cycle: bk.current_cycle,
                green_streak: bk.green_streak,
                target_pct,
                target_exit_odd,
                entry_odd,
                entry_minute: chosen.gate.meta.minute,
                entry_score: chosen.gate.meta.score,
                pressure_ratio: chosen.gate.meta.pressure_ratio,
                xg_side: chosen.gate.meta.xg_side,
                side: chosen.gate.meta.side,
              },
            },
          })
          .select('id')
          .single();

        if (bErr) {
          summary.rejected.push({ user: bk.user_id, reason: 'insert_error', err: bErr.message });
          continue;
        }
        summary.placed += 1;
        summary.rejected.push({
          user: bk.user_id, placed_bet: bet?.id, match: matchName,
          market: chosen.signal.market, entry_odd, target_exit_odd, target_pct, stake,
        });
      } catch (e: any) {
        summary.rejected.push({ user: bk.user_id, reason: 'exception', err: String(e?.message ?? e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, ...summary, ms: Date.now() - t0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[horus-pilot-ciclos-live] fatal', e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
