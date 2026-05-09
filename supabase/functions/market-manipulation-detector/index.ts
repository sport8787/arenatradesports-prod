import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

interface OddsRow {
  match_id: string;
  market: string;
  bookmaker: string;
  odd_open: number | null;
  odd_current: number | null;
  odd_close: number | null;
  movement_pct: number | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getSupabase();
    const body = await req.json().catch(() => ({}));
    const { match_ids } = body;

    // Fetch recent odds data
    let query = supabase.from('arena_odds').select('*').order('created_at', { ascending: false });
    if (match_ids?.length) {
      query = query.in('match_id', match_ids);
    } else {
      query = query.limit(200);
    }
    const { data: odds, error: oddsErr } = await query;
    if (oddsErr) throw oddsErr;

    const results: any[] = [];
    const grouped = new Map<string, OddsRow[]>();

    for (const o of (odds || [])) {
      const key = `${o.match_id}__${o.market}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(o);
    }

    for (const [key, rows] of grouped) {
      const [match_id, market] = key.split('__');

      // Calculate MIS (Market Inefficiency Score)
      // Compare odds across bookmakers for same market
      const currentOdds = rows.map(r => r.odd_current || r.odd_open || 0).filter(o => o > 0);
      const openOdds = rows.map(r => r.odd_open || 0).filter(o => o > 0);

      if (currentOdds.length < 1) continue;

      const avgCurrent = currentOdds.reduce((a, b) => a + b, 0) / currentOdds.length;
      const maxSpread = currentOdds.length > 1 
        ? Math.max(...currentOdds) - Math.min(...currentOdds) 
        : 0;

      // Prob from avg odd
      const probMarket = avgCurrent > 0 ? (1 / avgCurrent) * 100 : 0;

      // ODI: Odds Drift Index — how much odds moved from open to current
      const drifts = rows.filter(r => r.odd_open && r.odd_current && r.odd_open > 0)
        .map(r => Math.abs(((r.odd_current! - r.odd_open!) / r.odd_open!) * 100));
      const avgDrift = drifts.length > 0 ? drifts.reduce((a, b) => a + b, 0) / drifts.length : 0;

      // MIS calculation: cross-bookmaker spread as % of average
      const mis = avgCurrent > 0 ? (maxSpread / avgCurrent) * 100 : 0;

      // Detect suspicious patterns
      const isSuspicious = mis > 8 || avgDrift > 15;
      const isExtreme = mis > 15 || avgDrift > 25;

      let inefficiencyLevel = 'noise';
      if (isExtreme) inefficiencyLevel = 'extreme';
      else if (isSuspicious) inefficiencyLevel = 'strong';
      else if (mis > 4 || avgDrift > 8) inefficiencyLevel = 'light';

      // Detect one-sided movement (potential manipulation)
      const movements = rows.filter(r => r.movement_pct != null).map(r => r.movement_pct!);
      const allSameDirection = movements.length > 1 && 
        (movements.every(m => m > 0) || movements.every(m => m < 0));

      // Detect reverse line movement (RLM)
      // When odds move opposite to public money direction
      const hasRLM = movements.length > 1 && movements.some(m => Math.abs(m) > 5) && allSameDirection;

      // Prob model estimate (using cross-bookmaker consensus)
      const probModel = currentOdds.length > 2 
        ? (1 / (currentOdds.sort()[Math.floor(currentOdds.length / 2)])) * 100 // median-based
        : probMarket;

      // Upsert to market_analysis
      const { error: upsertErr } = await supabase.from('market_analysis').upsert({
        match_id,
        market,
        prob_model: Number(probModel.toFixed(2)),
        prob_market: Number(probMarket.toFixed(2)),
        market_inefficiency_score: Number(mis.toFixed(2)),
        odds_drift_index: Number(avgDrift.toFixed(2)),
        inefficiency_level: inefficiencyLevel,
        odd_open: openOdds.length > 0 ? openOdds[0] : null,
        odd_current: currentOdds[0] || null,
        analyzed_at: new Date().toISOString(),
      }, { onConflict: 'match_id,market', ignoreDuplicates: false });

      if (upsertErr) {
        // If conflict fails, just insert
        await supabase.from('market_analysis').insert({
          match_id,
          market,
          prob_model: Number(probModel.toFixed(2)),
          prob_market: Number(probMarket.toFixed(2)),
          market_inefficiency_score: Number(mis.toFixed(2)),
          odds_drift_index: Number(avgDrift.toFixed(2)),
          inefficiency_level: inefficiencyLevel,
          odd_open: openOdds.length > 0 ? openOdds[0] : null,
          odd_current: currentOdds[0] || null,
          analyzed_at: new Date().toISOString(),
        });
      }

      results.push({
        match_id,
        market,
        mis: Number(mis.toFixed(2)),
        odi: Number(avgDrift.toFixed(2)),
        inefficiency_level: inefficiencyLevel,
        prob_model: Number(probModel.toFixed(2)),
        prob_market: Number(probMarket.toFixed(2)),
        bookmakers_analyzed: rows.length,
        has_rlm: hasRLM,
        all_same_direction: allSameDirection,
        suspicious: isSuspicious || isExtreme,
      });
    }

    // Sort by MIS descending
    results.sort((a, b) => b.mis - a.mis);

    return new Response(JSON.stringify({
      ok: true,
      total_analyzed: results.length,
      suspicious_count: results.filter(r => r.suspicious).length,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[MMD] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
