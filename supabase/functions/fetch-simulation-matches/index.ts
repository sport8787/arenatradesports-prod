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

// Fetch detailed match stats from /partidas/{id}
async function fetchMatchStats(partidaId: number, apiKey: string) {
  try {
    const res = await fetch(`${API_FUTEBOL_URL}/partidas/${partidaId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const txt = await res.text();
      console.warn(`[Simulation] Stats fetch failed for ${partidaId}: ${res.status} - ${txt.substring(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const estatisticas = data.estatisticas;

    if (!estatisticas || !estatisticas.mandante || !estatisticas.visitante) {
      return null;
    }

    const home = estatisticas.mandante;
    const away = estatisticas.visitante;

    return {
      possession_home: parseInt(home.posse_de_bola || '0', 10),
      possession_away: parseInt(away.posse_de_bola || '0', 10),
      attacks_home: parseInt(home.ataques_perigosos || '0', 10),
      attacks_away: parseInt(away.ataques_perigosos || '0', 10),
      dangerous_attacks_home: parseInt(home.ataques_perigosos || '0', 10),
      dangerous_attacks_away: parseInt(away.ataques_perigosos || '0', 10),
      shots_total_home: parseInt(home.chutes || home.finalizacoes || '0', 10),
      shots_total_away: parseInt(away.chutes || away.finalizacoes || '0', 10),
      shots_home: parseInt(home.chutes_no_gol || home.finalizacoes_no_gol || '0', 10),
      shots_away: parseInt(away.chutes_no_gol || away.finalizacoes_no_gol || '0', 10),
      shots_on_target_home: parseInt(home.chutes_no_gol || home.finalizacoes_no_gol || '0', 10),
      shots_on_target_away: parseInt(away.chutes_no_gol || away.finalizacoes_no_gol || '0', 10),
      xG_home: parseFloat(home.xg || '0'),
      xG_away: parseFloat(away.xg || '0'),
    };
  } catch (e) {
    console.error(`[Simulation] Stats error for ${partidaId}:`, e);
    return null;
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

    // Parse optional params
    let analyze = false;
    let matchIdToAnalyze: string | null = null;
    try {
      const body = await req.json();
      analyze = body.analyze === true;
      matchIdToAnalyze = body.match_id || null;
    } catch { /* no body */ }

    // If analyzing a specific match, trigger Mycroft
    if (analyze && matchIdToAnalyze) {
      console.log(`[Simulation] 🔬 Analyzing match ${matchIdToAnalyze}`);

      // Get match data from response
      const partidaId = parseInt(matchIdToAnalyze.replace('sim_', ''), 10);
      const stats = await fetchMatchStats(partidaId, apiKey);

      if (!stats) {
        return new Response(
          JSON.stringify({ error: 'Could not fetch stats for this match' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get match details
      const matchRes = await fetch(`${API_FUTEBOL_URL}/partidas/${partidaId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!matchRes.ok) {
        return new Response(
          JSON.stringify({ error: 'Match not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const matchDetail = await matchRes.json();

      // Simulate as if we're at minute 30 (first half analysis window)
      const simulatedMinute = 30;
      const championship = matchDetail.campeonato?.nome || matchDetail.campeonato?.nome_popular || 'Simulação';

      // Call Mycroft without revealing final score - simulate as 0x0 at min 30
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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
              home: matchDetail.time_mandante?.nome_popular || 'Casa',
              away: matchDetail.time_visitante?.nome_popular || 'Fora',
              scoreHome: 0,
              scoreAway: 0,
              minute: simulatedMinute,
              period: '1º Tempo (Simulação)',
              championship,
              match_id: `sim_${partidaId}`,
              stats,
              bankroll: 500,
            },
          }),
        }
      );

      if (!analysisRes.ok) {
        const errText = await analysisRes.text();
        console.error(`[Simulation] Mycroft error:`, errText);
        return new Response(
          JSON.stringify({ error: 'Mycroft analysis failed' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const analysis = await analysisRes.json();
      console.log(`[Simulation] ✅ Verdict: ${analysis.verdict} (${analysis.confidence}%)`);

      // Return analysis with real final score for comparison
      return new Response(
        JSON.stringify({
          ok: true,
          analysis,
          real_result: {
            score_home: matchDetail.placar_mandante ?? '?',
            score_away: matchDetail.placar_visitante ?? '?',
          },
          stats_used: stats,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: fetch yesterday's finished matches
    console.log('[Simulation] 📅 Fetching finished matches from API Futebol...');

    // Get list of active championships
    const campRes = await fetch(`${API_FUTEBOL_URL}/campeonatos`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!campRes.ok) {
      const errText = await campRes.text();
      console.error(`[Simulation] Campeonatos error: ${campRes.status} - ${errText.substring(0, 300)}`);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch championships' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allCamps = await campRes.json();
    const activeCamps = allCamps
      .filter((c: any) => c.status === 'andamento')
      .slice(0, 8);

    console.log(`[Simulation] 🏆 ${activeCamps.length} active championships found`);

    const matches: any[] = [];

    for (const camp of activeCamps) {
      try {
        const campId = camp.campeonato_id;
        const campNome = camp.nome_popular || camp.nome;

        // Fetch recent rounds
        const rodadaRes = await fetch(`${API_FUTEBOL_URL}/campeonatos/${campId}/rodadas/atual`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });

        if (!rodadaRes.ok) {
          // Try alternative: fetch all partidas
          console.warn(`[Simulation] Rodada endpoint unavailable for ${campNome}, trying partidas...`);
          continue;
        }

        const rodadaData = await rodadaRes.json();
        const partidas = rodadaData.partidas || [];

        for (const partida of partidas) {
          // Only finished matches for simulation
          if (partida.status !== 'finalizado') continue;

          const partidaId = partida.partida_id;
          const matchDate = partida.data_realizacao_iso ? new Date(partida.data_realizacao_iso) : null;

          matches.push({
            id: `sim_${partidaId}`,
            partida_id: partidaId,
            championship: campNome,
            home_team: partida.time_mandante?.nome_popular || 'Casa',
            away_team: partida.time_visitante?.nome_popular || 'Fora',
            home_logo: partida.time_mandante?.escudo || null,
            away_logo: partida.time_visitante?.escudo || null,
            score_home: partida.placar_mandante ?? 0,
            score_away: partida.placar_visitante ?? 0,
            match_date: matchDate?.toISOString() || null,
            status: 'finished',
          });
        }
      } catch (campErr) {
        console.warn(`[Simulation] Error processing camp:`, campErr);
      }
    }

    // Sort by date (most recent first)
    matches.sort((a, b) => {
      if (!a.match_date || !b.match_date) return 0;
      return new Date(b.match_date).getTime() - new Date(a.match_date).getTime();
    });

    console.log(`[Simulation] ✅ ${matches.length} finished matches found for simulation`);

    return new Response(
      JSON.stringify({
        ok: true,
        source: 'api-futebol.com.br (simulation)',
        total_matches: matches.length,
        matches,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Simulation] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
