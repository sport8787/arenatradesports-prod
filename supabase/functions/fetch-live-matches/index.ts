import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logEdgeError.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_FOOTBALL_URL = 'https://v3.football.api-sports.io';
const LIVE_STATUS_SHORTS = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
const FINISHED_STATUS_SHORTS = new Set(['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO']);
const STALE_FINISH_GRACE_MS = 20 * 60 * 1000;

// Whitelist de ligas permitidas (league_id → nome)
const LIGAS_PERMITIDAS: Record<number, string> = {
  // Europa — Top 5 + segundas divisões
  39:  "Premier League",
  40:  "Championship (Inglaterra — 2ª divisão)",
  41:  "League One (Inglaterra — 3ª divisão)",
  140: "La Liga",
  141: "Segunda División (Espanha)",
  135: "Serie A",
  136: "Serie B (Itália)",
  78:  "Bundesliga",
  79:  "2. Bundesliga",
  61:  "Ligue 1",
  62:  "Ligue 2 (França)",
  // Europa — Primeiras divisões relevantes
  94:  "Primeira Liga (Portugal)",
  88:  "Eredivisie",
  89:  "Eerste Divisie (Holanda — 2ª divisão)",
  144: "Pro League (Bélgica)",
  197: "Super League (Grécia)",
  203: "Süper Lig (Turquia)",
  207: "Super Lig (Suíça)",
  113: "Allsvenskan (Suécia)",
  103: "Eliteserien (Noruega)",
  119: "Superliga (Dinamarca)",
  244: "Veikkausliiga (Finlândia)",
  218: "Bundesliga (Áustria)",
  332: "Ekstraklasa (Polônia)",
  235: "Premiership (Escócia)",
  271: "Prva HNL (Croácia)",
  283: "Superliga (Sérvia)",
  172: "Fortuna Liga (Eslováquia)",
  345: "Chance Liga (Tchéquia)",
  // UEFA Competições
  2:   "Champions League",
  3:   "Europa League",
  848: "Conference League",
  4:   "Euro Qualifiers",
  // América do Sul
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
  239: "Copa Argentina",
  350: "Primera A (Colômbia)",
  268: "Liga 1 (Peru)",
  262: "Liga Pro (Equador)",
  296: "Primera División (Uruguai)",
  // América do Norte / Central
  253: "MLS",
  262: "Liga MX",
  // Ásia
  292: "K-League 1 (Coreia do Sul)",
  98:  "J1 League (Japão)",
  169: "Super League (China)",
  // Oceania / África
  188: "A-League (Austrália)",
  233: "Premier Soccer League (África do Sul)",
  // Mundo
  1:   "Copa do Mundo",
  15:  "Copa do Mundo — Qualificatórias",
  10:  "Amistosos Internacionais (Seleções)",
  32:  "Eliminatórias Copa do Mundo - Europa",
  // Feminino — Principais ligas
  746: "UEFA Women's Champions League",
  766: "WSL (Inglaterra Feminino)",
  770: "Frauen-Bundesliga (Alemanha Feminino)",
  764: "NWSL (EUA Feminino)",
  1382: "Brasileirão Feminino",
};

// IDs de ligas bloqueadas
const LIGAS_BLOQUEADAS: number[] = [
  667, // Amistosos clubes
];

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function getFixtureLifecycleStatus(shortStatus: string | null | undefined): 'live' | 'finished' | 'scheduled' {
  const normalized = String(shortStatus || '').toUpperCase();
  if (LIVE_STATUS_SHORTS.has(normalized)) return 'live';
  if (FINISHED_STATUS_SHORTS.has(normalized)) return 'finished';
  return 'scheduled';
}

function isRecentlyUpdated(updatedAt: string | null | undefined, graceMs = STALE_FINISH_GRACE_MS): boolean {
  if (!updatedAt) return false;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < graceMs;
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
    let analyzedCount = 0;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 2. Process each fixture - fetch stats from kickoff
    for (const fixture of fixtures) {
      const fixtureId = String(fixture.fixture.id);
      const minute = fixture.fixture.status?.elapsed ?? 0;
      const period = fixture.fixture.status?.long ?? 'Unknown';
      const championship = fixture.league?.name ?? 'Unknown';
      const apiShortStatus = fixture.fixture.status?.short ?? 'LIVE';
      const lifecycleStatus = getFixtureLifecycleStatus(apiShortStatus);

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
        status: lifecycleStatus,
        updated_at: new Date().toISOString(),
      };

      // 3. Fetch live stats for all live matches
      const stats: FixtureStats | null = lifecycleStatus === 'live'
        ? await fetchFixtureStats(fixture.fixture.id, apiKey)
        : null;

      // 4. Upsert match (preserve mycroft fields)
      const { data: existing } = await supabase
        .from('live_matches')
        .select('mycroft_status, mycroft_analysis_id, updated_at, status')
        .eq('match_id', fixtureId)
        .maybeSingle();

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

      // Auto-trigger Mycroft (minute >= 20, has stats, sem análise OU status reanalisável)
      const reanalyzableStatuses = ['aguardar', 'jogo_morto', 'cuidado'];
      const shouldAnalyze = lifecycleStatus === 'live' && minute >= 20 && stats &&
        (!existing?.mycroft_analysis_id || reanalyzableStatuses.includes(existing?.mycroft_status as string));

      let analyzed = false;
      let verdict: string | undefined;
      if (shouldAnalyze) {
        try {
          const analysisRes = await fetch(`${supabaseUrl}/functions/v1/mycroft-sports-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
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
          });
          if (analysisRes.ok) {
            const analysis = await analysisRes.json();
            verdict = analysis.verdict;
            const { data: analysisRow } = await supabase.from('mycroft_analyses').insert({
              match_id: fixtureId,
              verdict: analysis.verdict || 'AGUARDAR',
              market: analysis.market || 'N/A',
              thesis: analysis.thesis || '',
              odd: analysis.odd ?? null,
              confidence: analysis.confidence ?? 0,
              risk_management: analysis.risk_management ?? null,
              alerts: analysis.alerts ?? [],
              fundamentation: analysis.fundamentation ?? { stats },
            }).select('id').single();
            if (analysisRow) {
              const statusToSet =
                analysis.verdict === 'AGUARDAR' ? 'aguardar' :
                analysis.verdict === 'JOGO_MORTO' ? 'jogo_morto' :
                analysis.verdict === 'CUIDADO' ? 'cuidado' : 'done';
              await supabase.from('live_matches').update({
                mycroft_analysis_id: analysisRow.id,
                mycroft_status: statusToSet,
                updated_at: new Date().toISOString(),
              }).eq('match_id', fixtureId);
              if (analysis.verdict === 'APROVADO' || analysis.verdict === 'APROVADO_SITUACIONAL') {
                await supabase.from('signals_sent').insert({
                  match_id: fixtureId,
                  analysis_id: analysisRow.id,
                });
              }
            }
            analyzed = true;
            analyzedCount++;
          } else {
            console.warn(`[FetchLive] Mycroft fail ${fixtureId}: ${analysisRes.status}`);
          }
        } catch (e) {
          console.error(`[FetchLive] Mycroft error ${fixtureId}:`, e);
        }
      }

      results.push({
        match_id: fixtureId,
        teams: `${matchData.home_team} vs ${matchData.away_team}`,
        minute,
        has_stats: !!stats,
        analyzed,
        verdict,
        status: lifecycleStatus,
      });
    }

    // 6. Mark matches no longer live as 'finished' only after grace period to avoid API snapshot flicker
    const liveMatchIds = fixtures.map((f: any) => String(f.fixture.id));
    const { data: currentLive } = await supabase
      .from('live_matches')
      .select('match_id, updated_at, minute, status')
      .eq('status', 'live');

    const staleRows = (currentLive || []).filter((match: any) => {
      if (liveMatchIds.includes(match.match_id)) return false;
      return !isRecentlyUpdated(match.updated_at);
    });

    const staleIds = staleRows.map((m: any) => m.match_id);
    const skippedRecentIds = (currentLive || [])
      .filter((match: any) => !liveMatchIds.includes(match.match_id) && isRecentlyUpdated(match.updated_at))
      .map((m: any) => m.match_id);

    if (skippedRecentIds.length > 0) {
      console.log(`[FetchLive] Grace period active, keeping ${skippedRecentIds.length} jogos ao vivo temporariamente: ${skippedRecentIds.join(', ')}`);
    }

    if (staleIds.length > 0) {
      await supabase
        .from('live_matches')
        .update({ status: 'finished', updated_at: new Date().toISOString() })
        .in('match_id', staleIds);
      console.log(`[FetchLive] Marked ${staleIds.length} matches as finished after grace period`);
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
