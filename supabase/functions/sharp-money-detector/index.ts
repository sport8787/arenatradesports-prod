import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getSupabase();
    const body = await req.json().catch(() => ({}));
    const { match_ids } = body;

    // Fetch odds data
    let query = supabase.from('arena_odds').select('*').order('created_at', { ascending: false });
    if (match_ids?.length) {
      query = query.in('match_id', match_ids);
    } else {
      query = query.limit(300);
    }
    const { data: odds, error: oddsErr } = await query;
    if (oddsErr) throw oddsErr;

    const grouped = new Map<string, any[]>();
    for (const o of (odds || [])) {
      const key = `${o.match_id}__${o.market}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(o);
    }

    const signals: any[] = [];

    for (const [key, rows] of grouped) {
      const [match_id, market] = key.split('__');

      // RLM Detection: odds move opposite to expected public money
      // When the favorite's odds go UP (should go down with public money)
      const movements = rows.filter(r => r.odd_open && r.odd_current)
        .map(r => ({
          bookmaker: r.bookmaker,
          open: r.odd_open,
          current: r.odd_current,
          movePct: ((r.odd_current - r.odd_open) / r.odd_open) * 100,
        }));

      // Significant movements (>3%)
      const significantMoves = movements.filter(m => Math.abs(m.movePct) > 3);
      
      // RLM: favorite odds increasing despite expected public action
      const rlmCandidates = movements.filter(m => m.open < 2.0 && m.movePct > 2);
      const hasRLM = rlmCandidates.length >= 2;

      // Steam Move: sudden coordinated drop across multiple bookmakers
      const drops = movements.filter(m => m.movePct < -3);
      const hasSteam = drops.length >= 3 && drops.every(d => d.movePct < -2);

      // Consensus: >70% of bookmakers moving same direction
      const positives = movements.filter(m => m.movePct > 1).length;
      const negatives = movements.filter(m => m.movePct < -1).length;
      const total = movements.length || 1;
      const hasConsensus = (positives / total > 0.7) || (negatives / total > 0.7);

      // Sharp Activity Score (0-100)
      let score = 0;
      if (hasRLM) score += 30;
      if (hasSteam) score += 35;
      if (hasConsensus) score += 15;
      score += Math.min(20, significantMoves.length * 5);

      // Average movement
      const avgMovement = movements.length > 0
        ? movements.reduce((a, m) => a + m.movePct, 0) / movements.length
        : 0;

      if (score >= 5) {
        // Upsert to sharp_money_signals
        await supabase.from('sharp_money_signals').upsert({
          match_id,
          market,
          has_rlm: hasRLM,
          has_steam: hasSteam,
          has_consensus: hasConsensus,
          sharp_activity_score: score,
          odd_movement_pct: Number(avgMovement.toFixed(2)),
          detected_at: new Date().toISOString(),
        }, { onConflict: 'match_id,market', ignoreDuplicates: false }).then(({ error }) => {
          if (error) {
            // Fallback: insert
            supabase.from('sharp_money_signals').insert({
              match_id,
              market,
              has_rlm: hasRLM,
              has_steam: hasSteam,
              has_consensus: hasConsensus,
              sharp_activity_score: score,
              odd_movement_pct: Number(avgMovement.toFixed(2)),
              detected_at: new Date().toISOString(),
            });
          }
        });

        signals.push({
          match_id,
          market,
          has_rlm: hasRLM,
          has_steam: hasSteam,
          has_consensus: hasConsensus,
          sharp_activity_score: score,
          avg_movement_pct: Number(avgMovement.toFixed(2)),
          bookmakers_tracked: rows.length,
          significant_moves: significantMoves.length,
          level: score >= 40 ? 'STEAM_PRO' : score >= 25 ? 'SHARP' : score >= 10 ? 'ACTIVITY' : 'LOW',
        });
      }
    }

    // Sort by score desc
    signals.sort((a, b) => b.sharp_activity_score - a.sharp_activity_score);

    return new Response(JSON.stringify({
      ok: true,
      total_detected: signals.length,
      steam_count: signals.filter(s => s.has_steam).length,
      rlm_count: signals.filter(s => s.has_rlm).length,
      signals,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[SharpMoney] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
