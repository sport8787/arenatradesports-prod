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
      sport = 'soccer_brazil_campeonato',
      hours_ahead = 48,
      bookmakers = ['bet365', 'pinnacle', 'betfair'],
      min_value = 5
    } = requestBody

    console.log(`[Mycroft Punter] Sport: ${sport}, Hours: ${hours_ahead}h, Min Value: ${min_value}%`)

    // 1. Busca jogos futuros (The Odds API)
    const oddsApiKey = Deno.env.get('THE_ODDS_API_KEY')
    if (!oddsApiKey) throw new Error('THE_ODDS_API_KEY not configured')

    const oddsResponse = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/odds?` +
      `apiKey=${oddsApiKey}` +
      `&regions=br,eu` +
      `&markets=h2h,spreads,totals` +
      `&bookmakers=${bookmakers.join(',')}` +
      `&oddsFormat=decimal`,
      { method: 'GET', headers: { 'Accept': 'application/json' } }
    )

    if (!oddsResponse.ok) {
      throw new Error(`The Odds API error: ${oddsResponse.status}`)
    }

    const games = await oddsResponse.json()
    console.log(`[Mycroft Punter] ${games.length} jogos encontrados`)

    // Filtra jogos nas próximas X horas
    const now = new Date()
    const maxTime = new Date(now.getTime() + hours_ahead * 60 * 60 * 1000)
    const upcomingGames = games.filter((game: any) => {
      const commenceTime = new Date(game.commence_time)
      return commenceTime > now && commenceTime <= maxTime
    })

    console.log(`[Mycroft Punter] ${upcomingGames.length} jogos nas próximas ${hours_ahead}h`)

    if (upcomingGames.length === 0) {
      return new Response(
        JSON.stringify({ success: true, signals: [], total_analyzed: 0, total_approved: 0, message: `Nenhum jogo nas próximas ${hours_ahead}h` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Busca Knowledge Base do bucket
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
      customPrompt = `Você é Mycroft Punter, o analista de VALUE BETTING da Arena Trader.
Sua missão é identificar apostas com value positivo baseado em análise probabilística.
FOCO: Encontrar odds acima do justo (value betting).
TARGET: Aprovar 10-20% dos jogos analisados (só os melhores).
METODOLOGIA: Danilo Pereira, Netuno, análise probabilística.`
    }

    console.log('[Mycroft Punter] KB carregada, prompt: ' + (customPrompt ? 'Custom' : 'Default'))

    // 3. Analisa cada jogo
    const approvedSignals: any[] = []
    let totalAnalyzed = 0

    for (const game of upcomingGames) {
      totalAnalyzed++
      try {
        const analysis = await analyzeGame(game, customPrompt, methodologyContent, valueGuideContent, min_value, supabaseClient)
        if (analysis && analysis.verdict === 'APROVADO') {
          approvedSignals.push({
            match: {
              home_team: game.home_team,
              away_team: game.away_team,
              commence_time: game.commence_time,
              league: sport
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
      JSON.stringify({ success: true, signals: approvedSignals, total_analyzed: totalAnalyzed, total_approved: approvedSignals.length, timestamp: new Date().toISOString() }),
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

// Analisa um jogo individual via Lovable AI Gateway (Gemini)
async function analyzeGame(
  game: any,
  customPrompt: string,
  methodology: string,
  valueGuide: string,
  minValue: number,
  supabaseClient: any
) {
  const matchId = `${game.home_team}_${game.away_team}_${game.commence_time}`.replace(/\s+/g, '_')
  console.log(`[Mycroft Punter] Analisando: ${game.home_team} vs ${game.away_team}`)

  const oddsData = extractOdds(game)
  if (oddsData.length === 0) return null

  const analysisPrompt = `
${customPrompt}

═══════════════════════════════════════
JOGO PRÉ-JOGO - ANÁLISE DE VALUE
═══════════════════════════════════════

⚽ TIMES: ${game.home_team} vs ${game.away_team}
🏆 LIGA: ${game.sport_title || 'N/A'}
📅 HORÁRIO: ${new Date(game.commence_time).toLocaleString('pt-BR')}

ODDS DISPONÍVEIS (Mercado H2H - 1X2):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${oddsData.map((o: any) => `
${o.bookmaker}:
  ${game.home_team}: ${o.home_odd}
  Empate: ${o.draw_odd}
  ${game.away_team}: ${o.away_odd}
`).join('\n')}

ANÁLISE DE PROBABILIDADES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${calculateProbabilities(oddsData[0])}

${methodology ? `KNOWLEDGE BASE (Metodologia Value Betting):\n${methodology}` : ''}
${valueGuide ? `\nGUIA DE VALUE:\n${valueGuide}` : ''}

═══════════════════════════════════════
INSTRUÇÕES DE RESPOSTA
═══════════════════════════════════════

Retorne APENAS um objeto JSON válido (sem \`\`\`json, sem preamble):

{
  "verdict": "APROVADO" ou "VETADO",
  "market": "Casa" | "Empate" | "Fora" | "Over 2.5" | "Under 2.5" | null,
  "bookmaker": "Bet365" | "Pinnacle" | "Betfair",
  "odd": 2.10,
  "fair_odd": 1.85,
  "implied_probability": 47.6,
  "estimated_probability": 54.1,
  "value_percentage": 13.5,
  "confidence": 72,
  "stake_percentage": 3,
  "thesis": "Análise principal (2-3 linhas)",
  "analysis": "Análise detalhada com fundamentação probabilística",
  "risk_factors": "Fatores de risco a considerar"
}

CRITÉRIOS PARA APROVAR:
- Value >= ${minValue}% (diferença entre probabilidade real e implícita)
- Confiança >= 70%
- Odd entre 1.70 e 3.50 (sweet spot)
- Casa de apostas confiável
- Lógica clara e fundamentada

ANALISE AGORA:`

  // Chama Lovable AI Gateway (Gemini)
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
      temperature: 0.7,
      max_tokens: 1000,
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

  console.log(`[Mycroft Punter] ${game.home_team} vs ${game.away_team}: ${analysis.verdict} - Value: ${analysis.value_percentage}%`)

  // Salva análise no banco
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

  // Se aprovado, cria sinal
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
}

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

function calculateProbabilities(odds: any) {
  if (!odds) return 'Sem dados'
  const homeProb = (1 / odds.home_odd * 100).toFixed(2)
  const drawProb = odds.draw_odd > 0 ? (1 / odds.draw_odd * 100).toFixed(2) : '0'
  const awayProb = (1 / odds.away_odd * 100).toFixed(2)
  const total = parseFloat(homeProb) + parseFloat(drawProb) + parseFloat(awayProb)
  const overround = (total - 100).toFixed(2)
  return `
Probabilidade Implícita (${odds.bookmaker}):
- Casa: ${homeProb}%
- Empate: ${drawProb}%
- Fora: ${awayProb}%
- Total: ${total.toFixed(2)}%
- Overround (margem): ${overround}%`
}
