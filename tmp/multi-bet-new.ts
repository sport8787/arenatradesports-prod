// multi-bet-optimizer v2.1 – Otimizador de Parlays com correlação refinada, beam search e diversificação
// Melhorias: correlação granular, geração eficiente, diversificação de resultados, logging estruturado

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface OptimizationParams {
  num_selections: number    // 3-8
  min_asset_score: number   // 50-100
  max_correlation: number   // 0-1
  top_k: number             // 1-20
  min_odd: number           // ≥1.01
  max_odd: number           // ≥min_odd
}

interface Bet {
  id: string
  match_id: string
  home_team: string
  away_team: string
  league: string
  market: string
  bookmaker: string
  odd: number
  value_percentage: number
  expected_value: number
  confidence: number
  stake_percentage: number
  asset_score: number
  estimated_probability: number
  // Campos derivados
  teams: string[]
}

interface ScoredParlay {
  id: string
  bets: Bet[]
  score: number
  totalOdd: number
  avgEdge: number
  avgCorrelation: number
  combinedProbability: number
  expectedROI: number
  kellyStake: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
  breakdown: {
    edgeScore: number
    independenceScore: number
    probabilityScore: number
    sharpeScore: number
  }
  warnings: string[]
}

interface OptimizationResponse {
  success: boolean
  eligible_count: number
  total_available: number
  total_combinations_scored: number
  parlays: ScoredParlay[]
  execution_time_ms: number
  metadata: {
    params_used: OptimizationParams
    avg_correlation_threshold: number
    timestamp: string
  }
  error?: string
}

// ------------------------------------------------------------
// 1. Validação de parâmetros
// ------------------------------------------------------------
function validateParams(body: any): OptimizationParams {
  const params: OptimizationParams = {
    num_selections: body.num_selections ?? 4,
    min_asset_score: body.min_asset_score ?? 70,
    max_correlation: body.max_correlation ?? 0.3,
    top_k: body.top_k ?? 5,
    min_odd: body.min_odd ?? 1.3,
    max_odd: body.max_odd ?? 100,
  }

  if (params.num_selections < 3 || params.num_selections > 8) {
    throw new Error('num_selections deve estar entre 3 e 8')
  }
  if (params.min_asset_score < 50 || params.min_asset_score > 100) {
    throw new Error('min_asset_score deve estar entre 50 e 100')
  }
  if (params.max_correlation < 0 || params.max_correlation > 1) {
    throw new Error('max_correlation deve estar entre 0 e 1')
  }
  if (params.top_k < 1 || params.top_k > 20) {
    throw new Error('top_k deve estar entre 1 e 20')
  }
  if (params.min_odd < 1.01) {
    throw new Error('min_odd deve ser >= 1.01')
  }
  if (params.max_odd < params.min_odd) {
    throw new Error('max_odd deve ser >= min_odd')
  }

  return params
}

// ------------------------------------------------------------
// 2. Busca de apostas elegíveis (mock – substituir pela consulta real)
// ------------------------------------------------------------
async function fetchEligibleBets(
  supabase: any,
  params: OptimizationParams
): Promise<Bet[]> {
  // Em produção, faça uma consulta real:
  /*
  const { data, error } = await supabase
    .from('punter_analyses')
    .select(`
      id,
      match_id,
      home_team,
      away_team,
      league,
      market,
      bookmaker,
      odd,
      value_percentage,
      expected_value,
      confidence,
      stake_percentage,
      asset_score,
      estimated_probability
    `)
    .eq('verdict', 'APROVADO')
    .gte('asset_score', params.min_asset_score)
    .gte('odd', params.min_odd)
    .lte('odd', params.max_odd)
    .order('expected_value', { ascending: false })
    .limit(200) // limite para performance

  if (error) throw error
  return data.map((b: any) => ({
    ...b,
    teams: [b.home_team, b.away_team]
  }))
  */

  // Mock para desenvolvimento
  const mockBets: Bet[] = []
  for (let i = 1; i <= 50; i++) {
    mockBets.push({
      id: `bet-${i}`,
      match_id: `match-${i}`,
      home_team: `Team${i}A`,
      away_team: `Team${i}B`,
      league: i % 3 === 0 ? 'Premier League' : i % 3 === 1 ? 'La Liga' : 'Bundesliga',
      market: i % 2 === 0 ? 'Casa' : 'Fora',
      bookmaker: i % 4 === 0 ? 'Pinnacle' : 'Bet365',
      odd: 1.5 + (i % 10) * 0.3,
      value_percentage: 5 + (i % 10),
      expected_value: 0.03 + (i % 10) * 0.01,
      confidence: 60 + (i % 30),
      stake_percentage: 2 + (i % 3),
      asset_score: 70 + (i % 20),
      estimated_probability: 50 + (i % 30),
      teams: [`Team${i}A`, `Team${i}B`],
    })
  }
  return mockBets
}

// ------------------------------------------------------------
// 3. Correlação refinada entre duas apostas
// ------------------------------------------------------------
function calculatePairwiseCorrelation(a: Bet, b: Bet): number {
  // Se for o mesmo jogo
  if (a.match_id === b.match_id) {
    // Mercados mutuamente exclusivos?
    const aMarket = a.market.toLowerCase()
    const bMarket = b.market.toLowerCase()
    // Detectar incompatibilidades
    if (
      (aMarket.includes('casa') && bMarket.includes('fora')) ||
      (aMarket.includes('fora') && bMarket.includes('casa')) ||
      (aMarket.includes('empate') && (bMarket.includes('casa') || bMarket.includes('fora')))
    ) {
      return -1 // impossível
    }
    // Mercados compatíveis – correlação alta, mas não perfeita
    // Podemos refinar com dados históricos, mas usaremos 0.85 como padrão
    return 0.85
  }

  let corr = 0

  // Times repetidos (jogos diferentes)
  const commonTeams = a.teams.filter(t => b.teams.includes(t))
  if (commonTeams.length > 0) {
    corr += 0.7
    // Se o time aparece de um lado em A e do outro em B, aumenta um pouco
    const team = commonTeams[0]
    const sideA = a.home_team === team ? 'home' : (a.away_team === team ? 'away' : null)
    const sideB = b.home_team === team ? 'home' : (b.away_team === team ? 'away' : null)
    if (sideA && sideB && sideA !== sideB) {
      corr += 0.1 // confronto indireto
    }
  }

  // Mesma liga
  if (a.league === b.league) corr += 0.12

  // Mesmo mercado
  if (a.market === b.market) corr += 0.08

  // Mesmo dia aproximado (pode ser extraído da data, mas aqui ignoramos)
  // if (sameDay) corr += 0.05

  // Mesmo bookmaker
  if (a.bookmaker === b.bookmaker) corr += 0.03

  return Math.min(corr, 1.0)
}

// ------------------------------------------------------------
// 4. Constrói matriz de correlação (N x N) com memoização
// ------------------------------------------------------------
function buildCorrelationMatrix(bets: Bet[]): number[][] {
  const n = bets.length
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const corr = calculatePairwiseCorrelation(bets[i], bets[j])
      matrix[i][j] = corr
      matrix[j][i] = corr // simétrica
    }
    matrix[i][i] = 1 // auto-correlação
  }
  return matrix
}

// ------------------------------------------------------------
// 5. Kelly Criterion ajustado
// ------------------------------------------------------------
function calculateKellyStake(
  totalOdd: number,
  combinedProb: number,
  avgCorrelation: number,
  numSelections: number
): number {
  const p = combinedProb / 100
  const b = totalOdd - 1
  const q = 1 - p

  // Kelly full
  let kellyFull = (p * b - q) / b
  if (kellyFull <= 0) return 0

  // Quarter Kelly base
  let stake = kellyFull * 0.25

  // Ajuste por correlação
  stake *= Math.pow(1 - avgCorrelation, 1.5)

  // Ajuste por número de seleções (parlays maiores são mais arriscados)
  if (numSelections > 4) {
    stake *= Math.pow(0.9, numSelections - 4)
  }

  // Ajuste por odds totais (odds altas = menor stake)
  if (totalOdd > 10) {
    stake *= Math.sqrt(10 / totalOdd)
  }

  // Limites entre 0.5% e 5%
  return Math.max(0.5, Math.min(5, stake * 100))
}

// ------------------------------------------------------------
// 6. Pontuação de um parlay
// ------------------------------------------------------------
function scoreParlay(bets: Bet[], corrMatrix: number[][], betIndices: number[]): ScoredParlay {
  const n = bets.length
  const selectedBets = betIndices.map(i => bets[i])

  // Calcular métricas agregadas
  const totalOdd = selectedBets.reduce((acc, b) => acc * b.odd, 1)
  const avgEdge = selectedBets.reduce((acc, b) => acc + b.value_percentage, 0) / n
  const combinedProb = selectedBets.reduce((acc, b) => acc * (b.estimated_probability / 100), 1) * 100

  // Correlação média entre pares
  let sumCorr = 0
  let pairCount = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      sumCorr += corrMatrix[betIndices[i]][betIndices[j]]
      pairCount++
    }
  }
  const avgCorrelation = pairCount > 0 ? sumCorr / pairCount : 0

  // Expected ROI
  const expectedROI = totalOdd * (combinedProb / 100) - 1

  // Componentes do score
  // Edge score (0-0.4)
  const edgeScore = Math.min(avgEdge / 10, 1.0) * 0.4

  // Independence score (0-0.3)
  const independenceScore = (1 - avgCorrelation) * 0.3

  // Probability score (0-0.2)
  let probabilityScore = 0
  if (combinedProb < 5) {
    probabilityScore = (combinedProb / 100) * 2 * 0.2
  } else if (combinedProb > 50) {
    probabilityScore = Math.max(0, 1 - (combinedProb - 50) / 50) * 0.2
  } else {
    probabilityScore = Math.min(combinedProb / 30, 1.0) * 0.2
  }

  // Sharpe ratio (0-0.1)
  let sharpeScore = 0
  if (combinedProb > 0) {
    const variance = selectedBets.reduce((acc, b) => {
      const p = b.estimated_probability / 100
      return acc + (b.odd * b.odd) * p * (1 - p)
    }, 0)
    const stdDev = Math.sqrt(variance)
    const sharpe = expectedROI / (stdDev + 1e-6)
    sharpeScore = Math.min(Math.max(sharpe, 0) / 2, 1.0) * 0.1
  }

  const totalScore = edgeScore + independenceScore + probabilityScore + sharpeScore

  // Kelly stake
  const kellyStake = calculateKellyStake(totalOdd, combinedProb, avgCorrelation, n)

  // Risk level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
  if (avgCorrelation < 0.25 && combinedProb >= 20) riskLevel = 'LOW'
  else if (avgCorrelation < 0.4 && combinedProb >= 10) riskLevel = 'MEDIUM'
  else if (avgCorrelation < 0.6 && combinedProb >= 5) riskLevel = 'HIGH'
  else riskLevel = 'EXTREME'

  // Warnings
  const warnings: string[] = []
  if (expectedROI < 0) warnings.push('⚠️ ROI esperado negativo')
  if (avgCorrelation > params.max_correlation) warnings.push('⚠️ Correlação média acima do limite')
  if (kellyStake < 0.5) warnings.push('ℹ️ Kelly stake muito baixo (menos de 0.5%)')
  if (kellyStake > 5) warnings.push('⚠️ Kelly stake acima de 5% (risco alto)')
  if (combinedProb < 5) warnings.push('🔴 Probabilidade combinada muito baixa (<5%)')
  if (combinedProb > 50) warnings.push('🟡 Probabilidade combinada alta (odds baixas)')
  // Verificar pares com correlação muito alta
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (corrMatrix[betIndices[i]][betIndices[j]] > 0.7) {
        warnings.push(`⚠️ Par ${i+1}-${j+1} com alta correlação (${corrMatrix[betIndices[i]][betIndices[j]].toFixed(2)})`)
      }
    }
  }

  return {
    id: betIndices.join('-'),
    bets: selectedBets,
    score: totalScore,
    totalOdd,
    avgEdge,
    avgCorrelation,
    combinedProbability: combinedProb,
    expectedROI: expectedROI * 100,
    kellyStake,
    riskLevel,
    breakdown: { edgeScore, independenceScore, probabilityScore, sharpeScore },
    warnings
  }
}

// ------------------------------------------------------------
// 7. Geração de combinações com beam search e poda
// ------------------------------------------------------------
function generateCombinationsBeam(
  bets: Bet[],
  corrMatrix: number[][],
  params: OptimizationParams
): ScoredParlay[] {
  const n = bets.length
  const k = params.num_selections
  if (n < k) return []

  // Ordenar apostas por edge (ou asset score) para beam search
  const sortedIndices = bets
    .map((_, idx) => idx)
    .sort((a, b) => bets[b].value_percentage - bets[a].value_percentage)

  // Manter apenas as top N apostas (beam width)
  const beamWidth = Math.min(50, n) // configuração
  const candidateIndices = sortedIndices.slice(0, beamWidth)

  // Gerar todas as combinações de k dentre os candidatos (C(beamWidth, k))
  const combinations: number[][] = []
  const totalCombos = comb(beamWidth, k)
  // Se for muito grande, limitar (ex: max 100k combos)
  const maxCombos = 100000
  if (totalCombos > maxCombos) {
    console.log(`[MultiBet] Muitas combinações (${totalCombos}), limitando a amostragem.`)
    // Amostrar aleatoriamente até maxCombos
    // Implementação simplificada: usar iteração com limite
    const comboList: number[][] = []
    const used = new Set<string>()
    while (comboList.length < maxCombos && comboList.length < totalCombos) {
      // Gerar combinação aleatória
      const shuffled = [...candidateIndices].sort(() => Math.random() - 0.5)
      const combo = shuffled.slice(0, k).sort((a,b) => a-b)
      const key = combo.join(',')
      if (!used.has(key)) {
        used.add(key)
        comboList.push(combo)
      }
    }
    combinations.push(...comboList)
  } else {
    // Gerar todas as combinações sistematicamente
    const generate = (start: number, chosen: number[]) => {
      if (chosen.length === k) {
        combinations.push([...chosen])
        return
      }
      for (let i = start; i < candidateIndices.length; i++) {
        chosen.push(candidateIndices[i])
        generate(i + 1, chosen)
        chosen.pop()
      }
    }
    generate(0, [])
  }

  // Calcular score para cada combinação, rejeitando as que têm correlação máxima acima do limite ou pares com correlação -1
  const scored: ScoredParlay[] = []
  for (const combo of combinations) {
    // Verificar se há pares com correlação -1 (impossíveis)
    let hasImpossible = false
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        if (corrMatrix[combo[i]][combo[j]] < 0) {
          hasImpossible = true
          break
        }
      }
      if (hasImpossible) break
    }
    if (hasImpossible) continue

    const parlay = scoreParlay(bets, corrMatrix, combo)
    // Filtrar por correlação média máxima
    if (parlay.avgCorrelation > params.max_correlation) continue
    scored.push(parlay)
  }

  // Ordenar por score decrescente
  scored.sort((a, b) => b.score - a.score)
  return scored
}

// Função auxiliar para calcular número de combinações
function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  k = Math.min(k, n - k)
  let result = 1
  for (let i = 1; i <= k; i++) {
    result = result * (n - k + i) / i
  }
  return result
}

// ------------------------------------------------------------
// 8. Diversificação dos resultados
// ------------------------------------------------------------
function diversifyResults(parlays: ScoredParlay[], topK: number): ScoredParlay[] {
  if (parlays.length === 0) return []

  const selected: ScoredParlay[] = []
  const usedBetIds = new Set<string>()

  for (const p of parlays) {
    const betIds = p.bets.map(b => b.id).join(',')
    // Verificar se este parlay compartilha mais de 60% das apostas com algum já selecionado
    let tooSimilar = false
    for (const sel of selected) {
      const common = sel.bets.filter(sb => p.bets.some(pb => pb.id === sb.id)).length
      const maxCommon = Math.max(sel.bets.length, p.bets.length)
      if (common / maxCommon > 0.6) {
        tooSimilar = true
        break
      }
    }
    if (!tooSimilar) {
      selected.push(p)
      p.bets.forEach(b => usedBetIds.add(b.id))
    }
    if (selected.length >= topK) break
  }

  // Se não atingiu topK, preencher com os próximos menos similares
  if (selected.length < topK) {
    const remaining = parlays.filter(p => !selected.includes(p))
    for (const p of remaining) {
      if (selected.length >= topK) break
      selected.push(p)
    }
  }

  return selected.slice(0, topK)
}

// ------------------------------------------------------------
// 9. Handler principal
// ------------------------------------------------------------
serve(async (req) => {
  const startTime = Date.now()
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const params = validateParams(body)

    console.log(`[MultiBet] Params: ${JSON.stringify(params)}`)

    // Buscar apostas elegíveis
    const bets = await fetchEligibleBets(supabase, params)
    console.log(`[MultiBet] Encontradas ${bets.length} apostas elegíveis`)

    if (bets.length < params.num_selections) {
      return new Response(
        JSON.stringify({
          success: true,
          eligible_count: bets.length,
          total_available: bets.length,
          total_combinations_scored: 0,
          parlays: [],
          execution_time_ms: Date.now() - startTime,
          metadata: {
            params_used: params,
            avg_correlation_threshold: params.max_correlation,
            timestamp: new Date().toISOString(),
          },
        } as OptimizationResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Construir matriz de correlação
    console.log('[MultiBet] Construindo matriz de correlação...')
    const corrMatrix = buildCorrelationMatrix(bets)
    console.log(`[MultiBet] Matriz construída (${bets.length}x${bets.length})`)

    // Gerar combinações e pontuar
    console.log('[MultiBet] Gerando combinações...')
    const scoredParlays = generateCombinationsBeam(bets, corrMatrix, params)
    console.log(`[MultiBet] Gerados ${scoredParlays.length} parlays elegíveis`)

    // Diversificar e pegar topK
    const topParlays = diversifyResults(scoredParlays, params.top_k)

    const response: OptimizationResponse = {
      success: true,
      eligible_count: bets.length,
      total_available: bets.length,
      total_combinations_scored: scoredParlays.length,
      parlays: topParlays,
      execution_time_ms: Date.now() - startTime,
      metadata: {
        params_used: params,
        avg_correlation_threshold: params.max_correlation,
        timestamp: new Date().toISOString(),
      },
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[MultiBet] Erro:', error)
    const errorResponse: OptimizationResponse = {
      success: false,
      eligible_count: 0,
      total_available: 0,
      total_combinations_scored: 0,
      parlays: [],
      execution_time_ms: Date.now() - startTime,
      metadata: {
        params_used: { num_selections: 0, min_asset_score: 0, max_correlation: 0, top_k: 0, min_odd: 0, max_odd: 0 },
        avg_correlation_threshold: 0,
        timestamp: new Date().toISOString(),
      },
      error: error.message,
    }
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})