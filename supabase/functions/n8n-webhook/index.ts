import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-n8n-token',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validação do token
    const token = req.headers.get('x-n8n-token')
    const expectedToken = Deno.env.get('N8N_WEBHOOK_TOKEN')
    
    if (!token || token !== expectedToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse body
    const { type, payload } = await req.json()

    // Cria cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Router baseado no type
    switch (type) {
      case 'live_match':
        return await handleLiveMatch(supabaseClient, payload, corsHeaders)
      
      case 'mycroft_analysis':
        return await handleMycroftAnalysis(supabaseClient, payload, corsHeaders)
      
      case 'signal_sent':
        return await handleSignalSent(supabaseClient, payload, corsHeaders)
      
      case 'scheduled_games':
        return await handleScheduledGames(supabaseClient, payload, corsHeaders)
      
      case 'get_scheduled_games':
        return await handleGetScheduledGames(supabaseClient, payload, corsHeaders)
      
      case 'mark_checking':
        return await handleMarkChecking(supabaseClient, payload, corsHeaders)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid webhook type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Handler: live_match (jogo ao vivo)
async function handleLiveMatch(supabaseClient: any, payload: any, corsHeaders: any) {
  const { data, error } = await supabaseClient
    .from('live_matches')
    .upsert({
      match_id: payload.match_id,
      championship: payload.championship,
      home_team: payload.home_team,
      away_team: payload.away_team,
      home_logo: payload.home_logo,
      away_logo: payload.away_logo,
      score_home: payload.score_home,
      score_away: payload.score_away,
      minute: payload.minute,
      period: payload.period,
      status: payload.status,
      stats: payload.stats,
      mycroft_status: 'pending',
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'match_id'
    })
    .select()

  if (error) throw error

  // Dispara análise Mycroft (se ainda não analisado)
  const match = data[0]
  if (match.mycroft_status === 'pending') {
    await triggerMycroftAnalysis(supabaseClient, match)
  }

  return new Response(
    JSON.stringify({ success: true, match }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Handler: mycroft_analysis (análise do Mycroft)
async function handleMycroftAnalysis(supabaseClient: any, payload: any, corsHeaders: any) {
  const { data, error } = await supabaseClient
    .from('mycroft_analyses')
    .insert({
      match_id: payload.match_id,
      verdict: payload.verdict,
      market: payload.market,
      odd: payload.odd,
      confidence: payload.confidence,
      thesis: payload.thesis,
      fundamentation: payload.fundamentation,
      risk_management: payload.risk_management,
      alerts: payload.alerts,
      created_at: new Date().toISOString()
    })
    .select()

  if (error) throw error

  // Atualiza status do jogo
  await supabaseClient
    .from('live_matches')
    .update({ mycroft_status: 'done' })
    .eq('match_id', payload.match_id)

  // Se aprovado, cria sinal
  if (payload.verdict === 'APROVADO') {
    await supabaseClient
      .from('signals_sent')
      .insert({
        match_id: payload.match_id,
        market: payload.market,
        odd: payload.odd,
        confidence: payload.confidence,
        sent_at: new Date().toISOString()
      })
  }

  return new Response(
    JSON.stringify({ success: true, analysis: data[0] }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Handler: signal_sent (log de sinal enviado)
async function handleSignalSent(supabaseClient: any, payload: any, corsHeaders: any) {
  const { data, error } = await supabaseClient
    .from('signals_sent')
    .insert({
      match_id: payload.match_id,
      channel: payload.channel || 'telegram',
      sent_at: new Date().toISOString()
    })
    .select()

  if (error) throw error

  return new Response(
    JSON.stringify({ success: true, signal: data[0] }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Handler: scheduled_games (salvar jogos programados do dia)
async function handleScheduledGames(supabaseClient: any, payload: any, corsHeaders: any) {
  // Payload é array de jogos
  const games = payload.games || []

  if (games.length === 0) {
    return new Response(
      JSON.stringify({ success: true, inserted: 0, message: 'No games to save' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 1. Limpa jogos antigos (>2 dias)
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  
  await supabaseClient
    .from('scheduled_games')
    .delete()
    .lt('match_date', twoDaysAgo.toISOString().split('T')[0])

  // 2. Insere novos jogos (com upsert pra evitar duplicatas)
  const { data, error } = await supabaseClient
    .from('scheduled_games')
    .upsert(
      games.map((game: any) => ({
        match_date: game.match_date,
        match_time: game.match_time,
        match_datetime: game.match_datetime,
        league_name: game.league_name,
        home_team: game.home_team,
        away_team: game.away_team,
        event_id: game.event_id || null,
        check_time: game.check_time,
        relevance_score: game.relevance_score || 5,
        status: 'scheduled',
        created_at: new Date().toISOString()
      })),
      {
        onConflict: 'match_date,match_time,home_team,away_team',
        ignoreDuplicates: false
      }
    )
    .select()

  if (error) {
    console.error('Error inserting games:', error)
    throw error
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      inserted: data.length,
      games: data 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Handler: get_scheduled_games (buscar jogos pra checar)
async function handleGetScheduledGames(supabaseClient: any, payload: any, corsHeaders: any) {
  const now = new Date()
  const in15min = new Date(now.getTime() + 15 * 60 * 1000)
  const ago60min = new Date(now.getTime() - 60 * 60 * 1000)  // Janela de 1 hora antes

  const { data, error } = await supabaseClient
    .from('scheduled_games')
    .select('*')
    .lte('check_time', in15min.toISOString())
    .gte('check_time', ago60min.toISOString())
    .eq('status', 'scheduled')
    .order('check_time', { ascending: true })
    .order('relevance_score', { ascending: false })
    .limit(20)

  if (error) throw error

  return new Response(
    JSON.stringify({ 
      success: true, 
      count: data.length,
      games: data 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Handler: mark_checking (marcar jogos como sendo checados)
async function handleMarkChecking(supabaseClient: any, payload: any, corsHeaders: any) {
  const gameIds = payload.game_ids || []

  if (gameIds.length === 0) {
    return new Response(
      JSON.stringify({ success: true, updated: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { data, error } = await supabaseClient
    .from('scheduled_games')
    .update({ 
      status: 'checking',
      updated_at: new Date().toISOString()
    })
    .in('id', gameIds)
    .select()

  if (error) throw error

  return new Response(
    JSON.stringify({ 
      success: true, 
      updated: data.length,
      games: data 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Helper: Dispara análise Mycroft via Gemini (Lovable AI Gateway)
async function triggerMycroftAnalysis(supabaseClient: any, match: any) {
  try {
    console.log(`[Mycroft] Analisando: ${match.home_team} vs ${match.away_team} (${match.minute}')`)

    // 1. Carregar Knowledge Base
    let kbContent = ''
    const { data: kbData, error: kbError } = await supabaseClient.storage
      .from('sports-knowledge-base')
      .download('ricardo-santos-methodology.md')

    if (kbError || !kbData) {
      console.warn('[Mycroft] KB não encontrada, usando fallback mínimo')
      kbContent = `Estratégias validadas no mercado:
- Assimetria mínima: 2x-3x já é suficiente
- Padrões: Back Favorito 1T (20-40min, odds 1.70-2.30), Lay Favorito 2T (empatado 60min+), Under (jogos mortos)
- Gestão: 5% da banca, stop loss claro
- Calibração: 30-40% de aprovação`
    } else {
      kbContent = await kbData.text()
      console.log('[Mycroft] KB carregada:', kbContent.length, 'caracteres')
    }

    // 2. Carregar prompt customizado (opcional)
    let customPrompt = ''
    const { data: promptData, error: promptError } = await supabaseClient.storage
      .from('sports-knowledge-base')
      .download('prompt_mycroft.txt')

    if (!promptError && promptData) {
      customPrompt = await promptData.text()
      console.log('[Mycroft] Prompt customizado carregado')
    } else {
      customPrompt = `Você é Mycroft, o analista de apostas esportivas da Arena Trader.
Sua missão é analisar jogos ao vivo e identificar oportunidades baseadas em ASSIMETRIA estatística.

REGRAS DE APROVAÇÃO:
1. ASSIMETRIA mínima: 2x-3x diferença
2. Target: 30-40% de aprovação
3. Padrões principais: Back Favorito 1T, Lay Favorito 2T, Under
4. Se vetando >70%, você NÃO está calibrado

Retorne APENAS JSON válido, sem preamble ou markdown.`
    }

    // 3. Calcular assimetria
    const stats = match.stats || {}
    const safeDivide = (a: number, b: number) => (b > 0 ? a / b : 1)
    const possessionRatio = Math.max(
      safeDivide(stats.possession_home || 50, stats.possession_away || 50),
      safeDivide(stats.possession_away || 50, stats.possession_home || 50)
    )
    const attacksRatio = Math.max(
      safeDivide(stats.attacks_home || 0, stats.attacks_away || 1),
      safeDivide(stats.attacks_away || 0, stats.attacks_home || 1)
    )
    const shotsRatio = Math.max(
      safeDivide(stats.shots_home || 0, stats.shots_away || 1),
      safeDivide(stats.shots_away || 0, stats.shots_home || 1)
    )
    const maxAssimetria = Math.max(possessionRatio, attacksRatio, shotsRatio)

    console.log('[Mycroft] Assimetrias:', {
      posse: possessionRatio.toFixed(2),
      ataques: attacksRatio.toFixed(2),
      chutes: shotsRatio.toFixed(2),
      max: maxAssimetria.toFixed(2)
    })

    // 4. Montar prompt
    const analysisPrompt = `
${customPrompt}

═══════════════════════════════════════
JOGO AO VIVO - ANÁLISE
═══════════════════════════════════════

🏆 LIGA: ${match.championship}
⚽ TIMES: ${match.home_team} vs ${match.away_team}
📊 PLACAR: ${match.score_home} x ${match.score_away}
⏱️ MINUTO: ${match.minute}' (${match.period})

ESTATÍSTICAS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Posse: ${stats.possession_home}% x ${stats.possession_away}% (${possessionRatio.toFixed(2)}x)
⚡ Ataques: ${stats.attacks_home} x ${stats.attacks_away} (${attacksRatio.toFixed(2)}x)
🎯 Chutes: ${stats.shots_home} x ${stats.shots_away} (${shotsRatio.toFixed(2)}x)
🔥 ASSIMETRIA MÁXIMA: ${maxAssimetria.toFixed(2)}x
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KNOWLEDGE BASE:
${kbContent}

═══════════════════════════════════════
INSTRUÇÕES DE RESPOSTA
═══════════════════════════════════════
Retorne APENAS JSON válido:
{
  "verdict": "APROVADO" ou "VETADO",
  "market": "Over 0.5 HT" | "Back Casa 1T" | "Lay Favorito 2T" | "Under" | null,
  "odd": 1.85,
  "confidence": 75,
  "thesis": "Tese principal (2-3 linhas)",
  "fundamentation": "Dados estatísticos",
  "risk_management": "Gestão de risco",
  "alerts": "Alertas importantes"
}

ANALISE AGORA:`

    // 5. Chamar Gemini
    console.log('[Mycroft] Chamando Gemini...')
    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': Deno.env.get('GEMINI_API_KEY') ?? ''
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: analysisPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
        })
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('[Mycroft] Erro Gemini:', errorText)
      return
    }

    const geminiData = await geminiResponse.json()
    const analysisText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!analysisText) {
      console.error('[Mycroft] Gemini não retornou análise válida')
      return
    }

    console.log('[Mycroft] Resposta recebida:', analysisText.substring(0, 200))

    // Parse JSON
    const cleanJson = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    let analysis
    try {
      analysis = JSON.parse(cleanJson)
    } catch (parseError) {
      console.error('[Mycroft] Erro ao parsear JSON:', cleanJson)
      return
    }

    console.log('[Mycroft] Resultado:', analysis.verdict, '-', analysis.market)

    // 6. Salvar análise no banco
    const { data: analysisData, error: analysisError } = await supabaseClient
      .from('mycroft_analyses')
      .insert({
        match_id: match.match_id,
        verdict: analysis.verdict,
        market: analysis.market || 'N/A',
        odd: analysis.odd,
        confidence: analysis.confidence,
        thesis: analysis.thesis || '',
        fundamentation: analysis.fundamentation,
        risk_management: analysis.risk_management,
        alerts: analysis.alerts ? (Array.isArray(analysis.alerts) ? analysis.alerts : [analysis.alerts]) : [],
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (analysisError) {
      console.error('[Mycroft] Erro ao salvar análise:', analysisError)
      return
    }

    console.log('[Mycroft] Análise salva em mycroft_analyses')

    // 7. Atualizar status do jogo
    await supabaseClient
      .from('live_matches')
      .update({ 
        mycroft_status: 'done',
        mycroft_analysis_id: analysisData.id
      })
      .eq('match_id', match.match_id)

    console.log('[Mycroft] Status atualizado para done')

    // 8. Se APROVADO, criar sinal
    if (analysis.verdict === 'APROVADO') {
      await supabaseClient
        .from('signals_sent')
        .insert({
          match_id: match.match_id,
          analysis_id: analysisData.id,
          sent_telegram: false,
          sent_whatsapp: false
        })

      console.log('[Mycroft] ✅ Sinal APROVADO registrado')
    } else {
      console.log('[Mycroft] ❌ Sinal VETADO - não registrado')
    }

  } catch (error) {
    console.error('[Mycroft] Erro na análise:', error)
  }
}
