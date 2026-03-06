import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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
        }
      } catch (err) {
        console.warn(`[Mycroft Punter] Erro ao buscar ${league}:`, err)
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
      JSON.stringify({ success: false, error: error.message }),
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
    'soccer_brazil_campeonato_pernambucano': 604,
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
    model_level
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
// AI Provider: Anthropic Claude
// ═══════════════════════════════════════════════

async function callAnthropic(systemPrompt: string, userPrompt: string): Promise<string> {
  const anthropicKey = Deno.env.get('VITE_ANTHROPIC_API_KEY')
  if (!anthropicKey) throw new Error('VITE_ANTHROPIC_API_KEY not configured')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Anthropic error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text || ''
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
  "thesis": "Resumo objetivo do edge identificado",
  "analysis": "Explicação quantitativa adaptada aos dados disponíveis",
  "risk_factors": "Riscos e limitações do modelo aplicado",
  "api_predictions_agree": true | false | null
}

IMPORTANTE:
- Use EXATAMENTE "APROVADO" ou "VETADO" no verdict
- Edge ≥ 2% com Confiança ≥ 58% = APROVAR (Tier 3 mínimo)
- META DE APROVAÇÃO: 50-70% dos jogos
- NÃO invente motivos extras de veto
- Se há edge ≥ 2% e EV positivo, APROVE no tier correspondente

ANALISE AGORA E RETORNE APENAS O JSON:`

  // Call AI provider with retry and backoff
  let analysisText: string = ''
  const maxRetries = 3
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      analysisText = await callGemini(systemPrompt, userPrompt)

      if (!analysisText) throw new Error('AI não retornou análise válida')

      // Clean and extract JSON
      const cleanJson = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error(`[Mycroft Punter] Resposta sem JSON (tentativa ${attempt + 1}):`, cleanJson.substring(0, 200))
        if (attempt < maxRetries - 1) continue
        throw new Error('Falha ao parsear análise - sem JSON na resposta')
      }

      const analysis = JSON.parse(jsonMatch[0])

      // Normalize verdict
      if (analysis.verdict && analysis.verdict.startsWith('APROVADO')) {
        analysis.verdict = 'APROVADO'
      }

      // Ensure value_percentage is a number (some models return edge_percentage instead)
      if (analysis.value_percentage === undefined || analysis.value_percentage === null) {
        analysis.value_percentage = analysis.edge_percentage || analysis.ev_percentage || 0
      }

      console.log(`[Mycroft Punter] ${game.home_team} vs ${game.away_team}: ${analysis.verdict} | Model: ${analysis.model_level} | Value: ${analysis.value_percentage}% | EV: ${analysis.expected_value} | AI: gemini`)

      // Save analysis to DB
      const { data: analysisRow } = await supabaseClient.from('punter_analyses').insert({
        match_id: matchId,
        home_team: game.home_team,
        away_team: game.away_team,
        league: game.sport_title || 'Unknown',
        commence_time: game.commence_time,
        market: analysis.market || 'N/A',
        bookmaker: analysis.bookmaker || 'N/A',
        odd: analysis.odd || 0,
        fair_odd: analysis.fair_odd,
        implied_probability: analysis.implied_probability,
        estimated_probability: analysis.estimated_probability,
        value_percentage: analysis.value_percentage,
        verdict: analysis.verdict,
        confidence: analysis.confidence,
        stake_percentage: analysis.stake_percentage,
        thesis: analysis.thesis,
        analysis: analysis.analysis,
        risk_factors: analysis.risk_factors,
        analyzed_by: 'gemini',
      }).select().maybeSingle()

      // If approved, create signal
      if (analysis.verdict === 'APROVADO' && analysisRow) {
        await supabaseClient.from('punter_signals').insert({
          analysis_id: analysisRow.id,
          match_id: matchId,
          market: analysis.market,
          bookmaker: analysis.bookmaker,
          odd: analysis.odd,
          value_percentage: analysis.value_percentage,
          stake_percentage: analysis.stake_percentage,
          status: 'pending',
        })
        console.log('[Mycroft Punter] ✅ Sinal aprovado registrado')
      }

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
