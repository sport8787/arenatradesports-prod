import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { logEdgeError } from "../_shared/logEdgeError.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const DEFAULT_LEAGUES = [
  'soccer_brazil_campeonato',
  'soccer_brazil_serie_b',
  'soccer_brazil_campeonato_paulista',
  'soccer_brazil_campeonato_carioca',
  'soccer_brazil_campeonato_mineiro',
  'soccer_brazil_campeonato_gaucho',
  'soccer_brazil_campeonato_baiano',
  'soccer_brazil_campeonato_paranaense',
  'soccer_brazil_campeonato_catarinense',
  'soccer_brazil_campeonato_pernambucano',
  'soccer_conmebol_copa_libertadores',
  'soccer_conmebol_copa_sudamericana',
  'soccer_uefa_champs_league',
  'soccer_uefa_europa_league',
  'soccer_epl',
  'soccer_england_efl_cup',
  'soccer_spain_la_liga',
  'soccer_italy_serie_a',
  'soccer_italy_serie_b',
  'soccer_germany_bundesliga',
  'soccer_germany_bundesliga2',
  'soccer_france_ligue_one',
  'soccer_argentina_primera_division',
  'soccer_brazil_copa_nordeste',
  'soccer_brazil_copa_do_brasil',
  'soccer_brazil_serie_c',
  'soccer_brazil_copa_verde',
  'soccer_international_friendlies',
  'soccer_fifa_world_cup_qualifier_europe',
  'soccer_netherlands_eredivisie',
  'soccer_portugal_primeira_liga',
  'soccer_england_league1',
  // Feminino
  'soccer_usa_nwsl',
]

// Estaduais + Copas fallback via API-Football
const estaduaisMap: Record<string, { id: number; name: string }> = {
  'soccer_brazil_campeonato_paulista': { id: 475, name: 'Paulistão' },
  'soccer_brazil_campeonato_carioca': { id: 476, name: 'Carioca' },
  'soccer_brazil_campeonato_mineiro': { id: 477, name: 'Mineiro' },
  'soccer_brazil_campeonato_gaucho': { id: 478, name: 'Gaúcho' },
  'soccer_brazil_campeonato_baiano': { id: 479, name: 'Baiano' },
  'soccer_brazil_campeonato_paranaense': { id: 480, name: 'Paranaense' },
  'soccer_brazil_campeonato_catarinense': { id: 481, name: 'Catarinense' },
  'soccer_brazil_campeonato_pernambucano': { id: 604, name: 'Pernambucano' },
  'soccer_brazil_copa_nordeste': { id: 76, name: 'Copa do Nordeste' },
  'soccer_brazil_copa_do_brasil': { id: 75, name: 'Copa do Brasil' },
  'soccer_brazil_serie_c': { id: 73, name: 'Brasileirão Série C' },
  'soccer_brazil_copa_verde': { id: 530, name: 'Copa Verde' },
  'soccer_international_friendlies': { id: 10, name: 'Amistosos Internacionais' },
  'soccer_fifa_world_cup_qualifier_europe': { id: 32, name: 'Eliminatórias Copa do Mundo - Europa' },
}

function getSeasonYear(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  return month < 8 ? now.getFullYear() - 1 : now.getFullYear()
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

    const oddsApiKey = Deno.env.get('THE_ODDS_API_KEY')
    if (!oddsApiKey) throw new Error('THE_ODDS_API_KEY not configured')

    const apiFootballKey = '' // API-Football removida em Fase 2 (18/05/2026) — fallback estaduais desativado
    const now = new Date()
    const maxTime = new Date(now.getTime() + 48 * 60 * 60 * 1000) // 48h ahead

    const allGames: any[] = []
    const leaguesWithoutOdds: string[] = []
    let apiCreditsUsed = 0

    console.log(`[Daily Odds Cache] Starting fetch for ${DEFAULT_LEAGUES.length} leagues...`)

    // Fetch from The Odds API
    for (const league of DEFAULT_LEAGUES) {
      try {
        const res = await fetch(
          `https://api.the-odds-api.com/v4/sports/${league}/odds?` +
          `apiKey=${oddsApiKey}` +
          `&regions=br,eu` +
          `&markets=h2h,spreads,totals` +
          `&bookmakers=bet365,pinnacle,betfair` +
          `&oddsFormat=decimal`,
          { method: 'GET', headers: { 'Accept': 'application/json' } }
        )

        // Track remaining credits
        const remaining = res.headers.get('x-requests-remaining')
        if (remaining) console.log(`[Daily Odds Cache] Credits remaining: ${remaining}`)

        if (!res.ok) {
          console.warn(`[Daily Odds Cache] ${league}: HTTP ${res.status}`)
          if (estaduaisMap[league]) leaguesWithoutOdds.push(league)
          continue
        }

        apiCreditsUsed++
        const games = await res.json()
        const liveWindow = new Date(now.getTime() - 3 * 60 * 60 * 1000)
        const upcoming = games.filter((g: any) => {
          const t = new Date(g.commence_time)
          return t >= liveWindow && t <= maxTime
        })

        if (upcoming.length > 0) {
          console.log(`[Daily Odds Cache] ${league}: ${upcoming.length} games`)
          allGames.push(...upcoming.map((g: any) => ({ ...g, sport_key: league })))
        } else if (estaduaisMap[league]) {
          leaguesWithoutOdds.push(league)
        }
      } catch (err) {
        console.warn(`[Daily Odds Cache] Error ${league}:`, err)
        if (estaduaisMap[league]) leaguesWithoutOdds.push(league)
      }
    }

    // Fallback: estaduais via API-Football
    if (leaguesWithoutOdds.length > 0 && apiFootballKey) {
      console.log(`[Daily Odds Cache] Fetching ${leaguesWithoutOdds.length} estaduais from API-Football...`)
      const seasonYear = getSeasonYear()

      for (const leagueKey of leaguesWithoutOdds) {
        const info = estaduaisMap[leagueKey]
        if (!info) continue
        try {
          const today = now.toISOString().split('T')[0]
          const maxDate = maxTime.toISOString().split('T')[0]
          const res = await fetch(
            `https://v3.football.api-sports.io/fixtures?league=${info.id}&season=${seasonYear}&from=${today}&to=${maxDate}&status=NS`,
            { headers: { 'x-apisports-key': apiFootballKey } }
          )
          if (!res.ok) continue
          const data = await res.json()
          const fixtures = data.response || []

          for (const fix of fixtures) {
            const home = fix.teams?.home?.name || 'Home'
            const away = fix.teams?.away?.name || 'Away'
            allGames.push({
              id: `sim_${fix.fixture?.id || Date.now()}`,
              sport_key: leagueKey,
              sport_title: info.name,
              commence_time: fix.fixture?.date || now.toISOString(),
              home_team: home,
              away_team: away,
              simulated_odds: true,
              bookmakers: [{
                key: 'poisson_model',
                title: 'Modelo Poisson (Simulado)',
                markets: [
                  { key: 'h2h', outcomes: [{ name: home, price: 2.20 }, { name: 'Draw', price: 3.30 }, { name: away, price: 3.10 }] },
                  { key: 'totals', outcomes: [{ name: 'Over', point: 2.5, price: 1.90 }, { name: 'Under', point: 2.5, price: 1.95 }] }
                ]
              }]
            })
          }
          if (fixtures.length > 0) {
            console.log(`[Daily Odds Cache] ${info.name}: ${fixtures.length} fixtures (simulated)`)
          }
        } catch (err) {
          console.warn(`[Daily Odds Cache] Error ${info.name}:`, err)
        }
      }
    }

    console.log(`[Daily Odds Cache] Total games found: ${allGames.length}`)

    // Clear expired cache and insert fresh data
    await supabaseClient
      .from('cached_odds_games')
      .delete()
      .lt('expires_at', now.toISOString())

    if (allGames.length > 0) {
      // Upsert all games
      const rows = allGames.map((g: any) => ({
        event_id: g.id,
        sport_key: g.sport_key || g.sport_key,
        home_team: g.home_team,
        away_team: g.away_team,
        commence_time: g.commence_time,
        bookmakers: g.bookmakers || [],
        simulated_odds: g.simulated_odds || false,
        fetched_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      }))

      // Batch upsert in chunks of 50
      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50)
        const { error } = await supabaseClient
          .from('cached_odds_games')
          .upsert(chunk, { onConflict: 'event_id' })
        
        if (error) {
          console.error(`[Daily Odds Cache] Upsert error chunk ${i}:`, error)
        }
      }
    }

    const result: any = {
      success: true,
      total_games: allGames.length,
      api_credits_used: apiCreditsUsed,
      leagues_scanned: DEFAULT_LEAGUES.length,
      cached_at: now.toISOString(),
    }

    console.log(`[Daily Odds Cache] Done! ${allGames.length} games cached, ${apiCreditsUsed} API credits used`)

    // Auto-chain: trigger Mycroft Punter analysis after caching
    if (allGames.length > 0) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

        console.log(`[Daily Odds Cache] ⚡ Triggering Mycroft Punter analysis...`)
        const analysisRes = await fetch(
          `${supabaseUrl}/functions/v1/mycroft-punter-analysis`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({ hours_ahead: 48, min_value: 3 }),
          }
        )

        if (analysisRes.ok) {
          const analysisResult = await analysisRes.json()
          console.log(`[Daily Odds Cache] ✅ Analysis complete:`, JSON.stringify(analysisResult))
          result.analysis_triggered = true
          result.analysis_result = analysisResult

          // After analysis, trigger notifications
          console.log(`[Daily Odds Cache] 📧 Triggering notifications...`)
          const notifRes = await fetch(
            `${supabaseUrl}/functions/v1/send-notifications`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({}),
            }
          )
          if (notifRes.ok) {
            const notifResult = await notifRes.json()
            console.log(`[Daily Odds Cache] ✅ Notifications sent:`, JSON.stringify(notifResult))
            result.notifications = notifResult
          } else {
            console.error(`[Daily Odds Cache] ❌ Notifications failed:`, await notifRes.text())
          }
        } else {
          console.error(`[Daily Odds Cache] ❌ Analysis failed:`, await analysisRes.text())
        }
      } catch (chainErr) {
        console.error(`[Daily Odds Cache] ❌ Chain error:`, chainErr)
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[Daily Odds Cache] Fatal error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
