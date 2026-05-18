import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { shadowCompare } from '../_shared/mycroft-rules-engine.ts'
import { getCalibrationFloor, applyCalibrationFloor } from '../_shared/calibrationFloor.ts'
import { resolveFutoddsEventId, getExchangeQuote, computeExchangeEdgePP } from '../_shared/futoddsExchange.ts'
import { applyApprovalBlocks, loadGateConfig } from '../_shared/punterApprovalBlocks.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const requestBody = await req.json()
    const {
      sports = [
        'soccer_brazil_campeonato',
        'soccer_brazil_serie_b',
        'soccer_brazil_campeonato_paulista',
        'soccer_brazil_campeonato_carioca',
        'soccer_brazil_campeonato_mineiro',
        'soccer_brazil_campeonato_gaucho',
        'soccer_brazil_campeonato_baiano',
        'soccer_brazil_campeonato_paranaense',
        'soccer_brazil_campeonato_catarinense',
        'soccer_brazil_campeonato_pernambucano',
        'soccer_conmebol_copa_libertadores',
        'soccer_conmebol_copa_sudamericana',
        'soccer_uefa_champs_league',
        'soccer_uefa_europa_league',
        'soccer_epl',
        'soccer_spain_la_liga',
        'soccer_italy_serie_a',
        'soccer_germany_bundesliga',
        'soccer_france_ligue_one',
        'soccer_argentina_primera_division',
      ],
      sport = null as string | null,
      hours_ahead = 48,
      bookmakers = ['bet365', 'pinnacle', 'betfair'],
      min_value = 3,
    } = requestBody

    const leaguesToScan: string[] = sport ? [sport] : sports

    console.log(`[Mycroft Punter] Leagues: ${leaguesToScan.length}, Hours: ${hours_ahead}h, Min Value: ${min_value}%, AI: anthropic`)

    // 1. Fetch upcoming games from The Odds API
    const oddsApiKey = Deno.env.get('THE_ODDS_API_KEY')
    if (!oddsApiKey) throw new Error('THE_ODDS_API_KEY not configured')

    const apiFootballKey = Deno.env.get('API_FOOTBALL_KEY') || ''

    const now = new Date()
    const maxTime = new Date(now.getTime() + hours_ahead * 60 * 60 * 1000)
    const allUpcomingGames: any[] = []
    const leaguesWithoutOdds: string[] = []

    const estaduaisMap: Record<string, { id: number; name: string }> = {
      'soccer_brazil_campeonato_paulista': { id: 475, name: 'Paulistão' },
      'soccer_brazil_campeonato_carioca': { id: 476, name: 'Carioca' },
      'soccer_brazil_campeonato_mineiro': { id: 477, name: 'Mineiro' },
      'soccer_brazil_campeonato_gaucho': { id: 478, name: 'Gaúcho' },
      'soccer_brazil_campeonato_baiano': { id: 479, name: 'Baiano' },
      'soccer_brazil_campeonato_paranaense': { id: 480, name: 'Paranaense' },
      'soccer_brazil_campeonato_catarinense': { id: 481, name: 'Catarinense' },
      'soccer_brazil_campeonato_pernambucano': { id: 604, name: 'Pernambucano' },
    }

    for (const league of leaguesToScan) {
      try {
        const oddsResponse = await fetch(
          `https://api.the-odds-api.com/v4/sports/${league}/odds?` +
          `apiKey=${oddsApiKey}` +
          `&regions=br,eu` +
          `&markets=h2h,spreads,totals` +
          `&bookmakers=${bookmakers.join(',')}` +
          `&oddsFormat=decimal`,
          { method: 'GET', headers: { 'Accept': 'application/json' } }
        )

        if (!oddsResponse.ok) {
          console.warn(`[Mycroft Punter] Skipping ${league}: HTTP ${oddsResponse.status}`)
          if (estaduaisMap[league]) leaguesWithoutOdds.push(league)
          continue
        }

        const games = await oddsResponse.json()
        const liveWindow = new Date(now.getTime() - 3 * 60 * 60 * 1000)
        const upcoming = games.filter((game: any) => {
          const commenceTime = new Date(game.commence_time)
          return commenceTime >= liveWindow && commenceTime <= maxTime
        })

        if (upcoming.length > 0) {
          console.log(`[Mycroft Punter] ${league}: ${upcoming.length} jogos`)
          allUpcomingGames.push(...upcoming)
        } else if (estaduaisMap[league]) {
          leaguesWithoutOdds.push(league)
        }
      } catch (err) {
        console.warn(`[Mycroft Punter] Erro ao buscar ${league}:`, err)
        if (estaduaisMap[league]) leaguesWithoutOdds.push(league)
      }
    }

    // Fallback: estaduais sem odds → API-Football fixtures + odds simuladas
    if (leaguesWithoutOdds.length > 0 && apiFootballKey) {
      console.log(`[Mycroft Punter] Buscando fixtures API-Football para ${leaguesWithoutOdds.length} estaduais...`)
      const seasonYear = new Date().getMonth() + 1 < 8 ? new Date().getFullYear() - 1 : new Date().getFullYear()

      for (const leagueKey of leaguesWithoutOdds) {
        const leagueInfo = estaduaisMap[leagueKey]
        if (!leagueInfo) continue
        try {
          const today = now.toISOString().split('T')[0]
          const maxDate = maxTime.toISOString().split('T')[0]
          const fixturesRes = await fetch(
            `${API_FOOTBALL_BASE}/fixtures?league=${leagueInfo.id}&season=${seasonYear}&from=${today}&to=${maxDate}&status=NS`,
            { headers: apiHeaders(apiFootballKey) }
          )
          if (!fixturesRes.ok) continue
          const fixturesData = await fixturesRes.json()
          const fixtures = fixturesData.response || []

          for (const fix of fixtures) {
            const homeTeam = fix.teams?.home?.name || 'Home'
            const awayTeam = fix.teams?.away?.name || 'Away'
            allUpcomingGames.push({
              id: `sim_${fix.fixture?.id || Date.now()}`,
              sport_key: leagueKey,
              sport_title: leagueInfo.name,
              commence_time: fix.fixture?.date || now.toISOString(),
              home_team: homeTeam,
              away_team: awayTeam,
              simulated_odds: true,
              bookmakers: [{
                key: 'poisson_model', title: 'Modelo Poisson (Simulado)',
                markets: [
                  { key: 'h2h', outcomes: [{ name: homeTeam, price: 2.20 }, { name: 'Draw', price: 3.30 }, { name: awayTeam, price: 3.10 }] },
                  { key: 'totals', outcomes: [{ name: 'Over', point: 2.5, price: 1.90 }, { name: 'Under', point: 2.5, price: 1.95 }] }
                ]
              }]
            })
          }
          if (fixtures.length > 0) console.log(`[Mycroft Punter] ${leagueInfo.name}: ${fixtures.length} jogos (ODDS SIMULADAS)`)
        } catch (err) {
          console.warn(`[Mycroft Punter] Erro fixtures ${leagueInfo.name}:`, err)
        }
      }
    }

    console.log(`[Mycroft Punter] Total: ${allUpcomingGames.length} jogos`)

    if (allUpcomingGames.length === 0) {
      return new Response(
        JSON.stringify({ success: true, signals: [], total_analyzed: 0, total_approved: 0, leagues_scanned: leaguesToScan.length, message: `Nenhum jogo nas próximas ${hours_ahead}h` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Load Knowledge Base
    let methodologyContent = ''
    let valueGuideContent = ''
    let customPrompt = ''

    try {
      const { data: md } = await supabaseClient.storage.from('sports-knowledge-base').download('punter-methodology.md')
      if (md) methodologyContent = await md.text()
    } catch { /* optional */ }

    try {
      const { data: vg } = await supabaseClient.storage.from('sports-knowledge-base').download('value-betting-guide.md')
      if (vg) valueGuideContent = await vg.text()
    } catch { /* optional */ }

    try {
      const { data: pt } = await supabaseClient.storage.from('sports-knowledge-base').download('prompt_mycroft_punter.txt')
      if (pt) customPrompt = await pt.text()
    } catch { /* optional */ }

    if (!customPrompt) {
      customPrompt = `Você é Mycroft Arena Quant Adaptive, analista probabilístico da Arena Punter.
Sua missão é identificar apostas com value positivo baseado em análise probabilística.
FOCO: ROI positivo consistente. Adaptar modelo ao nível de dados disponível.`
    }

    console.log('[Mycroft Punter] KB carregada, prompt: ' + (customPrompt ? 'Custom' : 'Default'))

    // 3. Analyze each game (with delay for rate limiting)
    const approvedSignals: any[] = []
    let totalAnalyzed = 0

    for (const game of allUpcomingGames) {
      totalAnalyzed++
      try {
        if (totalAnalyzed > 1) {
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
        const analysis = await analyzeGame(game, customPrompt, methodologyContent, valueGuideContent, min_value, supabaseClient, apiFootballKey)
        if (analysis && typeof analysis.verdict === 'string' && analysis.verdict.startsWith('APROVADO')) {
          if (game.simulated_odds) analysis.simulated_odds = true
          approvedSignals.push({
            match: {
              home_team: game.home_team,
              away_team: game.away_team,
              commence_time: game.commence_time,
              league: game.sport_title || 'Unknown'
            },
            recommendation: analysis
          })
        }
      } catch (error) {
        console.error(`[Mycroft Punter] Erro ao analisar ${game.home_team} vs ${game.away_team}:`, error)
      }
    }

    console.log(`[Mycroft Punter] Análise completa: ${approvedSignals.length}/${totalAnalyzed} aprovados`)

    return new Response(
      JSON.stringify({ success: true, signals: approvedSignals, total_analyzed: totalAnalyzed, total_approved: approvedSignals.length, leagues_scanned: leaguesToScan.length, ai_provider: 'anthropic', timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[Mycroft Punter] ERRO:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ═══════════════════════════════════════════════
// API-Football Pro: Full enrichment
// ═══════════════════════════════════════════════

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io'
const apiHeaders = (key: string) => ({ 'x-apisports-key': key })

async function searchTeamId(teamName: string, apiKey: string): Promise<number | null> {
  if (!apiKey) return null
  try {
    const res = await fetch(
      `${API_FOOTBALL_BASE}/teams?search=${encodeURIComponent(teamName)}`,
      { headers: apiHeaders(apiKey) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.response?.[0]?.team?.id || null
  } catch (e) {
    console.warn(`[API-Football] Erro buscando team ${teamName}:`, e)
    return null
  }
}

async function fetchTeamSeasonStats(teamId: number, leagueId: number | null, apiKey: string): Promise<any> {
  if (!apiKey || !teamId) return null
  try {
    const year = new Date().getFullYear()
    const endpoint = leagueId
      ? `${API_FOOTBALL_BASE}/teams/statistics?team=${teamId}&season=${year}&league=${leagueId}`
      : `${API_FOOTBALL_BASE}/teams/statistics?team=${teamId}&season=${year}`
    
    const res = await fetch(endpoint, { headers: apiHeaders(apiKey) })
    if (!res.ok) return null
    const data = await res.json()
    return data.response || null
  } catch { return null }
}

async function fetchRecentFixtures(teamId: number, apiKey: string, last = 5): Promise<any[]> {
  if (!apiKey || !teamId) return []
  try {
    const res = await fetch(
      `${API_FOOTBALL_BASE}/fixtures?team=${teamId}&last=${last}&status=FT`,
      { headers: apiHeaders(apiKey) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.response || []
  } catch { return [] }
}

async function fetchFixtureStats(fixtureId: number, apiKey: string): Promise<any[]> {
  if (!apiKey || !fixtureId) return []
  try {
    const res = await fetch(
      `${API_FOOTBALL_BASE}/fixtures/statistics?fixture=${fixtureId}`,
      { headers: apiHeaders(apiKey) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.response || []
  } catch { return [] }
}

async function fetchH2H(homeId: number, awayId: number, apiKey: string): Promise<any[]> {
  if (!apiKey || !homeId || !awayId) return []
  try {
    const res = await fetch(
      `${API_FOOTBALL_BASE}/fixtures/headtohead?h2h=${homeId}-${awayId}&last=10`,
      { headers: apiHeaders(apiKey) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.response || []
  } catch { return [] }
}

async function fetchInjuries(teamId: number, apiKey: string): Promise<any[]> {
  if (!apiKey || !teamId) return []
  try {
    const year = new Date().getFullYear()
    const res = await fetch(
      `${API_FOOTBALL_BASE}/injuries?team=${teamId}&season=${year}`,
      { headers: apiHeaders(apiKey) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.response || []).slice(0, 10)
  } catch { return [] }
}

async function fetchStandings(leagueId: number | null, apiKey: string): Promise<any[]> {
  if (!apiKey || !leagueId) return []
  try {
    const year = new Date().getFullYear()
    const res = await fetch(
      `${API_FOOTBALL_BASE}/standings?league=${leagueId}&season=${year}`,
      { headers: apiHeaders(apiKey) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.response?.[0]?.league?.standings?.[0] || []
  } catch { return [] }
}

// NEW: Fetch API-Football predictions
async function fetchPredictions(fixtureId: number, apiKey: string): Promise<any> {
  if (!apiKey || !fixtureId) return null
  try {
    const res = await fetch(
      `${API_FOOTBALL_BASE}/predictions?fixture=${fixtureId}`,
      { headers: apiHeaders(apiKey) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.response?.[0] || null
  } catch { return null }
}

// NEW: Find upcoming fixture ID for a match
async function findUpcomingFixtureId(homeId: number, awayId: number, apiKey: string): Promise<number | null> {
  if (!apiKey || !homeId || !awayId) return null
  try {
    const today = new Date().toISOString().split('T')[0]
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const res = await fetch(
      `${API_FOOTBALL_BASE}/fixtures?team=${homeId}&from=${today}&to=${nextWeek}&status=NS`,
      { headers: apiHeaders(apiKey) }
    )
    if (!res.ok) return null
    const data = await res.json()
    // Find fixture matching both teams
    const fixture = (data.response || []).find((f: any) =>
      (f.teams?.home?.id === homeId && f.teams?.away?.id === awayId) ||
      (f.teams?.home?.id === awayId && f.teams?.away?.id === homeId)
    )
    return fixture?.fixture?.id || null
  } catch { return null }
}

async function searchLeagueId(sportKey: string, apiKey: string): Promise<number | null> {
  const leagueMap: Record<string, number> = {
    'soccer_brazil_campeonato': 71,
    'soccer_brazil_serie_b': 72,
    'soccer_brazil_campeonato_paulista': 475,
    'soccer_brazil_campeonato_carioca': 476,
    'soccer_brazil_campeonato_mineiro': 477,
    'soccer_brazil_campeonato_gaucho': 478,
    'soccer_brazil_campeonato_baiano': 479,
    'soccer_brazil_campeonato_paranaense': 480,
    'soccer_brazil_campeonato_catarinense': 481,
    'soccer_brazil_campeonato_pernambucano': 604,
    'soccer_epl': 39,
    'soccer_spain_la_liga': 140,
    'soccer_germany_bundesliga': 78,
    'soccer_italy_serie_a': 135,
    'soccer_france_ligue_one': 61,
    'soccer_uefa_champs_league': 2,
    'soccer_uefa_europa_league': 3,
    'soccer_conmebol_copa_libertadores': 13,
    'soccer_conmebol_copa_sudamericana': 11,
    'soccer_argentina_primera_division': 128,
  }
  return leagueMap[sportKey] || null
}

async function fetchEnrichedData(homeTeam: string, awayTeam: string, apiKey: string, sportKey?: string) {
  if (!apiKey) return { home: null, away: null, h2h: null, injuries: { home: [], away: [] }, standings: [], predictions: null, model_level: 'NIVEL_3' }

  const [homeId, awayId] = await Promise.all([
    searchTeamId(homeTeam, apiKey),
    searchTeamId(awayTeam, apiKey)
  ])

  if (!homeId && !awayId) {
    console.log(`[API-Football] Nenhum time encontrado: ${homeTeam}, ${awayTeam}`)
    return { home: null, away: null, h2h: null, injuries: { home: [], away: [] }, standings: [], predictions: null, model_level: 'NIVEL_3' }
  }

  const leagueId = sportKey ? await searchLeagueId(sportKey, apiKey) : null

  // Parallel fetch all data + find fixture ID for predictions
  const [
    homeFixtures, awayFixtures,
    homeSeasonStats, awaySeasonStats,
    h2hData,
    homeInjuries, awayInjuries,
    standingsData,
    fixtureId
  ] = await Promise.all([
    homeId ? fetchRecentFixtures(homeId, apiKey, 5) : [],
    awayId ? fetchRecentFixtures(awayId, apiKey, 5) : [],
    homeId ? fetchTeamSeasonStats(homeId, leagueId, apiKey) : null,
    awayId ? fetchTeamSeasonStats(awayId, leagueId, apiKey) : null,
    (homeId && awayId) ? fetchH2H(homeId, awayId, apiKey) : [],
    homeId ? fetchInjuries(homeId, apiKey) : [],
    awayId ? fetchInjuries(awayId, apiKey) : [],
    fetchStandings(leagueId, apiKey),
    (homeId && awayId) ? findUpcomingFixtureId(homeId, awayId, apiKey) : null
  ])

  // Fetch predictions if we have the fixture ID
  let predictionsData = null
  if (fixtureId) {
    predictionsData = await fetchPredictions(fixtureId, apiKey)
    if (predictionsData) {
      console.log(`[API-Football] ✅ Predictions loaded for fixture ${fixtureId}`)
    }
  }

  // Process home team stats
  const homeStats = processTeamStats(homeId, homeFixtures, homeSeasonStats, apiKey)
  const awayStats = processTeamStats(awayId, awayFixtures, awaySeasonStats, apiKey)

  // Fetch detailed stats for last fixture if needed
  let homeDetailedStats = null, awayDetailedStats = null
  if (homeFixtures.length > 0) {
    const lastFixtureId = homeFixtures[0]?.fixture?.id
    if (lastFixtureId) {
      const stats = await fetchFixtureStats(lastFixtureId, apiKey)
      homeDetailedStats = stats.find((s: any) => s.team?.id === homeId)
    }
  }
  if (awayFixtures.length > 0) {
    const lastFixtureId = awayFixtures[0]?.fixture?.id
    if (lastFixtureId) {
      const stats = await fetchFixtureStats(lastFixtureId, apiKey)
      awayDetailedStats = stats.find((s: any) => s.team?.id === awayId)
    }
  }

  // Merge detailed stats into team stats
  if (homeStats && homeDetailedStats?.statistics) {
    homeStats.last_match_stats = extractStatValues(homeDetailedStats.statistics)
    homeStats.has_detailed_stats = true
  }
  if (awayStats && awayDetailedStats?.statistics) {
    awayStats.last_match_stats = extractStatValues(awayDetailedStats.statistics)
    awayStats.has_detailed_stats = true
  }

  // Determine model level
  const hasSeasonStats = homeSeasonStats || awaySeasonStats
  const hasH2H = h2hData.length > 0
  const hasDetailedStats = homeStats?.has_detailed_stats || awayStats?.has_detailed_stats
  let model_level = 'NIVEL_3'
  if (hasDetailedStats && hasSeasonStats && hasH2H) model_level = 'NIVEL_1'
  else if (hasSeasonStats || hasDetailedStats) model_level = 'NIVEL_2'
  else if (homeStats || awayStats) model_level = 'NIVEL_2'

  return {
    home: homeStats,
    away: awayStats,
    h2h: processH2H(h2hData, homeId, awayId),
    injuries: { home: homeInjuries, away: awayInjuries },
    standings: standingsData,
    homeSeasonStats,
    awaySeasonStats,
    predictions: predictionsData,
    model_level,
    // Raw IDs/league exposed for Sherlock advanced indicators
    homeId,
    awayId,
    leagueId,
    // Raw fixtures (last 5) reusable for CV computation
    homeFixtures,
    awayFixtures,
  }
}

function extractStatValues(statistics: any[]): Record<string, string | number> {
  const result: Record<string, string | number> = {}
  for (const stat of statistics) {
    result[stat.type] = stat.value
  }
  return result
}

function processTeamStats(teamId: number | null, fixtures: any[], seasonStats: any, apiKey: string) {
  if (!teamId || fixtures.length === 0) return null

  let goalsScored = 0, goalsConceded = 0, wins = 0, draws = 0, losses = 0

  for (const fixture of fixtures) {
    const isHome = fixture.teams?.home?.id === teamId
    const hg = fixture.goals?.home ?? 0
    const ag = fixture.goals?.away ?? 0
    goalsScored += isHome ? hg : ag
    goalsConceded += isHome ? ag : hg
    if (isHome ? fixture.teams?.home?.winner : fixture.teams?.away?.winner) wins++
    else if (hg === ag) draws++
    else losses++
  }

  const mp = fixtures.length || 1

  const stats: any = {
    team_id: teamId,
    matches_played: mp,
    wins, draws, losses,
    goals_scored: goalsScored,
    goals_conceded: goalsConceded,
    avg_goals_scored: (goalsScored / mp).toFixed(2),
    avg_goals_conceded: (goalsConceded / mp).toFixed(2),
    form: fixtures.map((f: any) => {
      const isHome = f.teams?.home?.id === teamId
      const hg = f.goals?.home ?? 0
      const ag = f.goals?.away ?? 0
      if (isHome) return hg > ag ? 'W' : hg === ag ? 'D' : 'L'
      return ag > hg ? 'W' : ag === hg ? 'D' : 'L'
    }).join(''),
    has_detailed_stats: false,
  }

  // Add season stats if available
  if (seasonStats) {
    stats.season = {
      played: seasonStats.fixtures?.played?.total,
      wins_total: seasonStats.fixtures?.wins?.total,
      draws_total: seasonStats.fixtures?.draws?.total,
      losses_total: seasonStats.fixtures?.loses?.total,
      goals_for_total: seasonStats.goals?.for?.total?.total,
      goals_for_avg: seasonStats.goals?.for?.average?.total,
      goals_against_total: seasonStats.goals?.against?.total?.total,
      goals_against_avg: seasonStats.goals?.against?.average?.total,
      clean_sheets: seasonStats.clean_sheet?.total,
      failed_to_score: seasonStats.failed_to_score?.total,
      biggest_win_home: seasonStats.biggest?.wins?.home,
      biggest_win_away: seasonStats.biggest?.wins?.away,
      biggest_loss_home: seasonStats.biggest?.loses?.home,
      biggest_loss_away: seasonStats.biggest?.loses?.away,
      // FIX: Renamed from avg_possession (was incorrectly mapped)
      preferred_formation: seasonStats.lineups?.[0]?.formation || null,
      // NEW: Goals by minute (offensive/defensive pressure patterns)
      goals_for_by_minute: seasonStats.goals?.for?.minute,
      goals_against_by_minute: seasonStats.goals?.against?.minute,
      // NEW: Penalty stats
      penalty_scored: seasonStats.penalty?.scored?.total ?? null,
      penalty_missed: seasonStats.penalty?.missed?.total ?? null,
      penalty_scored_pct: seasonStats.penalty?.scored?.percentage ?? null,
      // NEW: Streaks
      biggest_streak_wins: seasonStats.biggest?.streak?.wins ?? null,
      biggest_streak_draws: seasonStats.biggest?.streak?.draws ?? null,
      biggest_streak_loses: seasonStats.biggest?.streak?.loses ?? null,
      // NEW: Cards stats
      cards_yellow_total: Object.values(seasonStats.cards?.yellow || {}).reduce((sum: number, v: any) => sum + (v?.total || 0), 0),
      cards_red_total: Object.values(seasonStats.cards?.red || {}).reduce((sum: number, v: any) => sum + (v?.total || 0), 0),
    }
  }

  return stats
}

function processH2H(h2hData: any[], homeId: number | null, awayId: number | null) {
  if (h2hData.length === 0 || !homeId || !awayId) return null

  let homeWins = 0, awayWins = 0, drawCount = 0, totalGoals = 0

  const matches = h2hData.map((f: any) => {
    const hg = f.goals?.home ?? 0
    const ag = f.goals?.away ?? 0
    totalGoals += hg + ag

    const isTeamAHome = f.teams?.home?.id === homeId
    if (isTeamAHome) {
      if (hg > ag) homeWins++
      else if (ag > hg) awayWins++
      else drawCount++
    } else {
      if (ag > hg) homeWins++
      else if (hg > ag) awayWins++
      else drawCount++
    }

    return {
      date: f.fixture?.date,
      home: f.teams?.home?.name,
      away: f.teams?.away?.name,
      score: `${hg}-${ag}`,
      league: f.league?.name,
    }
  })

  return {
    total: h2hData.length,
    home_wins: homeWins,
    away_wins: awayWins,
    draws: drawCount,
    avg_goals: (totalGoals / h2hData.length).toFixed(2),
    matches: matches.slice(0, 5),
  }
}

function formatTeamStatsBlock(teamName: string, stats: any): string {
  if (!stats) return `${teamName}: Dados não disponíveis na API-Football`
  
  let block = `${teamName} (últimos ${stats.matches_played} jogos):
  Forma: ${stats.form || 'N/A'}
  Resultados: ${stats.wins}V ${stats.draws}E ${stats.losses}D
  Gols Marcados: ${stats.goals_scored} (média: ${stats.avg_goals_scored}/jogo)
  Gols Sofridos: ${stats.goals_conceded} (média: ${stats.avg_goals_conceded}/jogo)`

  if (stats.has_detailed_stats && stats.last_match_stats) {
    const ls = stats.last_match_stats
    block += `
  [Último jogo - Stats detalhadas]:
  Finalizações: ${ls['Total Shots'] || 'N/A'} (no gol: ${ls['Shots on Goal'] || 'N/A'})
  Posse de Bola: ${ls['Ball Possession'] || 'N/A'}
  Escanteios: ${ls['Corner Kicks'] || 'N/A'}
  Passes Certos: ${ls['Passes accurate'] || 'N/A'} (${ls['Passes %'] || 'N/A'})
  Faltas: ${ls['Fouls'] || 'N/A'}
  Cartões Amarelos: ${ls['Yellow Cards'] || 'N/A'} | Vermelhos: ${ls['Red Cards'] || 'N/A'}
  xG: ${ls['expected_goals'] || 'N/A'}`
  }

  if (stats.season) {
    const s = stats.season
    block += `
  [Temporada completa]:
  Jogos: ${s.played || 'N/A'} (${s.wins_total}V ${s.draws_total}E ${s.losses_total}D)
  Gols Marcados: ${s.goals_for_total} (média: ${s.goals_for_avg}/jogo)
  Gols Sofridos: ${s.goals_against_total} (média: ${s.goals_against_avg}/jogo)
  Clean Sheets: ${s.clean_sheets || 0}
  Falhou em Marcar: ${s.failed_to_score || 0}
  Formação Preferida: ${s.preferred_formation || 'N/A'}
  Maior Vitória Casa: ${s.biggest_win_home || 'N/A'} | Fora: ${s.biggest_win_away || 'N/A'}
  Maior Derrota Casa: ${s.biggest_loss_home || 'N/A'} | Fora: ${s.biggest_loss_away || 'N/A'}`

    // NEW: Penalties
    if (s.penalty_scored !== null) {
      block += `
  Pênaltis: ${s.penalty_scored} convertidos / ${(s.penalty_scored || 0) + (s.penalty_missed || 0)} totais (${s.penalty_scored_pct || 'N/A'})`
    }

    // NEW: Streaks
    if (s.biggest_streak_wins !== null) {
      block += `
  Maior Sequência: ${s.biggest_streak_wins}V / ${s.biggest_streak_draws}E / ${s.biggest_streak_loses}D`
    }

    // NEW: Cards
    if (s.cards_yellow_total > 0) {
      block += `
  Cartões na Temporada: ${s.cards_yellow_total} amarelos / ${s.cards_red_total} vermelhos`
    }

    // NEW: Goals by minute (offensive pressure patterns)
    if (s.goals_for_by_minute) {
      const goalsByMinute = s.goals_for_by_minute
      const periods = ['0-15', '16-30', '31-45', '46-60', '61-75', '76-90', '91-105']
      const hotPeriods: string[] = []
      const coldPeriods: string[] = []
      
      for (const period of periods) {
        const gf = goalsByMinute[period]?.total || 0
        if (gf >= 3) hotPeriods.push(`${period}' (${gf} gols)`)
        else if (gf === 0) coldPeriods.push(`${period}'`)
      }
      
      if (hotPeriods.length > 0) {
        block += `
  🔥 Períodos de Pressão Ofensiva: ${hotPeriods.join(', ')}`
      }
      if (coldPeriods.length > 0) {
        block += `
  ❄️ Períodos sem Gols Marcados: ${coldPeriods.join(', ')}`
      }
    }

    // NEW: Goals against by minute (defensive vulnerability)
    if (s.goals_against_by_minute) {
      const goalsByMinute = s.goals_against_by_minute
      const periods = ['0-15', '16-30', '31-45', '46-60', '61-75', '76-90', '91-105']
      const vulnerablePeriods: string[] = []
      
      for (const period of periods) {
        const ga = goalsByMinute[period]?.total || 0
        if (ga >= 3) vulnerablePeriods.push(`${period}' (${ga} gols sofridos)`)
      }
      
      if (vulnerablePeriods.length > 0) {
        block += `
  ⚠️ Vulnerabilidade Defensiva: ${vulnerablePeriods.join(', ')}`
      }
    }
  }

  return block
}

function formatH2HBlock(h2h: any): string {
  if (!h2h) return 'H2H: Dados não disponíveis'
  let block = `CONFRONTO DIRETO (últimos ${h2h.total} jogos):
  Casa: ${h2h.home_wins}V | Empates: ${h2h.draws} | Fora: ${h2h.away_wins}V
  Média de Gols: ${h2h.avg_goals}/jogo
  Últimos jogos:`
  for (const m of h2h.matches) {
    block += `\n    ${m.date?.substring(0, 10) || '?'} | ${m.home} ${m.score} ${m.away} (${m.league})`
  }
  return block
}

function formatInjuriesBlock(teamName: string, injuries: any[]): string {
  if (!injuries || injuries.length === 0) return `${teamName}: Sem lesões reportadas`
  const items = injuries.slice(0, 5).map((inj: any) =>
    `  - ${inj.player?.name || '?'} (${inj.player?.type || 'lesão'}: ${inj.player?.reason || 'N/A'})`
  )
  return `${teamName} - Lesões/Ausências:\n${items.join('\n')}`
}

function formatStandingsBlock(standings: any[], homeTeam: string, awayTeam: string): string {
  if (!standings || standings.length === 0) return 'Classificação: Não disponível'
  
  const relevantTeams = standings.filter((s: any) => {
    const name = (s.team?.name || '').toLowerCase()
    return homeTeam.toLowerCase().includes(name) || name.includes(homeTeam.toLowerCase().split(' ')[0]) ||
           awayTeam.toLowerCase().includes(name) || name.includes(awayTeam.toLowerCase().split(' ')[0])
  })

  if (relevantTeams.length === 0) {
    const top = standings.slice(0, 5)
    const bottom = standings.slice(-3)
    const display = [...top, ...bottom]
    const lines = display.map((s: any) => `  ${s.rank}º ${s.team?.name} - ${s.points}pts (${s.all?.win}V ${s.all?.draw}E ${s.all?.lose}D) GD:${s.goalsDiff}`)
    return `CLASSIFICAÇÃO (resumo):\n${lines.join('\n')}`
  }

  const lines = relevantTeams.map((s: any) =>
    `  ${s.rank}º ${s.team?.name} - ${s.points}pts (${s.all?.win}V ${s.all?.draw}E ${s.all?.lose}D) GD:${s.goalsDiff} | Forma: ${s.form || 'N/A'}`
  )
  return `CLASSIFICAÇÃO (times do jogo):\n${lines.join('\n')}`
}

// NEW: Format predictions block from API-Football /predictions endpoint
function formatPredictionsBlock(predictions: any): string {
  if (!predictions) return 'PREVISÕES API-FOOTBALL: Não disponível para este jogo'

  let block = `PREVISÕES API-FOOTBALL (6 algoritmos):
  Vencedor: ${predictions.predictions?.winner?.name || 'N/A'} (${predictions.predictions?.winner?.comment || ''})
  Conselho: ${predictions.predictions?.advice || 'N/A'}
  Under/Over: ${predictions.predictions?.under_over || 'N/A'}
  Goals Home: ${predictions.predictions?.goals?.home || 'N/A'}
  Goals Away: ${predictions.predictions?.goals?.away || 'N/A'}`

  if (predictions.predictions?.percent) {
    block += `
  Probabilidades: Casa ${predictions.predictions.percent.home} | Empate ${predictions.predictions.percent.draw} | Fora ${predictions.predictions.percent.away}`
  }

  // Comparison of team stats from predictions
  if (predictions.comparison) {
    const c = predictions.comparison
    block += `
  [Comparação Estatística]:
  Força do Ataque: Casa ${c.att?.home || 'N/A'} | Fora ${c.att?.away || 'N/A'}
  Força da Defesa: Casa ${c.def?.home || 'N/A'} | Fora ${c.def?.away || 'N/A'}
  Poisson: Casa ${c.poisson_distribution?.home || 'N/A'} | Fora ${c.poisson_distribution?.away || 'N/A'}
  Força Total: Casa ${c.total?.home || 'N/A'} | Fora ${c.total?.away || 'N/A'}
  H2H Recente: Casa ${c.h2h?.home || 'N/A'} | Fora ${c.h2h?.away || 'N/A'}`
  }

  return block
}

// ═══════════════════════════════════════════════
// Market Manipulation & Sharp Money Detectors
// ═══════════════════════════════════════════════

interface MarketDetectorResult {
  mis: number; mis_level: string; odi: number; odi_suspicious: boolean;
  sharp: { has_rlm: boolean; has_steam: boolean; has_consensus: boolean; activity_score: number; activity_level: string; };
  odd_open: number | null; odd_current: number | null;
}

function computeMarketDetectors(oddsData: any[], totalsData: any[], modelProbability: number | null, market: string | null): MarketDetectorResult {
  const result: MarketDetectorResult = {
    mis: 0, mis_level: 'noise', odi: 0, odi_suspicious: false,
    sharp: { has_rlm: false, has_steam: false, has_consensus: false, activity_score: 0, activity_level: 'normal' },
    odd_open: null, odd_current: null,
  }
  if (oddsData.length === 0) return result

  const allHomeOdds = oddsData.map(o => o.home_odd).filter(Boolean)
  const allAwayOdds = oddsData.map(o => o.away_odd).filter(Boolean)
  const allDrawOdds = oddsData.map(o => o.draw_odd).filter(o => o > 0)
  const avgHomeProb = allHomeOdds.length > 0 ? (allHomeOdds.reduce((s, o) => s + 1/o, 0) / allHomeOdds.length) * 100 : 0
  const avgAwayProb = allAwayOdds.length > 0 ? (allAwayOdds.reduce((s, o) => s + 1/o, 0) / allAwayOdds.length) * 100 : 0
  const avgDrawProb = allDrawOdds.length > 0 ? (allDrawOdds.reduce((s, o) => s + 1/o, 0) / allDrawOdds.length) * 100 : 0

  let marketProb = avgHomeProb
  if (market) {
    const m = market.toLowerCase()
    if (m.includes('fora') || m.includes('away')) marketProb = avgAwayProb
    else if (m.includes('empate') || m.includes('draw')) marketProb = avgDrawProb
  }
  if (modelProbability && modelProbability > 0 && marketProb > 0) {
    result.mis = Math.abs(modelProbability - marketProb) / 100
    if (result.mis < 0.02) result.mis_level = 'noise'
    else if (result.mis < 0.05) result.mis_level = 'light'
    else if (result.mis < 0.10) result.mis_level = 'strong'
    else result.mis_level = 'extreme'
  }

  const targetOdds = market?.toLowerCase().includes('fora') ? allAwayOdds : market?.toLowerCase().includes('empate') ? allDrawOdds : allHomeOdds
  if (targetOdds.length >= 2) {
    const maxOdd = Math.max(...targetOdds)
    const minOdd = Math.min(...targetOdds)
    result.odi = Math.abs(maxOdd - minOdd) / minOdd
    result.odi_suspicious = result.odi > 0.15
    result.odd_open = maxOdd
    result.odd_current = minOdd
  }

  let sharpScore = 0
  const pinnacleOdds = oddsData.find(o => (o.bookmaker || '').toLowerCase().includes('pinnacle'))
  const bet365Odds = oddsData.find(o => (o.bookmaker || '').toLowerCase().includes('bet365'))
  const betfairOdds = oddsData.find(o => (o.bookmaker || '').toLowerCase().includes('betfair'))

  if (pinnacleOdds && bet365Odds) {
    const diffPct = Math.abs(pinnacleOdds.home_odd - bet365Odds.home_odd) / bet365Odds.home_odd
    if (diffPct > 0.05) { result.sharp.has_rlm = true; sharpScore += 25 }
  }
  if (targetOdds.length >= 2) {
    const steamPct = (Math.max(...targetOdds) - Math.min(...targetOdds)) / Math.min(...targetOdds)
    if (steamPct > 0.08) { result.sharp.has_steam = true; sharpScore += 20 }
  }
  if (targetOdds.length >= 3) {
    const sorted = [...targetOdds].sort((a, b) => a - b)
    const med = sorted[Math.floor(sorted.length / 2)]
    if (targetOdds.filter(o => Math.abs(o - med) / med < 0.02).length >= 3) { result.sharp.has_consensus = true; sharpScore += 15 }
  }
  if (pinnacleOdds) sharpScore += 10
  if (betfairOdds) sharpScore += 5
  if (result.odi_suspicious) sharpScore += 15

  result.sharp.activity_score = Math.min(100, sharpScore)
  if (sharpScore >= 40) result.sharp.activity_level = 'steam_professional'
  else if (sharpScore >= 25) result.sharp.activity_level = 'sharp_money'
  else if (sharpScore >= 10) result.sharp.activity_level = 'activity'
  return result
}

function formatDetectorsBlock(d: MarketDetectorResult): string {
  let block = `═══════════════════════════════════════
MARKET MANIPULATION DETECTOR
═══════════════════════════════════════
MIS (Market Inefficiency Score): ${(d.mis * 100).toFixed(1)}% — Nível: ${d.mis_level.toUpperCase()}
ODI (Odds Drift Index): ${(d.odi * 100).toFixed(1)}%${d.odi_suspicious ? ' ⚠️ SUSPEITO' : ''}

SHARP MONEY DETECTOR
Sharp Activity Score: ${d.sharp.activity_score}/100 — Nível: ${d.sharp.activity_level.toUpperCase()}
RLM: ${d.sharp.has_rlm ? '✅ DETECTADO' : '❌'} | Steam: ${d.sharp.has_steam ? '✅ DETECTADO' : '❌'} | Consenso: ${d.sharp.has_consensus ? '✅' : '❌'}`
  if (d.sharp.activity_score >= 25) block += `\n⚡ Atividade sharp detectada. Considere BOOST de +15 no Asset Score.`
  if (d.mis_level === 'strong' || d.mis_level === 'extreme') block += `\n🎯 Ineficiência de mercado ${d.mis_level}. Possível mispricing.`
  return block
}

async function persistDetectors(supabaseClient: any, matchId: string, market: string, detectors: MarketDetectorResult, modelProb: number | null, marketProb: number) {
  try {
    await supabaseClient.from('market_analysis').upsert({ match_id: matchId, market: market || 'h2h', prob_model: modelProb || 0, prob_market: marketProb, market_inefficiency_score: Math.round(detectors.mis * 10000) / 100, inefficiency_level: detectors.mis_level, odds_drift_index: Math.round(detectors.odi * 10000) / 100, odd_open: detectors.odd_open, odd_current: detectors.odd_current }, { onConflict: 'match_id,market' })
    if (detectors.sharp.activity_score >= 10) {
      await supabaseClient.from('sharp_money_signals').upsert({ match_id: matchId, market: market || 'h2h', has_rlm: detectors.sharp.has_rlm, has_steam: detectors.sharp.has_steam, has_consensus: detectors.sharp.has_consensus, sharp_activity_score: detectors.sharp.activity_score, odd_open: detectors.odd_open, odd_current: detectors.odd_current, odd_movement_pct: Math.round(detectors.odi * 10000) / 100 }, { onConflict: 'match_id,market' })
    }
  } catch (err) { console.warn('[Detectors] Erro ao persistir:', err) }
}

// ═══════════════════════════════════════════════
// Odds extraction helpers
// ═══════════════════════════════════════════════

function extractOdds(game: any) {
  const oddsData: any[] = []
  for (const bookmaker of game.bookmakers || []) {
    const h2hMarket = bookmaker.markets?.find((m: any) => m.key === 'h2h')
    if (h2hMarket && h2hMarket.outcomes) {
      const homeOdd = h2hMarket.outcomes.find((o: any) => o.name === game.home_team)?.price
      const awayOdd = h2hMarket.outcomes.find((o: any) => o.name === game.away_team)?.price
      const drawOdd = h2hMarket.outcomes.find((o: any) => o.name === 'Draw')?.price
      if (homeOdd && awayOdd) {
        oddsData.push({ bookmaker: bookmaker.title, home_odd: homeOdd, draw_odd: drawOdd || 0, away_odd: awayOdd })
      }
    }
  }
  return oddsData
}

function extractTotals(game: any) {
  const totalsData: any[] = []
  for (const bookmaker of game.bookmakers || []) {
    const totalsMarket = bookmaker.markets?.find((m: any) => m.key === 'totals')
    if (totalsMarket && totalsMarket.outcomes) {
      const overOutcome = totalsMarket.outcomes.find((o: any) => o.name === 'Over')
      const underOutcome = totalsMarket.outcomes.find((o: any) => o.name === 'Under')
      if (overOutcome && underOutcome && overOutcome.point !== undefined) {
        totalsData.push({
          bookmaker: bookmaker.title,
          line: overOutcome.point,
          over_odd: overOutcome.price,
          under_odd: underOutcome.price,
        })
      }
    }
  }
  return totalsData
}

function calculateProbabilities(odds: any) {
  if (!odds) return 'Sem dados'
  const homeProb = (1 / odds.home_odd * 100).toFixed(2)
  const drawProb = odds.draw_odd > 0 ? (1 / odds.draw_odd * 100).toFixed(2) : '0'
  const awayProb = (1 / odds.away_odd * 100).toFixed(2)
  const total = parseFloat(homeProb) + parseFloat(drawProb) + parseFloat(awayProb)
  const overround = (total - 100).toFixed(2)
  return `Probabilidade Implícita H2H (${odds.bookmaker}):
- Casa: ${homeProb}%
- Empate: ${drawProb}%
- Fora: ${awayProb}%
- Total: ${total.toFixed(2)}%
- Overround (margem): ${overround}%`
}

function calculateTotalsProbabilities(totals: any) {
  if (!totals) return ''
  const overProb = (1 / totals.over_odd * 100).toFixed(2)
  const underProb = (1 / totals.under_odd * 100).toFixed(2)
  const total = parseFloat(overProb) + parseFloat(underProb)
  const overround = (total - 100).toFixed(2)
  return `Probabilidade Implícita Over/Under ${totals.line} (${totals.bookmaker}):
- Over ${totals.line}: ${overProb}%
- Under ${totals.line}: ${underProb}%
- Total: ${total.toFixed(2)}%
- Overround (margem): ${overround}%`
}

// ═══════════════════════════════════════════════
// AI Provider: Groq (Direct, OpenAI-compatible, llama-3.3-70b-versatile)
// ═══════════════════════════════════════════════

async function callAnthropic(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY')
  if (!apiKey) throw new Error('GROQ_API_KEY not configured')

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_completion_tokens: 3000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    if (response.status === 429) throw new Error('Rate limit excedido na Groq')
    if (response.status === 402 || response.status === 401) throw new Error('Créditos/auth insuficientes na Groq')
    throw new Error(`Groq error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

/**
 * Parser tolerante: extrai e tenta reparar JSON truncado vindo da IA.
 * 1) Tenta JSON.parse direto.
 * 2) Localiza o primeiro `{` e tenta JSON.parse do trecho até o último `}` válido.
 * 3) Se ainda truncado, balanceia chaves/colchetes/aspas pendentes e tenta parsear.
 */
function parseJsonRobust(raw: string): any | null {
  if (!raw) return null
  // 1) parse direto
  try { return JSON.parse(raw) } catch {}

  const start = raw.indexOf('{')
  if (start === -1) return null
  const sliced = raw.slice(start)

  // 2) tentar do { até o último } presente
  const lastBrace = sliced.lastIndexOf('}')
  if (lastBrace > 0) {
    try { return JSON.parse(sliced.slice(0, lastBrace + 1)) } catch {}
  }

  // 3) balanceamento — fecha strings, arrays e objetos em aberto
  let inString = false
  let escape = false
  let braces = 0
  let brackets = 0
  let lastSafe = -1 // último índice onde podemos cortar sem ficar dentro de string
  for (let i = 0; i < sliced.length; i++) {
    const c = sliced[i]
    if (escape) { escape = false; continue }
    if (c === '\\') { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{') braces++
    else if (c === '}') braces--
    else if (c === '[') brackets++
    else if (c === ']') brackets--
    if (!inString && (c === ',' || c === '}' || c === ']')) lastSafe = i
  }

  // remove vírgula final pendente para não quebrar
  let candidate = sliced
  if (lastSafe !== -1 && (inString || braces > 0 || brackets > 0)) {
    candidate = sliced.slice(0, lastSafe + 1).replace(/,\s*$/, '')
    // recontar pendências sobre o candidato truncado
    inString = false; escape = false; braces = 0; brackets = 0
    for (let i = 0; i < candidate.length; i++) {
      const c = candidate[i]
      if (escape) { escape = false; continue }
      if (c === '\\') { escape = true; continue }
      if (c === '"') { inString = !inString; continue }
      if (inString) continue
      if (c === '{') braces++
      else if (c === '}') braces--
      else if (c === '[') brackets++
      else if (c === ']') brackets--
    }
  }
  if (inString) candidate += '"'
  while (brackets-- > 0) candidate += ']'
  while (braces-- > 0) candidate += '}'

  try { return JSON.parse(candidate) } catch (e) {
    return null
  }
}

interface TeamAdvancedStats {
  team_id: number
  season: number
  team_name?: string | null
  home_avg_goals_scored: number
  home_avg_goals_conceded: number
  home_cv_scored: number
  home_cv_conceded: number
  away_avg_goals_scored: number
  away_avg_goals_conceded: number
  away_cv_scored: number
  away_cv_conceded: number
  sample_size?: number | null
  last_updated?: string | null
}

function calcularCV(valores: number[]): number {
  if (!valores || valores.length === 0) return 0
  const media = valores.reduce((a, b) => a + b, 0) / valores.length
  if (media === 0) return 0
  const variancia = valores.reduce((acc, v) => acc + Math.pow(v - media, 2), 0) / valores.length
  return Math.sqrt(variancia) / media
}

async function fetchAllRecentFixturesSherlock(teamId: number, apiKey: string, last = 20): Promise<any[]> {
  if (!apiKey || !teamId) return []
  try {
    const res = await fetch(
      `${API_FOOTBALL_BASE}/fixtures?team=${teamId}&last=${last}&status=FT`,
      { headers: apiHeaders(apiKey) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.response || []
  } catch { return [] }
}

function computeContextStats(fixtures: any[], teamId: number, ctx: 'home' | 'away') {
  const filtered = fixtures.filter((f: any) => {
    const isHome = f.teams?.home?.id === teamId
    const isAway = f.teams?.away?.id === teamId
    if (ctx === 'home') return isHome && f.goals?.home !== null
    return isAway && f.goals?.away !== null
  }).slice(0, 15)

  if (filtered.length < 3) return { mediaPro: 0, mediaContra: 0, cvPro: 0, cvContra: 0, n: filtered.length }
  const golsPro = filtered.map((f: any) => ctx === 'home' ? f.goals.home : f.goals.away)
  const golsContra = filtered.map((f: any) => ctx === 'home' ? f.goals.away : f.goals.home)
  return {
    mediaPro: golsPro.reduce((a, b) => a + b, 0) / golsPro.length,
    mediaContra: golsContra.reduce((a, b) => a + b, 0) / golsContra.length,
    cvPro: calcularCV(golsPro),
    cvContra: calcularCV(golsContra),
    n: filtered.length,
  }
}

async function getOrComputeAdvancedStats(
  teamId: number | null,
  teamName: string,
  season: number,
  apiKey: string,
  supabaseClient: any,
): Promise<TeamAdvancedStats | null> {
  if (!teamId) return null
  const { data: cached } = await supabaseClient
    .from('team_advanced_stats')
    .select('*')
    .eq('team_id', teamId)
    .eq('season', season)
    .maybeSingle()

  const fresh = cached?.last_updated &&
    (Date.now() - new Date(cached.last_updated).getTime()) < 24 * 60 * 60 * 1000
  if (fresh) return cached as TeamAdvancedStats

  const fixtures = await fetchAllRecentFixturesSherlock(teamId, apiKey, 20)
  if (fixtures.length < 3) return (cached as TeamAdvancedStats) || null

  const home = computeContextStats(fixtures, teamId, 'home')
  const away = computeContextStats(fixtures, teamId, 'away')

  const row = {
    team_id: teamId,
    season,
    team_name: teamName,
    home_avg_goals_scored: +home.mediaPro.toFixed(2),
    home_avg_goals_conceded: +home.mediaContra.toFixed(2),
    home_cv_scored: +home.cvPro.toFixed(2),
    home_cv_conceded: +home.cvContra.toFixed(2),
    away_avg_goals_scored: +away.mediaPro.toFixed(2),
    away_avg_goals_conceded: +away.mediaContra.toFixed(2),
    away_cv_scored: +away.cvPro.toFixed(2),
    away_cv_conceded: +away.cvContra.toFixed(2),
    sample_size: fixtures.length,
    last_updated: new Date().toISOString(),
  }

  await supabaseClient.from('team_advanced_stats').upsert(row, { onConflict: 'team_id,season' })
  return row as TeamAdvancedStats
}

interface SherlockResult { veto: boolean; reason?: string; confidenceDelta: number; notes: string[] }

function isAsianHandicapMarket(marketStr: string): boolean {
  const m = marketStr.toLowerCase()
  return m.startsWith('ah ') || m.startsWith('ah-') || m.includes('asian handicap') || m.includes('handicap asiático') || /\bah[\s+\-(]/.test(m)
}

function extractHandicapValue(marketStr: string): number | null {
  // Tries to find numeric handicap in strings like "AH -0.75", "Asian Handicap +1.5", "AH(-1)"
  const match = marketStr.match(/[+\-]\s?\d+(?:\.\d+)?/)
  if (!match) return null
  const v = parseFloat(match[0].replace(/\s/g, ''))
  return Number.isFinite(v) ? v : null
}

function applySherlockRules(
  analysis: any,
  homeStats: TeamAdvancedStats | null,
  awayStats: TeamAdvancedStats | null,
): SherlockResult {
  const notes: string[] = []
  let confidenceDelta = 0
  const market = (analysis.market || '').toString().toLowerCase()
  const plan = (analysis.plan_name || '').toString().toUpperCase()

  // ═══ AH MANDATORY (Item #2): high-risk AH requires Sherlock stats for both teams ═══
  const odd = Number(analysis.odd ?? 0)
  const handicap = extractHandicapValue(analysis.market || '')
  const isAH = isAsianHandicapMarket(analysis.market || '')
  const isHighRiskAH = isAH && (odd >= 2.0 || (handicap !== null && Math.abs(handicap) >= 1.5))
  if (isHighRiskAH) {
    if (!homeStats || !awayStats) {
      return { veto: true, reason: `AH alto risco (odd ${odd.toFixed(2)}${handicap !== null ? ` / handicap ${handicap}` : ''}) sem dados estatísticos suficientes (Sherlock obrigatório).`, confidenceDelta: 0, notes: [] }
    }
    // Strong inconsistency on either side → veto for AH high risk
    const homeCV = Math.max(homeStats.home_cv_scored ?? 0, homeStats.home_cv_conceded ?? 0)
    const awayCV = Math.max(awayStats.away_cv_scored ?? 0, awayStats.away_cv_conceded ?? 0)
    if (homeCV > 1.1 || awayCV > 1.1) {
      return { veto: true, reason: `AH alto risco bloqueado: alta variância (home CV ${homeCV.toFixed(2)} / away CV ${awayCV.toFixed(2)}).`, confidenceDelta: 0, notes: [] }
    }
    notes.push(`🔍 Sherlock validou AH alto risco (CV home ${homeCV.toFixed(2)} / CV away ${awayCV.toFixed(2)})`)
  }

  const isLayGoleada = plan.includes('LAY_GOLEADA') || market.includes('lay goleada') || market.includes('lay-goleada')
  if (homeStats && isLayGoleada) {
    const saldoHome = homeStats.home_avg_goals_scored - homeStats.home_avg_goals_conceded
    if (saldoHome > 1.2) {
      return { veto: true, reason: `LAY GOLEADA bloqueado: saldo médio do mandante em casa ${saldoHome.toFixed(2)} > 1.20 (alta propensão a goleada).`, confidenceDelta: 0, notes: [] }
    }
    if (homeStats.home_cv_scored > 1.0 || homeStats.home_cv_conceded > 1.0) {
      return { veto: true, reason: `LAY GOLEADA bloqueado: mandante inconsistente (CV ofensivo ${homeStats.home_cv_scored.toFixed(2)} / defensivo ${homeStats.home_cv_conceded.toFixed(2)}).`, confidenceDelta: 0, notes: [] }
    }
  }

  if (homeStats && (homeStats.home_cv_scored > 1.0 || homeStats.home_cv_conceded > 1.0)) {
    notes.push(`⚠️ Mandante imprevisível (CV pró ${homeStats.home_cv_scored.toFixed(2)} / contra ${homeStats.home_cv_conceded.toFixed(2)})`)
    confidenceDelta -= 5
  }
  if (awayStats && (awayStats.away_cv_scored > 1.0 || awayStats.away_cv_conceded > 1.0)) {
    notes.push(`⚠️ Visitante imprevisível (CV pró ${awayStats.away_cv_scored.toFixed(2)} / contra ${awayStats.away_cv_conceded.toFixed(2)})`)
    confidenceDelta -= 5
  }

  if (homeStats && market.includes('over 2.5')) {
    if (homeStats.home_cv_scored < 0.5 && homeStats.home_avg_goals_scored > 1.5) {
      confidenceDelta += 5
      notes.push(`✅ Mandante consistente ofensivo (CV ${homeStats.home_cv_scored.toFixed(2)}, média ${homeStats.home_avg_goals_scored.toFixed(2)}) → +5pp Over 2.5`)
    }
  }

  if (market.includes('under 2.5')) {
    if (homeStats && homeStats.home_cv_conceded < 0.6 && homeStats.home_avg_goals_conceded < 1.0) {
      confidenceDelta += 3
      notes.push(`✅ Mandante defensivo consistente (CV ${homeStats.home_cv_conceded.toFixed(2)}, sofridos ${homeStats.home_avg_goals_conceded.toFixed(2)}) → +3pp Under 2.5`)
    }
    if (awayStats && awayStats.away_cv_conceded < 0.6 && awayStats.away_avg_goals_conceded < 1.0) {
      confidenceDelta += 2
      notes.push(`✅ Visitante defensivo consistente (CV ${awayStats.away_cv_conceded.toFixed(2)}, sofridos ${awayStats.away_avg_goals_conceded.toFixed(2)}) → +2pp Under 2.5`)
    }
  }

  return { veto: false, confidenceDelta, notes }
}

// ═══════════════════════════════════════════════
// Main analysis function (Anthropic Claude only)
// ═══════════════════════════════════════════════

async function analyzeGame(
  game: any,
  customPrompt: string,
  methodology: string,
  valueGuide: string,
  minValue: number,
  supabaseClient: any,
  apiFootballKey: string,
) {
  const matchId = `${game.home_team}_${game.away_team}_${game.commence_time}`.replace(/\s+/g, '_')
  console.log(`[Mycroft Punter] Analisando: ${game.home_team} vs ${game.away_team} (AI: anthropic)`)

  const oddsData = extractOdds(game)
  const totalsData = extractTotals(game)
  if (oddsData.length === 0 && totalsData.length === 0) return null

  // Fetch enriched data from API-Football (Pro plan: H2H, Season Stats, Injuries, Standings, Predictions)
  const enriched = await fetchEnrichedData(game.home_team, game.away_team, apiFootballKey, game.sport_key)

  const homeStatsBlock = formatTeamStatsBlock(game.home_team, enriched.home)
  const awayStatsBlock = formatTeamStatsBlock(game.away_team, enriched.away)
  const h2hBlock = formatH2HBlock(enriched.h2h)
  const homeInjuriesBlock = formatInjuriesBlock(game.home_team, enriched.injuries?.home || [])
  const awayInjuriesBlock = formatInjuriesBlock(game.away_team, enriched.injuries?.away || [])
  const standingsBlock = formatStandingsBlock(enriched.standings || [], game.home_team, game.away_team)
  const predictionsBlock = formatPredictionsBlock(enriched.predictions)

  // ── Market Manipulation & Sharp Money Detection ──
  const detectors = computeMarketDetectors(oddsData, totalsData, null, null)
  const detectorsBlock = formatDetectorsBlock(detectors)
  console.log(`[Detectors] ${game.home_team} vs ${game.away_team}: MIS=${(detectors.mis*100).toFixed(1)}%, Sharp=${detectors.sharp.activity_score}/100`)

  const dataStrengthLabel = enriched.model_level === 'NIVEL_1' ? 'ALTA (stats completas + H2H + lesões + previsões)'
    : enriched.model_level === 'NIVEL_2' ? 'MEDIA (stats básicas disponíveis)'
    : 'BAIXA (apenas odds disponíveis)'

  const systemPrompt = `${customPrompt}

REGRA ABSOLUTA: Você é um motor de análise quantitativa. Você NUNCA responde com texto livre. Você SEMPRE retorna APENAS um objeto JSON válido. Sem saudações, sem confirmações, sem markdown. APENAS o JSON.`

  const userPrompt = `
═══════════════════════════════════════
JOGO PRÉ-JOGO - ANÁLISE DE VALUE
═══════════════════════════════════════

⚽ TIMES: ${game.home_team} vs ${game.away_team}
🏆 LIGA: ${game.sport_title || 'N/A'}
📅 HORÁRIO: ${new Date(game.commence_time).toLocaleString('pt-BR')}
📊 NÍVEL DE DADOS: ${dataStrengthLabel}
🔧 MODELO SUGERIDO: ${enriched.model_level}

═══════════════════════════════════════
DADOS API-FOOTBALL (Estatísticas Reais - Plano Pro)
═══════════════════════════════════════

${homeStatsBlock}

${awayStatsBlock}

═══════════════════════════════════════
CONFRONTO DIRETO (H2H)
═══════════════════════════════════════
${h2hBlock}

═══════════════════════════════════════
LESÕES E AUSÊNCIAS
═══════════════════════════════════════
${homeInjuriesBlock}
${awayInjuriesBlock}

═══════════════════════════════════════
${standingsBlock}
═══════════════════════════════════════

═══════════════════════════════════════
${predictionsBlock}
═══════════════════════════════════════

${enriched.predictions ? `
VALIDAÇÃO CRUZADA: Compare sua análise com as previsões da API-Football acima.
- Se AMBOS concordarem no vencedor/over-under → boost de confiança +5%
- Se DIVERGIREM → sinalize no risk_factors e reduza confiança -5%
` : ''}

${detectorsBlock}


═══════════════════════════════════════
ODDS DISPONÍVEIS (The Odds API - Mercado H2H)
═══════════════════════════════════════
${oddsData.map((o: any) => `
${o.bookmaker}:
  ${game.home_team}: ${o.home_odd}
  Empate: ${o.draw_odd}
  ${game.away_team}: ${o.away_odd}
`).join('\n')}

${totalsData.length > 0 ? `
═══════════════════════════════════════
ODDS DISPONÍVEIS (Mercado TOTALS - Over/Under)
═══════════════════════════════════════
${totalsData.map((t: any) => `
${t.bookmaker}:
  Over ${t.line}: ${t.over_odd}
  Under ${t.line}: ${t.under_odd}
`).join('\n')}
` : 'TOTALS: Não disponível para este jogo'}

═══════════════════════════════════════
ANÁLISE DE PROBABILIDADES IMPLÍCITAS
═══════════════════════════════════════
${calculateProbabilities(oddsData[0])}
${totalsData.length > 0 ? calculateTotalsProbabilities(totalsData[0]) : ''}

${methodology ? `\nKNOWLEDGE BASE (Metodologia):\n${methodology}` : ''}
${valueGuide ? `\nGUIA DE VALUE:\n${valueGuide}` : ''}

═══════════════════════════════════════
INSTRUÇÕES DE RESPOSTA
═══════════════════════════════════════

Retorne APENAS um objeto JSON válido (sem \`\`\`json, sem preamble):

{
  "verdict": "APROVADO" ou "VETADO",
  "tier": 1 | 2 | 3 | null,
  "model_level": "${enriched.model_level}",
  "market": "Casa" | "Empate" | "Fora" | "Over 1.5" | "Under 1.5" | "Over 2.5" | "Under 2.5" | "Over 3.5" | "Under 3.5" | null,
  "bookmaker": "Bet365" | "Pinnacle" | "Betfair",
  "odd": 2.10,
  "fair_odd": 1.85,
  "implied_probability": 47.6,
  "estimated_probability": 54.1,
  "expected_value": 0.046,
  "value_percentage": 13.5,
  "confidence": 72,
  "data_strength": "ALTA" | "MEDIA" | "BAIXA",
  "stake_percentage": 3,
  "thesis": "JUSTIFICATIVA narrativa da entrada em 3-4 frases curtas, no formato dos cards aprovados do Trader Sports. NÃO repetir métricas cruas. Estrutura obrigatória: (1) Contexto do confronto e por que esse mercado é o ponto fraco do adversário ou força do nosso lado; (2) Gatilho estatístico/forma recente que sustenta a tese (ex: 'Avellino sofreu menos de 1.5 gols em 7 dos últimos 8 em casa'); (3) Por que a odd está mal precificada (edge identificado); (4) Critério de risco residual aceito. Use linguagem de analista, não de calculadora.",
  "analysis": "Bloco quantitativo curto com os números (xG, médias, H2H, lambdas Poisson, edge). É AQUI que vão as métricas — não na thesis.",
  "risk_factors": "Riscos e limitações específicos (ex: desfalque, motivação, contexto de tabela, viés do modelo).",
  "api_predictions_agree": true | false | null
}

IMPORTANTE — SISTEMA DE 3 BLOCOS (LEIA COM ATENÇÃO):
- Use EXATAMENTE "APROVADO" ou "VETADO" no verdict
- Aprove APENAS se o sinal se encaixar em ALGUM destes blocos:

🟢 BLOCO A — SEGURANÇA: prob_estimada >= 58%, edge >= 3%, confidence >= 72%, odd entre 1.30 e 1.85 → tier=1
🟡 BLOCO B — VALOR:     prob_estimada >= 45%, edge >= 5%, confidence >= 70%, odd entre 1.85 e 3.20 → tier=2
🔥 BLOCO C — ELITE:     prob_estimada >= 55%, edge >= 7%, confidence >= 80%, odd entre 1.50 e 4.50 c/ Pinnacle como bookmaker → tier=3

- META DE APROVAÇÃO: 25-40% dos jogos (qualidade > volume)
- Win rate alvo: >= 58%

🚫 VETOS OBRIGATÓRIOS (NUNCA aprovar):
1. prob_estimada < 45% (mesmo com edge alto — evento improvável destrói win rate)
2. odd < 1.30 ou > 4.50 (fora da faixa de risco/retorno aceitável)
3. odd < 1.50 e data_strength != "ALTA" (favorito barato sem xG é onde mais se perde)
4. Liga fora de top (Premier/La Liga/Serie A/Bundesliga/Ligue1/Champions/Libertadores/Brasileirão/Championship) com odd < 1.60
5. Contradição grave (você projeta 70% mas odd está em 4.0)

🚫 VETOS PROIBIDOS (NÃO use estes motivos):
1. "Apenas Pinnacle/Bet365" — Pinnacle/Bet365 SÃO sharp baselines aceitáveis
2. "Dados insuficientes" para ligas major — sempre há contexto público suficiente
3. "Imprevisibilidade do futebol" — isso é inerente ao esporte

✅ APROVE quando o sinal se encaixar em A, B ou C E nenhum veto obrigatório aplicar.

ANALISE AGORA E RETORNE APENAS O JSON:`

  // Call AI provider with retry and backoff
  let analysisText: string = ''
  const maxRetries = 3
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      analysisText = await callAnthropic(systemPrompt, userPrompt)

      if (!analysisText) throw new Error('AI não retornou análise válida')

      // Clean and extract JSON (com recuperação de JSON truncado)
      const cleanJson = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const analysis = parseJsonRobust(cleanJson)
      if (!analysis) {
        console.error(`[Mycroft Punter] Resposta sem JSON parseável (tentativa ${attempt + 1}):`, cleanJson.substring(0, 300))
        if (attempt < maxRetries - 1) continue
        throw new Error('Falha ao parsear análise - sem JSON na resposta')
      }

      // Normalize verdict
      if (analysis.verdict && analysis.verdict.startsWith('APROVADO')) {
        analysis.verdict = 'APROVADO'
      }

      // Ensure value_percentage is a number (some models return edge_percentage instead)
      if (analysis.value_percentage === undefined || analysis.value_percentage === null) {
        analysis.value_percentage = analysis.edge_percentage || analysis.ev_percentage || 0
      }

      // ─── SHERLOCK: Validador estatístico pós-IA ───
      try {
        const seasonYear = new Date(game.commence_time).getFullYear()
        const [homeAdv, awayAdv] = await Promise.all([
          getOrComputeAdvancedStats(enriched.homeId ?? null, game.home_team, seasonYear, apiFootballKey, supabaseClient),
          getOrComputeAdvancedStats(enriched.awayId ?? null, game.away_team, seasonYear, apiFootballKey, supabaseClient),
        ])
        const sherlock = applySherlockRules(analysis, homeAdv, awayAdv)
        if (sherlock.veto && analysis.verdict === 'APROVADO') {
          console.log(`[Sherlock] 🚫 VETO em ${game.home_team} vs ${game.away_team}: ${sherlock.reason}`)
          analysis.verdict = 'VETADO'
          analysis.veto_reason = sherlock.reason
          analysis.sherlock_veto = true
        } else if (sherlock.confidenceDelta !== 0 && typeof analysis.confidence === 'number') {
          analysis.confidence = Math.max(0, Math.min(92, analysis.confidence + sherlock.confidenceDelta))
        }
        if (sherlock.notes.length > 0) {
          analysis.sherlock_notes = sherlock.notes
          analysis.risk_factors = [analysis.risk_factors, ...sherlock.notes].filter(Boolean).join(' | ')
        }
      } catch (sherlockErr) {
        console.warn('[Sherlock] Falha não crítica ao aplicar indicadores avançados:', sherlockErr)
      }

      // ─── CALIBRATION FLOOR (Punter) ────────────────────────────────────
      try {
        const floor = await getCalibrationFloor(supabaseClient, 'punter', 70)
        const r = applyCalibrationFloor(analysis, floor)
        if (r.demoted) {
          console.log(`[Mycroft Punter] 🎚️  CALIBRAÇÃO rebaixou ${game.home_team} vs ${game.away_team} (conf ${analysis.confidence}% < ${floor}%)`)
        }
      } catch (calErr) {
        console.warn('[Mycroft Punter] calibrationFloor falhou:', (calErr as Error)?.message)
      }

      // ─── EXCHANGE EDGE (Betfair via Futodds) ──────────────────────────
      // Recalcula edge contra o preço justo da Exchange (sem margem).
      // Se edge_exchange < 4% mesmo com APROVADO → rebaixa (foi falso valor de bookmaker).
      // Em qualquer caso, persiste snapshot em punter_clv_log para CLV posterior.
      let exchangeSnapshot: any = null
      try {
        const eventId = await resolveFutoddsEventId(supabaseClient, game.home_team, game.away_team, game.commence_time)
        if (eventId && analysis.market) {
          const quote = await getExchangeQuote(String(eventId), String(analysis.market))
          if (quote && quote.mid_odd) {
            const exEdge = computeExchangeEdgePP(Number(analysis.estimated_probability ?? 0), quote.mid_odd)
            exchangeSnapshot = {
              event_id: String(eventId),
              back: quote.back_odd, lay: quote.lay_odd, mid: quote.mid_odd,
              fair_prob: quote.fair_prob, edge_pp: exEdge,
            }
            const wasApproved = typeof analysis.verdict === 'string' && analysis.verdict.startsWith('APROVADO')
            const demoted = wasApproved && (exEdge != null) && exEdge < 4
            if (demoted) {
              console.log(`[Exchange] 🚫 ${game.home_team} vs ${game.away_team}: edge_exchange ${exEdge?.toFixed(2)}pp < 4pp → rebaixado`)
              analysis.verdict = 'VETADO'
              analysis.veto_reason = `Edge real vs Betfair Exchange ${exEdge?.toFixed(1)}pp < 4pp (bookmaker margin distortion)`
              analysis.exchange_demoted = true
            }
            analysis.exchange_back = quote.back_odd
            analysis.exchange_lay = quote.lay_odd
            analysis.exchange_mid = quote.mid_odd
            analysis.exchange_edge_pp = exEdge
            try {
              await supabaseClient.from('punter_clv_log').upsert({
                match_id: matchId, market: analysis.market,
                futodds_event_id: String(eventId),
                home_team: game.home_team, away_team: game.away_team,
                commence_time: game.commence_time,
                bookmaker_odd: analysis.odd ?? null,
                bookmaker_edge_pp: analysis.value_percentage ?? null,
                open_back_odd: quote.back_odd, open_lay_odd: quote.lay_odd, open_mid_odd: quote.mid_odd,
                open_fair_prob: quote.fair_prob, open_edge_pp: exEdge,
                estimated_probability: analysis.estimated_probability ?? null,
                demoted_by_exchange: !!demoted,
                exchange_source: 'futodds',
              }, { onConflict: 'match_id,market', ignoreDuplicates: false })
            } catch (logErr) {
              console.warn('[Exchange] punter_clv_log upsert falhou:', (logErr as Error).message)
            }
          }
        }
      } catch (exErr) {
        console.warn('[Exchange] check falhou:', (exErr as Error)?.message)
      }

      // ─── AH STRICT DISPERSION (Item #3): AH precisa de edge_exchange ≥ 5pp ─────
      try {
        if (isAsianHandicapMarket(analysis.market || '') && analysis.verdict === 'APROVADO') {
          const exEdge = Number(analysis.exchange_edge_pp ?? NaN)
          if (Number.isFinite(exEdge) && exEdge < 5) {
            console.log(`[AH-Dispersion] 🚫 ${game.home_team} vs ${game.away_team}: AH edge_exchange ${exEdge.toFixed(2)}pp < 5pp → rebaixado`)
            analysis.verdict = 'VETADO'
            analysis.veto_reason = `AH com edge real ${exEdge.toFixed(1)}pp < 5pp vs Betfair Exchange (mercado AH exige dispersão maior).`
            analysis.ah_dispersion_demoted = true
          } else if (!Number.isFinite(exEdge)) {
            console.log(`[AH-Dispersion] ⚠️ ${game.home_team} vs ${game.away_team}: AH sem cotação Exchange → rebaixado`)
            analysis.verdict = 'VETADO'
            analysis.veto_reason = `AH sem cotação confiável na Betfair Exchange (não validado por dispersão).`
            analysis.ah_dispersion_demoted = true
          }
        }
      } catch (ahErr) {
        console.warn('[AH-Dispersion] falhou:', (ahErr as Error)?.message)
      }

      // ─── QUALITY CHECK (Items #1+#3): quarantine + bucket calibration ─────
      try {
        if (analysis.verdict === 'APROVADO') {
          const { data: q } = await supabaseClient.rpc('punter_check_signal_quality', {
            p_league: game.sport_title || 'Unknown',
            p_market: analysis.market || 'N/A',
            p_odd: Number(analysis.odd ?? 0),
          })
          const row = Array.isArray(q) ? q[0] : q
          if (row?.quarantined) {
            console.log(`[Quality] 🚫 ${game.home_team} vs ${game.away_team}: bucket quarentenado (${row.reason})`)
            analysis.verdict = 'VETADO'
            analysis.veto_reason = `Bucket em quarentena: ${row.reason}`
            analysis.quality_quarantined = true
          } else if (row?.confidence_delta && typeof analysis.confidence === 'number') {
            const delta = Number(row.confidence_delta)
            analysis.confidence = Math.max(0, Math.min(92, analysis.confidence + delta))
            analysis.quality_calibration_delta = delta
            if (row.reason) analysis.quality_note = row.reason
          }
        }
      } catch (qErr) {
        console.warn('[Quality] check falhou:', (qErr as Error)?.message)
      }

      // ─── BLOCK GATE (3 blocos A/B/C + 4 vetos determinísticos) ───
      try {
        const gate = applyApprovalBlocks({
          verdict: String(analysis.verdict || 'VETADO'),
          market: analysis.market,
          odd: Number(analysis.odd) || 0,
          estimated_probability: Number(analysis.estimated_probability) || 0,
          value_percentage: Number(analysis.value_percentage) || 0,
          confidence: Number(analysis.confidence) || 0,
          league: game.sport_title || '',
          bookmaker: analysis.bookmaker || '',
          data_strength: analysis.data_strength || '',
        })
        if (gate.demoted) {
          console.log(`[Punter GATE] 🚫 ${game.home_team} vs ${game.away_team}: ${gate.veto_reason || gate.block_reason}`)
        }
        analysis.verdict = gate.verdict
        analysis.tier = gate.block
        analysis.tier_label = gate.tier_label
        analysis.block_reason = gate.block_reason
        if (gate.veto_reason) analysis.veto_reason = gate.veto_reason
        if (gate.stake_percentage > 0) analysis.stake_percentage = gate.stake_percentage
      } catch (gateErr) {
        console.warn('[Punter GATE] erro (mantendo verdict original):', (gateErr as Error)?.message)
      }

      console.log(`[Mycroft Punter] ${game.home_team} vs ${game.away_team}: ${analysis.verdict} | Model: ${analysis.model_level} | Value: ${analysis.value_percentage}% | EV: ${analysis.expected_value} | AI: anthropic${exchangeSnapshot ? ` | EX edge: ${exchangeSnapshot.edge_pp?.toFixed?.(2)}pp` : ''}`)

      if (analysis.verdict === 'APROVADO') {
        const commenceDate = game.commence_time ? new Date(game.commence_time) : new Date()
        const matchDate = commenceDate.toISOString().split('T')[0]
        const hoje = new Date().toISOString().split('T')[0]
        const isHoje = matchDate === hoje

        await supabaseClient.from('punter_sinais').upsert({
          match_id: matchId,
          home_team: game.home_team,
          away_team: game.away_team,
          league: game.sport_title || 'Unknown',
          commence_time: game.commence_time,
          match_date: matchDate,
          market: analysis.market || 'N/A',
          bookmaker: analysis.bookmaker || 'N/A',
          odd: analysis.odd || 0,
          fair_odd: analysis.fair_odd,
          implied_probability: analysis.implied_probability,
          estimated_probability: analysis.estimated_probability,
          value_percentage: analysis.value_percentage,
          verdict: analysis.verdict,
          confidence: analysis.confidence,
          stake_percentage: isHoje ? analysis.stake_percentage : null,
          stake_percentage_original: analysis.stake_percentage,
          thesis: analysis.thesis,
          analysis: analysis.analysis,
          risk_factors: analysis.risk_factors,
          analyzed_by: 'anthropic',
          status: isHoje ? 'pending' : 'awaiting_stake',
          stake_confirmed: isHoje,
          dismissed: false,
          resultado: null,
          approval_block: (analysis as any).tier ?? null,
        }, { onConflict: 'match_id,market', ignoreDuplicates: false })
        console.log('[Mycroft Punter] ✅ Sinal aprovado registrado')
      }

      // ─── SHADOW MODE: motor de regras dinâmicas ───
      try {
        await shadowCompare({
          sb: supabaseClient,
          modo: 'punter',
          source_function: 'mycroft-punter-anthropic',
          match_id: matchId,
          mercado: analysis.market || 'N/A',
          home_team: game.home_team,
          away_team: game.away_team,
          league: game.sport_title,
          odd: analysis.odd ?? undefined,
          stats: {
            value_percentage: Number(analysis.value_percentage ?? 0),
            implied_probability: Number(analysis.implied_probability ?? 0),
            estimated_probability: Number(analysis.estimated_probability ?? 0),
            expected_value: Number(analysis.expected_value ?? 0),
            confidence: Number(analysis.confidence ?? 0),
            odd: Number(analysis.odd ?? 0),
          },
          verdicto_atual: analysis.verdict,
          score_atual: Number(analysis.confidence ?? 0),
          stake_atual: Number(analysis.stake_percentage ?? 0),
          data_jogo: game.commence_time,
        });
      } catch (e) { console.warn('[shadowMode] punter falhou:', (e as Error).message); }

      // Persist detector results
      const modelProb = analysis.estimated_probability || null
      const marketProb = analysis.implied_probability || (analysis.odd ? (1 / analysis.odd) * 100 : 0)
      const finalDetectors = computeMarketDetectors(oddsData, totalsData, modelProb, analysis.market)
      await persistDetectors(supabaseClient, matchId, analysis.market || 'h2h', finalDetectors, modelProb, marketProb)

      return analysis
    } catch (parseErr: any) {
      if (attempt < maxRetries - 1) {
        const isRateLimit = parseErr?.message?.includes('429')
        const backoffMs = isRateLimit ? (attempt + 1) * 5000 : 1000
        console.warn(`[Mycroft Punter] Tentativa ${attempt + 1} falhou para ${game.home_team} vs ${game.away_team}${isRateLimit ? ' (rate limit)' : ''}, aguardando ${backoffMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        continue
      }
      throw parseErr
    }
  }

  return null
}
