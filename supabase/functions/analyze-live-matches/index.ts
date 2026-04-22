import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

// Reanalysis intervals (ms) by status and minute range
function getReanalysisInterval(status: string, minute: number): number {
  const MIN = 60 * 1000;
  if (status === 'aguardar' || status === 'AGUARDAR') {
    if (minute < 25) return 5 * MIN;
    return 1 * MIN;
  }
  if (status === 'jogo_morto' || status === 'JOGO_MORTO') {
    if (minute < 60) return 5 * MIN;
    if (minute < 75) return 3 * MIN;
    return 2 * MIN;
  }
  if (status === 'cuidado' || status === 'CUIDADO') {
    if (minute < 60) return 3 * MIN;
    if (minute < 75) return 2 * MIN;
    return 1 * MIN;
  }
  if (status === 'labareda' || status === 'LABAREDA') {
    return 1 * MIN; // Always 1 min for LABAREDA
  }
  return 5 * MIN; // default
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

    // Helper: check if match has special early context
    const hasSpecialEarlyContext = (m: any): boolean => {
      const stats = m.stats || {};
      const championship = (m.championship || '').toLowerCase();
      const isKnockout = /copa|cup|eliminat|playoff|mata-mata|knockout|libertadores|champions|europa league/i.test(championship);
      const homeBehind = (m.score_home ?? 0) < (m.score_away ?? 0);
      if (isKnockout && homeBehind) return true;
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

    const matchesNew = (allNewMatches || []).filter((m: any) => {
      const min = m.minute ?? 0;
      if (min < 10) {
        const special = hasSpecialEarlyContext(m);
        if (!special) console.log(`[AnalyzeLive] ⏭️ Skipping ${m.home_team} vs ${m.away_team} (${min}') — no special early context`);
        return special;
      }
      return true;
    }).slice(0, 5);

    // Re-analyze ALL non-APROVADO matches with tiered intervals
    // Statuses eligible for reanalysis: aguardar, jogo_morto, cuidado, labareda
    const REANALYSIS_STATUSES = ['aguardar', 'jogo_morto', 'cuidado', 'labareda'];
    
    const { data: matchesForReanalysis, error: matchError2 } = await supabase
      .from('live_matches')
      .select('*, mycroft_analyses!inner(id, verdict, plan_name, created_at)')
      .eq('status', 'live')
      .in('mycroft_status', ['aguardar', 'jogo_morto', 'cuidado', 'labareda', 'done'])
      .order('minute', { ascending: false })
      .limit(20);

    const now = Date.now();
    const reAnalyzable = (matchesForReanalysis || []).filter((m: any) => {
      const min = m.minute ?? 0;
      const verdict = m.mycroft_analyses?.verdict || '';
      const planName = m.mycroft_analyses?.plan_name || '';
      const analysisTime = new Date(m.mycroft_analyses?.created_at || 0).getTime();
      const elapsed = now - analysisTime;

      // EXCEÇÃO: Planos com monitoramento ativo de saída devem ser reanalisados (1 min)
      const isUnder25Active = verdict === 'APROVADO' && planName === 'PLANO UNDER 2.5 EARLY';
      const isDominanteActive = verdict === 'APROVADO' && planName === 'PLANO BACK AO DOMINANTE';
      const isMonitoredActive = isUnder25Active || isDominanteActive;

      // Demais APROVADOS não são reanalisados (signal already emitted)
      if ((verdict === 'APROVADO' || verdict === 'APROVADO_SITUACIONAL') && !isMonitoredActive) return false;

      // Determine effective status for interval calculation
      const effectiveStatus = isMonitoredActive ? 'labareda' : (verdict || m.mycroft_status || 'aguardar');
      const interval = getReanalysisInterval(effectiveStatus, min);

      // For early minutes, also check special context
      if (min < 10 && !hasSpecialEarlyContext(m)) return false;

      if (elapsed > interval) {
        console.log(`[AnalyzeLive] 🔄 Re-analyze ${m.home_team} vs ${m.away_team} (${min}', status=${effectiveStatus}${isMonitoredActive ? ` [${planName}-MONITOR]` : ''}, elapsed=${Math.round(elapsed/1000)}s, interval=${Math.round(interval/1000)}s)`);
        return true;
      }
      return false;
    }).slice(0, 5);

    if (reAnalyzable.length > 0) {
      console.log(`[AnalyzeLive] 🔄 ${reAnalyzable.length} matches eligible for re-analysis`);
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

        // 🔬 ENRIQUECIMENTO COM SOFASCORE: API-Football retorna xG/shots zerados em muitos jogos.
        // SofaScore tem xG real, big chances, tackles, momentum. Fazemos merge.
        let enrichedStats = { ...(match.stats || {}) };
        let sofascoreFound = false;
        try {
          const sofaRes = await fetch(`${supabaseUrl}/functions/v1/sofascore-live-stats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
            body: JSON.stringify({ home: match.home_team, away: match.away_team }),
          });
          if (sofaRes.ok) {
            const sofa = await sofaRes.json();
            if (sofa?.found) {
              sofascoreFound = true;
              const num = (v: any) => (v == null || isNaN(Number(v))) ? null : Number(v);
              const prefer = (sofaVal: any, apiVal: any) => {
                const s = num(sofaVal); const a = num(apiVal);
                if (s == null) return apiVal ?? null;
                if (a == null || a === 0) return s;
                return Math.max(s, a);
              };
              enrichedStats = {
                ...enrichedStats,
                xG_home: prefer(sofa.xg_home, enrichedStats.xG_home ?? enrichedStats.xg_home),
                xG_away: prefer(sofa.xg_away, enrichedStats.xG_away ?? enrichedStats.xg_away),
                xg_home: prefer(sofa.xg_home, enrichedStats.xg_home ?? enrichedStats.xG_home),
                xg_away: prefer(sofa.xg_away, enrichedStats.xg_away ?? enrichedStats.xG_away),
                possession_home: prefer(sofa.possession_home, enrichedStats.possession_home),
                possession_away: prefer(sofa.possession_away, enrichedStats.possession_away),
                shots_total_home: prefer(sofa.shots_total_home, enrichedStats.shots_total_home),
                shots_total_away: prefer(sofa.shots_total_away, enrichedStats.shots_total_away),
                shots_on_target_home: prefer(sofa.shots_on_target_home, enrichedStats.shots_on_target_home),
                shots_on_target_away: prefer(sofa.shots_on_target_away, enrichedStats.shots_on_target_away),
                shots_home: prefer(sofa.shots_on_target_home, enrichedStats.shots_home),
                shots_away: prefer(sofa.shots_on_target_away, enrichedStats.shots_away),
                big_chances_home: num(sofa.big_chances_home),
                big_chances_away: num(sofa.big_chances_away),
                corners_home: prefer(sofa.corners_home, enrichedStats.corners_home),
                corners_away: prefer(sofa.corners_away, enrichedStats.corners_away),
                tackles_home: num(sofa.tackles_home),
                tackles_away: num(sofa.tackles_away),
                fouls_home: prefer(sofa.fouls_home, enrichedStats.fouls_home),
                fouls_away: prefer(sofa.fouls_away, enrichedStats.fouls_away),
                passes_home: prefer(sofa.passes_home, enrichedStats.passes_home),
                passes_away: prefer(sofa.passes_away, enrichedStats.passes_away),
                momentum: sofa.momentum ?? null,
                source_enriched: 'sofascore',
              };
              console.log(`[AnalyzeLive] 🔬 SofaScore enriched ${match.home_team} vs ${match.away_team}: xG ${enrichedStats.xG_home}-${enrichedStats.xG_away}, shots ${enrichedStats.shots_total_home}-${enrichedStats.shots_total_away}, BigChances ${enrichedStats.big_chances_home}-${enrichedStats.big_chances_away}`);
            } else {
              console.log(`[AnalyzeLive] ℹ️ SofaScore no match found for ${match.home_team} vs ${match.away_team}`);
            }
          }
        } catch (sofaErr) {
          console.warn(`[AnalyzeLive] SofaScore enrichment failed:`, sofaErr instanceof Error ? sofaErr.message : sofaErr);
        }

        // 🚨 FLAG xG INDISPONÍVEL: SofaScore falhou + API-Football retornou 0/null
        // Sinaliza ao Mycroft para NÃO usar critério de xG (evita "xG zerado" enganoso)
        const _xgH = Number((enrichedStats as any).xG_home ?? (enrichedStats as any).xg_home ?? 0);
        const _xgA = Number((enrichedStats as any).xG_away ?? (enrichedStats as any).xg_away ?? 0);
        const _shotsTotal = Number((enrichedStats as any).shots_total_home ?? (enrichedStats as any).shots_home ?? 0)
                          + Number((enrichedStats as any).shots_total_away ?? (enrichedStats as any).shots_away ?? 0);
        if (!sofascoreFound && _xgH === 0 && _xgA === 0 && _shotsTotal >= 2) {
          (enrichedStats as any).xg_unavailable = true;
          console.log(`[AnalyzeLive] ⚠️ xG INDISPONÍVEL para ${match.home_team} vs ${match.away_team} (shots=${_shotsTotal}, sofascore_found=false) — Mycroft será avisado`);
        }

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
                stats: enrichedStats,
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
            fundamentation: analysis.fundamentation ?? { stats: enrichedStats },
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`[AnalyzeLive] ❌ Insert error for ${match.match_id}:`, JSON.stringify(insertError));
          continue;
        }

        if (analysisRow) {
          // Map verdict to mycroft_status — preserve dynamic statuses for reanalysis
          const verdictToStatus: Record<string, string> = {
            'APROVADO': 'done',
            'APROVADO_SITUACIONAL': 'done',
            'AGUARDAR': 'aguardar',
            'JOGO_MORTO': 'jogo_morto',
            'LABAREDA': 'labareda',
            'CUIDADO': 'cuidado',
          };
          const statusToSet = verdictToStatus[analysis.verdict] || 'aguardar';
          
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

          // === TELEGRAM DESATIVADO PARA ARENA TRADER SPORTS ===
          // Envio ao Telegram desligado a pedido do usuário para reduzir poluição no grupo principal.
          // Sinais ao vivo continuarão chegando via Web Push e na própria UI da Arena Trader Sports.
          // Será reativado em grupo dedicado para sinais ao vivo (a configurar).
          if (analysis.verdict === 'APROVADO' || analysis.verdict === 'APROVADO_SITUACIONAL' || analysis.verdict === 'LABAREDA') {
            console.log(`[AnalyzeLive] 🔕 Telegram disabled — signal stored only (${match.home_team} vs ${match.away_team} | ${analysis.verdict} | ${analysis.market})`);
          }
          if (analysis.plan_name === 'CANCELAMENTO UNDER 2.5 EARLY' || analysis.plan_name === 'CANCELAMENTO BACK AO DOMINANTE') {
            console.log(`[AnalyzeLive] 🔕 Telegram disabled — exit signal stored only (${match.home_team} vs ${match.away_team} | ${analysis.plan_name})`);
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