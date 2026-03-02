import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// League mapping: The Odds API key -> API-Football league ID
const LEAGUE_MAP: Record<string, { id: number; name: string }> = {
  'soccer_brazil_campeonato': { id: 71, name: 'Brasileirão Série A' },
  'soccer_brazil_serie_b': { id: 72, name: 'Brasileirão Série B' },
  'soccer_epl': { id: 39, name: 'Premier League' },
  'soccer_spain_la_liga': { id: 140, name: 'La Liga' },
  'soccer_italy_serie_a': { id: 135, name: 'Serie A' },
  'soccer_germany_bundesliga': { id: 78, name: 'Bundesliga' },
  'soccer_france_ligue_one': { id: 61, name: 'Ligue 1' },
  'soccer_argentina_primera_division': { id: 128, name: 'Argentina Primera' },
  'soccer_conmebol_copa_libertadores': { id: 13, name: 'Copa Libertadores' },
  'soccer_conmebol_copa_sudamericana': { id: 11, name: 'Copa Sudamericana' },
  'soccer_uefa_champs_league': { id: 2, name: 'Champions League' },
  'soccer_uefa_europa_league': { id: 3, name: 'Europa League' },
}

interface TeamCumulativeStats {
  played: number
  wins: number
  draws: number
  losses: number
  goalsScored: number
  goalsConceded: number
  homeWins: number
  homePlayed: number
  awayWins: number
  awayPlayed: number
}

interface BacktestResult {
  fixture_id: number
  date: string
  round: string
  home_team: string
  away_team: string
  home_goals: number
  away_goals: number
  market: string
  predicted_prob: number
  implied_prob: number
  odd: number
  ev: number
  value_pct: number
  verdict: 'APROVADO' | 'VETADO'
  result: 'green' | 'red' | null
  stake_pct: number
  profit_loss: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('API_FOOTBALL_KEY')
    if (!apiKey) throw new Error('API_FOOTBALL_KEY not configured')

    const body = await req.json()
    const {
      league = 'soccer_brazil_campeonato',
      season = new Date().getFullYear() - 1,
      min_value = 5,
      initial_bankroll = 10000,
      stake_mode = 'fixed_pct', // 'fixed_pct' or 'kelly'
      fixed_stake_pct = 3,
      min_confidence = 60,
    } = body

    const leagueInfo = LEAGUE_MAP[league]
    if (!leagueInfo) throw new Error(`Liga não suportada: ${league}`)

    console.log(`[Backtest] Liga: ${leagueInfo.name} | Temporada: ${season} | Min Value: ${min_value}%`)

    // 1. Fetch all finished fixtures for the season
    const fixtures = await fetchSeasonFixtures(leagueInfo.id, season, apiKey)
    console.log(`[Backtest] ${fixtures.length} jogos finalizados encontrados`)

    if (fixtures.length === 0) {
      return jsonResponse({ success: true, results: [], metrics: emptyMetrics(), league: leagueInfo.name, season })
    }

    // Sort by date ascending
    fixtures.sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime())

    // 2. Build cumulative stats progressively (NO LOOKAHEAD)
    const teamStats: Record<string, TeamCumulativeStats> = {}
    const results: BacktestResult[] = []
    let bankroll = initial_bankroll
    let maxBankroll = initial_bankroll
    let maxDrawdown = 0

    // Skip first 5 rounds to have enough data
    const MIN_GAMES_PER_TEAM = 3

    for (const fixture of fixtures) {
      const homeTeam = fixture.teams.home.name
      const awayTeam = fixture.teams.away.name
      const homeGoals = fixture.goals.home ?? 0
      const awayGoals = fixture.goals.away ?? 0
      const fixtureDate = fixture.fixture.date

      // Get CURRENT cumulative stats (BEFORE this game)
      const homeStats = teamStats[homeTeam]
      const awayStats = teamStats[awayTeam]

      // Only analyze if both teams have enough historical data
      if (homeStats && awayStats && homeStats.played >= MIN_GAMES_PER_TEAM && awayStats.played >= MIN_GAMES_PER_TEAM) {
        const analysis = analyzeFixture(homeTeam, awayTeam, homeStats, awayStats, homeGoals, awayGoals, min_value, min_confidence)
        
        if (analysis) {
          const stakePct = analysis.verdict === 'APROVADO' ? fixed_stake_pct : 0
          const stakeAmount = bankroll * (stakePct / 100)
          let profitLoss = 0

          if (analysis.verdict === 'APROVADO') {
            if (analysis.result === 'green') {
              profitLoss = stakeAmount * (analysis.odd - 1)
            } else {
              profitLoss = -stakeAmount
            }
            bankroll += profitLoss
          }

          // Track drawdown
          if (bankroll > maxBankroll) maxBankroll = bankroll
          const currentDrawdown = ((maxBankroll - bankroll) / maxBankroll) * 100
          if (currentDrawdown > maxDrawdown) maxDrawdown = currentDrawdown

          results.push({
            fixture_id: fixture.fixture.id,
            date: fixtureDate,
            round: fixture.league.round || '',
            home_team: homeTeam,
            away_team: awayTeam,
            home_goals: homeGoals,
            away_goals: awayGoals,
            market: analysis.market,
            predicted_prob: analysis.predictedProb,
            implied_prob: analysis.impliedProb,
            odd: analysis.odd,
            ev: analysis.ev,
            value_pct: analysis.valuePct,
            verdict: analysis.verdict,
            result: analysis.verdict === 'APROVADO' ? analysis.result : null,
            stake_pct: stakePct,
            profit_loss: Math.round(profitLoss * 100) / 100,
          })
        }
      }

      // NOW update cumulative stats (AFTER analysis, preserving no-lookahead rule)
      updateTeamStats(teamStats, homeTeam, awayTeam, homeGoals, awayGoals, true)
      updateTeamStats(teamStats, awayTeam, homeTeam, awayGoals, homeGoals, false)
    }

    // 3. Calculate final metrics
    const approved = results.filter(r => r.verdict === 'APROVADO')
    const greens = approved.filter(r => r.result === 'green')
    const reds = approved.filter(r => r.result === 'red')
    const totalPL = approved.reduce((sum, r) => sum + r.profit_loss, 0)
    const roi = approved.length > 0 ? (totalPL / (initial_bankroll * (fixed_stake_pct / 100) * approved.length)) * 100 : 0

    // ROI by EV range
    const evRanges = [
      { label: '5-10%', min: 5, max: 10 },
      { label: '10-15%', min: 10, max: 15 },
      { label: '15-20%', min: 15, max: 20 },
      { label: '20%+', min: 20, max: 999 },
    ]
    const roiByEv = evRanges.map(range => {
      const inRange = approved.filter(r => r.value_pct >= range.min && r.value_pct < range.max)
      const pl = inRange.reduce((s, r) => s + r.profit_loss, 0)
      const totalStaked = inRange.length * initial_bankroll * (fixed_stake_pct / 100)
      return {
        range: range.label,
        count: inRange.length,
        greens: inRange.filter(r => r.result === 'green').length,
        reds: inRange.filter(r => r.result === 'red').length,
        roi: totalStaked > 0 ? (pl / totalStaked) * 100 : 0,
        profit_loss: Math.round(pl * 100) / 100,
      }
    }).filter(r => r.count > 0)

    // Bankroll curve (track after each approved bet)
    let runningBankroll = initial_bankroll
    const bankrollCurve = [{ index: 0, bankroll: initial_bankroll, date: '' }]
    approved.forEach((r, i) => {
      runningBankroll += r.profit_loss
      bankrollCurve.push({
        index: i + 1,
        bankroll: Math.round(runningBankroll * 100) / 100,
        date: r.date.split('T')[0],
      })
    })

    const metrics = {
      total_analyzed: results.length,
      total_approved: approved.length,
      approval_rate: results.length > 0 ? (approved.length / results.length * 100) : 0,
      greens: greens.length,
      reds: reds.length,
      hit_rate: approved.length > 0 ? (greens.length / approved.length * 100) : 0,
      roi_total: Math.round(roi * 100) / 100,
      net_profit: Math.round(totalPL * 100) / 100,
      max_drawdown: Math.round(maxDrawdown * 100) / 100,
      final_bankroll: Math.round(bankroll * 100) / 100,
      initial_bankroll,
      roi_by_ev: roiByEv,
      bankroll_curve: bankrollCurve,
    }

    console.log(`[Backtest] Concluído: ${approved.length} aprovados, ${greens.length} greens, ${reds.length} reds, ROI: ${roi.toFixed(2)}%`)

    return jsonResponse({
      success: true,
      league: leagueInfo.name,
      season,
      metrics,
      results: approved, // only return approved for display
      total_fixtures: fixtures.length,
    })

  } catch (error) {
    console.error('[Backtest] ERRO:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ═══════════════════════════════════════════════
// API-Football: Fetch season fixtures
// ═══════════════════════════════════════════════

async function fetchSeasonFixtures(leagueId: number, season: number, apiKey: string): Promise<any[]> {
  const allFixtures: any[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const url = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&status=FT&page=${page}`
    const res = await fetch(url, {
      headers: { 'x-apisports-key': apiKey }
    })

    if (!res.ok) {
      console.warn(`[Backtest] API-Football HTTP ${res.status} on page ${page}`)
      break
    }

    const data = await res.json()
    const fixtures = data.response || []
    allFixtures.push(...fixtures)

    // Check pagination
    const paging = data.paging
    if (paging && paging.current < paging.total) {
      page++
    } else {
      hasMore = false
    }

    // Rate limit protection
    await new Promise(r => setTimeout(r, 200))
  }

  return allFixtures
}

// ═══════════════════════════════════════════════
// Cumulative stats management
// ═══════════════════════════════════════════════

function updateTeamStats(
  stats: Record<string, TeamCumulativeStats>,
  team: string,
  opponent: string,
  goalsFor: number,
  goalsAgainst: number,
  isHome: boolean,
) {
  if (!stats[team]) {
    stats[team] = { played: 0, wins: 0, draws: 0, losses: 0, goalsScored: 0, goalsConceded: 0, homeWins: 0, homePlayed: 0, awayWins: 0, awayPlayed: 0 }
  }
  const s = stats[team]
  s.played++
  s.goalsScored += goalsFor
  s.goalsConceded += goalsAgainst

  if (goalsFor > goalsAgainst) {
    s.wins++
    if (isHome) s.homeWins++
  } else if (goalsFor === goalsAgainst) {
    s.draws++
  } else {
    s.losses++
  }

  if (isHome) s.homePlayed++
  else s.awayPlayed++
}

// ═══════════════════════════════════════════════
// Mathematical analysis (Poisson-based, no AI)
// ═══════════════════════════════════════════════

function analyzeFixture(
  homeTeam: string,
  awayTeam: string,
  homeStats: TeamCumulativeStats,
  awayStats: TeamCumulativeStats,
  actualHomeGoals: number,
  actualAwayGoals: number,
  minValue: number,
  minConfidence: number,
): {
  market: string
  predictedProb: number
  impliedProb: number
  odd: number
  ev: number
  valuePct: number
  verdict: 'APROVADO' | 'VETADO'
  result: 'green' | 'red'
  confidence: number
} | null {
  // Calculate average goals
  const homeAvgScored = homeStats.goalsScored / homeStats.played
  const homeAvgConceded = homeStats.goalsConceded / homeStats.played
  const awayAvgScored = awayStats.goalsScored / awayStats.played
  const awayAvgConceded = awayStats.goalsConceded / awayStats.played

  // Expected goals using Poisson model
  const homeXG = (homeAvgScored + awayAvgConceded) / 2 * 1.05 // slight home advantage
  const awayXG = (awayAvgScored + homeAvgConceded) / 2 * 0.95

  // Poisson probabilities for outcomes
  const homeWinProb = poissonMatchProb(homeXG, awayXG, 'home')
  const drawProb = poissonMatchProb(homeXG, awayXG, 'draw')
  const awayWinProb = poissonMatchProb(homeXG, awayXG, 'away')
  const over25Prob = poissonOver(homeXG, awayXG, 2.5)
  const under25Prob = 1 - over25Prob

  // Generate synthetic fair odds from stats
  const homeWinRate = homeStats.wins / homeStats.played
  const awayWinRate = awayStats.wins / awayStats.played
  const homeFormFactor = homeStats.homeWins / Math.max(homeStats.homePlayed, 1)
  
  // Synthetic market odds (simulating bookmaker with ~5% margin)
  const margin = 1.05
  const homeOdd = margin / homeWinProb
  const drawOdd = margin / drawProb
  const awayOdd = margin / awayWinProb
  const over25Odd = margin / over25Prob
  const under25Odd = margin / under25Prob

  // Find best value opportunity across markets
  const markets = [
    { name: 'Casa', prob: homeWinProb, odd: homeOdd, actualResult: actualHomeGoals > actualAwayGoals },
    { name: 'Empate', prob: drawProb, odd: drawOdd, actualResult: actualHomeGoals === actualAwayGoals },
    { name: 'Fora', prob: awayWinProb, odd: awayOdd, actualResult: actualAwayGoals > actualHomeGoals },
    { name: 'Over 2.5', prob: over25Prob, odd: over25Odd, actualResult: (actualHomeGoals + actualAwayGoals) > 2.5 },
    { name: 'Under 2.5', prob: under25Prob, odd: under25Odd, actualResult: (actualHomeGoals + actualAwayGoals) < 2.5 },
  ]

  // Find market with highest EV
  let bestMarket: typeof markets[0] | null = null
  let bestEv = -1

  for (const m of markets) {
    const impliedProb = 1 / m.odd
    const ev = (m.prob * m.odd) - 1
    const valuePct = ((m.prob - impliedProb) / impliedProb) * 100

    if (ev > bestEv && valuePct >= minValue) {
      bestEv = ev
      bestMarket = m
    }
  }

  if (!bestMarket) return null

  const impliedProb = 1 / bestMarket.odd
  const valuePct = ((bestMarket.prob - impliedProb) / impliedProb) * 100
  const confidence = Math.min(95, Math.round(bestMarket.prob * 100 + Math.min(homeStats.played, 15) * 1.5))

  if (confidence < minConfidence) return null

  return {
    market: bestMarket.name,
    predictedProb: Math.round(bestMarket.prob * 10000) / 100,
    impliedProb: Math.round(impliedProb * 10000) / 100,
    odd: Math.round(bestMarket.odd * 100) / 100,
    ev: Math.round(bestEv * 10000) / 100,
    valuePct: Math.round(valuePct * 100) / 100,
    verdict: valuePct >= minValue ? 'APROVADO' : 'VETADO',
    result: bestMarket.actualResult ? 'green' : 'red',
    confidence,
  }
}

// ═══════════════════════════════════════════════
// Poisson distribution helpers
// ═══════════════════════════════════════════════

function poissonPmf(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0
  return Math.exp(-lambda + k * Math.log(lambda) - logFactorial(k))
}

function logFactorial(n: number): number {
  let result = 0
  for (let i = 2; i <= n; i++) result += Math.log(i)
  return result
}

function poissonMatchProb(homeXG: number, awayXG: number, outcome: 'home' | 'draw' | 'away'): number {
  let prob = 0
  const maxGoals = 8

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonPmf(homeXG, h) * poissonPmf(awayXG, a)
      if (outcome === 'home' && h > a) prob += p
      else if (outcome === 'draw' && h === a) prob += p
      else if (outcome === 'away' && a > h) prob += p
    }
  }

  return Math.max(0.01, Math.min(0.99, prob))
}

function poissonOver(homeXG: number, awayXG: number, line: number): number {
  let underProb = 0
  const maxGoals = 8

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      if ((h + a) <= line) {
        underProb += poissonPmf(homeXG, h) * poissonPmf(awayXG, a)
      }
    }
  }

  return Math.max(0.01, Math.min(0.99, 1 - underProb))
}

function emptyMetrics() {
  return {
    total_analyzed: 0,
    total_approved: 0,
    approval_rate: 0,
    greens: 0,
    reds: 0,
    hit_rate: 0,
    roi_total: 0,
    net_profit: 0,
    max_drawdown: 0,
    final_bankroll: 0,
    initial_bankroll: 0,
    roi_by_ev: [],
    bankroll_curve: [],
  }
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
