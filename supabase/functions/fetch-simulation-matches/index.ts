import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_FUTEBOL_URL = 'https://api.api-futebol.com.br/v1';

interface MatchStats {
  possession_home: number;
  possession_away: number;
  attacks_home: number;
  attacks_away: number;
  dangerous_attacks_home: number;
  dangerous_attacks_away: number;
  shots_total_home: number;
  shots_total_away: number;
  shots_home: number;
  shots_away: number;
  shots_on_target_home: number;
  shots_on_target_away: number;
  xG_home: number;
  xG_away: number;
}

function parseStatValue(val: any): number {
  if (val == null) return 0;
  const str = String(val).replace('%', '').trim();
  return parseInt(str, 10) || 0;
}

function extractStats(estatisticas: any): MatchStats | null {
  if (!estatisticas?.mandante || !estatisticas?.visitante) return null;
  const home = estatisticas.mandante;
  const away = estatisticas.visitante;
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

    let analyze = false;
    let matchIdToAnalyze: string | null = null;
    try {
      const body = await req.json();
      analyze = body.analyze === true;
      matchIdToAnalyze = body.match_id || null;
    } catch { /* no body */ }

    // If analyzing a specific match
    if (analyze && matchIdToAnalyze) {
      const partidaId = matchIdToAnalyze.replace('sim_', '');
      console.log(`[Simulation] 🔬 Analyzing match ${partidaId}`);

      const matchRes = await fetch(`${API_FUTEBOL_URL}/partidas/${partidaId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!matchRes.ok) {
        const errText = await matchRes.text();
        console.error(`[Simulation] Match fetch error: ${matchRes.status} - ${errText.substring(0, 200)}`);
        return new Response(
          JSON.stringify({ error: 'Match not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const matchDetail = await matchRes.json();
      const stats = extractStats(matchDetail.estatisticas);

      const championship = matchDetail.campeonato?.nome || matchDetail.campeonato?.nome_popular || 'Simulação';
      const homeTeam = matchDetail.time_mandante?.nome_popular || 'Casa';
      const awayTeam = matchDetail.time_visitante?.nome_popular || 'Fora';

      // Determine simulation minute based on match period
      const periodo = matchDetail.periodo || '';
      let simulatedMinute = 30;
      if (periodo.includes('2') || periodo.toLowerCase().includes('second')) {
        simulatedMinute = 65;
      } else if (periodo.toLowerCase().includes('interval') || periodo.toLowerCase().includes('half')) {
        simulatedMinute = 45;
      }

      console.log(`[Simulation] Stats extracted:`, JSON.stringify(stats));
      console.log(`[Simulation] Simulating at minute ${simulatedMinute} for ${homeTeam} vs ${awayTeam}`);

      // Call Mycroft - simulate as 0x0 so it doesn't know the result
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
              home: homeTeam,
              away: awayTeam,
              scoreHome: 0,
              scoreAway: 0,
              minute: simulatedMinute,
              period: `Simulação (Min ${simulatedMinute})`,
              championship,
              match_id: `sim_${partidaId}`,
              stats: stats || {},
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

    // Default: fetch matches using /ao-vivo (same as live mode - DEV API returns test data)
    console.log('[Simulation] 📅 Fetching matches from API Futebol (DEV mode)...');

    const liveRes = await fetch(`${API_FUTEBOL_URL}/ao-vivo`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!liveRes.ok) {
      const errText = await liveRes.text();
      console.error(`[Simulation] /ao-vivo error: ${liveRes.status} - ${errText.substring(0, 300)}`);

      // Fallback: try fetching championships and their rounds
      console.log('[Simulation] Trying fallback: /campeonatos...');
      return await fetchFromChampionships(apiKey);
    }

    const liveData = await liveRes.json();
    console.log(`[Simulation] /ao-vivo raw response type: ${typeof liveData}, isArray: ${Array.isArray(liveData)}`);

    const matches: any[] = [];

    // /ao-vivo can return an array or object with matches
    const rawMatches = Array.isArray(liveData) ? liveData : (liveData.partidas || liveData.matches || []);

    for (const partida of rawMatches) {
      const partidaId = partida.partida_id || partida.id;
      if (!partidaId) continue;

      matches.push({
        id: `sim_${partidaId}`,
        partida_id: partidaId,
        championship: partida.campeonato?.nome_popular || partida.campeonato?.nome || 'Simulação',
        home_team: partida.time_mandante?.nome_popular || partida.mandante?.nome || 'Casa',
        away_team: partida.time_visitante?.nome_popular || partida.visitante?.nome || 'Fora',
        home_logo: partida.time_mandante?.escudo || partida.mandante?.escudo || null,
        away_logo: partida.time_visitante?.escudo || partida.visitante?.escudo || null,
        score_home: partida.placar_mandante ?? partida.placar?.mandante ?? 0,
        score_away: partida.placar_visitante ?? partida.placar?.visitante ?? 0,
        minute: partida.minuto || partida.min || null,
        period: partida.periodo || partida.status || null,
        match_date: partida.data_realizacao_iso || partida.data_realizacao || null,
        status: partida.status || 'live',
      });
    }

    // If /ao-vivo returned nothing, try fallback
    if (matches.length === 0) {
      console.log('[Simulation] /ao-vivo returned 0 matches, trying fallback...');
      return await fetchFromChampionships(apiKey);
    }

    console.log(`[Simulation] ✅ ${matches.length} matches found`);

    return new Response(
      JSON.stringify({
        ok: true,
        source: 'api-futebol.com.br (simulação DEV)',
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

async function fetchFromChampionships(apiKey: string): Promise<Response> {
  try {
    const campRes = await fetch(`${API_FUTEBOL_URL}/campeonatos`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!campRes.ok) {
      const errText = await campRes.text();
      console.error(`[Simulation] Campeonatos error: ${campRes.status} - ${errText.substring(0, 300)}`);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch championships', detail: errText.substring(0, 200) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allCamps = await campRes.json();
    console.log(`[Simulation] Total championships: ${allCamps.length}`);
    
    // Log first few for debugging
    for (const c of allCamps.slice(0, 5)) {
      console.log(`[Simulation] Camp: ${c.nome || c.nome_popular} | status: ${c.status} | id: ${c.campeonato_id}`);
    }

    // Don't filter by status - DEV API may use different values
    const camps = allCamps.slice(0, 10);
    const matches: any[] = [];

    for (const camp of camps) {
      try {
        const campId = camp.campeonato_id;
        const campNome = camp.nome_popular || camp.nome;

        const rodadaRes = await fetch(`${API_FUTEBOL_URL}/campeonatos/${campId}/rodadas/atual`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });

        if (!rodadaRes.ok) {
          console.warn(`[Simulation] Rodada unavailable for ${campNome}: ${rodadaRes.status}`);
          continue;
        }

        const rodadaData = await rodadaRes.json();
        const partidas = rodadaData.partidas || [];

        for (const partida of partidas) {
          const partidaId = partida.partida_id;
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
            match_date: partida.data_realizacao_iso || null,
            status: partida.status || 'unknown',
          });
        }
      } catch (campErr) {
        console.warn(`[Simulation] Error processing camp:`, campErr);
      }
    }

    console.log(`[Simulation] ✅ ${matches.length} matches from championships fallback`);

    return new Response(
      JSON.stringify({
        ok: true,
        source: 'api-futebol.com.br (simulação DEV - fallback)',
        total_matches: matches.length,
        matches,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[Simulation] Fallback error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Fallback failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
