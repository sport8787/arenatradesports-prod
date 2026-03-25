import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_FOOTBALL_URL = 'https://v3.football.api-sports.io';

// Whitelist de ligas permitidas (mesma do fetch-live-matches)
const LIGAS_PERMITIDAS: Record<number, string> = {
  39:  "Premier League",
  140: "La Liga",
  135: "Serie A",
  78:  "Bundesliga",
  61:  "Ligue 1",
  94:  "Primeira Liga (Portugal)",
  88:  "Eredivisie",
  144: "Pro League (Bélgica)",
  197: "Super League (Grécia)",
  203: "Süper Lig (Turquia)",
  40:  "Championship (Inglaterra — 2ª divisão)",
  2:   "Champions League",
  3:   "Europa League",
  848: "Conference League",
  13:  "Libertadores",
  11:  "Sul-Americana",
  71:  "Brasileirão Série A",
  72:  "Brasileirão Série B",
  73:  "Brasileirão Série C",
  75:  "Copa Do Brasil",
  76:  "Copa do Nordeste",
  529: "Copa do Norte",
  530: "Copa Verde",
  531: "Copa Paulista",
  532: "Copa Espírito Santo",
  533: "Copa Rio",
  128: "Liga Profesional Argentina",
  238: "Argentine Primera División",
  253: "MLS",
  10:  "Amistosos Internacionais (Seleções)",
  32:  "Eliminatórias Copa do Mundo - Europa",
};

const LIGAS_BLOQUEADAS: number[] = [667, 668];

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Extract statistics from the API response for a fixture
async function fetchFixtureStats(fixtureId: string, apiKey: string): Promise<any> {
  try {
    const res = await fetch(`${API_FOOTBALL_URL}/fixtures/statistics?fixture=${fixtureId}`, {
      headers: { 'x-apisports-key': apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const teams = data.response || [];
    if (teams.length < 2) return null;

    const home = teams[0]?.statistics || [];
    const away = teams[1]?.statistics || [];

    const getStat = (arr: any[], type: string) => {
      const found = arr.find((s: any) => s.type === type);
      return found?.value ?? null;
    };

    const parsePossession = (val: any) => {
      if (val == null) return 0;
      return parseInt(String(val).replace('%', '')) || 0;
    };

    return {
      possession_home: parsePossession(getStat(home, 'Ball Possession')),
      possession_away: parsePossession(getStat(away, 'Ball Possession')),
      shots_total_home: getStat(home, 'Total Shots') ?? 0,
      shots_total_away: getStat(away, 'Total Shots') ?? 0,
      shots_on_target_home: getStat(home, 'Shots on Goal') ?? 0,
      shots_on_target_away: getStat(away, 'Shots on Goal') ?? 0,
      attacks_home: getStat(home, 'Dangerous Attacks') ?? getStat(home, 'Shots insidebox') ?? 0,
      attacks_away: getStat(away, 'Dangerous Attacks') ?? getStat(away, 'Shots insidebox') ?? 0,
      corners_home: getStat(home, 'Corner Kicks') ?? 0,
      corners_away: getStat(away, 'Corner Kicks') ?? 0,
      fouls_home: getStat(home, 'Fouls') ?? 0,
      fouls_away: getStat(away, 'Fouls') ?? 0,
      cards_home: (getStat(home, 'Yellow Cards') ?? 0) + (getStat(home, 'Red Cards') ?? 0),
      cards_away: (getStat(away, 'Yellow Cards') ?? 0) + (getStat(away, 'Red Cards') ?? 0),
      passes_home: getStat(home, 'Total passes') ?? 0,
      passes_away: getStat(away, 'Total passes') ?? 0,
      passes_accurate_home: getStat(home, 'Passes accurate') ?? 0,
      passes_accurate_away: getStat(away, 'Passes accurate') ?? 0,
      xG_home: parseFloat(getStat(home, 'expected_goals') || '0') || null,
      xG_away: parseFloat(getStat(away, 'expected_goals') || '0') || null,
    };
  } catch (e) {
    console.error(`[LiveScores] Stats fetch error for ${fixtureId}:`, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('API_FOOTBALL_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API_FOOTBALL_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch all live fixtures (1 API call)
    console.log('[LiveScores] Fetching live fixtures...');
    const res = await fetch(`${API_FOOTBALL_URL}/fixtures?live=all`, {
      headers: { 'x-apisports-key': apiKey },
    });

    if (!res.ok) {
      console.error(`[LiveScores] API error: ${res.status}`);
      return new Response(
        JSON.stringify({ error: `API error: ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await res.json();
    const allFixtures = data.response || [];
    
    // Filtrar apenas ligas permitidas
    const fixtures = allFixtures.filter((f: any) => {
      const leagueId = f.league?.id;
      return leagueId in LIGAS_PERMITIDAS && !LIGAS_BLOQUEADAS.includes(leagueId);
    });
    console.log(`[LiveScores] ✅ ${fixtures.length}/${allFixtures.length} jogos após filtro de ligas`);

    if (fixtures.length === 0) {
      const { data: staleLive } = await supabase
        .from('live_matches')
        .select('match_id')
        .eq('status', 'live');

      if (staleLive && staleLive.length > 0) {
        await supabase
          .from('live_matches')
          .update({ status: 'finished', updated_at: new Date().toISOString() })
          .eq('status', 'live');
        console.log(`[LiveScores] Marked ${staleLive.length} stale matches as finished`);
      }

      return new Response(
        JSON.stringify({ updated: 0, finished: staleLive?.length || 0, stats_fetched: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const liveFixtureIds = new Set(fixtures.map((f: any) => String(f.fixture.id)));

    // 2. Get matches in DB that need stats (>=15 min, no analysis yet)
    const { data: matchesNeedingStats } = await supabase
      .from('live_matches')
      .select('match_id')
      .eq('status', 'live')
      .is('mycroft_analysis_id', null)
      .gte('minute', 15);

    const needsStatsSet = new Set((matchesNeedingStats || []).map((m: any) => m.match_id));

    // 3. Update scores + fetch stats in parallel batches
    let updated = 0;
    let statsFetched = 0;

    // Process in batches of 5 to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < fixtures.length; i += batchSize) {
      const batch = fixtures.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (fixture: any) => {
        const fixtureId = String(fixture.fixture.id);
        const minute = fixture.fixture.status?.elapsed ?? 0;
        const period = fixture.fixture.status?.long ?? 'Unknown';
        const scoreHome = fixture.goals.home ?? 0;
        const scoreAway = fixture.goals.away ?? 0;
        const statusShort = fixture.fixture.status?.short ?? '';

        let matchStatus = 'live';
        if (['FT', 'AET', 'PEN'].includes(statusShort)) {
          matchStatus = 'finished';
        } else if (['HT'].includes(statusShort)) {
          matchStatus = 'halftime';
        }

        const updatePayload: any = {
          score_home: scoreHome,
          score_away: scoreAway,
          minute,
          period,
          status: matchStatus,
          updated_at: new Date().toISOString(),
        };

        // Fetch full stats for matches that need analysis (>= 15 min, no analysis yet)
        if (needsStatsSet.has(fixtureId) && minute >= 15) {
          const stats = await fetchFixtureStats(fixtureId, apiKey);
          if (stats) {
            updatePayload.stats = stats;
            statsFetched++;
            console.log(`[LiveScores] Stats fetched for ${fixtureId}: Poss ${stats.possession_home}%-${stats.possession_away}%, Shots ${stats.shots_total_home}-${stats.shots_total_away}`);
          }
        }

        const { error } = await supabase
          .from('live_matches')
          .update(updatePayload)
          .eq('match_id', fixtureId);

        if (!error) updated++;
      }));
    }

    // 4. Mark stale matches as finished
    const { data: currentLive } = await supabase
      .from('live_matches')
      .select('match_id')
      .eq('status', 'live');

    let finished = 0;
    if (currentLive) {
      const staleIds = currentLive
        .filter(m => !liveFixtureIds.has(m.match_id))
        .map(m => m.match_id);

      if (staleIds.length > 0) {
        const { error: finishErr } = await supabase
          .from('live_matches')
          .update({ status: 'finished', updated_at: new Date().toISOString() })
          .in('match_id', staleIds);

        if (!finishErr) finished = staleIds.length;
      }
    }

    console.log(`[LiveScores] Updated ${updated} scores, ${statsFetched} stats fetched, ${finished} stale finished`);

    return new Response(
      JSON.stringify({ updated, finished, stats_fetched: statsFetched, total_live: fixtures.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[LiveScores] Error:', e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
