import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      min_value = 3
    } = requestBody

    const leaguesToScan: string[] = sport ? [sport] : sports

    console.log(`[Mycroft Punter] Leagues: ${leaguesToScan.length}, Hours: ${hours_ahead}h, Min Value: ${min_value}%`)

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

    // 3. Analyze each game
    const approvedSignals: any[] = []
    let totalAnalyzed = 0

    for (const game of allUpcomingGames) {
      totalAnalyzed++
      try {
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
      JSON.stringify({ success: true, signals: approvedSignals, total_analyzed: totalAnalyzed, total_approved: approvedSignals.length, leagues_scanned: leaguesToScan.length, timestamp: new Date().toISOString() }),
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
// API-Football: Fetch team stats & fixtures
// ═══════════════════════════════════════════════

async function searchTeamId(teamName: string, apiKey: string): Promise<number | null> {
  if (!apiKey) return null
  try {
    const res = await fetch(
      `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(teamName)}`,
      { headers: { 'x-apisports-key': apiKey } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const team = data.response?.[0]
    return team?.team?.id || null
  } catch (e) {
    console.warn(`[API-Football] Erro buscando team ${teamName}:`, e)
    return null
  }
}

async function fetchTeamStats(teamId: number, apiKey: string): Promise<any> {
  if (!apiKey || !teamId) return null
  try {
    // Get current season
    const year = new Date().getFullYear()
    
    // Fetch last 5 fixtures for form
    const fixturesRes = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&last=5&status=FT`,
      { headers: { 'x-apisports-key': apiKey } }
    )
    
    let recentFixtures: any[] = []
    if (fixturesRes.ok) {
      const fixturesData = await fixturesRes.json()
      recentFixtures = fixturesData.response || []
    }

    // Calculate form stats from recent fixtures
    let goalsScored = 0, goalsConceded = 0, wins = 0, draws = 0, losses = 0
    let shotsOnTarget = 0, shotsTotal = 0, possession = 0, cornerKicks = 0
    let hasDetailedStats = false

    for (const fixture of recentFixtures) {
      const isHome = fixture.teams?.home?.id === teamId
      const homeGoals = fixture.goals?.home ?? 0
      const awayGoals = fixture.goals?.away ?? 0

      goalsScored += isHome ? homeGoals : awayGoals
      goalsConceded += isHome ? awayGoals : homeGoals

      if (isHome ? fixture.teams?.home?.winner : fixture.teams?.away?.winner) wins++
      else if (homeGoals === awayGoals) draws++
      else losses++

      // Try to get detailed stats per fixture
      if (fixture.statistics) {
        hasDetailedStats = true
        const teamStats = fixture.statistics?.find((s: any) => s.team?.id === teamId)
        if (teamStats?.statistics) {
          for (const stat of teamStats.statistics) {
            if (stat.type === 'Shots on Goal') shotsOnTarget += (parseInt(stat.value) || 0)
            if (stat.type === 'Total Shots') shotsTotal += (parseInt(stat.value) || 0)
            if (stat.type === 'Ball Possession') possession += (parseFloat(stat.value) || 0)
            if (stat.type === 'Corner Kicks') cornerKicks += (parseInt(stat.value) || 0)
          }
        }
      }
    }

    // If we didn't get inline stats, fetch them separately for last fixture
    if (!hasDetailedStats && recentFixtures.length > 0) {
      try {
        const lastFixtureId = recentFixtures[0]?.fixture?.id
        if (lastFixtureId) {
          const statsRes = await fetch(
            `https://v3.football.api-sports.io/fixtures/statistics?fixture=${lastFixtureId}`,
            { headers: { 'x-apisports-key': apiKey } }
          )
          if (statsRes.ok) {
            const statsData = await statsRes.json()
            const teamStatBlock = statsData.response?.find((s: any) => s.team?.id === teamId)
            if (teamStatBlock?.statistics) {
              hasDetailedStats = true
              for (const stat of teamStatBlock.statistics) {
                if (stat.type === 'Shots on Goal') shotsOnTarget = parseInt(stat.value) || 0
                if (stat.type === 'Total Shots') shotsTotal = parseInt(stat.value) || 0
                if (stat.type === 'Ball Possession') possession = parseFloat(stat.value) || 0
                if (stat.type === 'Corner Kicks') cornerKicks = parseInt(stat.value) || 0
              }
            }
          }
        }
      } catch { /* optional */ }
    }

    const matchesPlayed = recentFixtures.length || 1

    return {
      team_id: teamId,
      matches_played: matchesPlayed,
      wins, draws, losses,
      goals_scored: goalsScored,
      goals_conceded: goalsConceded,
      avg_goals_scored: (goalsScored / matchesPlayed).toFixed(2),
      avg_goals_conceded: (goalsConceded / matchesPlayed).toFixed(2),
      form: recentFixtures.map((f: any) => {
        const isHome = f.teams?.home?.id === teamId
        const hg = f.goals?.home ?? 0
        const ag = f.goals?.away ?? 0
        if (isHome) return hg > ag ? 'W' : hg === ag ? 'D' : 'L'
        return ag > hg ? 'W' : ag === hg ? 'D' : 'L'
      }).join(''),
      has_detailed_stats: hasDetailedStats,
      avg_shots_on_target: hasDetailedStats ? (shotsOnTarget / matchesPlayed).toFixed(1) : null,
      avg_shots_total: hasDetailedStats ? (shotsTotal / matchesPlayed).toFixed(1) : null,
      avg_possession: hasDetailedStats ? (possession / matchesPlayed).toFixed(1) : null,
      avg_corners: hasDetailedStats ? (cornerKicks / matchesPlayed).toFixed(1) : null,
    }
  } catch (e) {
    console.warn(`[API-Football] Erro buscando stats team ${teamId}:`, e)
    return null
  }
}

async function fetchEnrichedData(homeTeam: string, awayTeam: string, apiKey: string) {
  if (!apiKey) return { home: null, away: null, model_level: 'NIVEL_3' }

  const [homeId, awayId] = await Promise.all([
    searchTeamId(homeTeam, apiKey),
    searchTeamId(awayTeam, apiKey)
  ])

  if (!homeId && !awayId) {
    console.log(`[API-Football] Nenhum time encontrado: ${homeTeam}, ${awayTeam}`)
    return { home: null, away: null, model_level: 'NIVEL_3' }
  }

  const [homeStats, awayStats] = await Promise.all([
    homeId ? fetchTeamStats(homeId, apiKey) : null,
    awayId ? fetchTeamStats(awayId, apiKey) : null
  ])

  // Determine model level
  const hasStats = homeStats || awayStats
  const hasDetailedStats = homeStats?.has_detailed_stats || awayStats?.has_detailed_stats
  let model_level = 'NIVEL_3'
  if (hasDetailedStats) model_level = 'NIVEL_1'
  else if (hasStats) model_level = 'NIVEL_2'

  return { home: homeStats, away: awayStats, model_level }
}

function formatTeamStatsBlock(teamName: string, stats: any): string {
  if (!stats) return `${teamName}: Dados não disponíveis na API-Football`
  
  let block = `${teamName} (últimos ${stats.matches_played} jogos):
  Forma: ${stats.form || 'N/A'}
  Resultados: ${stats.wins}V ${stats.draws}E ${stats.losses}D
  Gols Marcados: ${stats.goals_scored} (média: ${stats.avg_goals_scored}/jogo)
  Gols Sofridos: ${stats.goals_conceded} (média: ${stats.avg_goals_conceded}/jogo)`

  if (stats.has_detailed_stats) {
    block += `
  Finalizações Totais (média): ${stats.avg_shots_total}
  Finalizações no Gol (média): ${stats.avg_shots_on_target}
  Posse de Bola (média): ${stats.avg_possession}%
  Escanteios (média): ${stats.avg_corners}`
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
// Main analysis function
// ═══════════════════════════════════════════════

async function analyzeGame(
  game: any,
  customPrompt: string,
  methodology: string,
  valueGuide: string,
  minValue: number,
  supabaseClient: any,
  apiFootballKey: string
) {
  const matchId = `${game.home_team}_${game.away_team}_${game.commence_time}`.replace(/\s+/g, '_')
  console.log(`[Mycroft Punter] Analisando: ${game.home_team} vs ${game.away_team}`)

  const oddsData = extractOdds(game)
  const totalsData = extractTotals(game)
  if (oddsData.length === 0 && totalsData.length === 0) return null

  // Fetch enriched data from API-Football
  const enriched = await fetchEnrichedData(game.home_team, game.away_team, apiFootballKey)

  const homeStatsBlock = formatTeamStatsBlock(game.home_team, enriched.home)
  const awayStatsBlock = formatTeamStatsBlock(game.away_team, enriched.away)

  const dataStrengthLabel = enriched.model_level === 'NIVEL_1' ? 'ALTA (stats detalhadas disponíveis)'
    : enriched.model_level === 'NIVEL_2' ? 'MEDIA (stats básicas disponíveis)'
    : 'BAIXA (apenas odds disponíveis)'

  const analysisPrompt = `
${customPrompt}

═══════════════════════════════════════
JOGO PRÉ-JOGO - ANÁLISE DE VALUE
═══════════════════════════════════════

⚽ TIMES: ${game.home_team} vs ${game.away_team}
🏆 LIGA: ${game.sport_title || 'N/A'}
📅 HORÁRIO: ${new Date(game.commence_time).toLocaleString('pt-BR')}
📊 NÍVEL DE DADOS: ${dataStrengthLabel}
🔧 MODELO SUGERIDO: ${enriched.model_level}

═══════════════════════════════════════
DADOS API-FOOTBALL (Estatísticas Reais)
═══════════════════════════════════════

${homeStatsBlock}

${awayStatsBlock}

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
  "verdict": "APROVADO" ou "VETADO" (use EXATAMENTE "APROVADO" se aprovado, não use variações como APROVADO_TIER_1),
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
  "risk_factors": "Riscos e limitações do modelo aplicado"
}

IMPORTANTE: Siga RIGOROSAMENTE os critérios de aprovação/veto definidos no prompt acima.
- Use os tiers e thresholds EXATOS do prompt (não invente critérios extras)
- Se NIVEL_3 (apenas odds): aplique penalização de stake conforme prompt
- CONSIDERE TODOS OS MERCADOS (H2H e Over/Under) e retorne aquele com MAIOR edge
- META DE APROVAÇÃO: 50-70% dos jogos devem ser APROVADOS conforme o prompt
- Edge ≥ 2% com Confiança ≥ 58% = APROVAR (Tier 3 mínimo)
- NÃO invente motivos extras de veto que não estejam no prompt
- NÃO vete por "amostra pequena", "volatilidade alta", "última rodada" ou "sem motivação"
- Se há edge ≥ 2% e EV positivo, APROVE no tier correspondente

ANALISE AGORA:`

  // Call Lovable AI Gateway
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured')

  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.3,
      max_tokens: 1500,
    })
  })

  if (!aiResponse.ok) {
    const errText = await aiResponse.text()
    throw new Error(`AI Gateway error ${aiResponse.status}: ${errText}`)
  }

  const aiData = await aiResponse.json()
  let analysisText = aiData.choices?.[0]?.message?.content
  if (!analysisText) throw new Error('AI não retornou análise válida')

  // Parse JSON
  const cleanJson = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  let analysis: any
  try {
    analysis = JSON.parse(cleanJson)
  } catch {
    console.error('[Mycroft Punter] Erro ao parsear JSON:', cleanJson.substring(0, 200))
    throw new Error('Falha ao parsear análise')
  }

  console.log(`[Mycroft Punter] ${game.home_team} vs ${game.away_team}: ${analysis.verdict} | Model: ${analysis.model_level} | Value: ${analysis.value_percentage}% | EV: ${analysis.expected_value}`)

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
  }).select().single()

  // If approved, create signal (handle both "APROVADO" and "APROVADO_TIER_X" formats)
  const isApproved = typeof analysis.verdict === 'string' && analysis.verdict.startsWith('APROVADO')
  if (isApproved && analysisRow) {
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
}
