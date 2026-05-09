import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_FUTEBOL_URL = 'https://api.api-futebol.com.br/v1';

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function parseStatValue(val: any): number {
  if (val == null) return 0;
  const str = String(val).replace('%', '').trim();
  return parseInt(str, 10) || 0;
}

async function fetchMatchStats(partidaId: number, apiKey: string) {
  try {
    const res = await fetch(`${API_FUTEBOL_URL}/partidas/${partidaId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      console.warn(`[SimV2] Stats fetch failed for partida ${partidaId}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    const est = data.estatisticas;
    if (!est?.mandante || !est?.visitante) return null;
    const home = est.mandante;
    const away = est.visitante;
    return {
      possession_home: parseStatValue(home.posse_de_bola),
      possession_away: parseStatValue(away.posse_de_bola),
      attacks_home: parseStatValue(home.ataques || home.total_de_ataques || 0),
      attacks_away: parseStatValue(away.ataques || away.total_de_ataques || 0),
      dangerous_attacks_home: parseStatValue(home.ataques_perigosos || 0),
      dangerous_attacks_away: parseStatValue(away.ataques_perigosos || 0),
      shots_total_home: parseStatValue(home.chutes || home.finalizacoes || 0),
      shots_total_away: parseStatValue(away.chutes || away.finalizacoes || 0),
      shots_home: parseStatValue(home.chutes_no_gol || home.finalizacoes_no_gol || 0),
      shots_away: parseStatValue(away.chutes_no_gol || away.finalizacoes_no_gol || 0),
      shots_on_target_home: parseStatValue(home.chutes_no_gol || home.finalizacoes_no_gol || 0),
      shots_on_target_away: parseStatValue(away.chutes_no_gol || away.finalizacoes_no_gol || 0),
      xG_home: parseFloat(home.xg || '0') || 0,
      xG_away: parseFloat(away.xg || '0') || 0,
    };
  } catch (e) {
    console.error(`[SimV2] Error fetching stats for partida ${partidaId}:`, e);
    return null;
  }
}

async function triggerMycroftAnalysis(matchData: any, stats: any, supabase: any) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    console.log(`[SimV2] Triggering Mycroft for ${matchData.home_team} vs ${matchData.away_team} (${matchData.minute}')`);

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
            home: matchData.home_team,
            away: matchData.away_team,
            scoreHome: matchData.score_home,
            scoreAway: matchData.score_away,
            minute: matchData.minute,
            period: matchData.period,
            championship: matchData.championship,
            match_id: matchData.match_id,
            stats,
            bankroll: 500,
          },
        }),
      }
    );

    if (!analysisRes.ok) {
      const errText = await analysisRes.text();
      console.error(`[SimV2] Mycroft failed for ${matchData.match_id}:`, errText);
      return { analyzed: false };
    }

    const analysis = await analysisRes.json();
    console.log(`[SimV2] Mycroft verdict: ${analysis.verdict} (${analysis.confidence}%)`);

    const { data: analysisRow } = await supabase
      .from('mycroft_analyses')
      .insert({
        match_id: matchData.match_id,
        verdict: analysis.verdict || 'AGUARDAR',
        market: analysis.market || 'N/A',
        thesis: analysis.thesis || '',
        odd: analysis.odd ?? null,
        confidence: analysis.confidence ?? 0,
        risk_management: analysis.risk_management ?? null,
        alerts: analysis.alerts ?? [],
        fundamentation: analysis.fundamentation ?? { stats },
      })
      .select('id')
      .single();

    if (analysisRow) {
      const statusToSet = analysis.verdict === 'AGUARDAR' ? 'aguardar' : 'done';
      await supabase
        .from('live_matches')
        .update({
          mycroft_analysis_id: analysisRow.id,
          mycroft_status: statusToSet,
          updated_at: new Date().toISOString(),
        })
        .eq('match_id', matchData.match_id);

      if (analysis.verdict === 'APROVADO') {
        await supabase.from('signals_sent').insert({
          match_id: matchData.match_id,
          analysis_id: analysisRow.id,
        });
        console.log(`[SimV2] Signal created for ${matchData.match_id}`);
      }
    }

    return { analyzed: true, verdict: analysis.verdict };
  } catch (e) {
    console.error(`[SimV2] Mycroft error:`, e);
    return { analyzed: false };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('API_FUTEBOL_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API_FUTEBOL_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch live matches from API Futebol (DEV key returns test data)
    console.log('[SimV2] Fetching matches from API Futebol (DEV)...');
    const liveRes = await fetch(`${API_FUTEBOL_URL}/ao-vivo`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    const results: any[] = [];
    let liveCount = 0;
    let analyzedCount = 0;

    if (liveRes.ok) {
      const liveData = await liveRes.json();
      const rawMatches = Array.isArray(liveData) ? liveData : (liveData.partidas || liveData.matches || []);
      console.log(`[SimV2] ${rawMatches.length} matches found`);

      for (const match of rawMatches) {
        const partidaId = match.partida_id || match.id;
        if (!partidaId) continue;

        const fixtureId = `sim_${partidaId}`;
        const championship = match.campeonato?.nome || match.campeonato?.nome_popular || 'Simulação';
        const minute = match.minuto ?? match.min ?? 0;
        const period = match.periodo || match.status || 'Ao Vivo';

        const matchData = {
          match_id: fixtureId,
          home_team: match.time_mandante?.nome_popular || match.mandante?.nome || 'Casa',
          away_team: match.time_visitante?.nome_popular || match.visitante?.nome || 'Fora',
          home_logo: match.time_mandante?.escudo || match.mandante?.escudo || null,
          away_logo: match.time_visitante?.escudo || match.visitante?.escudo || null,
          score_home: match.placar_mandante ?? match.placar?.mandante ?? 0,
          score_away: match.placar_visitante ?? match.placar?.visitante ?? 0,
          minute,
          period,
          championship,
          status: 'live',
          updated_at: new Date().toISOString(),
        };

        // Fetch detailed stats
        const stats = await fetchMatchStats(partidaId, apiKey);

        // Check existing entry
        const { data: existing } = await supabase
          .from('live_matches')
          .select('mycroft_status, mycroft_analysis_id')
          .eq('match_id', fixtureId)
          .single();

        const upsertData: any = {
          ...matchData,
          stats: stats || {},
        };

        if (existing) {
          upsertData.mycroft_status = existing.mycroft_status;
          upsertData.mycroft_analysis_id = existing.mycroft_analysis_id;
        }

        await supabase
          .from('live_matches')
          .upsert(upsertData, { onConflict: 'match_id' });

        liveCount++;

        // Auto-trigger Mycroft if >= 20 min, has stats, not yet analyzed
        const shouldAnalyze = minute >= 20 && stats &&
          (!existing?.mycroft_analysis_id || existing?.mycroft_status === 'aguardar');

        if (shouldAnalyze) {
          const result = await triggerMycroftAnalysis(matchData, stats!, supabase);
          if (result.analyzed) analyzedCount++;
          results.push({
            match_id: fixtureId,
            teams: `${matchData.home_team} vs ${matchData.away_team}`,
            championship,
            minute,
            has_stats: true,
            analyzed: result.analyzed,
            verdict: result.verdict,
          });
        } else {
          results.push({
            match_id: fixtureId,
            teams: `${matchData.home_team} vs ${matchData.away_team}`,
            championship,
            minute,
            has_stats: !!stats,
            analyzed: false,
          });
        }
      }
    } else {
      const errText = await liveRes.text();
      console.warn(`[SimV2] /ao-vivo error: ${liveRes.status} - ${errText.substring(0, 300)}`);
    }

    // Fallback: if no live matches, try championships
    if (liveCount === 0) {
      console.log('[SimV2] No live matches, trying /campeonatos fallback...');
      try {
        const campRes = await fetch(`${API_FUTEBOL_URL}/campeonatos`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (campRes.ok) {
          const allCamps = await campRes.json();
          const camps = allCamps.slice(0, 5);

          for (const camp of camps) {
            try {
              const campId = camp.campeonato_id;
              const campNome = camp.nome_popular || camp.nome;
              const rodadaRes = await fetch(`${API_FUTEBOL_URL}/campeonatos/${campId}/rodadas/atual`, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
              });
              if (!rodadaRes.ok) continue;
              const rodadaData = await rodadaRes.json();
              const partidas = rodadaData.partidas || [];

              for (const partida of partidas) {
                const partidaId = partida.partida_id;
                if (!partidaId) continue;
                const fixtureId = `sim_${partidaId}`;
                const matchData = {
                  match_id: fixtureId,
                  home_team: partida.time_mandante?.nome_popular || 'Casa',
                  away_team: partida.time_visitante?.nome_popular || 'Fora',
                  home_logo: partida.time_mandante?.escudo || null,
                  away_logo: partida.time_visitante?.escudo || null,
                  score_home: partida.placar_mandante ?? 0,
                  score_away: partida.placar_visitante ?? 0,
                  minute: 0,
                  period: partida.status || 'scheduled',
                  championship: campNome,
                  status: 'scheduled',
                  updated_at: new Date().toISOString(),
                };

                const stats = await fetchMatchStats(partidaId, apiKey);

                await supabase
                  .from('live_matches')
                  .upsert({ ...matchData, stats: stats || {} }, { onConflict: 'match_id' });

                liveCount++;

                if (stats) {
                  const result = await triggerMycroftAnalysis(matchData, stats, supabase);
                  if (result.analyzed) analyzedCount++;
                }
              }
            } catch (campErr) {
              console.warn(`[SimV2] Camp error:`, campErr);
            }
          }
        }
      } catch (e) {
        console.warn('[SimV2] Fallback error:', e);
      }
    }

    console.log(`[SimV2] Done: ${liveCount} synced, ${analyzedCount} analyzed`);

    return new Response(
      JSON.stringify({
        ok: true,
        source: 'api-futebol.com.br (simulação DEV)',
        total_matches: liveCount,
        analyzed: analyzedCount,
        matches: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[SimV2] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
