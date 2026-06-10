import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Markets supported by the backtest engine
const AH_LINES = [-1.5, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1] as const
const AH_HOME_MARKETS = AH_LINES.map(l => `AH Casa ${l > 0 ? '+' : ''}${l}`)
const AH_AWAY_MARKETS = AH_LINES.map(l => `AH Fora ${l > 0 ? '+' : ''}${l}`)
const ALL_MARKETS = [
  'Casa', 'Empate', 'Fora',
  'Over 2.5', 'Under 2.5', 'Over 1.5', 'BTTS Sim',
  ...AH_HOME_MARKETS,
  ...AH_AWAY_MARKETS,
] as const
type MarketKey = typeof ALL_MARKETS[number]

// Asian Handicap settlement multiplier on stake at odd O:
// returns 1 (full win), 0.5 (half win), 0 (push), -0.5 (half loss), -1 (full loss)
function settleAH(side: 'home' | 'away', line: number, homeGoals: number, awayGoals: number): number {
  const diff = side === 'home' ? (homeGoals - awayGoals) : (awayGoals - homeGoals)
  const adjusted = diff + line
  // Quarter lines split between two adjacent half-lines
  const isQuarter = Math.abs(line * 4) % 2 === 1
  if (isQuarter) {
    const lower = Math.floor(line * 2) / 2
    const upper = Math.ceil(line * 2) / 2
    return (settleAH(side, lower, homeGoals, awayGoals) + settleAH(side, upper, homeGoals, awayGoals)) / 2
  }
  // Half lines: never push
  if ((line * 2) % 2 !== 0) {
    return adjusted > 0 ? 1 : -1
  }
  // Whole lines: push allowed
  if (adjusted > 0) return 1
  if (adjusted === 0) return 0
  return -1
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LeagueDefinition {
  id: number
  name: string
  aliases: string[]
}

const LEAGUE_MAP: Record<string, LeagueDefinition> = {
  'soccer_brazil_campeonato': {
    id: 71,
    name: 'Brasileirão Série A',
    aliases: ['brasileirão série a', 'brasileirao serie a', 'campeonato brasileiro serie a', 'brazil serie a', 'serie a brazil', 'serie a brasil']
  },
  'soccer_brazil_serie_b': {
    id: 72,
    name: 'Brasileirão Série B',
    aliases: ['brasileirão série b', 'brasileirao serie b', 'campeonato brasileiro serie b', 'brazil serie b', 'serie b brazil', 'serie b brasil']
  },
  'soccer_brazil_campeonato_paulista': { id: 475, name: 'Paulistão', aliases: ['paulistão', 'paulistao', 'campeonato paulista'] },
  'soccer_brazil_campeonato_carioca': { id: 476, name: 'Carioca', aliases: ['carioca', 'campeonato carioca'] },
  'soccer_brazil_campeonato_mineiro': { id: 477, name: 'Mineiro', aliases: ['mineiro', 'campeonato mineiro'] },
  'soccer_brazil_campeonato_gaucho': { id: 478, name: 'Gaúcho', aliases: ['gaúcho', 'gaucho', 'campeonato gaúcho', 'campeonato gaucho'] },
  'soccer_brazil_campeonato_baiano': { id: 479, name: 'Baiano', aliases: ['baiano', 'campeonato baiano'] },
  'soccer_brazil_campeonato_paranaense': { id: 480, name: 'Paranaense', aliases: ['paranaense', 'campeonato paranaense'] },
  'soccer_brazil_campeonato_catarinense': { id: 481, name: 'Catarinense', aliases: ['catarinense', 'campeonato catarinense'] },
  'soccer_brazil_campeonato_pernambucano': { id: 604, name: 'Pernambucano', aliases: ['pernambucano', 'campeonato pernambucano'] },
  'soccer_epl': { id: 39, name: 'Premier League', aliases: ['premier league', 'english premier league', 'england premier league'] },
  'soccer_spain_la_liga': { id: 140, name: 'La Liga', aliases: ['la liga', 'laliga', 'spain la liga', 'primera division'] },
  'soccer_italy_serie_a': { id: 135, name: 'Serie A', aliases: ['serie a', 'italy serie a', 'italian serie a', 'serie a italy', 'serie a italia', 'serie a tim'] },
  'soccer_germany_bundesliga': { id: 78, name: 'Bundesliga', aliases: ['bundesliga', 'germany bundesliga'] },
  'soccer_france_ligue_one': { id: 61, name: 'Ligue 1', aliases: ['ligue 1', 'france ligue 1', 'ligue one'] },
  'soccer_argentina_primera_division': { id: 128, name: 'Argentina Primera', aliases: ['argentina primera', 'liga profesional argentina', 'primera division argentina'] },
  'soccer_conmebol_copa_libertadores': { id: 13, name: 'Copa Libertadores', aliases: ['copa libertadores', 'libertadores', 'conmebol libertadores'] },
  'soccer_conmebol_copa_sudamericana': { id: 11, name: 'Copa Sudamericana', aliases: ['copa sudamericana', 'sudamericana', 'conmebol sudamericana'] },
  'soccer_uefa_champs_league': { id: 2, name: 'Champions League', aliases: ['champions league', 'uefa champions league'] },
  'soccer_uefa_europa_league': { id: 3, name: 'Europa League', aliases: ['europa league', 'uefa europa league'] },
  'soccer_uefa_europa_conference_league': { id: 848, name: 'Conference League', aliases: ['conference league', 'uefa europa conference league'] },
  'soccer_portugal_primeira_liga': { id: 94, name: 'Primeira Liga', aliases: ['primeira liga', 'portugal primeira liga', 'liga portugal'] },
  'soccer_netherlands_eredivisie': { id: 88, name: 'Eredivisie', aliases: ['eredivisie', 'netherlands eredivisie', 'holland eredivisie'] },
  'soccer_belgium_first_div': { id: 144, name: 'Belgium Pro League', aliases: ['belgium pro league', 'jupiler pro league', 'belgium first division a'] },
  'soccer_turkey_super_league': { id: 203, name: 'Süper Lig', aliases: ['super lig', 'süper lig', 'turkey super lig'] },
  'soccer_usa_mls': { id: 253, name: 'MLS', aliases: ['mls', 'major league soccer', 'usa mls'] },
  'soccer_mexico_ligamx': { id: 262, name: 'Liga MX', aliases: ['liga mx', 'mexico liga mx', 'liga mx mexico'] },
  'soccer_saudi_pro_league': { id: 307, name: 'Saudi Pro League', aliases: ['saudi pro league', 'saudi arabia pro league'] },
  'soccer_brazil_serie_c': { id: 75, name: 'Brasileirão Série C', aliases: ['brasileirão série c', 'brasileirao serie c', 'brazil serie c'] },
  'soccer_brazil_copa_do_brasil': { id: 73, name: 'Copa do Brasil', aliases: ['copa do brasil', 'brazil copa do brasil'] },
  'soccer_fifa_world_cup': { id: 1, name: 'Copa do Mundo', aliases: ['fifa world cup', 'world cup', 'copa do mundo'] },
  'soccer_conmebol_copa_america': { id: 9, name: 'Copa América', aliases: ['copa america', 'copa américa', 'conmebol copa america'] },
  'soccer_uefa_european_championship': { id: 4, name: 'Eurocopa', aliases: ['euro', 'eurocopa', 'uefa european championship', 'european championship'] },
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
  league_name: string
  market: string
  predicted_prob: number
  implied_prob: number
  odd: number
  ev: number
  value_pct: number
  verdict: 'APROVADO' | 'VETADO'
  result: 'green' | 'red' | 'push' | 'half_green' | 'half_red' | null
  stake_pct: number
  stake_amount: number
  profit_loss: number
  veto_reason?: string
  model_level: string
  confidence: number
  data_strength: string
  tier: string | null
  used_real_odd?: boolean
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
  // Aligned with punter_calibration production values (2026-06-09 calibration)
  return {
    tiers: [
      { min_edge: 7, min_confidence: 78, stake_pct: 5.0, label: 'TIER_1' },
      { min_edge: 5, min_confidence: 70, stake_pct: 3.5, label: 'TIER_2' },
      { min_edge: 4, min_confidence: 65, stake_pct: 2.5, label: 'TIER_3' },
    ],
    min_edge_pct: 4,       // production CALIB.min_edge = 4
    min_confidence: 65,    // production CALIB.min_confidence = 65
    min_ev: 0,
    max_approval_pct: 70,
    min_approval_pct: 15,  // production targets 15-25% approval
    min_sample_games: 6,   // raised from 3 — need minimum context for reliable Poisson
    veto_small_sample: true,
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

    // PRIMARY: punter_calibration table (same source as live mycroft-punter-analysis)
    // This ensures backtest uses IDENTICAL thresholds as production.
    const { data: calibRow } = await supabase
      .from('punter_calibration')
      .select('*')
      .eq('is_active', true)
      .maybeSingle()

    if (calibRow) {
      const c = defaultCriteria()
      c.min_edge_pct       = Number(calibRow.min_edge)
      c.min_confidence     = Number(calibRow.min_confidence)
      c.tiers = [
        { min_edge: +calibRow.tier1_min_edge, min_confidence: +calibRow.tier1_min_conf, stake_pct: +calibRow.tier1_max_stake, label: 'TIER_1' },
        { min_edge: +calibRow.tier2_min_edge, min_confidence: +calibRow.tier2_min_conf, stake_pct: +calibRow.tier2_max_stake, label: 'TIER_2' },
        { min_edge: +calibRow.tier3_min_edge, min_confidence: +calibRow.tier3_min_conf, stake_pct: +calibRow.tier3_max_stake, label: 'TIER_3' },
      ]
      console.log('[Backtest] ✅ Critérios carregados de punter_calibration:', JSON.stringify({ min_edge: c.min_edge_pct, min_conf: c.min_confidence }))
      return c
    }
  } catch (e) {
    console.warn('[Backtest] punter_calibration não disponível:', (e as Error).message)
  }

  // SECONDARY: prompt storage file (legacy)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: storageData } = await supabase.storage
      .from('sports-knowledge-base')
      .download('prompt_mycroft_punter.txt')
    if (storageData) {
      const text = await storageData.text()
      console.log('[Backtest] Usando prompt_mycroft_punter.txt do storage (fallback)')
      return parseCriteriaFromPrompt(text)
    }
  } catch (e) {
    console.log('[Backtest] Storage não disponível')
  }

  console.log('[Backtest] Usando defaults de produção calibrados')
  return defaultCriteria()
}

// ═══════════════════════════════════════════════
// MONTE CARLO SIMULATION
// ═══════════════════════════════════════════════

interface MonteCarloResult {
  simulations: number
  ruin_risk_pct: number
  drawdown_avg: number
  drawdown_max: number
  roi_min: number
  roi_avg: number
  roi_max: number
  roi_p5: number
  roi_p25: number
  roi_p50: number
  roi_p75: number
  roi_p95: number
  final_bankroll_avg: number
  final_bankroll_p5: number
  final_bankroll_p95: number
}

function runMonteCarlo(
  approvedBets: { odd: number; stakePct: number; isGreen: boolean }[],
  initialBankroll: number,
  numSimulations: number = 10000,
  maxStakeAmount: number = 50000
): MonteCarloResult {
  if (approvedBets.length === 0) {
    return {
      simulations: 0, ruin_risk_pct: 0, drawdown_avg: 0, drawdown_max: 0,
      roi_min: 0, roi_avg: 0, roi_max: 0,
      roi_p5: 0, roi_p25: 0, roi_p50: 0, roi_p75: 0, roi_p95: 0,
      final_bankroll_avg: initialBankroll, final_bankroll_p5: initialBankroll, final_bankroll_p95: initialBankroll,
    }
  }

  const rois: number[] = []
  const maxDrawdowns: number[] = []
  let ruinCount = 0

  for (let sim = 0; sim < numSimulations; sim++) {
    // Shuffle the bets (Fisher-Yates)
    const shuffled = [...approvedBets]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    let bankroll = initialBankroll
    let maxBankroll = initialBankroll
    let maxDD = 0
    let busted = false

    for (const bet of shuffled) {
      const rawStake = bankroll * (bet.stakePct / 100)
      const stake = Math.min(rawStake, maxStakeAmount) // Cap at bookmaker limit
      if (bet.isGreen) {
        bankroll += stake * (bet.odd - 1)
      } else {
        bankroll -= stake
      }

      if (bankroll <= 0) {
        busted = true
        bankroll = 0
        break
      }

      if (bankroll > maxBankroll) maxBankroll = bankroll
      const dd = ((maxBankroll - bankroll) / maxBankroll) * 100
      if (dd > maxDD) maxDD = dd
    }

    if (busted) ruinCount++
    const roi = ((bankroll - initialBankroll) / initialBankroll) * 100
    rois.push(roi)
    maxDrawdowns.push(maxDD)
  }

  // Sort for percentiles
  rois.sort((a, b) => a - b)
  maxDrawdowns.sort((a, b) => a - b)

  const percentile = (arr: number[], p: number) => {
    const idx = Math.floor(arr.length * p / 100)
    return arr[Math.min(idx, arr.length - 1)]
  }

  const avgRoi = rois.reduce((s, v) => s + v, 0) / rois.length
  const avgDD = maxDrawdowns.reduce((s, v) => s + v, 0) / maxDrawdowns.length

  return {
    simulations: numSimulations,
    ruin_risk_pct: round2((ruinCount / numSimulations) * 100),
    drawdown_avg: round2(avgDD),
    drawdown_max: round2(percentile(maxDrawdowns, 99)),
    roi_min: round2(rois[0]),
    roi_avg: round2(avgRoi),
    roi_max: round2(rois[rois.length - 1]),
    roi_p5: round2(percentile(rois, 5)),
    roi_p25: round2(percentile(rois, 25)),
    roi_p50: round2(percentile(rois, 50)),
    roi_p75: round2(percentile(rois, 75)),
    roi_p95: round2(percentile(rois, 95)),
    final_bankroll_avg: round2(initialBankroll * (1 + avgRoi / 100)),
    final_bankroll_p5: round2(initialBankroll * (1 + percentile(rois, 5) / 100)),
    final_bankroll_p95: round2(initialBankroll * (1 + percentile(rois, 95) / 100)),
  }
}

// ═══════════════════════════════════════════════
// GROWTH PROJECTIONS
// ═══════════════════════════════════════════════

interface GrowthProjection {
  days: number
  label: string
  bankroll_conservative: number
  bankroll_expected: number
  bankroll_optimistic: number
}

function calculateGrowthProjections(
  approvedCount: number,
  totalDays: number,
  winRate: number, // 0-100
  avgOdd: number,
  avgStakePct: number, // e.g. 2.5
  initialBankroll: number,
  maxStakeAmount: number = 50000
): GrowthProjection[] {
  if (approvedCount === 0 || totalDays === 0) return []

  const betsPerDay = approvedCount / Math.max(totalDays, 1)
  const p = winRate / 100

  const periods = [
    { days: 30,  label: '30 dias' },
    { days: 60,  label: '60 dias' },
    { days: 90,  label: '3 meses' },
    { days: 180, label: '6 meses' },
    { days: 365, label: '1 ano' },
  ]

  // Stochastic projection: simulate N paths with random bet outcomes.
  // Variance is modeled properly — NOT deterministic EV-per-bet.
  // Conservative = P25 percentile, Expected = P50, Optimistic = P75.
  function projectStochastic(days: number, scenarioP: number, percentile: number): number {
    const numBets = Math.round(betsPerDay * days)
    if (numBets === 0) return round2(initialBankroll)

    const N_SIMS = 2000  // Fast enough for edge function
    const finals: number[] = []

    for (let sim = 0; sim < N_SIMS; sim++) {
      let bankroll = initialBankroll
      for (let i = 0; i < numBets; i++) {
        const rawStake = bankroll * (avgStakePct / 100)
        const stake = Math.min(rawStake, maxStakeAmount)
        const isWin = Math.random() < scenarioP
        if (isWin) bankroll += stake * (avgOdd - 1)
        else bankroll -= stake
        if (bankroll <= 0) { bankroll = 0; break }
      }
      finals.push(bankroll)
    }

    finals.sort((a, b) => a - b)
    const idx = Math.floor(finals.length * percentile / 100)
    return round2(finals[Math.min(idx, finals.length - 1)])
  }

  // Conservative: P25 at observed win rate (realistic downside)
  // Expected: P50 at observed win rate (median outcome)
  // Optimistic: P75 at observed win rate (upside scenario)
  return periods.map(period => ({
    days: period.days,
    label: period.label,
    bankroll_conservative: projectStochastic(period.days, p, 25),
    bankroll_expected:     projectStochastic(period.days, p, 50),
    bankroll_optimistic:   projectStochastic(period.days, p, 75),
  }))
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Backtest usa API-Football APENAS como último fallback histórico (não afeta análise live)
    const apiKey = Deno.env.get('API_FOOTBALL_KEY') ?? Deno.env.get('API_FOOTBALL_KEY_BACKUP') ?? ''

    const body = await req.json()

    // ── Diagnostic endpoint ──────────────────────────────────────────────
    if (body.__diag_odds_api) {
      const diagKey = Deno.env.get('THE_ODDS_API_KEY') ?? Deno.env.get('THE_ODDS_API') ?? ''
      const diagResults: Record<string, any> = { key_present: !!diagKey, key_length: diagKey.length }
      // Test 1: list sports (0 credits)
      try {
        const r = await fetch(`https://api.the-odds-api.com/v4/sports?apiKey=${diagKey}`)
        diagResults.sports_status = r.status
        const j = await r.json()
        diagResults.sports_count = Array.isArray(j) ? j.length : 'not array'
        const epl = Array.isArray(j) ? j.find((s: any) => s.key === 'soccer_epl') : null
        diagResults.soccer_epl_found = !!epl
      } catch (e) { diagResults.sports_error = (e as Error).message }
      // Test 2: recent historical odds for a known past date (1 API call)
      const testDate = '2025-10-01T12:00:00Z'
      try {
        const url = `https://api.the-odds-api.com/v4/historical/sports/soccer_epl/odds?apiKey=${diagKey}&date=${testDate}&regions=eu&markets=h2h&oddsFormat=decimal`
        const r = await fetch(url)
        diagResults.hist_epl_status = r.status
        if (r.ok) {
          const j = await r.json()
          diagResults.hist_epl_events = (j?.data || []).length
          diagResults.hist_epl_timestamp = j?.timestamp
        } else {
          diagResults.hist_epl_body = (await r.text()).slice(0, 200)
        }
      } catch (e) { diagResults.hist_epl_error = (e as Error).message }
      // Test 3: simulate matching one EPL fixture to The Odds API response
      if (diagResults.hist_epl_events > 0 && diagResults.hist_epl_status === 200) {
        try {
          const testUrl = `https://api.the-odds-api.com/v4/historical/sports/soccer_epl/odds?apiKey=${diagKey}&date=2025-10-01T12:00:00Z&regions=eu&markets=h2h&oddsFormat=decimal`
          const r2 = await fetch(testUrl)
          const j2 = await r2.json()
          const events = j2?.data || []
          diagResults.sample_event = events[0] ? { home: events[0].home_team, away: events[0].away_team, bkm_count: events[0].bookmakers?.length } : null
        } catch (e) { diagResults.sample_event_err = (e as Error).message }
      }
      return jsonResponse({ success: true, diag: diagResults })
    }
    // ─────────────────────────────────────────────────────────────────────

    const {
      league,
      leagues: leaguesInput,
      season = new Date().getFullYear() - 1,
      initial_bankroll = 10000,
      monte_carlo_sims = 10000,
      use_historical = true,
      max_stake_amount = 50000,
      markets: marketsInput,
      data_source = 'auto', // 'auto' | 'arena_matches' | 'sportmonks' | 'futodds' | 'api_football'
    } = body

    // Normalize markets filter: default = all
    const allowedMarkets: Set<string> = new Set(
      Array.isArray(marketsInput) && marketsInput.length > 0
        ? marketsInput.filter((m: string) => (ALL_MARKETS as readonly string[]).includes(m))
        : ALL_MARKETS
    )
    if (allowedMarkets.size === 0) ALL_MARKETS.forEach(m => allowedMarkets.add(m))

    const criteria = await loadPromptCriteria()

    const leagueKeys: string[] = leaguesInput && Array.isArray(leaguesInput) && leaguesInput.length > 0
      ? leaguesInput
      : [league || 'soccer_brazil_campeonato']

    const validLeagues = leagueKeys.map(k => ({ key: k, info: LEAGUE_MAP[k] })).filter(l => l.info)
    if (validLeagues.length === 0) throw new Error('Nenhuma liga válida selecionada')

    const leagueNames = validLeagues.map(l => l.info.name).join(', ')
    const leagueNameSet = new Set(validLeagues.map(l => l.info.name))
    console.log(`[Backtest] Ligas: ${leagueNames} | Temporada: ${season} | Fonte: ${data_source} | Mercados: ${Array.from(allowedMarkets).join(',')}`)
    console.log(`[Backtest] Critérios: edge≥${criteria.min_edge_pct}%, confiança≥${criteria.min_confidence}%`)

    // 1. Try to load from arena_matches first (historical DB), then fallback to API
    const allFixtures: any[] = []
    const fixtureLeagueMap: Map<number, string> = new Map()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const dbClient = createClient(supabaseUrl, supabaseKey)

    let usedSource = 'none'

    const tryArenaMatches = data_source === 'auto' || data_source === 'arena_matches'
    const trySportmonks = data_source === 'auto' || data_source === 'sportmonks'
    const tryFutodds = data_source === 'auto' || data_source === 'futodds'
    const tryApiFootball = data_source === 'auto' || data_source === 'api_football'

    // Track which leagues already have fixtures so subsequent providers
    // only fill the GAPS (não tudo-ou-nada baseado em contagem total).
    const leaguesWithData = new Set<string>()

    if (use_historical && tryArenaMatches) {
      for (const l of validLeagues) {
        const seasonStr = `${season}/${season + 1}`
        const { data: dbMatches } = await dbClient
          .from('arena_matches')
          .select('*')
          .eq('league', l.info.name)
          .or(`season.eq.${seasonStr},season.eq.${season}`)
          .not('score_home', 'is', null)
          .order('match_date', { ascending: true })
          .limit(1000)

        if (dbMatches && dbMatches.length > 10) {
          console.log(`[Backtest] arena_matches: ${dbMatches.length} jogos para ${l.info.name}`)
          usedSource = 'arena_matches'
          leaguesWithData.add(l.info.name)
          for (const m of dbMatches) {
            const fixtureId = parseInt(m.match_id.replace(/\D/g, '').slice(0, 8)) || Math.random() * 1000000
            const converted = {
              fixture: { id: fixtureId, date: m.match_date },
              teams: { home: { name: m.home_team }, away: { name: m.away_team } },
              goals: { home: m.score_home, away: m.score_away },
              league: { round: m.season || '' },
              _stats: {
                xg_home: m.xg_home, xg_away: m.xg_away,
                shots_home: m.shots_home, shots_away: m.shots_away,
                possession_home: m.possession_home, possession_away: m.possession_away,
                corners_home: m.corners_home, corners_away: m.corners_away,
              }
            }
            fixtureLeagueMap.set(fixtureId, l.info.name)
            allFixtures.push(converted)
          }
        }
      }
    }

    // Sportmonks — PER LEAGUE, preenche apenas ligas SEM dados ainda
    let smCacheHits = 0
    let smCacheMisses = 0
    if (trySportmonks && Deno.env.get('SPORTMONKS_API_KEY')) {
      for (const l of validLeagues) {
        if (leaguesWithData.has(l.info.name)) continue
        try {
          const { fixtures: smFixtures, fromCache } = await fetchHistoricalFromSportmonksCached(
            l.key, season, l.info.name, l.info.id, dbClient
          )
          if (smFixtures.length > 0) {
            if (usedSource === 'none') usedSource = 'sportmonks'
            else if (usedSource !== 'sportmonks') usedSource = 'mixed'
            if (fromCache) smCacheHits++; else smCacheMisses++
            leaguesWithData.add(l.info.name)
            for (const f of smFixtures) {
              fixtureLeagueMap.set(f.fixture.id, f._leagueName || l.info.name)
              allFixtures.push(f)
            }
            console.log(`[Backtest] Sportmonks ${l.info.name}: ${smFixtures.length} jogos (${fromCache ? 'CACHE' : 'API'})`)
          } else {
            console.warn(`[Backtest] Sportmonks ${l.info.name}: 0 jogos (provável limitação de plano) — tentará Futodds`)
          }
        } catch (e) {
          console.warn(`[Backtest] Sportmonks ${l.info.name} falhou:`, (e as Error).message)
        }
      }
      console.log(`[Backtest] Sportmonks fixtures: cache hits=${smCacheHits}, API fetches=${smCacheMisses}`)
    }

    // Futodds — preenche ligas que ainda não têm dados (ex.: Europeias fora do plano Sportmonks)
    if (tryFutodds && Deno.env.get('FUTODDS_API_KEY')) {
        const missingLeagues = validLeagues.filter(l => !leaguesWithData.has(l.info.name))
        if (missingLeagues.length > 0) {
          const missingKeys = new Set(missingLeagues.map(l => l.key))
          console.log(`[Backtest] Futodds: tentando preencher ${missingLeagues.length} ligas faltantes (${missingLeagues.map(l => l.info.name).join(', ')})`)
        try {
            const fdFixtures = await fetchHistoricalFromFutodds(season, missingKeys)
          if (fdFixtures.length > 0) {
            if (usedSource === 'none') usedSource = 'futodds'
            else if (usedSource !== 'futodds') usedSource = 'mixed'
            const perLeague: Record<string, number> = {}
            for (const f of fdFixtures) {
              fixtureLeagueMap.set(f.fixture.id, f._leagueName)
              allFixtures.push(f)
              leaguesWithData.add(f._leagueName)
              perLeague[f._leagueName] = (perLeague[f._leagueName] || 0) + 1
            }
            console.log(`[Backtest] Futodds: ${fdFixtures.length} jogos — ${JSON.stringify(perLeague)}`)
          }
        } catch (e) {
          console.warn('[Backtest] Futodds falhou:', (e as Error).message)
        }
      }
    }

    // Fallback API-Football (last resort, por liga faltante)
    if (tryApiFootball && apiKey) {
      const missingLeagues = validLeagues.filter(l => !leaguesWithData.has(l.info.name))
      for (const l of missingLeagues) {
        const fixtures = await fetchSeasonFixtures(l.info.id, season, apiKey)
        console.log(`[Backtest] API-Football ${l.info.name}: ${fixtures.length} jogos`)
        for (const f of fixtures) {
          fixtureLeagueMap.set(f.fixture.id, l.info.name)
        }
        allFixtures.push(...fixtures)
        if (fixtures.length > 0) {
          leaguesWithData.add(l.info.name)
          if (usedSource === 'none') usedSource = 'api_football'
          else if (usedSource !== 'api_football') usedSource = 'mixed'
        }
        if (missingLeagues.length > 1) await new Promise(r => setTimeout(r, 300))
      }
    }

    const missingFinal = validLeagues.filter(l => !leaguesWithData.has(l.info.name)).map(l => l.info.name)
    if (missingFinal.length > 0) {
      console.warn(`[Backtest] ⚠️ Sem dados históricos para: ${missingFinal.join(', ')}`)
    }

    console.log(`[Backtest] Total: ${allFixtures.length} jogos (fonte: ${usedSource})`)

    if (allFixtures.length === 0) {
      return jsonResponse({ success: true, results: [], metrics: emptyMetrics(), monte_carlo: null, growth_projections: [], league: leagueNames, season })
    }

    // Sort by date ascending
    allFixtures.sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime())

    // 2. League-wide running stats — INCREMENTAL (NO LOOKAHEAD).
    // leagueAvg is now built game-by-game and only contains data from PAST games.
    // The full-season pre-computed average is kept only for logging.
    const fullSeasonAvg = calculateLeagueAverages(allFixtures)
    console.log(`[Backtest] Média da liga (season completa): ${fullSeasonAvg.avgGoals.toFixed(2)} gols/jogo`)

    // Running stats updated inside the loop (each game sees only previous games' avg)
    let runningGoals = 0, runningHomeWins = 0, runningDraws = 0, runningAwayWins = 0
    let runningHomeGoals = 0, runningAwayGoals = 0, runningCount = 0

    const getRunningLeagueAvg = (): LeagueAverages => {
      const n = Math.max(runningCount, 1)
      return {
        avgGoals: runningGoals / n,
        homeWinRate: runningHomeWins / n,
        drawRate: runningDraws / n,
        awayWinRate: runningAwayWins / n,
        avgHomeGoals: runningHomeGoals / n,
        avgAwayGoals: runningAwayGoals / n,
      }
    }

    // 2b. Pre-fetch REAL pre-match odds.
    // Priority: Sportmonks (when source=sportmonks) → The Odds API historical (always attempted when key present)
    let realOddsByFixture: Map<number, Record<string, number>> = new Map()

    if (usedSource === 'sportmonks' && Deno.env.get('SPORTMONKS_API_KEY')) {
      const ids = allFixtures.map((f: any) => Number(f.fixture.id)).filter((n: number) => Number.isFinite(n))
      console.log(`[Backtest] Buscando odds reais pré-jogo para ${ids.length} fixtures (Sportmonks)...`)
      realOddsByFixture = await fetchSportmonksOddsBatch(ids, dbClient)
      const withOdds = Array.from(realOddsByFixture.values()).filter(o => Object.keys(o).length > 0).length
      console.log(`[Backtest] Sportmonks odds: ${withOdds}/${ids.length} fixtures cobertas`)
    }

    // The Odds API — enriquece odds faltantes (ou todas, quando fonte=api_football)
    const oddsApiKey = Deno.env.get('THE_ODDS_API_KEY') ?? Deno.env.get('THE_ODDS_API') ?? ''
    if (oddsApiKey) {
      const missingFixtures = allFixtures.filter((f: any) => {
        const id = Number(f.fixture.id)
        return !realOddsByFixture.has(id) || Object.keys(realOddsByFixture.get(id)!).length === 0
      })
      if (missingFixtures.length > 0) {
        console.log(`[Backtest] The Odds API: buscando odds para ${missingFixtures.length} fixtures sem cobertura...`)
        const oddsApiResult = await fetchOddsApiHistorical(
          missingFixtures, validLeagues, dbClient, oddsApiKey
        )
        let enriched = 0
        for (const [id, odds] of oddsApiResult.entries()) {
          if (id === '__debug' as any) continue
          if (Object.keys(odds).length > 0) {
            realOddsByFixture.set(id, odds)
            enriched++
          }
        }
        console.log(`[Backtest] The Odds API: ${enriched}/${missingFixtures.length} fixtures enriquecidas com odds reais`)
      }
    }

    const totalWithOdds = Array.from(realOddsByFixture.values()).filter(o => Object.keys(o).length > 0).length
    console.log(`[Backtest] Odds reais totais: ${totalWithOdds}/${allFixtures.length} fixtures cobertas`)
    if (totalWithOdds === 0) {
      console.log(`[Backtest] Nenhuma odds real disponível — usando odds sintéticas (ROI estimado)`)
    }

    // 3. Simulate game by game (NO LOOKAHEAD)
    // Both teamStats and runningLeagueStats are updated AFTER each game's analysis.
    const teamStats: Record<string, TeamCumulativeStats> = {}
    const rawAnalyses: {
      fixture: any
      analysis: AnalysisResult
      homeGoals: number
      awayGoals: number
      leagueName: string
    }[] = []

    for (const fixture of allFixtures) {
      const homeTeam = fixture.teams.home.name
      const awayTeam = fixture.teams.away.name
      const homeGoals = fixture.goals.home ?? 0
      const awayGoals = fixture.goals.away ?? 0

      const homeStats = teamStats[homeTeam]
      const awayStats = teamStats[awayTeam]

      // Require at least 10 running league games for calibration to be meaningful
      if (
        homeStats && awayStats &&
        homeStats.played >= criteria.min_sample_games &&
        awayStats.played >= criteria.min_sample_games &&
        runningCount >= 10
      ) {
        const fixRealOdds = realOddsByFixture.get(Number(fixture.fixture.id)) || {}
        // Pass running league avg (no lookahead — only past games)
        const analysis = analyzeWithCriteria(
          homeTeam, awayTeam, homeStats, awayStats,
          homeGoals, awayGoals, getRunningLeagueAvg(), criteria, allowedMarkets, fixRealOdds
        )

        if (analysis) {
          rawAnalyses.push({
            fixture, analysis, homeGoals, awayGoals,
            leagueName: fixtureLeagueMap.get(fixture.fixture.id) || 'Unknown',
          })
        }
      }

      // Update BOTH team stats AND league running avg AFTER analysis (no-lookahead)
      updateTeamStats(teamStats, homeTeam, homeGoals, awayGoals, true)
      updateTeamStats(teamStats, awayTeam, awayGoals, homeGoals, false)
      // Update running league stats
      runningGoals       += homeGoals + awayGoals
      runningHomeGoals   += homeGoals
      runningAwayGoals   += awayGoals
      if (homeGoals > awayGoals) runningHomeWins++
      else if (homeGoals === awayGoals) runningDraws++
      else runningAwayWins++
      runningCount++
    }

    // Phase 2: Enforce max approval rate
    const maxApprovalRate = criteria.max_approval_pct / 100
    const approvedRaw = rawAnalyses.filter(r => r.analysis.verdict === 'APROVADO')
    const maxApproved = Math.floor(rawAnalyses.length * maxApprovalRate)

    if (approvedRaw.length > maxApproved) {
      approvedRaw.sort((a, b) => b.analysis.edgePct - a.analysis.edgePct)
      for (let i = maxApproved; i < approvedRaw.length; i++) {
        approvedRaw[i].analysis.verdict = 'VETADO'
        approvedRaw[i].analysis.vetoReason = `Edge ${approvedRaw[i].analysis.edgePct.toFixed(1)}% abaixo do corte (limite ${maxApprovalRate * 100}% aprovação)`
        approvedRaw[i].analysis.tier = null
      }
      console.log(`[Backtest] Enforcement: cortou de ${approvedRaw.length} para ${maxApproved} aprovações`)
    }

    // Phase 3: Simulate bankroll in chronological order
    const results: BacktestResult[] = []
    let bankroll = initial_bankroll
    let maxBankroll = initial_bankroll
    let maxDrawdown = 0
    let totalActualStaked = 0

    // Track for Monte Carlo
    const mcBets: { odd: number; stakePct: number; isGreen: boolean }[] = []

    // Bankroll curve tracked DURING simulation (not rebuilt post-hoc)
    // This ensures compound staking is reflected accurately.
    const bankrollCurveLive: { index: number; bankroll: number; date: string }[] = [
      { index: 0, bankroll: initial_bankroll, date: '' }
    ]
    let approvedBetIndex = 0

    for (const { fixture, analysis, homeGoals, awayGoals, leagueName } of rawAnalyses) {
      const fixtureDate = fixture.fixture.date

      // Stake is a % of CURRENT bankroll (compound staking)
      const stakeAmount = Math.min(bankroll * (analysis.stakePct / 100), max_stake_amount)

      let profitLoss = 0
      if (analysis.verdict === 'APROVADO') {
        totalActualStaked += stakeAmount
        const m = analysis.settlementMultiplier
        // m=1 full win, 0.5 half win, 0 push, -0.5 half loss, -1 full loss
        if (m > 0)      profitLoss = stakeAmount * m * (analysis.odd - 1)
        else if (m === 0) profitLoss = 0
        else            profitLoss = stakeAmount * m // negative

        bankroll += profitLoss
        approvedBetIndex++

        // Track curve with ACTUAL bankroll at this point
        bankrollCurveLive.push({
          index: approvedBetIndex,
          bankroll: round2(bankroll),
          date: fixtureDate ? fixtureDate.split('T')[0] : '',
        })

        // Track for Monte Carlo
        mcBets.push({ odd: analysis.odd, stakePct: analysis.stakePct, isGreen: m > 0 })

        if (bankroll <= 0) {
          bankroll = 0
          results.push(buildResult(fixture, analysis, homeGoals, awayGoals, leagueName, stakeAmount, profitLoss))
          break
        }
      }

      if (bankroll > maxBankroll) maxBankroll = bankroll
      const currentDrawdown = ((maxBankroll - bankroll) / maxBankroll) * 100
      if (currentDrawdown > maxDrawdown) maxDrawdown = currentDrawdown

      results.push(buildResult(fixture, analysis, homeGoals, awayGoals, leagueName, stakeAmount, profitLoss))
    }

    // 4. Calculate metrics
    const approved = results.filter(r => r.verdict === 'APROVADO')
    const greens = approved.filter(r => ['green','half_green'].includes(r.result as string))
    const reds = approved.filter(r => ['red','half_red'].includes(r.result as string))
    const totalPL = bankroll - initial_bankroll
    const roi = totalActualStaked > 0 ? (totalPL / totalActualStaked) * 100 : 0
    const approvalRate = results.length > 0 ? (approved.length / results.length * 100) : 0

    // ROI by tier
    const tierBreakdown = criteria.tiers.map(tier => {
      const inTier = approved.filter(r => r.tier === tier.label)
      const tierGreens = inTier.filter(r => ['green','half_green'].includes(r.result as string)).length
      const tierPL = inTier.reduce((s, r) => s + r.profit_loss, 0)
      const tierStaked = inTier.reduce((s, r) => s + r.stake_amount, 0)
      return {
        tier: tier.label,
        count: inTier.length,
        greens: tierGreens,
        reds: inTier.length - tierGreens,
        hit_rate: inTier.length > 0 ? round2(tierGreens / inTier.length * 100) : 0,
        roi: tierStaked > 0 ? round2(tierPL / tierStaked * 100) : 0,
        profit_loss: round2(tierPL),
      }
    }).filter(t => t.count > 0)

    // ROI by odd range
    const oddRanges = [
      { label: '1.00-1.50', min: 1.0, max: 1.5 },
      { label: '1.50-2.00', min: 1.5, max: 2.0 },
      { label: '2.00-3.00', min: 2.0, max: 3.0 },
      { label: '3.00+', min: 3.0, max: 100 },
    ]
    const roiByOddRange = oddRanges.map(range => {
      const inRange = approved.filter(r => r.odd >= range.min && r.odd < range.max)
      const rangeGreens = inRange.filter(r => ['green','half_green'].includes(r.result as string)).length
      const rangePL = inRange.reduce((s, r) => s + r.profit_loss, 0)
      const rangeStaked = inRange.reduce((s, r) => s + r.stake_amount, 0)
      return {
        range: range.label,
        count: inRange.length,
        greens: rangeGreens,
        reds: inRange.length - rangeGreens,
        hit_rate: inRange.length > 0 ? round2(rangeGreens / inRange.length * 100) : 0,
        roi: rangeStaked > 0 ? round2(rangePL / rangeStaked * 100) : 0,
        avg_odd: inRange.length > 0 ? round2(inRange.reduce((s, r) => s + r.odd, 0) / inRange.length) : 0,
      }
    }).filter(r => r.count > 0)

    // ROI by league
    const leagueSet = new Set(approved.map(r => r.league_name))
    const roiByLeague = Array.from(leagueSet).map(ln => {
      const inLeague = approved.filter(r => r.league_name === ln)
      const lGreens = inLeague.filter(r => ['green','half_green'].includes(r.result as string)).length
      const lPL = inLeague.reduce((s, r) => s + r.profit_loss, 0)
      const lStaked = inLeague.reduce((s, r) => s + r.stake_amount, 0)
      return {
        league: ln,
        count: inLeague.length,
        greens: lGreens,
        reds: inLeague.length - lGreens,
        hit_rate: inLeague.length > 0 ? round2(lGreens / inLeague.length * 100) : 0,
        roi: lStaked > 0 ? round2(lPL / lStaked * 100) : 0,
        profit_loss: round2(lPL),
      }
    })

    // Bankroll curve: use the one built during the live simulation (compound staking accurate)
    const bankrollCurve = bankrollCurveLive

    // 5. Monte Carlo
    console.log(`[Backtest] Iniciando Monte Carlo com ${mcBets.length} apostas e ${monte_carlo_sims} simulações...`)
    const mcResult = runMonteCarlo(mcBets, initial_bankroll, monte_carlo_sims, max_stake_amount)
    console.log(`[Backtest] Monte Carlo: Ruína ${mcResult.ruin_risk_pct}%, ROI médio ${mcResult.roi_avg}%, DD médio ${mcResult.drawdown_avg}%`)

    // 6. Growth projections
    const firstDate = new Date(allFixtures[0]?.fixture?.date || Date.now())
    const lastDate = new Date(allFixtures[allFixtures.length - 1]?.fixture?.date || Date.now())
    const totalDays = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)))
    const hitRate = approved.length > 0 ? greens.length / approved.length * 100 : 50
    const avgOddVal = approved.length > 0 ? approved.reduce((s, r) => s + r.odd, 0) / approved.length : 2.0
    const avgStakePctVal = totalActualStaked > 0 && approved.length > 0 ? (totalActualStaked / approved.length) / initial_bankroll * 100 : 2.5
    const growthProjections = calculateGrowthProjections(approved.length, totalDays, hitRate, avgOddVal, Math.min(avgStakePctVal, 5), initial_bankroll, max_stake_amount)

    const metrics = {
      total_analyzed: results.length,
      total_approved: approved.length,
      approval_rate: round2(approvalRate),
      greens: greens.length,
      reds: reds.length,
      hit_rate: approved.length > 0 ? round2(greens.length / approved.length * 100) : 0,
      roi_total: round2(roi),
      yield_pct: totalActualStaked > 0 ? round2(totalPL / totalActualStaked * 100) : 0,
      net_profit: round2(totalPL),
      total_staked: round2(totalActualStaked),
      max_drawdown: round2(maxDrawdown),
      final_bankroll: round2(bankroll),
      initial_bankroll,
      avg_odd: approved.length > 0 ? round2(approved.reduce((s, r) => s + r.odd, 0) / approved.length) : 0,
      bets_per_day: totalDays > 0 ? round2(approved.length / totalDays) : 0,
      total_days: totalDays,
      tier_breakdown: tierBreakdown,
      roi_by_odd_range: roiByOddRange,
      roi_by_league: roiByLeague,
      bankroll_curve: bankrollCurve,
      criteria_used: {
        min_edge: criteria.min_edge_pct,
        min_confidence: criteria.min_confidence,
        min_sample: criteria.min_sample_games,
        target_approval: `${criteria.min_approval_pct}-${criteria.max_approval_pct}%`,
      },
      real_odds_coverage_pct: approved.length > 0
        ? round2(approved.filter(r => r.used_real_odd).length / approved.length * 100)
        : 0,
      real_odds_used_count: approved.filter(r => r.used_real_odd).length,
    }

    console.log(`[Backtest] CONCLUÍDO: ${results.length} analisados, ${approved.length} aprovados (${approvalRate.toFixed(1)}%), ${greens.length}G/${reds.length}R, ROI: ${roi.toFixed(2)}%, Banca: R$ ${bankroll.toFixed(2)}`)

    // Synthetic odds warning: when < 30% of approved bets used real market odds,
    // edge calculations are circular (model odds vs same model odds = fabricated edge).
    const realCoveragePct = metrics.real_odds_coverage_pct ?? 0
    const syntheticOddsWarning = realCoveragePct < 30
      ? `⚠️ ATENÇÃO: Apenas ${realCoveragePct.toFixed(0)}% das apostas aprovadas usaram odds reais de mercado. ` +
        `O edge calculado é majoritariamente sintético (modelo vs. próprio modelo), ` +
        `o que pode inflar artificialmente o ROI. Interprete os resultados com cautela.`
      : null

    return jsonResponse({
      success: true,
      league: leagueNames,
      season,
      metrics,
      monte_carlo: mcResult,
      growth_projections: growthProjections,
      results: approved.slice(0, 500),
      total_fixtures: allFixtures.length,
      data_source: usedSource,
      markets_used: Array.from(allowedMarkets),
      synthetic_odds_warning: syntheticOddsWarning,
      real_odds_api_coverage: { fixtures_with_odds: totalWithOdds, total_fixtures: allFixtures.length },
    })

  } catch (error) {
    console.error('[Backtest] ERRO:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

function buildResult(
  fixture: any, analysis: AnalysisResult,
  homeGoals: number, awayGoals: number,
  leagueName: string,
  stakeAmount: number, profitLoss: number
): BacktestResult {
  return {
    fixture_id: fixture.fixture.id,
    date: fixture.fixture.date,
    round: fixture.league.round || '',
    home_team: fixture.teams.home.name,
    away_team: fixture.teams.away.name,
    home_goals: homeGoals,
    away_goals: awayGoals,
    league_name: leagueName,
    market: analysis.market,
    predicted_prob: analysis.predictedProb,
    implied_prob: analysis.impliedProb,
    odd: analysis.odd,
    ev: analysis.ev,
    value_pct: analysis.edgePct,
    verdict: analysis.verdict,
    result: analysis.verdict === 'APROVADO'
      ? (analysis.settlementMultiplier === 1 ? 'green'
        : analysis.settlementMultiplier === 0.5 ? 'half_green'
        : analysis.settlementMultiplier === 0 ? 'push'
        : analysis.settlementMultiplier === -0.5 ? 'half_red'
        : 'red')
      : null,
    stake_pct: analysis.verdict === 'APROVADO' ? analysis.stakePct : 0,
    stake_amount: analysis.verdict === 'APROVADO' ? round2(stakeAmount) : 0,
    profit_loss: round2(profitLoss),
    veto_reason: analysis.vetoReason,
    model_level: analysis.modelLevel,
    confidence: analysis.confidence,
    data_strength: analysis.dataStrength,
    tier: analysis.tier,
    used_real_odd: analysis.usedRealOdd,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

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
// SPORTMONKS — historical fixtures by date iteration
// ═══════════════════════════════════════════════

function smNorm(n: string): string {
  return (n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, ' ')
}

function resolveLeagueKeyFromName(leagueName: string): string | null {
  const target = smNorm(leagueName)
  for (const [key, info] of Object.entries(LEAGUE_MAP)) {
    const names = [info.name, ...info.aliases]
    for (const candidate of names) {
      const normalized = smNorm(candidate)
      if (target === normalized || target.includes(normalized) || normalized.includes(target)) {
        return key
      }
    }
  }
  return null
}

function leagueMatches(leagueName: string, allowedLeagueKeys: Set<string>): string | null {
  const matchedKey = resolveLeagueKeyFromName(leagueName)
  if (!matchedKey) return null
  return allowedLeagueKeys.has(matchedKey) ? matchedKey : null
}

function* dateRangeOfSeason(season: number): Generator<string> {
  // Brazilian leagues: Jan-Dec; European seasons: Aug season -> Jul season+1.
  // To cover both, iterate Jan(season) -> Dec(season+1), capped at today.
  const start = new Date(`${season}-01-01T00:00:00Z`)
  const end = new Date(Math.min(new Date(`${season + 1}-12-31T00:00:00Z`).getTime(), Date.now()))
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10)
  }
}

/**
 * Fetches all FT fixtures of a (league, season) from Sportmonks.
 * Uses `sportmonks_fixtures_cache` to skip API completely on subsequent runs.
 * Returns { fixtures, fromCache } so callers can report cache usage.
 */
async function fetchHistoricalFromSportmonksCached(
  leagueKey: string,
  season: number,
  leagueName: string,
  afId: number,
  dbClient: any,
): Promise<{ fixtures: any[]; fromCache: boolean }> {
  const TOKEN = Deno.env.get('SPORTMONKS_API_KEY')
  if (!TOKEN) return { fixtures: [], fromCache: false }

  // 1) Cache hit? (incremental: completamos gap se existir)
  let cachedFixtures: any[] = []
  let hadCache = false
  try {
    const { data: cached } = await dbClient
      .from('sportmonks_fixtures_cache')
      .select('fixtures, is_complete, fetched_at')
      .eq('league_key', leagueKey)
      .eq('season', season)
      .maybeSingle()
    if (cached && Array.isArray(cached.fixtures) && cached.fixtures.length > 0) {
      cachedFixtures = cached.fixtures.filter((fixture: any) => {
        const providerLeagueName = fixture?.league?.name
        if (!providerLeagueName) return true
        return resolveLeagueKeyFromName(providerLeagueName) === leagueKey
      })
      hadCache = true
      console.log(`[Backtest][SM-Cache] HIT ${leagueKey}/${season}: ${cachedFixtures.length} fixtures (cached em ${cached.fetched_at})`)
    }
  } catch (e) {
    console.warn('[Backtest][SM-Cache] read failed:', (e as Error).message)
  }

  // 1b) Resolver sportmonks_id via league_id_map (af_id → sm_id)
  let smId: number | null = null
  try {
    const { data: mapRow } = await dbClient
      .from('league_id_map')
      .select('sportmonks_id')
      .eq('api_football_id', afId)
      .maybeSingle()
    if (mapRow?.sportmonks_id) smId = Number(mapRow.sportmonks_id)
  } catch (e) {
    console.warn('[Backtest][SM-Cache] league_id_map lookup failed:', (e as Error).message)
  }
  if (!smId) {
    if (hadCache) {
      console.warn(`[Backtest][SM-Cache] sem sportmonks_id para ${leagueName} (af=${afId}) — devolvendo cache existente`)
      return { fixtures: cachedFixtures, fromCache: true }
    }
    console.warn(`[Backtest][SM-Cache] sem sportmonks_id para ${leagueName} (af=${afId}) — pulando`)
    return { fixtures: [], fromCache: false }
  }

  // 2) Calcular janela incremental. Se já há cache, busca apenas do último
  // dia do cache até hoje (mesmo dia para pegar jogos que terminaram após).
  const seasonEnd = new Date(Math.min(new Date(`${season + 1}-12-31T00:00:00Z`).getTime(), Date.now()))
  const toYmd = seasonEnd.toISOString().slice(0, 10)
  let fromYmd: string
  if (hadCache) {
    const lastTs = cachedFixtures.reduce((mx: number, f: any) => {
      const t = new Date(f?.fixture?.date || 0).getTime()
      return isFinite(t) && t > mx ? t : mx
    }, 0)
    const fromDate = lastTs > 0 ? new Date(lastTs) : new Date(`${season}-01-01T00:00:00Z`)
    fromYmd = fromDate.toISOString().slice(0, 10)
    if (fromYmd > toYmd) {
      console.log(`[Backtest][SM-Cache] ${leagueKey}/${season}: cache já cobre ${fromYmd} ≥ ${toYmd}`)
      return { fixtures: cachedFixtures, fromCache: true }
    }
    console.log(`[Backtest][SM-Cache] ${leagueKey}/${season}: incremental ${fromYmd} → ${toYmd}`)
  } else {
    fromYmd = `${season}-01-01`
    console.log(`[Backtest][SM-Cache] MISS ${leagueKey}/${season}: full scan ${fromYmd} → ${toYmd}`)
  }

  // 3) Buscar via /fixtures/between/{from}/{to} paginado
  const fetched: any[] = []
  let page = 1
  const MAX_PAGES = 50
  while (page <= MAX_PAGES) {
    const url = `https://api.sportmonks.com/v3/football/fixtures/between/${fromYmd}/${toYmd}` +
      `?api_token=${TOKEN}&include=scores;participants;state;league` +
      `&filters=fixtureLeagues:${smId}&per_page=100&page=${page}`
    let json: any
    try {
      const res = await fetch(url)
      if (!res.ok) {
        console.warn(`[Backtest][SM-Cache] HTTP ${res.status} page=${page} league=${smId}`)
        break
      }
      json = await res.json()
    } catch (e) {
      console.warn(`[Backtest][SM-Cache] fetch fail page=${page}:`, (e as Error).message)
      break
    }
    const data: any[] = json?.data || []
    if (page === 1) {
      console.log(`[Backtest][SM-Cache] ${leagueKey}/${season} page1: ${data.length} items, subscription=${JSON.stringify(json?.subscription)?.slice(0,100)}`)
      if (data.length > 0) console.log(`[Backtest][SM-Cache] sample fixture keys: ${Object.keys(data[0]).join(',')}`)
    }
    let skippedState = 0, skippedScore = 0
    for (const f of data) {
      // Accept any finished-match state code
      const stateName = (f.state?.short_name || f.state?.name || f.state?.state || '').toUpperCase()
      const isFinished = /^(FT|AET|PEN|FT_PEN|AWARDED|FINISHED|AFTER_ET|AFTER_PEN|AP|COMPLETE)/.test(stateName)
      if (!isFinished) { skippedState++; continue }
      const providerLeagueId = Number(f.league?.id)
      const providerLeagueName = String(f.league?.name || '')
      if (Number.isFinite(providerLeagueId) && providerLeagueId !== smId) continue
      if (!Number.isFinite(providerLeagueId) && providerLeagueName && resolveLeagueKeyFromName(providerLeagueName) !== leagueKey) continue
      const participants = f.participants || []
      const home = participants.find((p: any) => p.meta?.location === 'home') || participants[0]
      const away = participants.find((p: any) => p.meta?.location === 'away') || participants[1]
      if (!home || !away) continue
      const scores = f.scores || []
      let gh: number | null = null, ga: number | null = null
      // Try multiple description patterns that Sportmonks uses
      const priorities = ['CURRENT', 'FT', '2ND_HALF', 'FULLTIME', 'REGULAR']
      for (const prio of priorities) {
        if (gh !== null && ga !== null) break
        for (const s of scores) {
          const desc = String(s.description || s.type?.code || '').toUpperCase()
          if (desc !== prio) continue
          if (s.score?.participant === 'home' && gh === null) gh = Number(s.score.goals ?? s.score.total)
          if (s.score?.participant === 'away' && ga === null) ga = Number(s.score.goals ?? s.score.total)
        }
      }
      // Also try home_score/away_score direct fields (some SM plans return these)
      if (gh === null && f.scores == null) {
        gh = f.home_score ?? f.score_home ?? null
        ga = f.away_score ?? f.score_away ?? null
      }
      if (gh === null || ga === null || !Number.isFinite(gh) || !Number.isFinite(ga)) { skippedScore++; continue }
      fetched.push({
        fixture: { id: f.id, date: f.starting_at || `${fromYmd}T00:00:00Z` },
        teams: { home: { name: home.name }, away: { name: away.name } },
        goals: { home: gh, away: ga },
        league: { id: providerLeagueId, name: providerLeagueName, round: '' },
        _leagueName: leagueName,
      })
    }
    if (skippedState + skippedScore > 0) {
      console.log(`[Backtest][SM-Cache] ${leagueKey} page${page}: ${fetched.length} ok, ${skippedState} skipped(state), ${skippedScore} skipped(score)`)
    }
    const hasMore = json?.pagination?.has_more ?? (data.length === 100)
    if (!hasMore) break
    page++
  }

  // 4) Merge dedup por fixture.id
  const merged = cachedFixtures.slice()
  const seen = new Set(merged.map((f: any) => Number(f?.fixture?.id)).filter(Number.isFinite))
  let added = 0
  for (const nf of fetched) {
    const id = Number(nf?.fixture?.id)
    if (!Number.isFinite(id) || seen.has(id)) continue
    seen.add(id)
    merged.push(nf)
    added++
  }
  console.log(`[Backtest][SM-Cache] ${leagueKey}/${season}: +${added} novos (total ${merged.length})`)

  // 5) Persistir somente se houver mudança E o resultado não for vazio
  // (evita travar caches em 0 para ligas fora do plano Sportmonks)
  if ((added > 0 || !hadCache) && merged.length > 0) {
    try {
      await dbClient.from('sportmonks_fixtures_cache').upsert({
        league_key: leagueKey,
        season,
        league_name: leagueName,
        fixtures: merged,
        fixture_count: merged.length,
        is_complete: true,
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'league_key,season' })
      console.log(`[Backtest][SM-Cache] SAVED ${leagueKey}/${season}: ${merged.length} fixtures`)
    } catch (e) {
      console.warn('[Backtest][SM-Cache] save failed:', (e as Error).message)
    }
  } else if (merged.length === 0) {
    console.warn(`[Backtest][SM-Cache] ${leagueKey}/${season}: 0 fixtures (não salvando cache vazio — Sportmonks pode não cobrir essa liga)`)
  }

  return { fixtures: merged, fromCache: hadCache && added === 0 }
}

// ═══════════════════════════════════════════════
// FUTODDS — /matches-ended by date iteration
// ═══════════════════════════════════════════════

async function fetchHistoricalFromFutodds(season: number, allowedLeagueKeys: Set<string>): Promise<any[]> {
  const TOKEN = Deno.env.get('FUTODDS_API_KEY')
  if (!TOKEN) return []
  const fixtures: any[] = []
  let id = 1
  let dayCount = 0
  const MAX_DAYS = 400

  for (const ymd of dateRangeOfSeason(season)) {
    if (dayCount++ >= MAX_DAYS) break
    try {
      const res = await fetch(`https://csv.futodds.com/functions/v1/matches-ended?date=${ymd}`, {
        headers: { Authorization: `Bearer ${TOKEN}`, 'X-API-Key': TOKEN, Accept: 'application/json' },
      })
      if (!res.ok) continue
      const json = await res.json()
      const data: any[] = Array.isArray(json) ? json : (json?.data || [])
      for (const m of data) {
        const leagueName = m.league_name || m.league || m.competition || ''
        const matchedKey = leagueMatches(leagueName, allowedLeagueKeys)
        const matched = matchedKey ? LEAGUE_MAP[matchedKey]?.name : null
        if (!matched) continue
        const home = m.home_name || m.home_team || m.home || ''
        const away = m.away_name || m.away_team || m.away || ''
        let gh: number | null = null, ga: number | null = null
        if (typeof m.scores === 'string' && m.scores.includes('-')) {
          const [a, b] = m.scores.split('-')
          gh = Number(a); ga = Number(b)
        }
        if (gh == null || isNaN(gh)) gh = Number(m.home_goals)
        if (ga == null || isNaN(ga)) ga = Number(m.away_goals)
        if (!home || !away || gh == null || isNaN(gh) || ga == null || isNaN(ga)) continue
        fixtures.push({
          fixture: { id: id++, date: m.start_time || m.kickoff || `${ymd}T00:00:00Z` },
          teams: { home: { name: home }, away: { name: away } },
          goals: { home: gh, away: ga },
          league: { round: '' },
          _leagueName: matched,
        })
      }
    } catch { /* skip */ }
    if (dayCount % 5 === 0) await new Promise(r => setTimeout(r, 100))
  }
  return fixtures
}

// ═══════════════════════════════════════════════
// SPORTMONKS — REAL PRE-MATCH ODDS (1X2, O/U, BTTS)
// Market IDs: 1=Fulltime Result, 12=Goals Over/Under, 14=Both Teams To Score
// Cached in `sportmonks_odds_cache` to avoid re-paying API calls on reruns.
// ═══════════════════════════════════════════════

// Markets: 1=Fulltime Result, 12=Goals O/U, 14=BTTS, 28=Asian Handicap
const SM_TARGET_MARKETS = '1,12,14,28'

// Formats a numeric AH line to our internal label format ("AH Casa +0.5", "AH Fora -1", etc.)
function fmtAHLabel(side: 'Casa' | 'Fora', line: number): string {
  // Normalize: 0 → "0", positives → "+X", negatives → "-X"
  const lineStr = line === 0 ? '0' : (line > 0 ? `+${line}` : `${line}`)
  return `AH ${side} ${lineStr}`
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

/** Parses raw Sportmonks odds array → our canonical market label → median odd. */
function parseSportmonksOdds(rawOdds: any[]): Record<string, number> {
  const buckets: Record<string, number[]> = {}
  const push = (label: string, val: any) => {
    const v = parseFloat(String(val))
    if (!isFinite(v) || v < 1.01 || v > 50) return
    if (!buckets[label]) buckets[label] = []
    buckets[label].push(v)
  }
  // Allowed AH lines (mirror AH_LINES from backtest engine)
  const allowedAHLines = new Set([-1.5, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1])

  for (const o of rawOdds || []) {
    const mid = Number(o.market_id)
    const lbl = String(o.label || '').toLowerCase().trim()
    const val = o.value ?? o.dp3
    if (mid === 1) {
      // Match Winner / Fulltime Result
      if (lbl === 'home' || lbl === '1') push('Casa', val)
      else if (lbl === 'draw' || lbl === 'x') push('Empate', val)
      else if (lbl === 'away' || lbl === '2') push('Fora', val)
    } else if (mid === 12) {
      // Goals Over/Under — total field contains the line
      const total = String(o.total ?? '').trim()
      if (total === '2.5' || total === '2.50') {
        if (lbl === 'over') push('Over 2.5', val)
        else if (lbl === 'under') push('Under 2.5', val)
      } else if (total === '1.5' || total === '1.50') {
        if (lbl === 'over') push('Over 1.5', val)
      }
    } else if (mid === 14) {
      // BTTS
      if (lbl === 'yes') push('BTTS Sim', val)
    } else if (mid === 28) {
      // Asian Handicap — handicap field holds the line from this side's perspective
      const hcRaw = String(o.handicap ?? '').trim().replace(/^\+/, '')
      const hc = parseFloat(hcRaw)
      if (!isFinite(hc) || !allowedAHLines.has(hc)) continue
      if (lbl === 'home' || lbl === '1') push(fmtAHLabel('Casa', hc), val)
      else if (lbl === 'away' || lbl === '2') push(fmtAHLabel('Fora', hc), val)
    }
  }
  const agg: Record<string, number> = {}
  for (const [label, arr] of Object.entries(buckets)) {
    agg[label] = round2(median(arr))
  }
  return agg
}

/**
 * Fetches real pre-match odds for a set of fixture IDs, using cache first.
 * Returns Map<fixture_id, marketLabel → odd>. Missing fixtures get empty object.
 */
async function fetchSportmonksOddsBatch(
  fixtureIds: number[],
  dbClient: any,
): Promise<Map<number, Record<string, number>>> {
  const TOKEN = Deno.env.get('SPORTMONKS_API_KEY')
  const result = new Map<number, Record<string, number>>()
  if (!TOKEN || fixtureIds.length === 0) return result

  // 1) Load cache
  const uniqueIds = Array.from(new Set(fixtureIds))
  try {
    const { data: cached } = await dbClient
      .from('sportmonks_odds_cache')
      .select('fixture_id, odds')
      .in('fixture_id', uniqueIds)
    if (cached) {
      for (const row of cached) {
        result.set(Number(row.fixture_id), row.odds || {})
      }
    }
  } catch (e) {
    console.warn('[Backtest][Odds] cache read failed:', (e as Error).message)
  }

  const missing = uniqueIds.filter(id => !result.has(id))
  console.log(`[Backtest][Odds] cache hit: ${uniqueIds.length - missing.length}/${uniqueIds.length}, fetching ${missing.length}`)

  // 2) Fetch missing in parallel batches of 8
  const CONCURRENCY = 8
  const toInsert: any[] = []
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map(async (fid) => {
      const url = `https://api.sportmonks.com/v3/football/odds/pre-match/fixtures/${fid}?api_token=${TOKEN}&filters=markets:${SM_TARGET_MARKETS}`
      try {
        const res = await fetch(url)
        if (!res.ok) return { fid, parsed: {} as Record<string, number> }
        const json = await res.json()
        const parsed = parseSportmonksOdds(json.data || [])
        return { fid, parsed }
      } catch {
        return { fid, parsed: {} as Record<string, number> }
      }
    }))
    for (const { fid, parsed } of results) {
      result.set(fid, parsed)
      toInsert.push({
        fixture_id: fid,
        odds: parsed,
        has_real_odds: Object.keys(parsed).length > 0,
        fetched_at: new Date().toISOString(),
      })
    }
    // pacing
    await new Promise(r => setTimeout(r, 120))
  }

  // 3) Persist to cache (upsert in chunks of 100)
  for (let i = 0; i < toInsert.length; i += 100) {
    try {
      await dbClient
        .from('sportmonks_odds_cache')
        .upsert(toInsert.slice(i, i + 100), { onConflict: 'fixture_id' })
    } catch (e) {
      console.warn('[Backtest][Odds] cache upsert failed:', (e as Error).message)
    }
  }

  return result
}

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
// THE ODDS API — Historical pre-match odds
// ═══════════════════════════════════════════════

/**
 * Fetches historical pre-match odds from The Odds API for a list of fixtures.
 * Groups requests by (sport_key, date) to minimize API credit consumption.
 * One API call per unique sport+date covers ALL matches on that date.
 *
 * Cache: stored in `odds_api_historical_cache` table (sport_key, event_date)
 * to avoid re-fetching on subsequent backtest runs.
 *
 * Returns Map<fixture_id, marketLabel → decimal_odd>
 */
async function fetchOddsApiHistorical(
  fixtures: any[],
  validLeagues: Array<{ key: string; info: any }>,
  dbClient: any,
  apiKey: string,
): Promise<Map<number, Record<string, number>>> {
  const result = new Map<number, Record<string, number>>()
  if (!apiKey || fixtures.length === 0) return result

  // Helper: normalize team name for fuzzy matching
  const norm = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, ' ')

  // Build leagueKey → sportKey mapping (they're the same in The Odds API!)
  // e.g. soccer_epl, soccer_brazil_campeonato, etc.
  const leagueKeyToSport = new Map(validLeagues.map(l => [l.key, l.key]))

  // Group fixtures by (sportKey, dateYMD)
  // We fetch 1 day before match time to get pre-match odds
  type GroupKey = string // `${sportKey}::${ymd}`
  const groups = new Map<GroupKey, Array<{ fixture: any; fixtureId: number }>>()
  let _noSportKey = 0

  for (const f of fixtures) {
    // Determine sport key for this fixture
    const fixtureId = Number(f.fixture.id)
    const leagueName = f._leagueName || f.league?.name || ''
    let sportKey: string | null = null
    for (const l of validLeagues) {
      if (l.info.name === leagueName || l.info.aliases?.includes(leagueName.toLowerCase())) {
        sportKey = leagueKeyToSport.get(l.key) ?? l.key
        break
      }
    }
    if (!sportKey) { _noSportKey++; continue }

    const matchDate = new Date(f.fixture.date)
    if (!isFinite(matchDate.getTime())) continue
    const ymd = matchDate.toISOString().slice(0, 10)
    const key: GroupKey = `${sportKey}::${ymd}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ fixture: f, fixtureId })
  }

  console.log(`[Backtest][OddsAPI] groups formed: ${groups.size} unique (sport,date), ${_noSportKey} fixtures sem sportKey`)
  if (groups.size > 0) {
    const sample = Array.from(groups.entries())[0]
    console.log(`[Backtest][OddsAPI] sample group: key=${sample[0]}, fixtures=${sample[1].length}`)
  }

  // Try to load from cache first
  const cacheTable = 'odds_api_historical_cache'
  const cachedKeys = new Set<GroupKey>()
  const allGroupKeys = Array.from(groups.keys())

  // Load cache in batches to avoid huge IN clauses
  const CACHE_BATCH = 100
  for (let i = 0; i < allGroupKeys.length; i += CACHE_BATCH) {
    const batchKeys = allGroupKeys.slice(i, i + CACHE_BATCH)
    try {
      const { data: rows } = await dbClient
        .from(cacheTable)
        .select('sport_key, event_date, events')
        .in('cache_key', batchKeys)
      if (rows) {
        for (const row of rows) {
          const key = `${row.sport_key}::${row.event_date}`
          cachedKeys.add(key)
          // Match events to fixtures in this group
          const groupFixtures = groups.get(key) || []
          for (const gf of groupFixtures) {
            const homeNorm = norm(gf.fixture.teams?.home?.name)
            const awayNorm = norm(gf.fixture.teams?.away?.name)
            for (const ev of (row.events || [])) {
              const evHome = norm(ev.home_team)
              const evAway = norm(ev.away_team)
              if (teamNamesMatch(homeNorm, evHome) && teamNamesMatch(awayNorm, evAway)) {
                result.set(gf.fixtureId, ev.odds || {})
                break
              }
            }
          }
        }
      }
    } catch (_e) { /* cache table may not exist yet */ }
  }

  // Fetch from API for groups not in cache
  const missingGroups = allGroupKeys.filter(k => !cachedKeys.has(k))
  console.log(`[Backtest][OddsAPI] cache: ${cachedKeys.size}/${allGroupKeys.length} groups, fetching ${missingGroups.length} from API`)

  // Cap API calls per run to avoid Edge Function timeout.
  // Cached results accumulate across runs — eventually full coverage.
  const MAX_API_CALLS = 40
  const DELAY_MS = 150
  const cacheRows: any[] = []
  let apiCallsMade = 0

  for (const groupKey of missingGroups) {
    if (apiCallsMade >= MAX_API_CALLS) {
      console.log(`[Backtest][OddsAPI] atingiu limite de ${MAX_API_CALLS} chamadas — restantes ficarão sem odds nesta execução (cache acumula)`)
      break
    }

    const [sportKey, ymd] = groupKey.split('::')
    const groupFixtures = groups.get(groupKey) || []

    // Fetch odds snapshot ~12h into the match day (good pre-match window)
    const snapshotDate = `${ymd}T12:00:00Z`
    // Note: no trailing slash — The Odds API is strict about URL format
    // Use only h2h+totals for historical endpoint — btts/spreads cause 422 on many soccer leagues
    // h2h = 1X2, totals = Over/Under
    const url = `https://api.the-odds-api.com/v4/historical/sports/${sportKey}/odds` +
      `?apiKey=${apiKey}&date=${snapshotDate}&regions=eu&markets=h2h,totals&oddsFormat=decimal`

    let events: any[] = []
    try {
      const res = await fetch(url)
      if (res.status === 422 || res.status === 404) {
        // Sport/market not supported by The Odds API for this key — skip silently
        continue
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.warn(`[Backtest][OddsAPI] HTTP ${res.status} for ${sportKey} ${ymd}: ${body.slice(0, 100)}`)
        continue
      }
      apiCallsMade++
      const json = await res.json()
      events = json?.data || []

      // Parse each event into our marketLabel → odd format
      const parsedEvents: Array<{ home_team: string; away_team: string; odds: Record<string, number> }> = []
      for (const ev of events) {
        const odds = parseOddsApiEvent(ev)
        parsedEvents.push({ home_team: ev.home_team, away_team: ev.away_team, odds })
      }

      // Match to our fixtures
      for (const gf of groupFixtures) {
        const homeNorm = norm(gf.fixture.teams?.home?.name)
        const awayNorm = norm(gf.fixture.teams?.away?.name)
        for (const pev of parsedEvents) {
          if (teamNamesMatch(homeNorm, norm(pev.home_team)) && teamNamesMatch(awayNorm, norm(pev.away_team))) {
            result.set(gf.fixtureId, pev.odds)
            break
          }
        }
      }

      // Queue cache row
      if (parsedEvents.length > 0) {
        cacheRows.push({
          cache_key: groupKey,
          sport_key: sportKey,
          event_date: ymd,
          events: parsedEvents,
          fetched_at: new Date().toISOString(),
        })
      }
    } catch (e) {
      console.warn(`[Backtest][OddsAPI] error ${sportKey} ${ymd}:`, (e as Error).message)
    }

    if (DELAY_MS > 0) await new Promise(r => setTimeout(r, DELAY_MS))
  }

  // Persist cache rows
  if (cacheRows.length > 0) {
    try {
      await dbClient.from(cacheTable).upsert(cacheRows, { onConflict: 'cache_key' })
      console.log(`[Backtest][OddsAPI] cached ${cacheRows.length} group(s)`)
    } catch (e) {
      console.warn(`[Backtest][OddsAPI] cache save failed:`, (e as Error).message)
    }
  }

  return result
}

/**
 * Parses a single The Odds API event object into our { marketLabel: odd } format.
 * Handles h2h (1x2), totals (over/under), and btts markets.
 */
function parseOddsApiEvent(ev: any): Record<string, number> {
  const buckets: Record<string, number[]> = {}
  const push = (k: string, v: number) => {
    if (!isFinite(v) || v <= 1) return
    if (!buckets[k]) buckets[k] = []
    buckets[k].push(v)
  }
  const med = (arr: number[]) => {
    const s = arr.slice().sort((a, b) => a - b)
    const mid = Math.floor(s.length / 2)
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
  }

  for (const bkm of (ev.bookmakers || [])) {
    for (const mkt of (bkm.markets || [])) {
      const key = mkt.key // h2h, totals, btts
      for (const out of (mkt.outcomes || [])) {
        const name = (out.name || '').toLowerCase()
        const val = Number(out.price)
        if (key === 'h2h') {
          if (name === 'home' || name === ev.home_team?.toLowerCase()) push('Casa', val)
          else if (name === 'away' || name === ev.away_team?.toLowerCase()) push('Fora', val)
          else if (name === 'draw') push('Empate', val)
        } else if (key === 'totals') {
          const point = String(out.point ?? '').trim()
          if (point === '2.5') {
            if (name === 'over') push('Over 2.5', val)
            else if (name === 'under') push('Under 2.5', val)
          } else if (point === '1.5') {
            if (name === 'over') push('Over 1.5', val)
          } else if (point === '3.5') {
            if (name === 'over') push('Over 3.5', val)
          }
        } else if (key === 'btts') {
          if (name === 'yes') push('BTTS Sim', val)
          else if (name === 'no') push('BTTS Não', val)
        } else if (key === 'spreads') {
          // Asian Handicap — The Odds API uses 'spreads'
          const point = Number(out.point)
          if (isFinite(point)) {
            const isHome = name === 'home' || name === ev.home_team?.toLowerCase()
            const isAway = name === 'away' || name === ev.away_team?.toLowerCase()
            const allowedLines = [-1.5, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1, 1.5]
            if (allowedLines.includes(point) && isHome) push(`AH Casa ${point > 0 ? '+' : ''}${point}`, val)
            if (allowedLines.includes(-point) && isAway) push(`AH Fora ${-point > 0 ? '+' : ''}{-point}`, val)
          }
        }
      }
    }
  }

  const result: Record<string, number> = {}
  for (const [k, arr] of Object.entries(buckets)) {
    result[k] = Math.round(med(arr) * 100) / 100
  }
  return result
}

/**
 * Fuzzy team name matching: tolerates common suffixes, abbreviations, and accents.
 * Returns true if names are likely the same club.
 */
function teamNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  // Remove common suffixes
  const strip = (s: string) => s.replace(/\b(fc|cf|sc|ac|as|ss|afc|bv|sv|fk|sk|nk|if|bf|bk)\b/g, '').trim()
  const sa = strip(a), sb = strip(b)
  if (sa === sb) return true
  // Substring containment (one contains the other, min 5 chars)
  if (sa.length >= 5 && sb.length >= 5) {
    if (sa.includes(sb) || sb.includes(sa)) return true
  }
  // Token overlap: if all tokens of shorter name appear in longer
  const ta = sa.split(' ').filter(t => t.length >= 3)
  const tb = sb.split(' ').filter(t => t.length >= 3)
  if (ta.length > 0 && tb.length > 0) {
    const shorter = ta.length <= tb.length ? ta : tb
    const longer  = ta.length <= tb.length ? tb : ta
    const matches = shorter.filter(t => longer.some(lt => lt.startsWith(t) || t.startsWith(lt)))
    if (matches.length >= shorter.length) return true
  }
  return false
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
// ANALYSIS ENGINE
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
  settlementMultiplier: number // 1 / 0.5 / 0 / -0.5 / -1
  confidence: number
  vetoReason?: string
  modelLevel: string
  dataStrength: string
  tier: string | null
  stakePct: number
  usedRealOdd: boolean
}

function analyzeWithCriteria(
  homeTeam: string,
  awayTeam: string,
  homeStats: TeamCumulativeStats,
  awayStats: TeamCumulativeStats,
  actualHomeGoals: number,
  actualAwayGoals: number,
  runningLeagueAvg: LeagueAverages,   // ← incremental, no lookahead
  criteria: AnalysisCriteria,
  allowedMarkets: Set<string> = new Set(ALL_MARKETS),
  realOdds: Record<string, number> = {},
): AnalysisResult | null {

  // ═══════════════════════════════════════════════
  // MARKET MODEL — uses ONLY overall seasonal averages (no home/away split, no form)
  // Simulates a naive bookmaker that prices from season-long goal averages.
  // ═══════════════════════════════════════════════
  // This is DELIBERATELY simpler than the MODEL below to create genuine differentiation.
  // The MODEL uses home/away specific rates + recent form → real information advantage.

  const MARKET_MARGIN = 1.08
  // Market uses simple attack/defense without home-away split
  const mktHomeAttack  = homeStats.goalsScored / homeStats.played
  const mktAwayAttack  = awayStats.goalsScored / awayStats.played
  const mktHomeDefense = homeStats.goalsConceded / homeStats.played
  const mktAwayDefense = awayStats.goalsConceded / awayStats.played

  // Market XG: plain average of attack and opponent defense — no contextual adjustment
  const mktHomeXG = clamp((mktHomeAttack + mktAwayDefense) / 2, 0.20, 4.0)
  const mktAwayXG = clamp((mktAwayAttack + mktHomeDefense) / 2, 0.15, 3.5)

  const mktHomeWin = poissonMatchProb(mktHomeXG, mktAwayXG, 'home')
  const mktDraw    = poissonMatchProb(mktHomeXG, mktAwayXG, 'draw')
  const mktAwayWin = poissonMatchProb(mktHomeXG, mktAwayXG, 'away')
  const mktOver25  = poissonOver(mktHomeXG, mktAwayXG, 2.5)
  const mktOver15  = poissonOver(mktHomeXG, mktAwayXG, 1.5)
  const mktBTTS    = poissonBTTS(mktHomeXG, mktAwayXG)

  const marketOdds: Record<string, number> = {
    'Casa':     round2(MARKET_MARGIN / mktHomeWin),
    'Empate':   round2(MARKET_MARGIN / mktDraw),
    'Fora':     round2(MARKET_MARGIN / mktAwayWin),
    'Over 2.5': round2(MARKET_MARGIN / mktOver25),
    'Under 2.5':round2(MARKET_MARGIN / (1 - mktOver25)),
    'Over 1.5': round2(MARKET_MARGIN / mktOver15),
    'BTTS Sim': round2(MARKET_MARGIN / mktBTTS),
  }

  // ═══════════════════════════════════════════════
  // PREDICTION MODEL — uses home/away specific rates + recent form + league calibration
  // This is what our system "knows" that the simple market model doesn't.
  // ═══════════════════════════════════════════════

  // Use home-specific attack/defense when enough games, else fall back to overall
  const homeHomeAttack   = homeStats.homePlayed >= 4 ? homeStats.homeGoalsScored / homeStats.homePlayed : mktHomeAttack
  const awayHomeDefense  = homeStats.homePlayed >= 4 ? homeStats.homeGoalsConceded / homeStats.homePlayed : mktHomeDefense
  const awayAwayAttack   = awayStats.awayPlayed >= 4 ? awayStats.awayGoalsScored / awayStats.awayPlayed : mktAwayAttack
  const homeAwayDefense  = awayStats.awayPlayed >= 4 ? awayStats.awayGoalsConceded / awayStats.awayPlayed : mktAwayDefense

  // Recent form factor (last 5 games): W=1.05, D=1.0, L=0.95
  const formFactor = (results: ('W' | 'D' | 'L')[]): number => {
    if (results.length === 0) return 1.0
    const sum = results.reduce((s, r) => s + (r === 'W' ? 1.05 : r === 'L' ? 0.95 : 1.0), 0)
    return sum / results.length
  }
  const homeFormFactor = formFactor(homeStats.lastResults)
  const awayFormFactor = formFactor(awayStats.lastResults)

  // League calibration factor (uses running average — no lookahead)
  const leagueHomeCalib = runningLeagueAvg.avgGoals > 0
    ? runningLeagueAvg.avgHomeGoals / Math.max(runningLeagueAvg.avgGoals / 2, 0.5)
    : 1.0
  const leagueAwayCalib = runningLeagueAvg.avgGoals > 0
    ? runningLeagueAvg.avgAwayGoals / Math.max(runningLeagueAvg.avgGoals / 2, 0.5)
    : 1.0

  const homeXG = clamp(
    ((homeHomeAttack + awayHomeDefense) / 2) * leagueHomeCalib * homeFormFactor,
    0.20, 4.0
  )
  const awayXG = clamp(
    ((awayAwayAttack + homeAwayDefense) / 2) * leagueAwayCalib * awayFormFactor,
    0.15, 3.5
  )

  const modelHomeWin = poissonMatchProb(homeXG, awayXG, 'home')
  const modelDraw    = poissonMatchProb(homeXG, awayXG, 'draw')
  const modelAwayWin = poissonMatchProb(homeXG, awayXG, 'away')
  const modelOver25  = poissonOver(homeXG, awayXG, 2.5)
  const modelUnder25 = 1 - modelOver25
  const modelOver15  = poissonOver(homeXG, awayXG, 1.5)
  const modelBTTS    = poissonBTTS(homeXG, awayXG)

  // OVERRIDE with REAL pre-match odds from Sportmonks where available.
  // This eliminates the synthetic-edge bias on canonical markets.
  const realOddsUsedForMarkets = new Set<string>()
  for (const [mk, od] of Object.entries(realOdds)) {
    if (mk in marketOdds && od >= 1.05 && od <= 50) {
      marketOdds[mk] = od
      realOddsUsedForMarkets.add(mk)
    }
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

  // ── Asian Handicap: compute model effective prob, fair odd, actual multiplier ──
  // Distribution of goal diff h-a using independent Poisson (grid 12 to reduce truncation)
  const diffDist: Map<number, number> = new Map()
  for (let h = 0; h <= POISSON_MAX; h++) {
    for (let a = 0; a <= POISSON_MAX; a++) {
      const p = poissonPmf(homeXG, h) * poissonPmf(awayXG, a)
      const d = h - a
      diffDist.set(d, (diffDist.get(d) ?? 0) + p)
    }
  }

  // For an AH bet at fair odd O, effective_prob = p_win + 0.5*p_half_win.
  // Expected return per unit = p_win*(O-1) + 0.5*p_hw*(O-1) + 0*p_push - 0.5*p_hl - p_loss
  // Setting EV=0 gives O = 1 + (p_loss + 0.5*p_hl) / (p_win + 0.5*p_hw)
  function ahProbsForLine(side: 'home' | 'away', line: number) {
    // Uses the canonical settleAH function (consistent with settlement at bet confirmation).
    // diffDist maps (homeGoals - awayGoals) → probability.
    let pWin = 0, pHW = 0, pPush = 0, pHL = 0, pLoss = 0
    for (const [d, p] of diffDist) {
      // Reconstruct (homeGoals, awayGoals) pair for settleAH from the diff.
      // We only need the difference to be correct; we use (max(d,0), max(-d,0)) as a proxy.
      const hg = Math.max(d, 0)
      const ag = Math.max(-d, 0)
      const m = settleAH(side, line, hg, ag)
      if (m === 1)        pWin  += p
      else if (m === 0.5) pHW   += p
      else if (m === 0)   pPush += p
      else if (m === -0.5) pHL  += p
      else                pLoss += p
    }
    const effProb = pWin + 0.5 * pHW
    const lossEq  = pLoss + 0.5 * pHL
    const fairOdd = effProb > 0 ? 1 + lossEq / effProb : 99
    return { effProb, fairOdd, pWin, pHW, pPush, pHL, pLoss }
  }

  for (const line of AH_LINES) {
    for (const side of ['home', 'away'] as const) {
      const market = `${side === 'home' ? 'AH Casa' : 'AH Fora'} ${line > 0 ? '+' : ''}${line}`
      const { effProb, fairOdd } = ahProbsForLine(side, line)
      // Apply small market margin to simulate book price
      const oddWithMargin = Math.max(1.05, fairOdd / 1.04)
      modelProbs[market] = effProb
      marketOdds[market] = oddWithMargin
      const mult = settleAH(side, line, actualHomeGoals, actualAwayGoals)
      ;(actualResults as any)[market] = mult > 0 // approximate "isGreen"
      ;(actualResults as any)[`__mult_${market}`] = mult
    }
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
    settlementMultiplier: number
  } | null = null

  for (const [market, modelProb] of Object.entries(modelProbs)) {
    if (!allowedMarkets.has(market)) continue
    const marketOdd = marketOdds[market]
    if (!marketOdd || marketOdd > 20 || marketOdd < 1.05) continue

    const impliedProb = 1 / marketOdd
    const edge = ((modelProb - impliedProb) / impliedProb) * 100
    const ev = (modelProb * marketOdd) - 1

    if (ev > 0 && edge > (bestOpportunity?.edge ?? 0)) {
      const mult = (actualResults as any)[`__mult_${market}`]
      const settlementMultiplier = typeof mult === 'number' ? mult : (actualResults[market] ? 1 : -1)
      bestOpportunity = {
        market, modelProb, marketOdd, impliedProb, edge, ev,
        isGreen: actualResults[market] ?? false,
        settlementMultiplier,
      }
    }
  }

  if (!bestOpportunity) return null

  const { market, modelProb, marketOdd, impliedProb, edge, ev, isGreen, settlementMultiplier } = bestOpportunity

  const minPlayed = Math.min(homeStats.played, awayStats.played)
  const dataStrength = minPlayed >= 15 ? 'ALTA' : minPlayed >= 8 ? 'MEDIA' : 'BAIXA'

  // Confidence aligned with mycroft-punter-analysis production logic
  let confidence: number
  if (dataStrength === 'ALTA') confidence = 65       // xG stats básicas → base 65
  else if (dataStrength === 'MEDIA') confidence = 62
  else confidence = 55

  // Bonus for edge (same as production)
  if (edge >= 10) confidence += 8
  else if (edge >= 8) confidence += 5
  else if (edge >= 5) confidence += 3

  // Bonus for model probability strength
  if (modelProb >= 0.60) confidence += 8
  else if (modelProb >= 0.55) confidence += 5
  else if (modelProb >= 0.50) confidence += 3

  // Bonus for data volume
  if (minPlayed >= 20) confidence += 5
  else if (minPlayed >= 15) confidence += 3

  // Penalty for low-data context
  if (dataStrength === 'BAIXA') confidence -= 8

  confidence = Math.min(92, Math.max(50, Math.round(confidence)))

  const modelLevel = 'NIVEL_2'

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
    for (const tier of criteria.tiers) {
      if (edge >= tier.min_edge && confidence >= tier.min_confidence) {
        matchedTier = tier.label
        tierStake = tier.stake_pct
        verdict = 'APROVADO'
        break
      }
    }
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
    predictedProb: round2(modelProb * 100),
    impliedProb: round2(impliedProb * 100),
    odd: round2(marketOdd),
    ev: round2(ev * 100),
    edgePct: round2(edge),
    verdict,
    isGreen,
    settlementMultiplier,
    confidence,
    vetoReason,
    modelLevel,
    dataStrength,
    tier: matchedTier,
    stakePct: tierStake,
    usedRealOdd: realOddsUsedForMarkets.has(market),
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

// Grid extended to 12 to reduce truncation error for high-scoring games
const POISSON_MAX = 12

function poissonMatchProb(homeXG: number, awayXG: number, outcome: 'home' | 'draw' | 'away'): number {
  let prob = 0
  for (let h = 0; h <= POISSON_MAX; h++) {
    for (let a = 0; a <= POISSON_MAX; a++) {
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
  for (let h = 0; h <= POISSON_MAX; h++) {
    for (let a = 0; a <= POISSON_MAX; a++) {
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
    greens: 0, reds: 0, hit_rate: 0, roi_total: 0, yield_pct: 0,
    net_profit: 0, max_drawdown: 0, final_bankroll: 0,
    initial_bankroll: 0, avg_odd: 0, bets_per_day: 0, total_days: 0,
    tier_breakdown: [], roi_by_odd_range: [], roi_by_league: [], bankroll_curve: [],
  }
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
