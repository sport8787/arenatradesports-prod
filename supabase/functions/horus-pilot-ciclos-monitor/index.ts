// Hórus Pilota Ciclos — Monitor
// ---------------------------------------------------------------
// Cron 1min. Para cada virtual_bets via_horus_ciclos pendente:
//   • Lê odd ao vivo (live_matches.odds_live + score).
//   • Se odd atual <= target_exit_odd → fecha GREEN (cashout_odd = current_odd).
//   • Se cenário RED (gol contra OU jogo finalizado contra OU drift adverso forte) → fecha RED.
//
// O trigger trg_horus_pilot_autobind_trader cuida do P/L correto via cashout_odd.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const RED_DRIFT_PCT = 0.20; // odd subiu >=20% acima da entry → RED (cenário ruim)

function num(v: any, d = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : d;
}

// Extrai odd atual do mercado dentro de odds_live (estrutura tolerante)
function extractCurrentOdd(market: string, side: string | null, oddsLive: any): number | null {
  if (!oddsLive || !side) return null;
  // tenta vários layouts (Futodds/SM/The Odds)
  try {
    const containers = [
      oddsLive.match_odds, oddsLive['1x2'], oddsLive.matchOdds, oddsLive.h2h, oddsLive,
    ];
    for (const c of containers) {
      if (!c) continue;
      const candidate =
        side === 'home' ? (c.home ?? c.back_home ?? c.casa ?? c['1']) :
        side === 'away' ? (c.away ?? c.back_away ?? c.fora ?? c['2']) :
        (c.draw ?? c.back_draw ?? c.empate ?? c['X']);
      if (typeof candidate === 'number') return candidate;
      if (typeof candidate === 'string') { const n = Number(candidate); if (Number.isFinite(n)) return n; }
      if (candidate && typeof candidate === 'object' && Number.isFinite(Number(candidate.odd))) return Number(candidate.odd);
    }
  } catch (_) { /* ignore */ }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const t0 = Date.now();
  const summary: any = { pending: 0, closed_green: 0, closed_red: 0, untouched: 0, errors: [] as any[] };

  try {
    const { data: bets, error } = await sb
      .from('virtual_bets')
      .select('id, user_id, match_id, market, odd, entry_odd, stake, entry_stats')
      .eq('via_horus_ciclos', true)
      .eq('status', 'pending')
      .limit(200);
    if (error) throw error;
    summary.pending = bets?.length ?? 0;
    if (!bets?.length) {
      return new Response(JSON.stringify({ ok: true, ...summary, ms: Date.now() - t0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ids = [...new Set(bets.map((b: any) => b.match_id))];
    const { data: matches } = await sb
      .from('live_matches')
      .select('match_id, score_home, score_away, minute, status, odds_live')
      .in('match_id', ids);
    const mmap = new Map<string, any>((matches ?? []).map((m: any) => [m.match_id, m]));

    for (const b of bets) {
      try {
        const m = mmap.get(b.match_id);
        const meta = (b.entry_stats as any)?.ciclos ?? {};
        const side = meta.side ?? null;
        const entry_odd = num(b.entry_odd ?? b.odd);
        const target_exit_odd = num(meta.target_exit_odd);
        const entry_sh = num((meta.entry_score || '0-0').split('-')[0]);
        const entry_sa = num((meta.entry_score || '0-0').split('-')[1]);

        if (!m) { summary.untouched++; continue; }

        const cur_sh = num(m.score_home);
        const cur_sa = num(m.score_away);
        const status = String(m.status || '').toUpperCase();
        const finished = ['FT','AET','PEN','CANC','PST','ABD'].includes(status);
        const current_odd = extractCurrentOdd(b.market, side, m.odds_live);

        // RED: gol contra
        let red_reason: string | null = null;
        if (side === 'home' && cur_sa > entry_sa) red_reason = 'goal_against_home';
        else if (side === 'away' && cur_sh > entry_sh) red_reason = 'goal_against_away';
        else if (side === 'draw' && (cur_sh + cur_sa) > (entry_sh + entry_sa)) red_reason = 'goal_breaks_draw';

        // RED: drift adverso forte
        if (!red_reason && current_odd && entry_odd > 0) {
          const drift = (current_odd - entry_odd) / entry_odd;
          if (drift >= RED_DRIFT_PCT) red_reason = `odd_drift_${(drift*100).toFixed(0)}pct`;
        }

        // GREEN: odd atingiu target
        let green_close = false;
        if (!red_reason && current_odd && target_exit_odd > 0 && current_odd <= target_exit_odd) {
          green_close = true;
        }

        if (red_reason) {
          const { error: uErr } = await sb
            .from('virtual_bets')
            .update({
              status: 'red',
              settled_at: new Date().toISOString(),
              cashout_odd: current_odd ?? null,
              cashout_value: current_odd && entry_odd > 0
                ? +(b.stake * (1 - Math.min(1, (current_odd - entry_odd) / entry_odd))).toFixed(2)
                : 0,
              mycroft_cashout_reason: `ciclos_red:${red_reason}`,
              score_home: cur_sh, score_away: cur_sa,
            })
            .eq('id', b.id);
          if (uErr) throw uErr;
          summary.closed_red++;
          continue;
        }

        if (green_close) {
          const profit = +(b.stake * (entry_odd / current_odd! - 1)).toFixed(2);
          const { error: uErr } = await sb
            .from('virtual_bets')
            .update({
              status: 'green',
              settled_at: new Date().toISOString(),
              cashout_odd: current_odd,
              cashout_value: +(b.stake + profit).toFixed(2),
              mycroft_cashout_reason: 'ciclos_target_hit',
              score_home: cur_sh, score_away: cur_sa,
            })
            .eq('id', b.id);
          if (uErr) throw uErr;
          summary.closed_green++;
          continue;
        }

        // Se acabou sem fechar → settler padrão (Match Odds via score) faz o resto.
        if (finished) {
          summary.untouched++; // deixa o settle-bets resolver
          continue;
        }

        summary.untouched++;
      } catch (e: any) {
        summary.errors.push({ bet: b.id, err: String(e?.message ?? e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, ...summary, ms: Date.now() - t0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[horus-pilot-ciclos-monitor] fatal', e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
