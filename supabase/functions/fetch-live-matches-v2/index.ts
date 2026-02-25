import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

interface MatchStats {
  attacks_home: number;
  attacks_away: number;
  possession_home: number;
  possession_away: number;
  shots_home: number;
  shots_away: number;
  shots_total_home: number;
  shots_total_away: number;
  xG_home: number;
  xG_away: number;
}

// Fetch detailed match stats from /partidas/{id}
async function fetchMatchStats(partidaId: number, apiKey: string): Promise<MatchStats | null> {
  try {
    const res = await fetch(`${API_FUTEBOL_URL}/partidas/${partidaId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const txt = await res.text();
      console.warn(`[FetchV2] Stats fetch failed for partida ${partidaId}: ${res.status} - ${txt.substring(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const estatisticas = data.estatisticas;

    if (!estatisticas || !estatisticas.mandante || !estatisticas.visitante) {
      console.warn(`[FetchV2] No stats available for partida ${partidaId}`);
      return null;
    }

    const home = estatisticas.mandante;
    const away = estatisticas.visitante;

    return {
      possession_home: parseInt(home.posse_de_bola || '0', 10),
      possession_away: parseInt(away.posse_de_bola || '0', 10),
      attacks_home: parseInt(home.ataques_perigosos || '0', 10),
      attacks_away: parseInt(away.ataques_perigosos || '0', 10),
      shots_total_home: parseInt(home.chutes || home.finalizacoes || '0', 10),
      shots_total_away: parseInt(away.chutes || away.finalizacoes || '0', 10),
      shots_home: parseInt(home.chutes_no_gol || home.finalizacoes_no_gol || '0', 10),
      shots_away: parseInt(away.chutes_no_gol || away.finalizacoes_no_gol || '0', 10),
      xG_home: parseFloat(home.xg || '0'),
      xG_away: parseFloat(away.xg || '0'),
    };
  } catch (e) {
    console.error(`[FetchV2] Error fetching stats for partida ${partidaId}:`, e);
    return null;
  }
}

// Trigger Mycroft analysis for a match
async function triggerMycroftAnalysis(
  matchData: any,
  stats: MatchStats,
  supabase: any,
): Promise<{ analyzed: boolean; verdict?: string }> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    console.log(`[FetchV2] Triggering Mycroft for ${matchData.home_team} vs ${matchData.away_team} (${matchData.minute}')`);

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
      console.error(`[FetchV2] Mycroft failed for ${matchData.match_id}:`, errText);
      return { analyzed: false };
    }

    const analysis = await analysisRes.json();
    console.log(`[FetchV2] Mycroft verdict for ${matchData.match_id}: ${analysis.verdict} (${analysis.confidence}%)`);

    // Save analysis to mycroft_analyses
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

      // Auto-create signal if APROVADO
      if (analysis.verdict === 'APROVADO') {
        await supabase.from('signals_sent').insert({
          match_id: matchData.match_id,
          analysis_id: analysisRow.id,
        });
        console.log(`[FetchV2] Signal created for ${matchData.match_id}`);
      }
    }

    return { analyzed: true, verdict: analysis.verdict };
  } catch (e) {
    console.error(`[FetchV2] Mycroft error for ${matchData.match_id}:`, e);
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

    // 1. Fetch live matches from API Futebol
    console.log('[FetchV2] Fetching live matches from API Futebol...');
    const liveRes = await fetch(`${API_FUTEBOL_URL}/ao-vivo`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    const results: any[] = [];
    let liveCount = 0;
    let analyzedCount = 0;

    if (liveRes.ok) {
      const liveMatches = await liveRes.json();
      console.log(`[FetchV2] ${liveMatches.length} live matches found`);

      for (const match of liveMatches) {
        const partidaId = match.partida_id;
        const fixtureId = `apifut_${partidaId}`;
        const championship = match.campeonato?.nome || match.campeonato?.nome_popular || 'Unknown';
        const minute = match.minuto ?? 0;
        const period = match.periodo || 'Ao Vivo';

        const matchData = {
          match_id: fixtureId,
          home_team: match.time_mandante?.nome_popular || 'TBD',
          away_team: match.time_visitante?.nome_popular || 'TBD',
          home_logo: match.time_mandante?.escudo || null,
          away_logo: match.time_visitante?.escudo || null,
          score_home: match.placar_mandante ?? 0,
          score_away: match.placar_visitante ?? 0,
          minute,
          period,
          championship,
          status: 'live',
          updated_at: new Date().toISOString(),
        };

        // 2. Fetch detailed stats for this match
        const stats = await fetchMatchStats(partidaId, apiKey);

        // 3. Preserve existing mycroft fields
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

        // 4. Auto-trigger Mycroft if match >= 20 min, has stats, and not yet analyzed
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
      console.warn(`[FetchV2] Live matches error: ${liveRes.status} - ${errText.substring(0, 300)}`);
    }

    // 5. Fetch scheduled games from championships
    let scheduledCount = 0;
    try {
      const campRes = await fetch(`${API_FUTEBOL_URL}/campeonatos`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (campRes.ok) {
        const allCamps = await campRes.json();
        const priorityCamps = allCamps
          .filter((c: any) => c.status === 'andamento')
          .slice(0, 10);

        for (const camp of priorityCamps) {
          try {
            const campId = camp.campeonato_id;
            const campNome = camp.nome_popular || camp.nome;

            const partidasRes = await fetch(`${API_FUTEBOL_URL}/campeonatos/${campId}/partidas`, {
              headers: { 'Authorization': `Bearer ${apiKey}` },
            });

            if (partidasRes.status === 401 || partidasRes.status === 403) {
              console.log(`[FetchV2] Partidas endpoint requires PROD key, skipping`);
              break;
            }

            if (!partidasRes.ok) continue;

            const partidasData = await partidasRes.json();
            const partidas = partidasData.partidas || {};

            const allMatches: any[] = [];
            for (const faseName in partidas) {
              const fase = partidas[faseName];
              if (typeof fase === 'object') {
                for (const chaveKey in fase) {
                  const chave = fase[chaveKey];
                  if (chave?.ida) allMatches.push(chave.ida);
                  if (chave?.volta) allMatches.push(chave.volta);
                  if (chave?.partida_id) allMatches.push(chave);
                }
              }
            }

            const today = new Date();
            const maxDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

            for (const partida of allMatches) {
              if (!partida?.data_realizacao_iso) continue;
              const matchDate = new Date(partida.data_realizacao_iso);
              if (matchDate < today || matchDate > maxDate) continue;
              if (partida.status === 'finalizado') continue;

              const dateStr = matchDate.toISOString().split('T')[0];
              const timeStr = matchDate.toTimeString().slice(0, 5);
              const checkTime = new Date(matchDate.getTime() - 15 * 60000).toISOString();
              const homeTeam = partida.time_mandante?.nome_popular || 'TBD';
              const awayTeam = partida.time_visitante?.nome_popular || 'TBD';

              const campLower = campNome.toLowerCase();
              let relevance = 2;
              if (campLower.includes('brasileir') || campLower.includes('série a')) relevance = 5;
              else if (campLower.includes('copa do brasil') || campLower.includes('libertadores')) relevance = 5;
              else if (campLower.includes('série b') || campLower.includes('sul-americana')) relevance = 4;
              else if (campLower.includes('copa') || campLower.includes('supercopa')) relevance = 4;
              else if (campLower.includes('carioca') || campLower.includes('paulist') || campLower.includes('gaúcho') || campLower.includes('mineiro')) relevance = 3;

              const { error: upsertErr } = await supabase.from('scheduled_games').upsert({
                match_date: dateStr,
                match_time: timeStr,
                match_datetime: matchDate.toISOString(),
                league_name: campNome,
                home_team: homeTeam,
                away_team: awayTeam,
                event_id: `apifut_${partida.partida_id}`,
                match_id: `apifut_${partida.partida_id}`,
                status: partida.status === 'ao_vivo' ? 'live' : 'scheduled',
                check_time: checkTime,
                relevance_score: relevance,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'match_date,match_time,home_team,away_team',
              });

              if (!upsertErr) scheduledCount++;
            }
          } catch (campErr) {
            console.warn(`[FetchV2] Error processing camp:`, campErr);
          }
        }
      }
    } catch (schedErr) {
      console.warn('[FetchV2] Scheduled games error:', schedErr);
    }

    console.log(`[FetchV2] Done: ${liveCount} live synced, ${analyzedCount} analyzed, ${scheduledCount} scheduled`);

    return new Response(
      JSON.stringify({
        ok: true,
        source: 'api-futebol.com.br',
        total_matches: liveCount,
        analyzed: analyzedCount,
        scheduled: scheduledCount,
        matches: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[FetchV2] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
