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
    const authHeaders = { 'Authorization': `Bearer ${apiKey}` };

    // 1. Fetch live matches from API Futebol
    console.log('[FetchV2] Fetching live matches from API Futebol...');
    const liveRes = await fetch(`${API_FUTEBOL_URL}/ao-vivo`, { headers: authHeaders });

    let liveMatches: any[] = [];
    let liveCount = 0;

    if (liveRes.ok) {
      liveMatches = await liveRes.json();
      console.log(`[FetchV2] ${liveMatches.length} live matches found`);

      for (const match of liveMatches) {
        const fixtureId = `apifut_${match.partida_id}`;
        const championship = match.campeonato?.nome || match.campeonato?.nome_popular || 'Unknown';

        const matchData = {
          match_id: fixtureId,
          home_team: match.time_mandante?.nome_popular || 'TBD',
          away_team: match.time_visitante?.nome_popular || 'TBD',
          home_logo: match.time_mandante?.escudo || null,
          away_logo: match.time_visitante?.escudo || null,
          score_home: match.placar_mandante ?? 0,
          score_away: match.placar_visitante ?? 0,
          minute: match.minuto ?? 0,
          period: match.periodo || 'Ao Vivo',
          championship,
          status: 'live',
          stats: {}, // API Futebol doesn't provide inline stats on /ao-vivo
          updated_at: new Date().toISOString(),
        };

        // Preserve existing mycroft fields
        const { data: existing } = await supabase
          .from('live_matches')
          .select('mycroft_status, mycroft_analysis_id')
          .eq('match_id', fixtureId)
          .single();

        const upsertData: any = { ...matchData };
        if (existing) {
          upsertData.mycroft_status = existing.mycroft_status;
          upsertData.mycroft_analysis_id = existing.mycroft_analysis_id;
        }

        await supabase
          .from('live_matches')
          .upsert(upsertData, { onConflict: 'match_id' });

        liveCount++;
      }
    } else {
      console.warn(`[FetchV2] Live matches error: ${liveRes.status}`);
    }

    // 2. Fetch available championships for scheduled games
    console.log('[FetchV2] Fetching available championships...');
    let scheduledCount = 0;
    const campeonatos: any[] = [];

    const campRes = await fetch(`${API_FUTEBOL_URL}/campeonatos`, { headers: authHeaders });

    if (campRes.ok) {
      const allCamps = await campRes.json();
      campeonatos.push(...allCamps);
      console.log(`[FetchV2] ${allCamps.length} championships available`);

      // Try to fetch partidas for priority championships only
      const priorityCampIds = allCamps
        .filter((c: any) => c.status === 'andamento')
        .slice(0, 10); // Limit to avoid too many calls

      for (const camp of priorityCampIds) {
        try {
          const campId = camp.campeonato_id;
          const campNome = camp.nome_popular || camp.nome;

          const partidasRes = await fetch(`${API_FUTEBOL_URL}/campeonatos/${campId}/partidas`, { headers: authHeaders });

          if (partidasRes.status === 401 || partidasRes.status === 403) {
            console.log(`[FetchV2] Partidas endpoint requires PROD key, skipping scheduled fetch`);
            break; // No point trying others if auth fails
          }

          if (!partidasRes.ok) {
            continue;
          }

          const partidasData = await partidasRes.json();
          const partidas = partidasData.partidas || {};

          // Flatten all matches from all phases/keys
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
          console.warn(`[FetchV2] Error processing camp ${camp.nome}:`, campErr);
        }
      }
    } else {
      console.warn(`[FetchV2] Championships fetch error: ${campRes.status}`);
    }

    console.log(`[FetchV2] Done: ${liveCount} live synced, ${scheduledCount} scheduled saved`);

    return new Response(
      JSON.stringify({
        ok: true,
        source: 'api-futebol.com.br',
        total_matches: liveCount,
        scheduled: scheduledCount,
        live_matches: liveMatches.map((m: any) => ({
          match_id: `apifut_${m.partida_id}`,
          teams: `${m.time_mandante?.nome_popular} vs ${m.time_visitante?.nome_popular}`,
          championship: m.campeonato?.nome || 'Unknown',
          minute: m.minuto,
        })),
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
