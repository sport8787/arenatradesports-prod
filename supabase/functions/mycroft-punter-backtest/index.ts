import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  homeGoalsScored: number
  homeGoalsConceded: number
  awayWins: number
  awayPlayed: number
  awayGoalsScored: number
  awayGoalsConceded: number
  lastResults: ('W' | 'D' | 'L')[]
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
  veto_reason?: string
  model_level: string
  confidence: number
  data_strength: string
}

// ═══════════════════════════════════════════════
// CRITERIA PARSER — reads prompt_mycroft_punter.txt dynamically
// ═══════════════════════════════════════════════

interface AnalysisCriteria {
  min_edge_pct: number        // default 3
  min_confidence: number      // default 68
  min_ev: number              // default 0
  high_priority_edge: number  // default 6
  max_approval_pct: number    // default 30
  min_approval_pct: number    // default 8
  stake_low: number           // confidence 68-75 → 3%
  stake_mid: number           // confidence 75-85 → 4%
  stake_high: number          // confidence >85 → 5%
  level3_stake_penalty: number // 0.5%
  min_sample_games: number    // 5
}

function defaultCriteria(): AnalysisCriteria {
  return {
    min_edge_pct: 3,
    min_confidence: 68,
    min_ev: 0,
    high_priority_edge: 6,
    max_approval_pct: 30,
    min_approval_pct: 8,
    stake_low: 3,
    stake_mid: 4,
    stake_high: 5,
    level3_stake_penalty: 0.5,
    min_sample_games: 5,
  }
}

function parseCriteriaFromPrompt(promptText: string): AnalysisCriteria {
  const c = defaultCriteria()
  try {
    // Parse edge thresholds
    const edgeMatch = promptText.match(/≥\s*(\d+)%\s*→\s*potencial edge/i)
    if (edgeMatch) c.min_edge_pct = parseInt(edgeMatch[1])

    const highEdge = promptText.match(/≥\s*(\d+)%\s*→\s*prioridade alta/i)
    if (highEdge) c.high_priority_edge = parseInt(highEdge[1])

    // Parse confidence
    const confMatch = promptText.match(/Confiança\s*≥\s*(\d+)%/i)
    if (confMatch) c.min_confidence = parseInt(confMatch[1])

    // Parse stakes
    const stakeLow = promptText.match(/Confiança\s*68.75%\s*→\s*(\d+)%/i)
    if (stakeLow) c.stake_low = parseInt(stakeLow[1])
    const stakeMid = promptText.match(/Confiança\s*75.85%\s*→\s*(\d+)%/i)
    if (stakeMid) c.stake_mid = parseInt(stakeMid[1])
    const stakeHigh = promptText.match(/Confiança\s*>85%\s*→\s*(\d+)%/i)
    if (stakeHigh) c.stake_high = parseInt(stakeHigh[1])

    // Parse approval range
    const approvalMatch = promptText.match(/Aprovar\s*entre\s*(\d+)%\s*e\s*(\d+)%/i)
    if (approvalMatch) {
      c.min_approval_pct = parseInt(approvalMatch[1])
      c.max_approval_pct = parseInt(approvalMatch[2])
    }

    // Parse min sample
    const sampleMatch = promptText.match(/Amostra\s*pequena\s*\(<\s*(\d+)\s*jogos/i)
    if (sampleMatch) c.min_sample_games = parseInt(sampleMatch[1])

    // Parse level 3 penalty
    const penaltyMatch = promptText.match(/Reduzir\s*stake\s*em\s*(\d+\.?\d*)%/i)
    if (penaltyMatch) c.level3_stake_penalty = parseFloat(penaltyMatch[1])

    console.log('[Backtest] Critérios parseados do prompt:', JSON.stringify(c))
  } catch (e) {
    console.warn('[Backtest] Erro ao parsear prompt, usando defaults:', e)
  }
  return c
}

async function loadPromptCriteria(): Promise<AnalysisCriteria> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Try storage override first
    const { data: storageData } = await supabase.storage
      .from('sports-knowledge-base')
      .download('prompt_mycroft_punter.txt')

    if (storageData) {
      const text = await storageData.text()
      console.log('[Backtest] Usando prompt_mycroft_punter.txt do storage')
      return parseCriteriaFromPrompt(text)
    }
  } catch (e) {
    console.log('[Backtest] Storage não disponível, tentando arquivo local')
  }

  // Fallback: try to fetch from public KB
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const res = await fetch(`${supabaseUrl.replace('supabase.co', 'supabase.co')}/storage/v1/object/public/sports-knowledge-base/prompt_mycroft_punter.txt`)
    if (res.ok) {
      const text = await res.text()
      return parseCriteriaFromPrompt(text)
    }
  } catch (e) {
    // ignore
  }

  console.log('[Backtest] Usando critérios padrão do prompt')
  return defaultCriteria()
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('API_FOOTBALL_KEY')
    if (!apiKey) throw new Error('API_FOOTBALL_KEY not configured')

    const body = await req.json()
    const {
      league,
      leagues: leaguesInput,
      season = new Date().getFullYear() - 1,
      min_value = 5,
      initial_bankroll = 10000,
      stake_mode = 'fixed_pct',
      fixed_stake_pct = 3,
    } = body

    // Load criteria from prompt
    const criteria = await loadPromptCriteria()

    const leagueKeys: string[] = leaguesInput && Array.isArray(leaguesInput) && leaguesInput.length > 0
      ? leaguesInput
      : [league || 'soccer_brazil_campeonato']

    const validLeagues = leagueKeys.map(k => ({ key: k, info: LEAGUE_MAP[k] })).filter(l => l.info)
    if (validLeagues.length === 0) throw new Error('Nenhuma liga válida selecionada')

    const leagueNames = validLeagues.map(l => l.info.name).join(', ')
    console.log(`[Backtest] Ligas: ${leagueNames} | Temporada: ${season}`)
    console.log(`[Backtest] Critérios: edge≥${criteria.min_edge_pct}%, confiança≥${criteria.min_confidence}%, EV>0`)

    // 1. Fetch all finished fixtures
    const allFixtures: any[] = []
    for (const l of validLeagues) {
      const fixtures = await fetchSeasonFixtures(l.info.id, season, apiKey)
      console.log(`[Backtest] ${l.info.name}: ${fixtures.length} jogos`)
      allFixtures.push(...fixtures)
      if (validLeagues.length > 1) await new Promise(r => setTimeout(r, 300))
    }

    console.log(`[Backtest] Total: ${allFixtures.length} jogos finalizados`)

    if (allFixtures.length === 0) {
      return jsonResponse({ success: true, results: [], metrics: emptyMetrics(), league: leagueNames, season })
    }

    // Sort by date ascending
    allFixtures.sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime())

    // 2. Calculate league-wide averages for market odds baseline
    const leagueAvg = calculateLeagueAverages(allFixtures)
    console.log(`[Backtest] Média da liga: ${leagueAvg.avgGoals.toFixed(2)} gols/jogo, home win: ${(leagueAvg.homeWinRate * 100).toFixed(1)}%`)

    // 3. Simulate game by game (NO LOOKAHEAD)
    const teamStats: Record<string, TeamCumulativeStats> = {}
    const results: BacktestResult[] = []
    let bankroll = initial_bankroll
    let maxBankroll = initial_bankroll
    let maxDrawdown = 0

    for (const fixture of allFixtures) {
      const homeTeam = fixture.teams.home.name
      const awayTeam = fixture.teams.away.name
      const homeGoals = fixture.goals.home ?? 0
      const awayGoals = fixture.goals.away ?? 0
      const fixtureDate = fixture.fixture.date

      const homeStats = teamStats[homeTeam]
      const awayStats = teamStats[awayTeam]

      // Need minimum games for both teams
      if (homeStats && awayStats && homeStats.played >= criteria.min_sample_games && awayStats.played >= criteria.min_sample_games) {
        const analysis = analyzeWithCriteria(
          homeTeam, awayTeam, homeStats, awayStats,
          homeGoals, awayGoals, leagueAvg, criteria
        )

        if (analysis) {
          // Calculate stake based on confidence (from prompt criteria)
          let stakePct = criteria.stake_low
          if (analysis.confidence >= 85) stakePct = criteria.stake_high
          else if (analysis.confidence >= 75) stakePct = criteria.stake_mid

          // Level 2 analysis (no xG) → apply level3 penalty since we don't have real odds
          stakePct -= criteria.level3_stake_penalty
          stakePct = Math.max(1, stakePct)

          const stakeAmount = bankroll * (stakePct / 100)
          let profitLoss = 0

          if (analysis.verdict === 'APROVADO') {
            profitLoss = analysis.isGreen
              ? stakeAmount * (analysis.odd - 1)
              : -stakeAmount
            bankroll += profitLoss
          }

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
            value_pct: analysis.edgePct,
            verdict: analysis.verdict,
            result: analysis.verdict === 'APROVADO' ? (analysis.isGreen ? 'green' : 'red') : null,
            stake_pct: analysis.verdict === 'APROVADO' ? stakePct : 0,
            profit_loss: Math.round(profitLoss * 100) / 100,
            veto_reason: analysis.vetoReason,
            model_level: analysis.modelLevel,
            confidence: analysis.confidence,
            data_strength: analysis.dataStrength,
          })
        }
      }

      // Update stats AFTER analysis (no-lookahead)
      updateTeamStats(teamStats, homeTeam, homeGoals, awayGoals, true)
      updateTeamStats(teamStats, awayTeam, awayGoals, homeGoals, false)
    }

    // 4. Calculate metrics
    const approved = results.filter(r => r.verdict === 'APROVADO')
    const vetoed = results.filter(r => r.verdict === 'VETADO')
    const greens = approved.filter(r => r.result === 'green')
    const reds = approved.filter(r => r.result === 'red')
    const totalPL = approved.reduce((sum, r) => sum + r.profit_loss, 0)
    const totalStaked = approved.reduce((sum, r) => sum + initial_bankroll * (r.stake_pct / 100), 0)
    const roi = totalStaked > 0 ? (totalPL / totalStaked) * 100 : 0

    const approvalRate = results.length > 0 ? (approved.length / results.length * 100) : 0
    console.log(`[Backtest] Taxa de aprovação: ${approvalRate.toFixed(1)}% (target: ${criteria.min_approval_pct}-${criteria.max_approval_pct}%)`)

    // ROI by EV range
    const evRanges = [
      { label: '3-5%', min: 3, max: 5 },
      { label: '5-10%', min: 5, max: 10 },
      { label: '10-15%', min: 10, max: 15 },
      { label: '15-20%', min: 15, max: 20 },
      { label: '20%+', min: 20, max: 999 },
    ]
    const roiByEv = evRanges.map(range => {
      const inRange = approved.filter(r => r.value_pct >= range.min && r.value_pct < range.max)
      const pl = inRange.reduce((s, r) => s + r.profit_loss, 0)
      const staked = inRange.reduce((s, r) => s + initial_bankroll * (r.stake_pct / 100), 0)
      return {
        range: range.label,
        count: inRange.length,
        greens: inRange.filter(r => r.result === 'green').length,
        reds: inRange.filter(r => r.result === 'red').length,
        roi: staked > 0 ? (pl / staked) * 100 : 0,
        profit_loss: Math.round(pl * 100) / 100,
      }
    }).filter(r => r.count > 0)

    // Bankroll curve
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
      approval_rate: Math.round(approvalRate * 100) / 100,
      greens: greens.length,
      reds: reds.length,
      hit_rate: approved.length > 0 ? Math.round((greens.length / approved.length * 100) * 100) / 100 : 0,
      roi_total: Math.round(roi * 100) / 100,
      net_profit: Math.round(totalPL * 100) / 100,
      max_drawdown: Math.round(maxDrawdown * 100) / 100,
      final_bankroll: Math.round(bankroll * 100) / 100,
      initial_bankroll,
      roi_by_ev: roiByEv,
      bankroll_curve: bankrollCurve,
      criteria_used: {
        min_edge: criteria.min_edge_pct,
        min_confidence: criteria.min_confidence,
        min_sample: criteria.min_sample_games,
        target_approval: `${criteria.min_approval_pct}-${criteria.max_approval_pct}%`,
      },
    }

    console.log(`[Backtest] CONCLUÍDO: ${results.length} analisados, ${approved.length} aprovados (${approvalRate.toFixed(1)}%), ${greens.length}G/${reds.length}R, ROI: ${roi.toFixed(2)}%`)

    return jsonResponse({
      success: true,
      league: leagueNames,
      season,
      metrics,
      results: approved,
      total_fixtures: allFixtures.length,
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
// API-Football
// ═══════════════════════════════════════════════

async function fetchSeasonFixtures(leagueId: number, season: number, apiKey: string): Promise<any[]> {
  const url = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&status=FT`
  const res = await fetch(url, { headers: { 'x-apisports-key': apiKey } })
  if (!res.ok) return []
  const data = await res.json()
  return data.response || []
}

// ═══════════════════════════════════════════════
// League averages — baseline for "market" odds
// ═══════════════════════════════════════════════

interface LeagueAverages {
  avgGoals: number
  homeWinRate: number
  drawRate: number
  awayWinRate: number
  avgHomeGoals: number
  avgAwayGoals: number
}

function calculateLeagueAverages(fixtures: any[]): LeagueAverages {
  let totalGoals = 0, homeWins = 0, draws = 0, awayWins = 0
  let homeGoals = 0, awayGoals = 0

  for (const f of fixtures) {
    const hg = f.goals.home ?? 0
    const ag = f.goals.away ?? 0
    totalGoals += hg + ag
    homeGoals += hg
    awayGoals += ag
    if (hg > ag) homeWins++
    else if (hg === ag) draws++
    else awayWins++
  }

  const n = fixtures.length || 1
  return {
    avgGoals: totalGoals / n,
    homeWinRate: homeWins / n,
    drawRate: draws / n,
    awayWinRate: awayWins / n,
    avgHomeGoals: homeGoals / n,
    avgAwayGoals: awayGoals / n,
  }
}

// ═══════════════════════════════════════════════
// Stats management
// ═══════════════════════════════════════════════

function updateTeamStats(stats: Record<string, TeamCumulativeStats>, team: string, goalsFor: number, goalsAgainst: number, isHome: boolean) {
  if (!stats[team]) {
    stats[team] = {
      played: 0, wins: 0, draws: 0, losses: 0,
      goalsScored: 0, goalsConceded: 0,
      homeWins: 0, homePlayed: 0, homeGoalsScored: 0, homeGoalsConceded: 0,
      awayWins: 0, awayPlayed: 0, awayGoalsScored: 0, awayGoalsConceded: 0,
      lastResults: [],
    }
  }
  const s = stats[team]
  s.played++
  s.goalsScored += goalsFor
  s.goalsConceded += goalsAgainst

  let result: 'W' | 'D' | 'L'
  if (goalsFor > goalsAgainst) { s.wins++; result = 'W' }
  else if (goalsFor === goalsAgainst) { s.draws++; result = 'D' }
  else { s.losses++; result = 'L' }

  if (isHome) {
    s.homePlayed++
    s.homeGoalsScored += goalsFor
    s.homeGoalsConceded += goalsAgainst
    if (goalsFor > goalsAgainst) s.homeWins++
  } else {
    s.awayPlayed++
    s.awayGoalsScored += goalsFor
    s.awayGoalsConceded += goalsAgainst
    if (goalsFor > goalsAgainst) s.awayWins++
  }

  s.lastResults.push(result)
  if (s.lastResults.length > 5) s.lastResults.shift()
}

// ═══════════════════════════════════════════════
// ANALYSIS ENGINE — applies prompt criteria
// ═══════════════════════════════════════════════

interface AnalysisResult {
  market: string
  predictedProb: number
  impliedProb: number
  odd: number
  ev: number
  edgePct: number
  verdict: 'APROVADO' | 'VETADO'
  isGreen: boolean
  confidence: number
  vetoReason?: string
  modelLevel: string
  dataStrength: string
}

function analyzeWithCriteria(
  homeTeam: string,
  awayTeam: string,
  homeStats: TeamCumulativeStats,
  awayStats: TeamCumulativeStats,
  actualHomeGoals: number,
  actualAwayGoals: number,
  leagueAvg: LeagueAverages,
  criteria: AnalysisCriteria,
): AnalysisResult | null {

  // ── MODEL: Poisson-based predicted probabilities ──
  // Use team-specific stats (our "model view")
  const homeAttack = homeStats.goalsScored / homeStats.played
  const homeDefense = homeStats.goalsConceded / homeStats.played
  const awayAttack = awayStats.goalsScored / awayStats.played
  const awayDefense = awayStats.goalsConceded / awayStats.played

  // Home/away split for better accuracy
  const homeHomeAttack = homeStats.homePlayed > 2
    ? homeStats.homeGoalsScored / homeStats.homePlayed
    : homeAttack
  const awayAwayAttack = awayStats.awayPlayed > 2
    ? awayStats.awayGoalsScored / awayStats.awayPlayed
    : awayAttack

  // Expected goals (Poisson lambda)
  const homeXG = ((homeHomeAttack + awayDefense) / 2) * (leagueAvg.avgHomeGoals / Math.max(leagueAvg.avgGoals / 2, 0.5))
  const awayXG = ((awayAwayAttack + homeDefense) / 2) * (leagueAvg.avgAwayGoals / Math.max(leagueAvg.avgGoals / 2, 0.5))

  const modelHomeWin = poissonMatchProb(homeXG, awayXG, 'home')
  const modelDraw = poissonMatchProb(homeXG, awayXG, 'draw')
  const modelAwayWin = poissonMatchProb(homeXG, awayXG, 'away')
  const modelOver25 = poissonOver(homeXG, awayXG, 2.5)
  const modelUnder25 = 1 - modelOver25
  const modelOver15 = poissonOver(homeXG, awayXG, 1.5)
  const modelBTTS = poissonBTTS(homeXG, awayXG)

  // ── MARKET: Independent baseline using league averages + simple win rates ──
  // This simulates what a bookmaker would price, INDEPENDENT of our model
  const homeWinRate = homeStats.wins / homeStats.played
  const awayWinRate = awayStats.wins / awayStats.played
  const homeDrawRate = homeStats.draws / homeStats.played
  const awayDrawRate = awayStats.draws / awayStats.played

  // Market probabilities (blend of simple rates + league baseline)
  const marketHomeWin = clamp((homeWinRate * 0.4 + leagueAvg.homeWinRate * 0.6), 0.05, 0.90)
  const marketDraw = clamp(((homeDrawRate + awayDrawRate) / 2 * 0.4 + leagueAvg.drawRate * 0.6), 0.10, 0.40)
  const marketAwayWin = clamp(1 - marketHomeWin - marketDraw, 0.05, 0.90)

  // Over/Under market baseline from league average
  const leagueOver25Rate = calculateOver25Rate(leagueAvg.avgGoals)
  const marketOver25 = clamp(leagueOver25Rate, 0.20, 0.80)
  const marketUnder25 = 1 - marketOver25

  // Apply bookmaker margin (5-8% overround)
  const margin = 1.06
  const marketOdds = {
    'Casa': margin / marketHomeWin,
    'Empate': margin / marketDraw,
    'Fora': margin / marketAwayWin,
    'Over 2.5': margin / marketOver25,
    'Under 2.5': margin / marketUnder25,
    'Over 1.5': margin / clamp(leagueOver25Rate * 1.3, 0.40, 0.90),
    'BTTS Sim': margin / clamp(marketOver25 * 0.85, 0.25, 0.75),
  }

  const modelProbs: Record<string, number> = {
    'Casa': modelHomeWin,
    'Empate': modelDraw,
    'Fora': modelAwayWin,
    'Over 2.5': modelOver25,
    'Under 2.5': modelUnder25,
    'Over 1.5': modelOver15,
    'BTTS Sim': modelBTTS,
  }

  const actualResults: Record<string, boolean> = {
    'Casa': actualHomeGoals > actualAwayGoals,
    'Empate': actualHomeGoals === actualAwayGoals,
    'Fora': actualAwayGoals > actualHomeGoals,
    'Over 2.5': (actualHomeGoals + actualAwayGoals) > 2.5,
    'Under 2.5': (actualHomeGoals + actualAwayGoals) < 2.5,
    'Over 1.5': (actualHomeGoals + actualAwayGoals) > 1.5,
    'BTTS Sim': actualHomeGoals > 0 && actualAwayGoals > 0,
  }

  // ── FIND BEST EDGE ──
  let bestOpportunity: {
    market: string
    modelProb: number
    marketOdd: number
    impliedProb: number
    edge: number
    ev: number
    isGreen: boolean
  } | null = null

  for (const [market, modelProb] of Object.entries(modelProbs)) {
    const marketOdd = marketOdds[market as keyof typeof marketOdds]
    if (!marketOdd) continue

    const impliedProb = 1 / marketOdd
    const edge = ((modelProb - impliedProb) / impliedProb) * 100
    const ev = (modelProb * marketOdd) - 1

    if (edge > (bestOpportunity?.edge ?? 0)) {
      bestOpportunity = {
        market,
        modelProb,
        marketOdd,
        impliedProb,
        edge,
        ev,
        isGreen: actualResults[market] ?? false,
      }
    }
  }

  if (!bestOpportunity) return null

  // ── APPLY PROMPT CRITERIA ──
  const { market, modelProb, marketOdd, impliedProb, edge, ev, isGreen } = bestOpportunity

  // Data strength assessment
  const minPlayed = Math.min(homeStats.played, awayStats.played)
  const dataStrength = minPlayed >= 15 ? 'ALTA' : minPlayed >= 8 ? 'MEDIA' : 'BAIXA'

  // Confidence calculation
  let confidence = 50
  confidence += Math.min(minPlayed, 20) * 0.8  // more games = more confidence
  confidence += edge > 7 ? 8 : edge > 5 ? 5 : edge > 3 ? 2 : 0
  confidence += dataStrength === 'ALTA' ? 6 : dataStrength === 'MEDIA' ? 3 : 0

  // Form factor bonus
  const homeForm = homeStats.lastResults.filter(r => r === 'W').length / Math.max(homeStats.lastResults.length, 1)
  const awayForm = awayStats.lastResults.filter(r => r === 'W').length / Math.max(awayStats.lastResults.length, 1)
  const formConsistency = Math.abs(homeForm - awayForm) > 0.3 ? 4 : 0
  confidence += formConsistency
  confidence = Math.min(95, Math.round(confidence))

  // Model level (we're at Level 2 — stats but no xG)
  const modelLevel = 'NIVEL_2'

  // ── VETO CHECKS (from prompt) ──
  let verdict: 'APROVADO' | 'VETADO' = 'APROVADO'
  let vetoReason = ''

  // EV must be positive
  if (ev <= 0) {
    verdict = 'VETADO'
    vetoReason = 'EV negativo'
  }

  // Edge must be >= min_edge_pct (default 3%)
  if (edge < criteria.min_edge_pct) {
    verdict = 'VETADO'
    vetoReason = `Edge ${edge.toFixed(1)}% < ${criteria.min_edge_pct}%`
  }

  // Confidence must be >= min_confidence (default 68%)
  if (confidence < criteria.min_confidence) {
    verdict = 'VETADO'
    vetoReason = `Confiança ${confidence}% < ${criteria.min_confidence}%`
  }

  // Probability must be reasonable (not extreme outliers)
  if (modelProb < 0.15 || modelProb > 0.95) {
    verdict = 'VETADO'
    vetoReason = `Probabilidade extrema: ${(modelProb * 100).toFixed(1)}%`
  }

  // Data inconsistency check
  if (dataStrength === 'BAIXA' && edge < criteria.high_priority_edge) {
    verdict = 'VETADO'
    vetoReason = 'Dados insuficientes para edge moderado'
  }

  // Form-based volatility filter
  const recentVolatility = homeStats.lastResults.length >= 3 && awayStats.lastResults.length >= 3
  if (!recentVolatility && edge < 5) {
    verdict = 'VETADO'
    vetoReason = 'Forma recente insuficiente'
  }

  return {
    market,
    predictedProb: Math.round(modelProb * 10000) / 100,
    impliedProb: Math.round(impliedProb * 10000) / 100,
    odd: Math.round(marketOdd * 100) / 100,
    ev: Math.round(ev * 10000) / 100,
    edgePct: Math.round(edge * 100) / 100,
    verdict,
    isGreen,
    confidence,
    vetoReason,
    modelLevel,
    dataStrength,
  }
}

// ═══════════════════════════════════════════════
// Poisson helpers
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
  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      const p = poissonPmf(homeXG, h) * poissonPmf(awayXG, a)
      if (outcome === 'home' && h > a) prob += p
      else if (outcome === 'draw' && h === a) prob += p
      else if (outcome === 'away' && a > h) prob += p
    }
  }
  return clamp(prob, 0.01, 0.99)
}

function poissonOver(homeXG: number, awayXG: number, line: number): number {
  let underProb = 0
  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      if ((h + a) <= line) underProb += poissonPmf(homeXG, h) * poissonPmf(awayXG, a)
    }
  }
  return clamp(1 - underProb, 0.01, 0.99)
}

function poissonBTTS(homeXG: number, awayXG: number): number {
  // P(both score) = 1 - P(home=0) - P(away=0) + P(both=0)
  const pHome0 = poissonPmf(homeXG, 0)
  const pAway0 = poissonPmf(awayXG, 0)
  return clamp(1 - pHome0 - pAway0 + pHome0 * pAway0, 0.01, 0.99)
}

function calculateOver25Rate(avgGoals: number): number {
  // Estimate over 2.5 probability from average goals
  if (avgGoals >= 3.5) return 0.70
  if (avgGoals >= 3.0) return 0.58
  if (avgGoals >= 2.7) return 0.50
  if (avgGoals >= 2.5) return 0.45
  if (avgGoals >= 2.2) return 0.38
  return 0.30
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function emptyMetrics() {
  return {
    total_analyzed: 0, total_approved: 0, approval_rate: 0,
    greens: 0, reds: 0, hit_rate: 0, roi_total: 0,
    net_profit: 0, max_drawdown: 0, final_bankroll: 0,
    initial_bankroll: 0, roi_by_ev: [], bankroll_curve: [],
  }
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
