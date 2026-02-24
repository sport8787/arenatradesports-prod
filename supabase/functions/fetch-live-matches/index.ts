import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_FOOTBALL_URL = 'https://v3.football.api-sports.io';

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

interface FixtureStats {
  attacks_home: number;
  attacks_away: number;
  possession_home: number;
  possession_away: number;
  shots_home: number;
  shots_away: number;
  xG_home: number;
  xG_away: number;
}

function findStat(stats: any[], type: string): string | null {
  const stat = stats.find((s: any) => s.type === type);
  return stat?.value ?? null;
}

function parsePct(val: string | null): number {
  if (!val) return 0;
  return parseInt(val.replace('%', ''), 10) || 0;
}

async function fetchFixtureStats(fixtureId: number, apiKey: string): Promise<FixtureStats | null> {
  try {
    const res = await fetch(`${API_FOOTBALL_URL}/fixtures/statistics?fixture=${fixtureId}`, {
      headers: { 'x-apisports-key': apiKey },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const teams = data.response;
    if (!teams || teams.length < 2) return null;

    const homeStats = teams[0].statistics || [];
    const awayStats = teams[1].statistics || [];

    return {
      attacks_home: parseInt(findStat(homeStats, 'Dangerous Attacks') || '0', 10),
      attacks_away: parseInt(findStat(awayStats, 'Dangerous Attacks') || '0', 10),
      possession_home: parsePct(findStat(homeStats, 'Ball Possession')),
      possession_away: parsePct(findStat(awayStats, 'Ball Possession')),
      shots_home: parseInt(findStat(homeStats, 'Shots on Goal') || '0', 10),
      shots_away: parseInt(findStat(awayStats, 'Shots on Goal') || '0', 10),
      xG_home: parseFloat(findStat(homeStats, 'expected_goals') || '0'),
      xG_away: parseFloat(findStat(awayStats, 'expected_goals') || '0'),
    };
  } catch (e) {
    console.error(`[FetchLive] Stats fetch error for fixture ${fixtureId}:`, e);
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

    // 1. Fetch all live matches
    console.log('[FetchLive] Fetching all live matches from API-Football...');
    const res = await fetch(`${API_FOOTBALL_URL}/fixtures?live=all`, {
      headers: { 'x-apisports-key': apiKey },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[FetchLive] API-Football error ${res.status}:`, errText);
      return new Response(
        JSON.stringify({ error: `API-Football error: ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawText = await res.text();
    console.log(`[FetchLive] Raw API response (first 500 chars):`, rawText.substring(0, 500));
    const data = JSON.parse(rawText);
    const fixtures = data.response || [];
    console.log(`[FetchLive] Found ${fixtures.length} live matches, errors: ${JSON.stringify(data.errors)}, results: ${data.results}`);

    const results: any[] = [];
    let analyzedCount = 0;

    // 2. Process each fixture
    for (const fixture of fixtures) {
      const fixtureId = String(fixture.fixture.id);
      const minute = fixture.fixture.status?.elapsed ?? 0;
      const period = fixture.fixture.status?.long ?? 'Unknown';
      const championship = fixture.league?.name ?? 'Unknown';

      const matchData = {
        match_id: fixtureId,
        home_team: fixture.teams.home.name,
        away_team: fixture.teams.away.name,
        home_logo: fixture.teams.home.logo || null,
        away_logo: fixture.teams.away.logo || null,
        score_home: fixture.goals.home ?? 0,
        score_away: fixture.goals.away ?? 0,
        minute,
        period,
        championship,
        status: 'live',
        updated_at: new Date().toISOString(),
      };

      // 3. Fetch stats for this fixture
      const stats = await fetchFixtureStats(fixture.fixture.id, apiKey);

      // 4. Upsert match (preserve mycroft fields)
      const { data: existing } = await supabase
        .from('live_matches')
        .select('mycroft_status, mycroft_analysis_id')
        .eq('match_id', fixtureId)
        .single();

      const upsertData: any = {
        ...matchData,
        stats: stats || { attacks_home: 0, attacks_away: 0, possession_home: 0, possession_away: 0, shots_home: 0, shots_away: 0 },
      };

      // Preserve mycroft fields if they exist
      if (existing) {
        upsertData.mycroft_status = existing.mycroft_status;
        upsertData.mycroft_analysis_id = existing.mycroft_analysis_id;
      }

      await supabase
        .from('live_matches')
        .upsert(upsertData, { onConflict: 'match_id' });

      // 5. Auto-trigger Mycroft if match is >= 20 min and not yet analyzed (or was AGUARDAR)
      const shouldAnalyze = minute >= 20 && stats &&
        (!existing?.mycroft_analysis_id || existing?.mycroft_status === 'aguardar');

      if (shouldAnalyze) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

          console.log(`[FetchLive] Triggering Mycroft for ${matchData.home_team} vs ${matchData.away_team} (${minute}')`);

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
                  minute,
                  period,
                  championship,
                  match_id: fixtureId,
                  stats,
                  bankroll: 500,
                },
              }),
            }
          );

          if (analysisRes.ok) {
            const analysis = await analysisRes.json();
            console.log(`[FetchLive] Mycroft verdict for ${fixtureId}: ${analysis.verdict} (${analysis.confidence}%)`);

            // Save analysis
            const { data: analysisRow } = await supabase
              .from('mycroft_analyses')
              .insert({
                match_id: fixtureId,
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
                .eq('match_id', fixtureId);

              // Auto-create signal if APROVADO
              if (analysis.verdict === 'APROVADO') {
                await supabase.from('signals_sent').insert({
                  match_id: fixtureId,
                  analysis_id: analysisRow.id,
                });
                console.log(`[FetchLive] Signal created for ${fixtureId}`);
              }

              analyzedCount++;
            }
          } else {
            const errText = await analysisRes.text();
            console.error(`[FetchLive] Mycroft failed for ${fixtureId}:`, errText);
          }
        } catch (e) {
          console.error(`[FetchLive] Analysis error for ${fixtureId}:`, e);
        }
      }

      results.push({
        match_id: fixtureId,
        teams: `${matchData.home_team} vs ${matchData.away_team}`,
        minute,
        has_stats: !!stats,
        analyzed: shouldAnalyze,
      });
    }

    // 6. Mark matches no longer live as 'finished'
    const liveMatchIds = fixtures.map((f: any) => String(f.fixture.id));
    const { data: currentLive } = await supabase
      .from('live_matches')
      .select('match_id')
      .eq('status', 'live');

    const staleIds = (currentLive || [])
      .map((m: any) => m.match_id)
      .filter((id: string) => !liveMatchIds.includes(id));

    if (staleIds.length > 0) {
      await supabase
        .from('live_matches')
        .update({ status: 'finished', updated_at: new Date().toISOString() })
        .in('match_id', staleIds);
      console.log(`[FetchLive] Marked ${staleIds.length} matches as finished`);
    }

    // 7. Fetch today's scheduled fixtures and save to scheduled_games (one-time cache)
    let scheduledCount = 0;
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log(`[FetchLive] Fetching scheduled fixtures for ${today}...`);
      const schedRes = await fetch(`${API_FOOTBALL_URL}/fixtures?date=${today}&status=NS-1H-2H-HT-ET-BT-P-SUSP-INT-LIVE`, {
        headers: { 'x-apisports-key': apiKey },
      });

      if (schedRes.ok) {
        const schedData = await schedRes.json();
        const schedFixtures = schedData.response || [];
        console.log(`[FetchLive] Found ${schedFixtures.length} fixtures for today`);

        for (const fix of schedFixtures) {
          const fixtureDate = new Date(fix.fixture.date);
          const matchDate = fixtureDate.toISOString().split('T')[0];
          const matchTime = fixtureDate.toTimeString().slice(0, 5);
          const checkTime = new Date(fixtureDate.getTime() - 15 * 60000).toISOString();

          const leagueName = fix.league?.name || 'Unknown';
          const homeTeam = fix.teams?.home?.name || 'TBD';
          const awayTeam = fix.teams?.away?.name || 'TBD';
          const eventId = String(fix.fixture.id);
          const fixtureStatus = fix.fixture.status?.short || 'NS';

          // Calculate relevance based on league
          const leagueLower = leagueName.toLowerCase();
          let relevance = 1;
          if (leagueLower.includes('brasileir') || leagueLower.includes('premier') || leagueLower.includes('champions')) relevance = 5;
          else if (leagueLower.includes('la liga') || leagueLower.includes('bundesliga') || leagueLower.includes('serie a') || leagueLower.includes('ligue 1')) relevance = 4;
          else if (leagueLower.includes('copa') || leagueLower.includes('libertadores')) relevance = 4;
          else if (leagueLower.includes('serie b') || leagueLower.includes('championship')) relevance = 3;
          else relevance = 2;

          // Map API status to our status
          let gameStatus = 'scheduled';
          if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(fixtureStatus)) gameStatus = 'live';
          else if (['FT', 'AET', 'PEN'].includes(fixtureStatus)) gameStatus = 'finished';

          const { error: upsertErr } = await supabase.from('scheduled_games').upsert({
            match_date: matchDate,
            match_time: matchTime,
            match_datetime: fixtureDate.toISOString(),
            league_name: leagueName,
            home_team: homeTeam,
            away_team: awayTeam,
            event_id: eventId,
            match_id: eventId,
            status: gameStatus,
            check_time: checkTime,
            relevance_score: relevance,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'match_date,match_time,home_team,away_team',
          });

          if (!upsertErr) scheduledCount++;
        }
        console.log(`[FetchLive] Saved ${scheduledCount} scheduled games`);
      }
    } catch (schedErr) {
      console.error('[FetchLive] Scheduled games fetch error:', schedErr);
    }

    console.log(`[FetchLive] Done: ${fixtures.length} matches synced, ${analyzedCount} analyzed, ${staleIds.length} finished, ${scheduledCount} scheduled`);

    return new Response(
      JSON.stringify({
        ok: true,
        total_matches: fixtures.length,
        analyzed: analyzedCount,
        finished: staleIds.length,
        scheduled: scheduledCount,
        matches: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[FetchLive] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
