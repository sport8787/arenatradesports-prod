import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseAdmin();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const { bankroll } = await req.json();

    // Get live matches eligible for analysis (limit 5 per cycle)
    // Include: matches without analysis (minute >= 25) OR matches with AGUARDAR that progressed 10+ minutes
    const { data: matchesNew, error: matchError1 } = await supabase
      .from('live_matches')
      .select('*')
      .eq('status', 'live')
      .is('mycroft_analysis_id', null)
      .gte('minute', 25)
      .order('minute', { ascending: false })
      .limit(5);

    // Re-analyze AGUARDAR matches that have progressed significantly
    const { data: matchesAguardar, error: matchError2 } = await supabase
      .from('live_matches')
      .select('*, mycroft_analyses!inner(id, verdict, created_at)')
      .eq('status', 'live')
      .eq('mycroft_status', 'aguardar')
      .gte('minute', 35)
      .order('minute', { ascending: false })
      .limit(3);

    // Filter AGUARDAR matches: only re-analyze if 10+ min since last analysis
    const now = Date.now();
    const reAnalyzable = (matchesAguardar || []).filter((m: any) => {
      const analysisTime = new Date(m.mycroft_analyses?.created_at || 0).getTime();
      return (now - analysisTime) > 10 * 60 * 1000; // 10 minutes
    });

    if (reAnalyzable.length > 0) {
      console.log(`[AnalyzeLive] 🔄 ${reAnalyzable.length} AGUARDAR matches eligible for re-analysis`);
      // Clear their analysis reference so they get fresh analysis
      for (const m of reAnalyzable) {
        await supabase.from('live_matches').update({
          mycroft_analysis_id: null,
          mycroft_status: 'pending',
          updated_at: new Date().toISOString(),
        }).eq('match_id', m.match_id);
      }
    }

    const matchError = matchError1 || matchError2;
    const matches = [...(matchesNew || []), ...reAnalyzable];

    if (matchError) {
      console.error('[AnalyzeLive] Error fetching matches:', matchError);
      return new Response(JSON.stringify({ error: matchError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const eligibleMatches = (matches || []).filter((m: any) => {
      const stats = m.stats;
      if (!stats) return false;
      return (
        (stats.attacks_home || 0) + (stats.attacks_away || 0) > 0 ||
        (stats.shots_total_home || 0) + (stats.shots_total_away || 0) > 0 ||
        (stats.possession_home || 0) + (stats.possession_away || 0) > 0
      );
    });

    console.log(`[AnalyzeLive] Found ${eligibleMatches.length} matches to analyze`);

    let analyzedCount = 0;
    const results: any[] = [];

    for (const match of eligibleMatches) {
      try {
        console.log(`[AnalyzeLive] Analyzing ${match.home_team} vs ${match.away_team} (${match.minute}')`);

        const analysisRes = await fetch(
          `${supabaseUrl}/functions/v1/mycroft-sports-analysis`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              match: {
                home: match.home_team,
                away: match.away_team,
                scoreHome: match.score_home ?? 0,
                scoreAway: match.score_away ?? 0,
                minute: match.minute ?? 0,
                period: match.period ?? '',
                championship: match.championship,
                match_id: match.match_id,
                stats: match.stats,
                bankroll: bankroll ?? 500,
              },
            }),
          }
        );

        if (!analysisRes.ok) {
          const errText = await analysisRes.text();
          console.error(`[AnalyzeLive] Mycroft failed for ${match.match_id}:`, errText);
          continue;
        }

        const analysis = await analysisRes.json();
        console.log(`[AnalyzeLive] Verdict for ${match.match_id}: ${analysis.verdict} (${analysis.confidence}%)`);

        // Save analysis
        const { data: analysisRow, error: insertError } = await supabase
          .from('mycroft_analyses')
          .insert({
            match_id: match.match_id,
            verdict: analysis.verdict || 'AGUARDAR',
            plan_name: analysis.plan_name || null,
            market: analysis.market || 'N/A',
            thesis: analysis.thesis || 'Análise sem tese.',
            odd: analysis.odd ?? null,
            confidence: analysis.confidence ?? 0,
            risk_management: analysis.risk_management ?? null,
            alerts: Array.isArray(analysis.alerts) ? analysis.alerts.filter((a: any) => typeof a === 'string') : [],
            fundamentation: analysis.fundamentation ?? { stats: match.stats },
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`[AnalyzeLive] ❌ Insert error for ${match.match_id}:`, JSON.stringify(insertError));
          continue;
        }

        if (analysisRow) {
          const statusToSet = analysis.verdict === 'AGUARDAR' ? 'aguardar' : 'done';
          await supabase
            .from('live_matches')
            .update({
              mycroft_analysis_id: analysisRow.id,
              mycroft_status: statusToSet,
              updated_at: new Date().toISOString(),
            })
            .eq('match_id', match.match_id);

          analyzedCount++;
          results.push({
            match_id: match.match_id,
            teams: `${match.home_team} vs ${match.away_team}`,
            verdict: analysis.verdict,
            confidence: analysis.confidence,
            market: analysis.market,
          });
        }
      } catch (e) {
        console.error(`[AnalyzeLive] Error for ${match.match_id}:`, e);
      }
    }

    console.log(`[AnalyzeLive] Done: ${analyzedCount}/${eligibleMatches.length} analyzed`);

    return new Response(
      JSON.stringify({
        ok: true,
        total_eligible: eligibleMatches.length,
        analyzed: analyzedCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[AnalyzeLive] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
