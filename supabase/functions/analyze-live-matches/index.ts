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

    // Helper: check if match has special early context (knockout needing comeback, or high xG)
    const hasSpecialEarlyContext = (m: any): boolean => {
      const stats = m.stats || {};
      const championship = (m.championship || '').toLowerCase();
      const isKnockout = /copa|cup|eliminat|playoff|mata-mata|knockout|libertadores|champions|europa league/i.test(championship);
      // Check if home team is behind on aggregate or score
      const homeBehind = (m.score_home ?? 0) < (m.score_away ?? 0);
      if (isKnockout && homeBehind) return true;
      // Check xG > 0.3 for home team
      const xgHome = parseFloat(stats.xg_home ?? stats.expected_goals_home ?? '0') || 0;
      if (xgHome > 0.3) return true;
      return false;
    };

    // Get live matches eligible for FIRST analysis (no previous analysis)
    const { data: allNewMatches, error: matchError1 } = await supabase
      .from('live_matches')
      .select('*')
      .eq('status', 'live')
      .is('mycroft_analysis_id', null)
      .order('minute', { ascending: false })
      .limit(10);

    // FAIXA 1 (0-10): only special context. FAIXA 2+ (10+): all.
    const matchesNew = (allNewMatches || []).filter((m: any) => {
      const min = m.minute ?? 0;
      if (min < 10) {
        const special = hasSpecialEarlyContext(m);
        if (!special) {
          console.log(`[AnalyzeLive] ⏭️ Skipping ${m.home_team} vs ${m.away_team} (${min}') — no special early context`);
        }
        return special;
      }
      return true; // min >= 10: analyze all
    }).slice(0, 5);

    // Re-analyze AGUARDAR matches with tiered intervals
    const { data: matchesAguardar, error: matchError2 } = await supabase
      .from('live_matches')
      .select('*, mycroft_analyses!inner(id, verdict, created_at)')
      .eq('status', 'live')
      .eq('mycroft_status', 'aguardar')
      .order('minute', { ascending: false })
      .limit(10);

    const now = Date.now();
    const reAnalyzable = (matchesAguardar || []).filter((m: any) => {
      const min = m.minute ?? 0;
      const analysisTime = new Date(m.mycroft_analyses?.created_at || 0).getTime();
      const elapsed = now - analysisTime;

      // FAIXA 1 (0-10): re-analyze every 5 min, only if special context
      if (min < 10) {
        return elapsed > 5 * 60 * 1000 && hasSpecialEarlyContext(m);
      }
      // FAIXA 2 (10-25): re-analyze every 5 min
      if (min < 25) {
        return elapsed > 5 * 60 * 1000;
      }
      // FAIXA 3 (25+): re-analyze every 1 min
      return elapsed > 1 * 60 * 1000;
    }).slice(0, 5);

    if (reAnalyzable.length > 0) {
      console.log(`[AnalyzeLive] 🔄 ${reAnalyzable.length} AGUARDAR matches eligible for re-analysis`);
      for (const m of reAnalyzable) {
        await supabase.from('live_matches').update({
          mycroft_analysis_id: null,
          mycroft_status: 'pending',
          updated_at: new Date().toISOString(),
        }).eq('match_id', m.match_id);
      }
    }

    const matchError = matchError1 || matchError2;
    const eligibleMatches = [...(matchesNew || []), ...reAnalyzable];

    if (matchError) {
      console.error('[AnalyzeLive] Error fetching matches:', matchError);
      return new Response(JSON.stringify({ error: matchError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

          // === TELEGRAM NOTIFICATION for APROVADO ===
          if (analysis.verdict === 'APROVADO') {
            try {
              const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
              const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');
              if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
                const tierEmoji = analysis.asset_classification === 'ELITE' ? '🏆' : analysis.asset_classification === 'PREMIUM' ? '💎' : '⚡';
                const planLabel = analysis.plan_name ? ` | Plano: *${analysis.plan_name}*` : '';
                const msg = [
                  `${tierEmoji} *SINAL APROVADO — ARENA TRADER SPORTS*`,
                  ``,
                  `⚽ *${match.home_team} vs ${match.away_team}*`,
                  `🏟️ ${match.championship} | ${match.minute ?? 0}'`,
                  `📊 Mercado: *${analysis.market}*`,
                  `💰 Odd: *${analysis.odd ?? '—'}*`,
                  `🎯 Confiança: *${analysis.confidence}%*${planLabel}`,
                  ``,
                  `📝 _${analysis.thesis || 'Análise concluída'}_`,
                  ``,
                  analysis.risk_management?.stake_value ? `💵 Stake sugerida: *R$ ${Number(analysis.risk_management.stake_value).toFixed(2)}* (${analysis.risk_management.stake_percent}% da banca)` : '',
                  ``,
                  `🔗 [Abrir Arena Trader](https://arenatradesports.lovable.app/arena-trader-sports)`,
                ].filter(Boolean).join('\n');

                await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'Markdown' }),
                });
                console.log(`[AnalyzeLive] 📲 Telegram sent for ${match.home_team} vs ${match.away_team}`);
              }
            } catch (tgErr) {
              console.warn('[AnalyzeLive] Telegram notification error:', tgErr);
            }
          }
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
