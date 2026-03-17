import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_FOOTBALL_URL = 'https://v3.football.api-sports.io';

// Whitelist de ligas permitidas (league_id → nome)
const LIGAS_PERMITIDAS: Record<number, string> = {
  // Europa — Primeiras divisões
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
  // Europa — Segundas divisões
  40:  "Championship (Inglaterra — 2ª divisão)",
  // UEFA
  2:   "Champions League",
  3:   "Europa League",
  848: "Conference League",
  // América do Sul
  13:  "Libertadores",
  11:  "Sul-Americana",
  71:  "Brasileirão Série A",
  72:  "Brasileirão Série B",
  73:  "Brasileirão Série C",
  238: "Argentine Primera División",
  // América do Norte
  253: "MLS",
};

// IDs de ligas bloqueadas
const LIGAS_BLOQUEADAS: number[] = [
  667, // Amistosos clubes
  668, // Amistosos seleções
];

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

interface FixtureStats {
  attacks_home: number;
  attacks_away: number;
  dangerous_attacks_home: number;
  dangerous_attacks_away: number;
  possession_home: number;
  possession_away: number;
  shots_home: number;
  shots_away: number;
  shots_total_home: number;
  shots_total_away: number;
  shots_on_target_home: number;
  shots_on_target_away: number;
  xG_home: number;
  xG_away: number;
}

// Robust stat getter from uploaded fix - handles null, string percentages, numbers
function getStat(stats: any[], type: string): number {
  const found = stats.find((s: any) => s.type === type);
  if (!found) return 0;
  const value = found.value;
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string') {
    return parseInt(value.replace('%', ''), 10) || 0;
  }
  return typeof value === 'number' ? value : 0;
}

async function fetchFixtureStats(fixtureId: number, apiKey: string): Promise<FixtureStats | null> {
  try {
    console.log(`[FetchLive] 🔍 Fetching stats for fixture ${fixtureId}...`);
    const res = await fetch(`${API_FOOTBALL_URL}/fixtures/statistics?fixture=${fixtureId}`, {
      headers: { 'x-apisports-key': apiKey },
    });
    if (!res.ok) {
      console.error(`[FetchLive] Stats API error ${res.status} for fixture ${fixtureId}`);
      return null;
    }

    const data = await res.json();
    const teams = data.response;
    if (!teams || teams.length < 2) {
      console.warn(`[FetchLive] No team stats returned for fixture ${fixtureId}`);
      return null;
    }

    const homeStats = teams[0].statistics || [];
    const awayStats = teams[1].statistics || [];

    // Log raw stat types for debugging
    const statTypes = homeStats.map((s: any) => `${s.type}: ${s.value}`).join(', ');
    console.log(`[FetchLive] 📊 Raw home stats for ${fixtureId}: ${statTypes.substring(0, 300)}`);

    // API-Football uses 'Shots insidebox' as proxy for dangerous attacks (no 'Dangerous Attacks' field)
    const shotsInsideHome = getStat(homeStats, 'Shots insidebox');
    const shotsInsideAway = getStat(awayStats, 'Shots insidebox');
    
    const result: FixtureStats = {
      attacks_home: shotsInsideHome + getStat(homeStats, 'Shots outsidebox'),
      attacks_away: shotsInsideAway + getStat(awayStats, 'Shots outsidebox'),
      dangerous_attacks_home: shotsInsideHome,
      dangerous_attacks_away: shotsInsideAway,
      possession_home: getStat(homeStats, 'Ball Possession'),
      possession_away: getStat(awayStats, 'Ball Possession'),
      shots_home: getStat(homeStats, 'Shots on Goal'),
      shots_away: getStat(awayStats, 'Shots on Goal'),
      shots_total_home: getStat(homeStats, 'Total Shots'),
      shots_total_away: getStat(awayStats, 'Total Shots'),
      shots_on_target_home: getStat(homeStats, 'Shots on Goal'),
      shots_on_target_away: getStat(awayStats, 'Shots on Goal'),
      xG_home: parseFloat(String(getStat(homeStats, 'expected_goals'))) || 0,
      xG_away: parseFloat(String(getStat(awayStats, 'expected_goals'))) || 0,
    };

    console.log(`[FetchLive] 📊 Parsed stats: Posse ${result.possession_home}%-${result.possession_away}% | Ataques ${result.attacks_home}-${result.attacks_away} | Perigosos ${result.dangerous_attacks_home}-${result.dangerous_attacks_away} | Chutes ${result.shots_total_home}-${result.shots_total_away} (Gol: ${result.shots_home}-${result.shots_away})`);

    return result;
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
    const allFixtures = data.response || [];
    console.log(`[FetchLive] Found ${allFixtures.length} total live matches`);

    // 1b. Filtrar apenas ligas permitidas
    const fixtures = allFixtures.filter((f: any) => {
      const leagueId = f.league?.id;
      return leagueId in LIGAS_PERMITIDAS && !LIGAS_BLOQUEADAS.includes(leagueId);
    });

    console.log(`[FetchLive] ✅ ${fixtures.length}/${allFixtures.length} jogos passaram no filtro de ligas`);

    // Log de auditoria do filtro
    try {
      await supabase.from('cron_logs').insert({
        tipo: 'filtro_ligas',
        total_recebidos: allFixtures.length,
        total_filtrados: fixtures.length,
        ligas_encontradas: [...new Set(fixtures.map((f: any) => `${f.league.id}: ${f.league.name}`))],
      });
    } catch (logErr) {
      console.warn('[FetchLive] Falha ao gravar log de filtro:', logErr);
    }

    const results: any[] = [];
    // analyzedCount removed - analysis is now manual only

    // 2. Process each fixture - fetch stats from kickoff
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

      // 3. Fetch live stats for all live matches
      const stats: FixtureStats | null = await fetchFixtureStats(fixture.fixture.id, apiKey);

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

      // Analysis is now MANUAL ONLY - no auto-trigger to save API credits
      // Stats are collected and saved; user triggers analysis separately

      results.push({
        match_id: fixtureId,
        teams: `${matchData.home_team} vs ${matchData.away_team}`,
        minute,
        has_stats: !!stats,
        analyzed: false,
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

    console.log(`[FetchLive] Done: ${fixtures.length} matches synced, ${staleIds.length} finished, ${scheduledCount} scheduled`);

    return new Response(
      JSON.stringify({
        ok: true,
        total_matches: fixtures.length,
        analyzed: 0,
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
