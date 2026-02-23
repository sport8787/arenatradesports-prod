import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-n8n-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
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

    const { type, payload } = await req.json()

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
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

  await supabaseClient
    .from('live_matches')
    .update({ mycroft_status: 'done' })
    .eq('match_id', payload.match_id)

  if (payload.verdict === 'APROVADO') {
    await supabaseClient
      .from('signals_sent')
      .insert({
        match_id: payload.match_id,
        analysis_id: data[0]?.id,
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
      analysis_id: payload.analysis_id || null,
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
  const games = payload.games || []

  if (games.length === 0) {
    return new Response(
      JSON.stringify({ success: true, inserted: 0, message: 'No games to save' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Limpa jogos antigos (>2 dias)
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  
  await supabaseClient
    .from('scheduled_games')
    .delete()
    .lt('match_date', twoDaysAgo.toISOString().split('T')[0])

  // Insere novos jogos (com upsert pra evitar duplicatas)
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
    JSON.stringify({ success: true, inserted: data.length, games: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Handler: get_scheduled_games (buscar jogos pra checar)
async function handleGetScheduledGames(supabaseClient: any, _payload: any, corsHeaders: any) {
  const now = new Date()
  const in15min = new Date(now.getTime() + 15 * 60 * 1000)
  const ago5min = new Date(now.getTime() - 5 * 60 * 1000)

  const { data, error } = await supabaseClient
    .from('scheduled_games')
    .select('*')
    .lte('check_time', in15min.toISOString())
    .gte('check_time', ago5min.toISOString())
    .eq('status', 'scheduled')
    .order('check_time', { ascending: true })
    .order('relevance_score', { ascending: false })
    .limit(20)

  if (error) throw error

  return new Response(
    JSON.stringify({ success: true, count: data.length, games: data }),
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
    JSON.stringify({ success: true, updated: data.length, games: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Helper: Dispara análise Mycroft
async function triggerMycroftAnalysis(supabaseClient: any, match: any) {
  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    
    const response = await fetch('https://api.openai.com/v1/threads/runs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        assistant_id: 'asst_XWcpEmMgF0PsqyVlGlNs4oA7',
        thread: {
          messages: [{
            role: 'user',
            content: `Analise este jogo:

${match.home_team} vs ${match.away_team}
${match.championship}
Placar: ${match.score_home} x ${match.score_away}
Minuto: ${match.minute}'

Estatísticas:
- Posse: ${match.stats?.possession_home || 0}% x ${match.stats?.possession_away || 0}%
- Ataques: ${match.stats?.attacks_home || 0} x ${match.stats?.attacks_away || 0}
- Chutes: ${match.stats?.shots_home || 0} x ${match.stats?.shots_away || 0}

Retorne sua análise em JSON.`
          }]
        }
      })
    })

    if (!response.ok) {
      console.error('Mycroft API error:', await response.text())
      return
    }
    
  } catch (error) {
    console.error('Error triggering Mycroft:', error)
  }
}
