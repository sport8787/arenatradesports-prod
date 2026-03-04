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
  stake_amount: number
  profit_loss: number
  veto_reason?: string
  model_level: string
  confidence: number
  data_strength: string
  tier: string | null
}

// ═══════════════════════════════════════════════
// CRITERIA PARSER — reads prompt_mycroft_punter.txt dynamically
// ═══════════════════════════════════════════════

interface TierConfig {
  min_edge: number
  min_confidence: number
  stake_pct: number
  label: string
}

interface AnalysisCriteria {
  tiers: TierConfig[]
  min_edge_pct: number
  min_confidence: number
  min_ev: number
  max_approval_pct: number
  min_approval_pct: number
  min_sample_games: number
  veto_small_sample: boolean
}

function defaultCriteria(): AnalysisCriteria {
  return {
    tiers: [
      { min_edge: 5, min_confidence: 75, stake_pct: 4.5, label: 'TIER_1' },
      { min_edge: 3, min_confidence: 65, stake_pct: 3, label: 'TIER_2' },
      { min_edge: 2, min_confidence: 58, stake_pct: 2, label: 'TIER_3' },
    ],
    min_edge_pct: 2,
    min_confidence: 58,
    min_ev: 0,
    max_approval_pct: 70,
    min_approval_pct: 50,
    min_sample_games: 3,
    veto_small_sample: false,
  }
}

function parseCriteriaFromPrompt(promptText: string): AnalysisCriteria {
  const c = defaultCriteria()
  try {
    const tierBlocks = promptText.match(/TIER\s*\d[\s\S]*?Stake:\s*[\d.]+/gi) || []
    const parsedTiers: TierConfig[] = []
    
    for (const block of tierBlocks) {
      const edgeM = block.match(/Edge\s*≥\s*(\d+)%/i)
      const confM = block.match(/Confian[çc]a\s*≥\s*(\d+)%/i)
      const stakeM = block.match(/Stake:\s*([\d.]+)(?:-([\d.]+))?%/i)
      const tierM = block.match(/TIER\s*(\d)/i)
      
      if (edgeM && confM && stakeM && tierM) {
        const stakeLow = parseFloat(stakeM[1])
        const stakeHigh = stakeM[2] ? parseFloat(stakeM[2]) : stakeLow
        parsedTiers.push({
          min_edge: parseInt(edgeM[1]),
          min_confidence: parseInt(confM[1]),
          stake_pct: (stakeLow + stakeHigh) / 2,
          label: `TIER_${tierM[1]}`,
        })
      }
    }

    if (parsedTiers.length > 0) {
      parsedTiers.sort((a, b) => b.min_edge - a.min_edge)
      c.tiers = parsedTiers
      const lowestTier = parsedTiers[parsedTiers.length - 1]
      c.min_edge_pct = lowestTier.min_edge
      c.min_confidence = lowestTier.min_confidence
    }

    if (parsedTiers.length === 0) {
      const edgeFallback = promptText.match(/Edge\s*≥\s*(\d+)%/i)
      if (edgeFallback) c.min_edge_pct = parseInt(edgeFallback[1])
      const confFallback = promptText.match(/Confian[çc]a\s*≥\s*(\d+)%/i)
      if (confFallback) c.min_confidence = parseInt(confFallback[1])
    }

    const approvalMatch = promptText.match(/(\d+)-(\d+)%\s*aprova[çc][ãa]o/i)
      || promptText.match(/META.*?Aprovar\s*(\d+)-(\d+)%/i)
    if (approvalMatch) {
      c.min_approval_pct = parseInt(approvalMatch[1])
      c.max_approval_pct = parseInt(approvalMatch[2])
    }

    if (promptText.match(/NÃO vetar por/i) && promptText.match(/amostra pequena/i)) {
      c.veto_small_sample = false
      c.min_sample_games = 2
    }

    console.log('[Backtest] Critérios parseados:', JSON.stringify(c))
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

    const { data: storageData } = await supabase.storage
      .from('sports-knowledge-base')
      .download('prompt_mycroft_punter.txt')

    if (storageData) {
      const text = await storageData.text()
      console.log('[Backtest] Usando prompt_mycroft_punter.txt do storage')
      return parseCriteriaFromPrompt(text)
    }
  } catch (e) {
    console.log('[Backtest] Storage não disponível, usando defaults')
  }

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
      initial_bankroll = 10000,
    } = body

    const criteria = await loadPromptCriteria()

    const leagueKeys: string[] = leaguesInput && Array.isArray(leaguesInput) && leaguesInput.length > 0
      ? leaguesInput
      : [league || 'soccer_brazil_campeonato']

    const validLeagues = leagueKeys.map(k => ({ key: k, info: LEAGUE_MAP[k] })).filter(l => l.info)
    if (validLeagues.length === 0) throw new Error('Nenhuma liga válida selecionada')

    const leagueNames = validLeagues.map(l => l.info.name).join(', ')
    console.log(`[Backtest] Ligas: ${leagueNames} | Temporada: ${season}`)
    console.log(`[Backtest] Critérios: edge≥${criteria.min_edge_pct}%, confiança≥${criteria.min_confidence}%`)

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

    // 2. Calculate league-wide averages
    const leagueAvg = calculateLeagueAverages(allFixtures)
    console.log(`[Backtest] Média da liga: ${leagueAvg.avgGoals.toFixed(2)} gols/jogo`)

    // 3. Simulate game by game (NO LOOKAHEAD)
    const teamStats: Record<string, TeamCumulativeStats> = {}
    const results: BacktestResult[] = []
    let bankroll = initial_bankroll
    let maxBankroll = initial_bankroll
    let maxDrawdown = 0
    let totalActualStaked = 0

    for (const fixture of allFixtures) {
      const homeTeam = fixture.teams.home.name
      const awayTeam = fixture.teams.away.name
      const homeGoals = fixture.goals.home ?? 0
      const awayGoals = fixture.goals.away ?? 0
      const fixtureDate = fixture.fixture.date

      const homeStats = teamStats[homeTeam]
      const awayStats = teamStats[awayTeam]

      if (homeStats && awayStats && homeStats.played >= criteria.min_sample_games && awayStats.played >= criteria.min_sample_games) {
        const analysis = analyzeWithCriteria(
          homeTeam, awayTeam, homeStats, awayStats,
          homeGoals, awayGoals, leagueAvg, criteria
        )

        if (analysis) {
          // Calculate actual stake from CURRENT bankroll
          const stakeAmount = bankroll * (analysis.stakePct / 100)

          let profitLoss = 0
          if (analysis.verdict === 'APROVADO') {
            totalActualStaked += stakeAmount
            profitLoss = analysis.isGreen
              ? stakeAmount * (analysis.odd - 1)
              : -stakeAmount
            bankroll += profitLoss
            
            // Prevent bankroll going below zero (bust)
            if (bankroll <= 0) {
              bankroll = 0
              // Stop simulation - bankroll busted
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
                result: analysis.isGreen ? 'green' : 'red',
                stake_pct: analysis.stakePct,
                stake_amount: Math.round(stakeAmount * 100) / 100,
                profit_loss: Math.round(profitLoss * 100) / 100,
                model_level: analysis.modelLevel,
                confidence: analysis.confidence,
                data_strength: analysis.dataStrength,
                tier: analysis.tier,
              })
              break
            }
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
            stake_pct: analysis.verdict === 'APROVADO' ? analysis.stakePct : 0,
            stake_amount: analysis.verdict === 'APROVADO' ? Math.round(stakeAmount * 100) / 100 : 0,
            profit_loss: Math.round(profitLoss * 100) / 100,
            veto_reason: analysis.vetoReason,
            model_level: analysis.modelLevel,
            confidence: analysis.confidence,
            data_strength: analysis.dataStrength,
            tier: analysis.tier,
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
    const totalPL = bankroll - initial_bankroll
    // ROI = profit / total amount actually staked
    const roi = totalActualStaked > 0 ? (totalPL / totalActualStaked) * 100 : 0

    const approvalRate = results.length > 0 ? (approved.length / results.length * 100) : 0
    console.log(`[Backtest] Taxa de aprovação: ${approvalRate.toFixed(1)}% (target: ${criteria.min_approval_pct}-${criteria.max_approval_pct}%)`)

    // ROI by tier
    const tierBreakdown = criteria.tiers.map(tier => {
      const inTier = approved.filter(r => r.tier === tier.label)
      const tierGreens = inTier.filter(r => r.result === 'green').length
      const tierPL = inTier.reduce((s, r) => s + r.profit_loss, 0)
      const tierStaked = inTier.reduce((s, r) => s + r.stake_amount, 0)
      return {
        tier: tier.label,
        count: inTier.length,
        greens: tierGreens,
        reds: inTier.length - tierGreens,
        hit_rate: inTier.length > 0 ? Math.round(tierGreens / inTier.length * 100 * 100) / 100 : 0,
        roi: tierStaked > 0 ? Math.round(tierPL / tierStaked * 100 * 100) / 100 : 0,
        profit_loss: Math.round(tierPL * 100) / 100,
      }
    }).filter(t => t.count > 0)

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
      total_staked: Math.round(totalActualStaked * 100) / 100,
      max_drawdown: Math.round(maxDrawdown * 100) / 100,
      final_bankroll: Math.round(bankroll * 100) / 100,
      initial_bankroll,
      tier_breakdown: tierBreakdown,
      bankroll_curve: bankrollCurve,
      criteria_used: {
        min_edge: criteria.min_edge_pct,
        min_confidence: criteria.min_confidence,
        min_sample: criteria.min_sample_games,
        target_approval: `${criteria.min_approval_pct}-${criteria.max_approval_pct}%`,
      },
    }

    console.log(`[Backtest] CONCLUÍDO: ${results.length} analisados, ${approved.length} aprovados (${approvalRate.toFixed(1)}%), ${greens.length}G/${reds.length}R, ROI: ${roi.toFixed(2)}%, Banca: R$ ${bankroll.toFixed(2)}`)

    return jsonResponse({
      success: true,
      league: leagueNames,
      season,
      metrics,
      results: approved.slice(0, 500), // limit response size
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
// League averages
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
// ANALYSIS ENGINE — Realistic market simulation
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
  tier: string | null
  stakePct: number
}

/**
 * KEY FIX: Both model and market now use team-specific data,
 * but with different methodologies (Poisson vs ELO-like ratings).
 * Edge only appears when Poisson genuinely disagrees with ratings-based market.
 */
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
  const homeAttack = homeStats.goalsScored / homeStats.played
  const homeDefense = homeStats.goalsConceded / homeStats.played
  const awayAttack = awayStats.goalsScored / awayStats.played
  const awayDefense = awayStats.goalsConceded / awayStats.played

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

  // ── MARKET: Ratings-based approach (simulates Pinnacle/sharp market) ──
  // Uses TEAM-SPECIFIC data too, but via a different methodology:
  // Weighted blend of overall win rate + home/away specific rates + regression to league mean
  // This means both model and market see the same data but interpret differently
  
  const homeOverallWR = homeStats.wins / homeStats.played
  const homeHomeWR = homeStats.homePlayed > 2 ? homeStats.homeWins / homeStats.homePlayed : homeOverallWR
  const awayOverallWR = awayStats.wins / awayStats.played
  const awayAwayWR = awayStats.awayPlayed > 2 ? awayStats.awayWins / awayStats.awayPlayed : awayOverallWR
  
  // Market uses heavier regression to league mean (sharp markets are efficient)
  const regressionWeight = Math.max(0.3, 1 - Math.min(homeStats.played, awayStats.played) / 30)
  
  // Home win probability (market view): team-specific with heavy regression
  const rawMarketHome = (homeHomeWR * 0.5 + homeOverallWR * 0.2 + (1 - awayOverallWR) * 0.3)
  const marketHomeWin = clamp(rawMarketHome * (1 - regressionWeight) + leagueAvg.homeWinRate * regressionWeight, 0.10, 0.85)
  
  const rawMarketAway = (awayAwayWR * 0.5 + awayOverallWR * 0.2 + (1 - homeOverallWR) * 0.3)
  const marketAwayWin = clamp(rawMarketAway * (1 - regressionWeight) + leagueAvg.awayWinRate * regressionWeight, 0.05, 0.75)
  
  const marketDraw = clamp(1 - marketHomeWin - marketAwayWin, 0.15, 0.35)
  
  // Normalize to sum = 1
  const totalMarket = marketHomeWin + marketDraw + marketAwayWin
  const normHome = marketHomeWin / totalMarket
  const normDraw = marketDraw / totalMarket
  const normAway = marketAwayWin / totalMarket

  // Over/Under market: use team goal rates with regression
  const teamBasedGoalRate = (homeAttack + awayAttack + homeDefense + awayDefense) / 2 // weighted avg
  const marketGoalExpectation = teamBasedGoalRate * (1 - regressionWeight) + leagueAvg.avgGoals * regressionWeight
  const marketOver25 = clamp(poissonOver(marketGoalExpectation * 0.52, marketGoalExpectation * 0.48, 2.5), 0.25, 0.75)
  const marketUnder25 = 1 - marketOver25
  const marketOver15 = clamp(poissonOver(marketGoalExpectation * 0.52, marketGoalExpectation * 0.48, 1.5), 0.50, 0.92)
  const marketBTTS = clamp(1 - poissonPmf(marketGoalExpectation * 0.52, 0) - poissonPmf(marketGoalExpectation * 0.48, 0) + poissonPmf(marketGoalExpectation * 0.52, 0) * poissonPmf(marketGoalExpectation * 0.48, 0), 0.25, 0.75)

  // Apply bookmaker margin (5-8% overround) — sharp market
  const margin = 1.05
  const marketOdds: Record<string, number> = {
    'Casa': margin / normHome,
    'Empate': margin / normDraw,
    'Fora': margin / normAway,
    'Over 2.5': margin / marketOver25,
    'Under 2.5': margin / marketUnder25,
    'Over 1.5': margin / marketOver15,
    'BTTS Sim': margin / marketBTTS,
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

  // ── FIND BEST EDGE (model prob vs sharp market implied prob) ──
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
    const marketOdd = marketOdds[market]
    if (!marketOdd || marketOdd > 20 || marketOdd < 1.05) continue // sanity

    const impliedProb = 1 / marketOdd
    // Edge = how much our model probability exceeds the sharp market probability
    const edge = ((modelProb - impliedProb) / impliedProb) * 100
    const ev = (modelProb * marketOdd) - 1

    if (ev > 0 && edge > (bestOpportunity?.edge ?? 0)) {
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

  const { market, modelProb, marketOdd, impliedProb, edge, ev, isGreen } = bestOpportunity

  // Data strength
  const minPlayed = Math.min(homeStats.played, awayStats.played)
  const dataStrength = minPlayed >= 15 ? 'ALTA' : minPlayed >= 8 ? 'MEDIA' : 'BAIXA'

  // Confidence calculation per prompt tiers
  let confidence: number
  if (dataStrength === 'ALTA') confidence = 70
  else if (dataStrength === 'MEDIA') confidence = 65
  else confidence = 60

  // Edge bonuses (per prompt)
  if (edge > 10) confidence += 15
  else if (edge > 7) confidence += 10
  else if (edge > 5) confidence += 5

  // Multiple data points bonus
  if (minPlayed >= 10) confidence += 5
  
  confidence = Math.min(95, Math.round(confidence))

  const modelLevel = 'NIVEL_2'

  // ── APPLY TIER CRITERIA ──
  let verdict: 'APROVADO' | 'VETADO' = 'VETADO'
  let vetoReason = ''
  let matchedTier: string | null = null
  let tierStake = 2

  if (ev <= 0) {
    vetoReason = 'EV negativo'
  } else if (edge < criteria.min_edge_pct) {
    vetoReason = `Edge ${edge.toFixed(1)}% < ${criteria.min_edge_pct}%`
  } else if (confidence < criteria.min_confidence) {
    vetoReason = `Confiança ${confidence}% < ${criteria.min_confidence}%`
  } else {
    // Find matching tier (highest first)
    for (const tier of criteria.tiers) {
      if (edge >= tier.min_edge && confidence >= tier.min_confidence) {
        matchedTier = tier.label
        tierStake = tier.stake_pct
        verdict = 'APROVADO'
        break
      }
    }
    // Fallback to lowest tier
    if (verdict === 'VETADO' && edge >= criteria.min_edge_pct && confidence >= criteria.min_confidence) {
      const lowestTier = criteria.tiers[criteria.tiers.length - 1]
      matchedTier = lowestTier.label
      tierStake = lowestTier.stake_pct
      verdict = 'APROVADO'
    }
    if (verdict === 'VETADO') {
      vetoReason = 'Não atingiu critérios mínimos'
    }
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
    tier: matchedTier,
    stakePct: tierStake,
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
  const pHome0 = poissonPmf(homeXG, 0)
  const pAway0 = poissonPmf(awayXG, 0)
  return clamp(1 - pHome0 - pAway0 + pHome0 * pAway0, 0.01, 0.99)
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function emptyMetrics() {
  return {
    total_analyzed: 0, total_approved: 0, approval_rate: 0,
    greens: 0, reds: 0, hit_rate: 0, roi_total: 0,
    net_profit: 0, max_drawdown: 0, final_bankroll: 0,
    initial_bankroll: 0, tier_breakdown: [], bankroll_curve: [],
  }
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
