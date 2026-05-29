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

const LEAGUE_MAP: Record<string, { id: number; name: string }> = {
  'soccer_brazil_campeonato': { id: 71, name: 'Brasileirão Série A' },
  'soccer_brazil_serie_b': { id: 72, name: 'Brasileirão Série B' },
  'soccer_brazil_campeonato_paulista': { id: 475, name: 'Paulistão' },
  'soccer_brazil_campeonato_carioca': { id: 476, name: 'Carioca' },
  'soccer_brazil_campeonato_mineiro': { id: 477, name: 'Mineiro' },
  'soccer_brazil_campeonato_gaucho': { id: 478, name: 'Gaúcho' },
  'soccer_brazil_campeonato_baiano': { id: 479, name: 'Baiano' },
  'soccer_brazil_campeonato_paranaense': { id: 480, name: 'Paranaense' },
  'soccer_brazil_campeonato_catarinense': { id: 481, name: 'Catarinense' },
  'soccer_brazil_campeonato_pernambucano': { id: 604, name: 'Pernambucano' },
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
    { days: 30, label: '30 dias' },
    { days: 60, label: '60 dias' },
    { days: 90, label: '3 meses' },
    { days: 180, label: '6 meses' },
    { days: 365, label: '1 ano' },
  ]

  // Simulate bet-by-bet with expected value and stake cap
  // Conservative uses 80% of win rate, Optimistic uses 105%
  function projectWithCap(winRateMultiplier: number, days: number): number {
    const numBets = Math.round(betsPerDay * days)
    let bankroll = initialBankroll
    const effectiveP = Math.min(1, p * winRateMultiplier)
    // Expected profit per bet = stake * (p*odd - 1)
    const evPerUnit = effectiveP * avgOdd - 1
    if (evPerUnit <= 0) return round2(initialBankroll) // no edge = no growth

    for (let i = 0; i < numBets; i++) {
      const rawStake = bankroll * (avgStakePct / 100)
      const stake = Math.min(rawStake, maxStakeAmount)
      bankroll += stake * evPerUnit
      if (bankroll <= 0) return 0
    }
    return round2(bankroll)
  }

  return periods.map(p => ({
    days: p.days,
    label: p.label,
    bankroll_conservative: projectWithCap(0.9, p.days),   // 90% of observed win rate
    bankroll_expected: projectWithCap(1.0, p.days),        // actual win rate
    bankroll_optimistic: projectWithCap(1.05, p.days),     // 105% of win rate
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
    const apiKey = '' // API-Football removida em Fase 2 (18/05/2026) — backtest usa arena_matches/Sportmonks/Futodds

    const body = await req.json()
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
        const missingNames = new Set(missingLeagues.map(l => l.info.name))
        console.log(`[Backtest] Futodds: tentando preencher ${missingLeagues.length} ligas faltantes (${Array.from(missingNames).join(', ')})`)
        try {
          const fdFixtures = await fetchHistoricalFromFutodds(season, missingNames)
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

    // 2. Calculate league-wide averages
    const leagueAvg = calculateLeagueAverages(allFixtures)
    console.log(`[Backtest] Média da liga: ${leagueAvg.avgGoals.toFixed(2)} gols/jogo`)

    // 2b. Pre-fetch REAL pre-match odds from Sportmonks (uses cache).
    // Only meaningful when fixtures came from Sportmonks (they carry SM fixture_id).
    let realOddsByFixture: Map<number, Record<string, number>> = new Map()
    if (usedSource === 'sportmonks' && Deno.env.get('SPORTMONKS_API_KEY')) {
      const ids = allFixtures.map((f: any) => Number(f.fixture.id)).filter((n: number) => Number.isFinite(n))
      console.log(`[Backtest] Buscando odds reais pré-jogo para ${ids.length} fixtures (Sportmonks)...`)
      realOddsByFixture = await fetchSportmonksOddsBatch(ids, dbClient)
      const withOdds = Array.from(realOddsByFixture.values()).filter(o => Object.keys(o).length > 0).length
      console.log(`[Backtest] Odds reais: ${withOdds}/${ids.length} fixtures cobertas`)
    } else {
      console.log(`[Backtest] Odds reais NÃO disponíveis (fonte=${usedSource}). Backtest usará odds sintéticas (ROI estimado).`)
    }

    // 3. Simulate game by game (NO LOOKAHEAD)
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

      if (homeStats && awayStats && homeStats.played >= criteria.min_sample_games && awayStats.played >= criteria.min_sample_games) {
        const fixRealOdds = realOddsByFixture.get(Number(fixture.fixture.id)) || {}
        const analysis = analyzeWithCriteria(
          homeTeam, awayTeam, homeStats, awayStats,
          homeGoals, awayGoals, leagueAvg, criteria, allowedMarkets, fixRealOdds
        )

        if (analysis) {
          rawAnalyses.push({
            fixture, analysis, homeGoals, awayGoals,
            leagueName: fixtureLeagueMap.get(fixture.fixture.id) || 'Unknown',
          })
        }
      }

      // Update stats AFTER analysis (no-lookahead)
      updateTeamStats(teamStats, homeTeam, homeGoals, awayGoals, true)
      updateTeamStats(teamStats, awayTeam, awayGoals, homeGoals, false)
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

    for (const { fixture, analysis, homeGoals, awayGoals, leagueName } of rawAnalyses) {
      const fixtureDate = fixture.fixture.date
      const homeTeam = fixture.teams.home.name
      const awayTeam = fixture.teams.away.name

      const stakeAmount = Math.min(bankroll * (analysis.stakePct / 100), max_stake_amount) // Cap at bookmaker limit

      let profitLoss = 0
      if (analysis.verdict === 'APROVADO') {
        totalActualStaked += stakeAmount
        const m = analysis.settlementMultiplier
        // m=1 full win, 0.5 half win, 0 push, -0.5 half loss, -1 full loss
        if (m > 0) profitLoss = stakeAmount * m * (analysis.odd - 1)
        else if (m === 0) profitLoss = 0
        else profitLoss = stakeAmount * m // negative
        bankroll += profitLoss

        // Track for Monte Carlo (treat half-results approximately as fractional outcomes)
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

    // Bankroll curve
    let runningBankroll = initial_bankroll
    const bankrollCurve = [{ index: 0, bankroll: initial_bankroll, date: '' }]
    approved.forEach((r, i) => {
      runningBankroll += r.profit_loss
      bankrollCurve.push({
        index: i + 1,
        bankroll: round2(runningBankroll),
        date: r.date.split('T')[0],
      })
    })

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

function leagueMatches(leagueName: string, allowed: Set<string>): string | null {
  const target = smNorm(leagueName)
  for (const a of allowed) {
    const an = smNorm(a)
    if (target === an || target.includes(an) || an.includes(target)) return a
  }
  return null
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
      cachedFixtures = cached.fixtures
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
    for (const f of data) {
      const stateName = f.state?.short_name || f.state?.name || ''
      if (!/FT|AET|PEN_LIVE|FT_PEN/i.test(stateName)) continue
      const participants = f.participants || []
      const home = participants.find((p: any) => p.meta?.location === 'home') || participants[0]
      const away = participants.find((p: any) => p.meta?.location === 'away') || participants[1]
      if (!home || !away) continue
      const scores = f.scores || []
      let gh: number | null = null, ga: number | null = null
      for (const s of scores) {
        const desc = String(s.description || '').toUpperCase()
        if (desc !== 'CURRENT') continue
        if (s.score?.participant === 'home') gh = s.score.goals
        if (s.score?.participant === 'away') ga = s.score.goals
      }
      if (gh === null || ga === null) {
        for (const s of scores) {
          const desc = String(s.description || '').toUpperCase()
          if (desc !== 'FT') continue
          if (s.score?.participant === 'home' && gh === null) gh = s.score.goals
          if (s.score?.participant === 'away' && ga === null) ga = s.score.goals
        }
      }
      if (gh === null || ga === null) continue
      fetched.push({
        fixture: { id: f.id, date: f.starting_at || `${fromYmd}T00:00:00Z` },
        teams: { home: { name: home.name }, away: { name: away.name } },
        goals: { home: gh, away: ga },
        league: { round: '' },
        _leagueName: leagueName,
      })
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

  // 5) Persistir somente se houver mudança ou era miss
  if (added > 0 || !hadCache) {
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
  }

  return { fixtures: merged, fromCache: hadCache && added === 0 }
}

// ═══════════════════════════════════════════════
// FUTODDS — /matches-ended by date iteration
// ═══════════════════════════════════════════════

async function fetchHistoricalFromFutodds(season: number, allowedLeagues: Set<string>): Promise<any[]> {
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
        const matched = leagueMatches(leagueName, allowedLeagues)
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
  leagueAvg: LeagueAverages,
  criteria: AnalysisCriteria,
  allowedMarkets: Set<string> = new Set(ALL_MARKETS),
  realOdds: Record<string, number> = {},
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

  const homeXG = ((homeHomeAttack + awayDefense) / 2) * (leagueAvg.avgHomeGoals / Math.max(leagueAvg.avgGoals / 2, 0.5))
  const awayXG = ((awayAwayAttack + homeDefense) / 2) * (leagueAvg.avgAwayGoals / Math.max(leagueAvg.avgGoals / 2, 0.5))

  const modelHomeWin = poissonMatchProb(homeXG, awayXG, 'home')
  const modelDraw = poissonMatchProb(homeXG, awayXG, 'draw')
  const modelAwayWin = poissonMatchProb(homeXG, awayXG, 'away')
  const modelOver25 = poissonOver(homeXG, awayXG, 2.5)
  const modelUnder25 = 1 - modelOver25
  const modelOver15 = poissonOver(homeXG, awayXG, 1.5)
  const modelBTTS = poissonBTTS(homeXG, awayXG)

  // ── MARKET: Ratings-based (simulates sharp market) ──
  const homeOverallWR = homeStats.wins / homeStats.played
  const homeHomeWR = homeStats.homePlayed > 2 ? homeStats.homeWins / homeStats.homePlayed : homeOverallWR
  const awayOverallWR = awayStats.wins / awayStats.played
  const awayAwayWR = awayStats.awayPlayed > 2 ? awayStats.awayWins / awayStats.awayPlayed : awayOverallWR
  
  const regressionWeight = Math.max(0.3, 1 - Math.min(homeStats.played, awayStats.played) / 30)
  
  const rawMarketHome = (homeHomeWR * 0.5 + homeOverallWR * 0.2 + (1 - awayOverallWR) * 0.3)
  const marketHomeWin = clamp(rawMarketHome * (1 - regressionWeight) + leagueAvg.homeWinRate * regressionWeight, 0.10, 0.85)
  
  const rawMarketAway = (awayAwayWR * 0.5 + awayOverallWR * 0.2 + (1 - homeOverallWR) * 0.3)
  const marketAwayWin = clamp(rawMarketAway * (1 - regressionWeight) + leagueAvg.awayWinRate * regressionWeight, 0.05, 0.75)
  
  const marketDraw = clamp(1 - marketHomeWin - marketAwayWin, 0.15, 0.35)
  
  const totalMarket = marketHomeWin + marketDraw + marketAwayWin
  const normHome = marketHomeWin / totalMarket
  const normDraw = marketDraw / totalMarket
  const normAway = marketAwayWin / totalMarket

  const teamBasedGoalRate = (homeAttack + awayAttack + homeDefense + awayDefense) / 2
  const marketGoalExpectation = teamBasedGoalRate * (1 - regressionWeight) + leagueAvg.avgGoals * regressionWeight
  const marketOver25 = clamp(poissonOver(marketGoalExpectation * 0.52, marketGoalExpectation * 0.48, 2.5), 0.25, 0.75)
  const marketUnder25 = 1 - marketOver25
  const marketOver15 = clamp(poissonOver(marketGoalExpectation * 0.52, marketGoalExpectation * 0.48, 1.5), 0.50, 0.92)
  const marketBTTS = clamp(1 - poissonPmf(marketGoalExpectation * 0.52, 0) - poissonPmf(marketGoalExpectation * 0.48, 0) + poissonPmf(marketGoalExpectation * 0.52, 0) * poissonPmf(marketGoalExpectation * 0.48, 0), 0.25, 0.75)

  const margin = 1.08
  const marketOdds: Record<string, number> = {
    'Casa': margin / normHome,
    'Empate': margin / normDraw,
    'Fora': margin / normAway,
    'Over 2.5': margin / marketOver25,
    'Under 2.5': margin / marketUnder25,
    'Over 1.5': margin / marketOver15,
    'BTTS Sim': margin / marketBTTS,
  }

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
  // Distribution of goal diff h-a using independent Poisson
  const diffDist: Map<number, number> = new Map()
  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      const p = poissonPmf(homeXG, h) * poissonPmf(awayXG, a)
      const d = h - a
      diffDist.set(d, (diffDist.get(d) ?? 0) + p)
    }
  }

  // For an AH bet at fair odd O, effective_prob = p_win + 0.5*p_half_win.
  // Expected return per unit = p_win*(O-1) + 0.5*p_hw*(O-1) + 0*p_push - 0.5*p_hl - p_loss
  // Setting EV=0 gives O = 1 + (p_loss + 0.5*p_hl) / (p_win + 0.5*p_hw)
  function ahProbsForLine(side: 'home' | 'away', line: number) {
    let pWin = 0, pHW = 0, pPush = 0, pHL = 0, pLoss = 0
    for (const [d, p] of diffDist) {
      // simulate settlement for diff=d
      const m = settleAH(side, line, side === 'home' ? d : 0, side === 'home' ? 0 : -d)
      // simpler: rebuild via diff
      const diff = side === 'home' ? d : -d
      const adjusted = diff + line
      const isHalf = (line * 2) % 2 !== 0 && (line * 4) % 2 === 0
      const isQuarter = (line * 4) % 2 !== 0
      if (isQuarter) {
        const lower = Math.floor(line * 2) / 2
        const upper = Math.ceil(line * 2) / 2
        const aLower = (side === 'home' ? d : -d) + lower
        const aUpper = (side === 'home' ? d : -d) + upper
        const partial = (x: number, half: boolean) => {
          if (half) return x > 0 ? 1 : -1
          if (x > 0) return 1
          if (x === 0) return 0
          return -1
        }
        const lowerHalf = (lower * 2) % 2 !== 0
        const upperHalf = (upper * 2) % 2 !== 0
        const mm = (partial(aLower, lowerHalf) + partial(aUpper, upperHalf)) / 2
        if (mm === 1) pWin += p
        else if (mm === 0.5) pHW += p
        else if (mm === 0) pPush += p
        else if (mm === -0.5) pHL += p
        else pLoss += p
      } else if (isHalf) {
        if (adjusted > 0) pWin += p; else pLoss += p
      } else {
        if (adjusted > 0) pWin += p
        else if (adjusted === 0) pPush += p
        else pLoss += p
      }
      void m
    }
    const effProb = pWin + 0.5 * pHW
    const lossEq = pLoss + 0.5 * pHL
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

  let confidence: number
  if (dataStrength === 'ALTA') confidence = 70
  else if (dataStrength === 'MEDIA') confidence = 65
  else confidence = 60

  if (edge > 10) confidence += 15
  else if (edge > 7) confidence += 10
  else if (edge > 5) confidence += 5

  if (minPlayed >= 10) confidence += 5
  confidence = Math.min(95, Math.round(confidence))

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
