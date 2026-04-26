// =============================================================================
// PLANO FAVORITO — Edge Function Pré-Live
// Supabase Edge Function | Bluffer Entertainment
// Mercados: Vitória do Favorito | Over 1.5 FT | Over 2.5 FT
// Favorito com odd entre 1.40 e 2.00
// Roda via cron: 08:00 e 14:00 BRT
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SVC_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_FOOTBALL_KEY  = Deno.env.get('API_FOOTBALL_KEY') ?? ''
const ODDS_API_KEY      = Deno.env.get('ODDS_API_KEY') ?? ''
const TELEGRAM_TOKEN    = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const TELEGRAM_CHAT     = Deno.env.get('TELEGRAM_CHAT_ID') ?? ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY)
const AF_BASE  = 'https://v3.football.api-sports.io'

// =============================================================================
// LIGAS PERMITIDAS (campeonatos regulares — sem copas)
// =============================================================================
const LIGAS_PERMITIDAS = new Set([
  71, 72,         // Brasileirão A e B
  39, 40,         // Premier League, Championship
  140,            // La Liga
  135,            // Serie A
  78, 79,         // Bundesliga 1 e 2
  61,             // Ligue 1
  94,             // Primeira Liga
  203,            // Süper Lig
  144,            // Jupiler Pro League
  88,             // Eredivisie
  179,            // Scottish Premiership
  253,            // MLS
  262,            // Liga MX
  197,            // Super League Grécia
  307,            // Saudi Pro League
])

// Mapeamento de ligas para odds API sport key
const LIGAS_ODDS_API: Record<number, string> = {
  39: 'soccer_epl',
  140: 'soccer_spain_la_liga',
  135: 'soccer_italy_serie_a',
  78: 'soccer_germany_bundesliga',
  61: 'soccer_france_ligue_one',
  71: 'soccer_brazil_campeonato',
  88: 'soccer_netherlands_eredivisie',
  94: 'soccer_portugal_primeira_liga',
}

// =============================================================================
// TIPOS
// =============================================================================

interface TeamStats {
  goals: {
    for: { average: { home: string; away: string }; total: { home: number; away: number } }
    against: { average: { home: string; away: string }; total: { home: number; away: number } }
  }
  fixtures: {
    played: { home: number; away: number }
    wins: { home: number; away: number }
    draws: { home: number; away: number }
    loses: { home: number; away: number }
  }
  clean_sheet: { home: number; away: number }
  failed_to_score: { home: number; away: number }
  form: string
}

interface FixtureResult {
  fixture: { id: number; date: string }
  goals: { home: number | null; away: number | null }
  teams: { home: { id: number }; away: { id: number } }
}

interface OddsMarket {
  over15: number | null
  over25: number | null
  favOdd: number | null
  undOdd: number | null
  homeOdd?: number | null
  awayOdd?: number | null
}

interface Analise {
  fixtureId: number
  homeTeam: string
  awayTeam: string
  homeTeamId: number
  awayTeamId: number
  leagueId: number
  leagueName: string
  matchDate: string
  season: number
  isFavoriteHome: boolean
  favOdd: number
  undOdd: number
  scoreVitoria: number
  scoreOver15: number
  scoreOver25: number
  statusVitoria: string
  statusOver15: string
  statusOver25: string
  indicadores: Record<string, number | string>
}

// =============================================================================
// HELPERS API
// =============================================================================

async function afFetch(path: string, params: Record<string, string | number>) {
  const url = new URL(`${AF_BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  const r = await fetch(url.toString(), { headers: { 'x-apisports-key': API_FOOTBALL_KEY } })
  if (!r.ok) throw new Error(`AF ${path} → ${r.status}`)
  const d = await r.json()
  return d.response
}

async function getTeamStats(teamId: number, leagueId: number, season: number): Promise<TeamStats | null> {
  try {
    const r = await afFetch('/teams/statistics', { team: teamId, league: leagueId, season })
    return r as TeamStats
  } catch { return null }
}

async function getRecentFixtures(teamId: number, last = 10): Promise<FixtureResult[]> {
  try {
    return await afFetch('/fixtures', { team: teamId, last }) as FixtureResult[]
  } catch { return [] }
}

async function getH2H(homeId: number, awayId: number, last = 5): Promise<FixtureResult[]> {
  try {
    return await afFetch('/fixtures/headtohead', { h2h: `${homeId}-${awayId}`, last }) as FixtureResult[]
  } catch { return [] }
}

async function getUpcomingFixtures(): Promise<any[]> {
  const now  = new Date()
  const from = now.toISOString().split('T')[0]
  const to   = new Date(now.getTime() + 36 * 3600 * 1000).toISOString().split('T')[0]
  const season = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  // Brazilian leagues use the calendar year as season
  const seasonBR = now.getUTCFullYear()

  const ligas = Array.from(LIGAS_PERMITIDAS)
  const all: any[] = []

  // Busca em paralelo (lotes de 4 para respeitar rate limit)
  for (let i = 0; i < ligas.length; i += 4) {
    const lote = ligas.slice(i, i + 4)
    const results = await Promise.allSettled(
      lote.map(async (leagueId) => {
        // Brasileirão (71/72) usa ano-calendário; europeias usam temporada cruzada
        const seasonsToTry = [71, 72, 253, 262, 307].includes(leagueId)
          ? [seasonBR, seasonBR - 1]
          : [season, season + 1, seasonBR]
        for (const s of seasonsToTry) {
          try {
            const r = await afFetch('/fixtures', {
              league: leagueId,
              season: s,
              from,
              to,
              status: 'NS-TBD',
              timezone: 'America/Recife',
            })
            if (r && r.length > 0) {
              console.log(`[PLANO FAVORITO] liga ${leagueId} season ${s}: ${r.length} jogos`)
              return r
            }
          } catch (e) {
            console.warn(`[PLANO FAVORITO] liga ${leagueId} s${s} erro:`, String(e))
          }
        }
        return []
      }),
    )
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value)
    }
    if (i + 4 < ligas.length) await new Promise((res) => setTimeout(res, 1500))
  }
  return all
}

// =============================================================================
// BUSCA ODDS — The Odds API
// =============================================================================

async function getOdds(
  homeTeam: string,
  awayTeam: string,
  leagueId: number
): Promise<OddsMarket> {
  const sportKey = LIGAS_ODDS_API[leagueId]
  if (!sportKey) return { over15: null, over25: null, favOdd: null, undOdd: null, homeOdd: null, awayOdd: null }

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`+
      `?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal`

    const r  = await fetch(url)
    const d  = await r.json() as any[]
    const game = Array.isArray(d) ? d.find((g: any) =>
      g.home_team?.toLowerCase().includes(homeTeam.toLowerCase().split(' ')[0]) ||
      g.away_team?.toLowerCase().includes(awayTeam.toLowerCase().split(' ')[0])
    ) : null
    if (!game) return { over15: null, over25: null, favOdd: null, undOdd: null, homeOdd: null, awayOdd: null }

    let over15: number | null = null
    let over25: number | null = null
    let homeOdd: number | null = null
    let awayOdd: number | null = null

    for (const bm of (game.bookmakers || [])) {
      for (const mkt of (bm.markets || [])) {
        if (mkt.key === 'h2h') {
          const h = mkt.outcomes.find((o: any) => o.name === game.home_team)
          const a = mkt.outcomes.find((o: any) => o.name === game.away_team)
          if (h && !homeOdd) homeOdd = h.price
          if (a && !awayOdd) awayOdd = a.price
        }
        if (mkt.key === 'totals') {
          const o15 = mkt.outcomes.find((o: any) => o.name === 'Over' && Math.abs(o.point - 1.5) < 0.1)
          const o25 = mkt.outcomes.find((o: any) => o.name === 'Over' && Math.abs(o.point - 2.5) < 0.1)
          if (o15 && !over15) over15 = o15.price
          if (o25 && !over25) over25 = o25.price
        }
      }
      if (homeOdd && awayOdd && over15 && over25) break
    }

    const isFavHome  = homeOdd !== null && awayOdd !== null ? homeOdd <= awayOdd : true
    const favOdd = homeOdd && awayOdd ? (isFavHome ? homeOdd : awayOdd) : null
    const undOdd = homeOdd && awayOdd ? (isFavHome ? awayOdd : homeOdd) : null

    return { over15, over25, favOdd, undOdd, homeOdd, awayOdd }
  } catch { return { over15: null, over25: null, favOdd: null, undOdd: null, homeOdd: null, awayOdd: null } }
}

// =============================================================================
// CÁLCULOS DE INDICADORES
// =============================================================================

function calcWinRate(fixtures: FixtureResult[], teamId: number, local: 'home' | 'away', last = 10): number {
  const jogos = fixtures
    .filter(f =>
      f.goals.home !== null && f.goals.away !== null &&
      (local === 'home' ? f.teams.home.id === teamId : f.teams.away.id === teamId)
    )
    .slice(0, last)
  if (jogos.length < 3) return -1
  const wins = jogos.filter(f => {
    const gh = f.goals.home ?? 0, ga = f.goals.away ?? 0
    return local === 'home' ? gh > ga : ga > gh
  })
  return Math.round((wins.length / jogos.length) * 100)
}

// =============================================================================
// SCORING VITÓRIA DO FAVORITO
// =============================================================================

function calcScoreVitoria(
  stats: { fav: TeamStats; und: TeamStats },
  fixtures: { fav: FixtureResult[]; und: FixtureResult[] },
  h2h: FixtureResult[],
  favIsHome: boolean,
  favTeamId: number,
  undTeamId: number,
  favOdd: number,
  ind: Record<string, number>
): number {
  let s = 40

  const favLocal = favIsHome ? 'home' : 'away'
  const undLocal = favIsHome ? 'away' : 'home'

  // ── Taxa de vitória do favorito no local (últimos 10) ──────────
  const winRateFav = calcWinRate(fixtures.fav, favTeamId, favLocal, 10)
  ind.win_rate_fav = winRateFav
  if (winRateFav >= 70)      { s += 20 }
  else if (winRateFav >= 50) { s += 12 }
  else if (winRateFav >= 35) { s +=  4 }
  else if (winRateFav >= 0 && winRateFav < 35) { s -= 20 }

  // ── Forma recente do favorito no local (últimos 5) ─────────────
  const formFav = calcFormRate(fixtures.fav, favTeamId, favLocal, 5)
  ind.form_fav_5 = formFav
  if (formFav >= 60)      { s += 12 }
  else if (formFav >= 40) { s +=  5 }
  else if (formFav >= 0 && formFav <= 20) { s -= 15 }

  // ── Favorito marcou em todos os últimos 5 no local ─────────────
  const semGolFav = fixtures.fav
    .filter(f =>
      f.goals.home !== null &&
      (favIsHome ? f.teams.home.id === favTeamId : f.teams.away.id === favTeamId)
    )
    .slice(0, 5)
    .filter(f => {
      const meus = favIsHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0)
      return meus === 0
    }).length
  ind.fav_jogos_sem_gol = semGolFav
  if (semGolFav === 0) { s += 6 }   // marcou em todos
  if (semGolFav >= 3)  { s -= 10 }  // não marcou em 3+

  // ── Odd do favorito (confiança do mercado) ─────────────────────
  if (favOdd <= 1.50)      { s += 15 }
  else if (favOdd <= 1.70) { s +=  8 }
  else if (favOdd <= 1.90) { s +=  3 }
  else                     { s -=  5 } // 1.91-2.00: mercado menos convicto

  // ── Fragilidade do underdog ────────────────────────────────────
  const winRateUnd = calcWinRate(fixtures.und, undTeamId, undLocal, 10)
  ind.win_rate_und = winRateUnd
  if (winRateUnd >= 0 && winRateUnd <= 20)  { s += 12 }
  else if (winRateUnd > 20 && winRateUnd <= 35) { s +=  5 }
  else if (winRateUnd > 50)                 { s -= 14 }

  // ── Underdog em má forma (perdeu 3+ dos últimos 5) ────────────
  const formUnd = calcFormRate(fixtures.und, undTeamId, undLocal, 5)
  ind.form_und_5 = formUnd
  if (formUnd >= 0 && formUnd <= 20) { s += 8 }
  else if (formUnd >= 60)            { s -= 8 }

  // ── H2H: vitórias do favorito ─────────────────────────────────
  const h2hWins = calcH2HFavWins(h2h, favTeamId, 5)
  ind.h2h_vitorias_fav_5 = h2hWins
  if (h2hWins >= 4)      { s += 12 }
  else if (h2hWins === 3) { s +=  6 }
  else if (h2hWins <= 1)  { s -= 12 }

  // ── Clean sheet rate do favorito (estabilidade defensiva) ─────
  const csFav = favIsHome ? stats.fav.clean_sheet.home : stats.fav.clean_sheet.away
  const jogosFav = favIsHome ? stats.fav.fixtures.played.home : stats.fav.fixtures.played.away
  const csRateFav = jogosFav > 0 ? Math.round((csFav / jogosFav) * 100) : 0
  ind.fav_clean_sheet = csRateFav
  if (csRateFav >= 40) { s += 6 } // sólido defensivamente

  // ── Underdog sem vitória nos últimos 3 no local ───────────────
  const h2hUndWins = calcH2HFavWins(h2h, undTeamId, 3)
  if (h2hUndWins === 0) { s += 5 }

  return Math.max(0, Math.min(100, Math.round(s)))
}

function calcOverRate(fixtures: FixtureResult[], teamId: number, local: 'home' | 'away', threshold: number): number {
  const jogos = fixtures.filter(f =>
    f.goals.home !== null &&
    f.goals.away !== null &&
    (local === 'home' ? f.teams.home.id === teamId : f.teams.away.id === teamId)
  )
  if (jogos.length < 3) return -1 // dados insuficientes
  const over = jogos.filter(f => ((f.goals.home ?? 0) + (f.goals.away ?? 0)) > threshold)
  return Math.round((over.length / jogos.length) * 100)
}

function calcBTTSRate(fixtures: FixtureResult[], teamId: number, local: 'home' | 'away'): number {
  const jogos = fixtures.filter(f =>
    f.goals.home !== null && f.goals.away !== null &&
    (local === 'home' ? f.teams.home.id === teamId : f.teams.away.id === teamId)
  )
  if (jogos.length < 3) return -1
  const btts = jogos.filter(f => (f.goals.home ?? 0) > 0 && (f.goals.away ?? 0) > 0)
  return Math.round((btts.length / jogos.length) * 100)
}

function calcGoaladeRate(fixtures: FixtureResult[], teamId: number, local: 'home' | 'away'): number {
  const jogos = fixtures.filter(f =>
    f.goals.home !== null && f.goals.away !== null &&
    (local === 'home' ? f.teams.home.id === teamId : f.teams.away.id === teamId)
  )
  if (jogos.length < 3) return -1
  const goleadas = jogos.filter(f => {
    const meus = local === 'home' ? (f.goals.home ?? 0) : (f.goals.away ?? 0)
    return meus >= 3
  })
  return Math.round((goleadas.length / jogos.length) * 100)
}

function calcFormRate(fixtures: FixtureResult[], teamId: number, local: 'home' | 'away', last = 5): number {
  const jogos = fixtures
    .filter(f =>
      f.goals.home !== null && f.goals.away !== null &&
      (local === 'home' ? f.teams.home.id === teamId : f.teams.away.id === teamId)
    )
    .slice(0, last)
  if (jogos.length < last) return -1
  const vitorias = jogos.filter(f => {
    const gh = f.goals.home ?? 0, ga = f.goals.away ?? 0
    return local === 'home' ? gh > ga : ga > gh
  })
  return Math.round((vitorias.length / jogos.length) * 100)
}

function calcH2HOverRate(h2h: FixtureResult[], threshold: number): number {
  const jogos = h2h.filter(f => f.goals.home !== null && f.goals.away !== null)
  if (jogos.length < 3) return -1
  const over = jogos.filter(f => ((f.goals.home ?? 0) + (f.goals.away ?? 0)) > threshold)
  return Math.round((over.length / jogos.length) * 100)
}

function calcH2HFavWins(h2h: FixtureResult[], favTeamId: number, last = 3): number {
  const jogos = h2h.filter(f => f.goals.home !== null).slice(0, last)
  const wins = jogos.filter(f => {
    const gh = f.goals.home ?? 0, ga = f.goals.away ?? 0
    const favIsHome = f.teams.home.id === favTeamId
    return favIsHome ? gh > ga : ga > gh
  })
  return wins.length
}

// =============================================================================
// SCORING OVER 1.5
// =============================================================================

function calcScoreOver15(
  stats: { fav: TeamStats; und: TeamStats },
  fixtures: { fav: FixtureResult[]; und: FixtureResult[] },
  h2h: FixtureResult[],
  favIsHome: boolean,
  favTeamId: number,
  undTeamId: number,
  odds: OddsMarket,
  ind: Record<string, number>
): number {
  let s = 40

  const favLocal = favIsHome ? 'home' : 'away'
  const undLocal = favIsHome ? 'away' : 'home'

  // CAMADA 1 — Força do favorito
  const gmFav = favIsHome
    ? parseFloat(stats.fav.goals.for.average.home)
    : parseFloat(stats.fav.goals.for.average.away)
  ind.fav_gols_local = gmFav

  if (gmFav >= 1.8) s += 15
  else if (gmFav >= 1.3) s += 8
  else if (gmFav < 1.0) s -= 15

  const formFav = calcFormRate(fixtures.fav, favTeamId, favLocal, 5)
  ind.fav_form_5 = formFav
  if (formFav >= 60) s += 12
  else if (formFav <= 20) s -= 12

  // CAMADA 2 — Fragilidade do underdog
  const gsUnd = favIsHome
    ? parseFloat(stats.und.goals.against.average.away)
    : parseFloat(stats.und.goals.against.average.home)
  ind.und_gols_sofridos_local = gsUnd

  if (gsUnd >= 1.8) s += 15
  else if (gsUnd >= 1.2) s += 8
  else if (gsUnd <= 0.7) s -= 15

  const csUnd = favIsHome ? stats.und.clean_sheet.away : stats.und.clean_sheet.home
  const jogosUnd = favIsHome ? stats.und.fixtures.played.away : stats.und.fixtures.played.home
  const csRateUnd = jogosUnd > 0 ? (csUnd / jogosUnd) * 100 : 0
  ind.und_clean_sheet = Math.round(csRateUnd)
  if (csRateUnd >= 40) s -= 12

  // CAMADA 3A — Over 1.5 contextual
  const avgTotalGols = gmFav + gsUnd
  ind.media_gols_total = parseFloat(avgTotalGols.toFixed(2))

  if (avgTotalGols >= 2.5) s += 18
  else if (avgTotalGols >= 2.0) s += 10
  else if (avgTotalGols <= 1.5) s -= 18

  const o15Fav = calcOverRate(fixtures.fav, favTeamId, favLocal, 1.5)
  ind.o15_fav = o15Fav
  if (o15Fav >= 70) s += 15
  else if (o15Fav >= 55) s += 8
  else if (o15Fav >= 0 && o15Fav <= 40) s -= 18

  const o15Und = calcOverRate(fixtures.und, undTeamId, undLocal, 1.5)
  ind.o15_und = o15Und
  if (o15Und >= 60) s += 10
  else if (o15Und >= 0 && o15Und <= 35) s -= 10

  // Odds de mercado
  if (odds.over15) {
    ind.odd_o15 = odds.over15
    if (odds.over15 <= 1.5)  s += 5
    else if (odds.over15 >= 2.0) s -= 8
  }

  // CAMADA 4 — H2H
  const h2hO15 = calcH2HOverRate(h2h, 1.5)
  ind.h2h_o15 = h2hO15
  if (h2hO15 >= 80) s += 12
  else if (h2hO15 >= 0 && h2hO15 <= 40) s -= 10

  const h2hWins = calcH2HFavWins(h2h, favTeamId, 3)
  ind.h2h_vitorias_fav = h2hWins
  if (h2hWins === 3) s += 6

  return Math.max(0, Math.min(100, Math.round(s)))
}

// =============================================================================
// SCORING OVER 2.5
// =============================================================================

function calcScoreOver25(
  stats: { fav: TeamStats; und: TeamStats },
  fixtures: { fav: FixtureResult[]; und: FixtureResult[] },
  h2h: FixtureResult[],
  favIsHome: boolean,
  favTeamId: number,
  undTeamId: number,
  odds: OddsMarket,
  ind: Record<string, number>
): number {
  let s = 35

  const favLocal = favIsHome ? 'home' : 'away'
  const undLocal = favIsHome ? 'away' : 'home'

  const gmFav = favIsHome
    ? parseFloat(stats.fav.goals.for.average.home)
    : parseFloat(stats.fav.goals.for.average.away)

  const gsUnd = favIsHome
    ? parseFloat(stats.und.goals.against.average.away)
    : parseFloat(stats.und.goals.against.average.home)

  // CAMADA 1 — Força ofensiva
  if (gmFav >= 1.8) s += 12
  else if (gmFav >= 1.3) s += 6
  else if (gmFav < 1.0) s -= 12

  // CAMADA 2 — Fragilidade
  if (gsUnd >= 1.8) s += 12
  else if (gsUnd >= 1.2) s += 6
  else if (gsUnd <= 0.7) s -= 14

  const csUnd = favIsHome ? stats.und.clean_sheet.away : stats.und.clean_sheet.home
  const jogosUnd = favIsHome ? stats.und.fixtures.played.away : stats.und.fixtures.played.home
  const csRateUnd = jogosUnd > 0 ? (csUnd / jogosUnd) * 100 : 0
  if (csRateUnd >= 35) s -= 14

  // CAMADA 3B — Over 2.5
  const avgTotal = gmFav + gsUnd
  if (avgTotal >= 3.0)       s += 22
  else if (avgTotal >= 2.5)  s += 14
  else if (avgTotal >= 2.0)  s += 6
  else if (avgTotal <= 1.8)  s -= 22

  const o25Fav = calcOverRate(fixtures.fav, favTeamId, favLocal, 2.5)
  ind.o25_fav = o25Fav
  if (o25Fav >= 65)       s += 18
  else if (o25Fav >= 50)  s += 10
  else if (o25Fav >= 0 && o25Fav <= 35) s -= 20

  const o25Und = calcOverRate(fixtures.und, undTeamId, undLocal, 2.5)
  ind.o25_und = o25Und
  if (o25Und >= 55)       s += 12
  else if (o25Und >= 0 && o25Und <= 30) s -= 12

  const btts = calcBTTSRate(fixtures.fav, favTeamId, favLocal)
  ind.btts_fav = btts
  if (btts >= 55) s += 8

  const goleadas = calcGoaladeRate(fixtures.fav, favTeamId, favLocal)
  ind.goleadas_fav = goleadas
  if (goleadas >= 25) s += 10

  // Odds de mercado
  if (odds.over25) {
    ind.odd_o25 = odds.over25
    if (odds.over25 <= 1.8)  s += 8
    else if (odds.over25 >= 2.2) s -= 8
  }

  // CAMADA 4 — H2H
  const h2hO25 = calcH2HOverRate(h2h, 2.5)
  ind.h2h_o25 = h2hO25
  if (h2hO25 >= 70)       s += 15
  else if (h2hO25 >= 0 && h2hO25 <= 30) s -= 12

  return Math.max(0, Math.min(100, Math.round(s)))
}

// =============================================================================
// STATUS DO SINAL
// =============================================================================

function getStatus(score: number, threshold: number): string {
  if (score >= threshold + 15) return 'SINAL_FORTE'
  if (score >= threshold)      return 'SINAL_BOM'
  if (score >= threshold - 15) return 'CUIDADO'
  return 'DESCARTADO'
}

// =============================================================================
// SALVAR SINAL NO SUPABASE
// =============================================================================

async function salvarSinal(analise: Analise) {
  // Evita duplicatas
  const { data: exist } = await supabase
    .from('sinais_favorito_prelive')
    .select('id')
    .eq('fixture_id', String(analise.fixtureId))
    .maybeSingle()

  if (exist) return

  await supabase.from('sinais_favorito_prelive').insert({
    fixture_id:     String(analise.fixtureId),
    home_team:      analise.homeTeam,
    away_team:      analise.awayTeam,
    league_id:      analise.leagueId,
    league_name:    analise.leagueName,
    match_date:     analise.matchDate,
    favorito:       analise.isFavoriteHome ? analise.homeTeam : analise.awayTeam,
    fav_odd:        analise.favOdd,
    und_odd:        analise.undOdd,
    score_vitoria:  analise.scoreVitoria,
    score_over15:   analise.scoreOver15,
    score_over25:   analise.scoreOver25,
    status_vitoria: analise.statusVitoria,
    status_over15:  analise.statusOver15,
    status_over25:  analise.statusOver25,
    indicadores:    analise.indicadores,
  })
}

// =============================================================================
// TELEGRAM
// =============================================================================

async function notificar(analise: Analise) {
  const aprov: string[] = []
  if (['SINAL_FORTE', 'SINAL_BOM'].includes(analise.statusVitoria)) {
    aprov.push(`✅ Vitória do Favorito — ${analise.scoreVitoria}/100 — ${analise.statusVitoria}`)
  }
  if (['SINAL_FORTE', 'SINAL_BOM'].includes(analise.statusOver15)) {
    aprov.push(`✅ Over 1.5 FT — ${analise.scoreOver15}/100 — ${analise.statusOver15}`)
  }
  if (['SINAL_FORTE', 'SINAL_BOM'].includes(analise.statusOver25)) {
    aprov.push(`✅ Over 2.5 FT — ${analise.scoreOver25}/100 — ${analise.statusOver25}`)
  }
  if (aprov.length === 0) return

  const fav = analise.isFavoriteHome ? analise.homeTeam : analise.awayTeam
  const hora = new Date(analise.matchDate).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife',
  })

  const ind = analise.indicadores
  const msg = `
⚡ *PLANO FAVORITO — PRÉ-LIVE*
━━━━━━━━━━━━━━━━━━
⚽ *${analise.homeTeam}* x *${analise.awayTeam}*
🏆 ${analise.leagueName}
🕐 ${hora} BRT

📌 *Favorito:* ${fav} (odd ${analise.favOdd.toFixed(2)})

🎯 *Sinais aprovados:*
${aprov.join('\n')}

📊 *Fundamentos:*
• Win rate fav (local): ${ind.win_rate_fav !== undefined ? ind.win_rate_fav+'%' : '—'}
• Win rate und (local): ${ind.win_rate_und !== undefined ? ind.win_rate_und+'%' : '—'}
• Form fav últimos 5: ${ind.form_fav_5 !== undefined ? ind.form_fav_5+'%' : '—'}
• H2H vitórias fav (5): ${ind.h2h_vitorias_fav_5 !== undefined ? ind.h2h_vitorias_fav_5+'/5' : '—'}
• Gols fav/jogo (local): ${(ind.fav_gols_local as number)?.toFixed(2) ?? '—'}
• Over 1.5 fav: ${ind.o15_fav !== undefined ? ind.o15_fav+'%' : '—'} | Over 2.5: ${ind.o25_fav !== undefined ? ind.o25_fav+'%' : '—'}
• H2H Over 2.5: ${ind.h2h_o25 !== undefined ? ind.h2h_o25+'%' : '—'}
• Clean Sheet und: ${ind.und_clean_sheet !== undefined ? ind.und_clean_sheet+'%' : '—'}

🏦 Execute nas suas casas de apostas
💡 Gestão: stake padrão da banca
━━━━━━━━━━━━━━━━━━
_Oráculo Mycroft | Bluffer Entertainment_
`.trim()

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'Markdown' }),
  })
}

// =============================================================================
// ANÁLISE DE UM JOGO
// =============================================================================

async function analisarJogo(fixture: any): Promise<Analise | null> {
  const { fixture: fix, league, teams } = fixture
  if (!LIGAS_PERMITIDAS.has(league.id)) return null

  // Busca odds
  const odds = await getOdds(teams.home.name, teams.away.name, league.id)

  // Determina favorito a partir das odds home/away
  if (odds.homeOdd == null || odds.awayOdd == null) return null
  const isFavoriteHome = odds.homeOdd <= odds.awayOdd
  const favOdd = isFavoriteHome ? odds.homeOdd : odds.awayOdd
  const undOdd = isFavoriteHome ? odds.awayOdd : odds.homeOdd

  // Filtra odd do favorito
  if (favOdd < 1.40 || favOdd > 2.00) return null

  const favTeamId = isFavoriteHome ? teams.home.id : teams.away.id
  const undTeamId = isFavoriteHome ? teams.away.id : teams.home.id

  // Busca dados em paralelo
  const [statsFav, statsUnd, fixFav, fixUnd, h2h] = await Promise.all([
    getTeamStats(favTeamId, league.id, league.season),
    getTeamStats(undTeamId, league.id, league.season),
    getRecentFixtures(favTeamId, 10),
    getRecentFixtures(undTeamId, 10),
    getH2H(teams.home.id, teams.away.id, 5),
  ])

  if (!statsFav || !statsUnd) return null

  // Verifica dados mínimos
  const favLocal = isFavoriteHome ? 'home' : 'away'
  const jogosLocal = isFavoriteHome ? statsFav.fixtures.played.home : statsFav.fixtures.played.away
  if (jogosLocal < 5) return null

  const ind: Record<string, number> = {}
  const stats = { fav: statsFav, und: statsUnd }
  const fixtures = { fav: fixFav, und: fixUnd }

  // Regra de forma: veto se perdeu últimos 2 no local
  const ultimos2 = fixFav
    .filter(f =>
      isFavoriteHome ? f.teams.home.id === favTeamId : f.teams.away.id === favTeamId
    )
    .slice(0, 2)
  const perdeu2 = ultimos2.every(f => {
    const gh = f.goals.home ?? 0, ga = f.goals.away ?? 0
    return isFavoriteHome ? gh < ga : ga < gh
  })
  if (perdeu2 && ultimos2.length === 2) return null // veto por má forma

  const scoreO15 = calcScoreOver15(stats, fixtures, h2h, isFavoriteHome, favTeamId, undTeamId, odds, ind)
  const scoreO25 = calcScoreOver25(stats, fixtures, h2h, isFavoriteHome, favTeamId, undTeamId, odds, ind)
  const scoreVit = calcScoreVitoria(stats, fixtures, h2h, isFavoriteHome, favTeamId, undTeamId, favOdd, ind)

  return {
    fixtureId:      fix.id,
    homeTeam:       teams.home.name,
    awayTeam:       teams.away.name,
    homeTeamId:     teams.home.id,
    awayTeamId:     teams.away.id,
    leagueId:       league.id,
    leagueName:     league.name,
    matchDate:      fix.date,
    season:         league.season,
    isFavoriteHome,
    favOdd,
    undOdd,
    scoreVitoria:   scoreVit,
    scoreOver15:    scoreO15,
    scoreOver25:    scoreO25,
    statusVitoria:  getStatus(scoreVit, 62),
    statusOver15:   getStatus(scoreO15, 62),
    statusOver25:   getStatus(scoreO25, 65),
    indicadores:    ind,
  }
}

// =============================================================================
// HANDLER PRINCIPAL
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const start = Date.now()
  console.log('[PLANO FAVORITO] Iniciando análise pré-live...')

  try {
    // Verifica autenticação + role admin (quando chamado pelo frontend)
    const authHeader = req.headers.get('Authorization') ?? ''
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: userData } = await userClient.auth.getUser(token)
      if (userData?.user) {
        const { data: hasRole } = await userClient.rpc('has_role', {
          _user_id: userData.user.id,
          _role: 'admin',
        })
        if (!hasRole) {
          return new Response(
            JSON.stringify({ success: false, error: 'Apenas administradores podem disparar esta análise.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }
    }

    const fixtures = await getUpcomingFixtures()
    console.log(`[PLANO FAVORITO] ${fixtures.length} jogos nas próximas 24h`)

    const resultados: Analise[] = []
    let sinaísEmitidos = 0
    const LIMITE_SINAIS_DIA = 3

    for (let i = 0; i < fixtures.length && sinaísEmitidos < LIMITE_SINAIS_DIA; i += 3) {
      const lote = fixtures.slice(i, i + 3)
      const analises = await Promise.allSettled(lote.map(f => analisarJogo(f)))

      for (const r of analises) {
        if (r.status !== 'fulfilled' || !r.value) continue
        const a = r.value

        const temAprovado =
          ['SINAL_FORTE', 'SINAL_BOM'].includes(a.statusVitoria) ||
          ['SINAL_FORTE', 'SINAL_BOM'].includes(a.statusOver15) ||
          ['SINAL_FORTE', 'SINAL_BOM'].includes(a.statusOver25)

        await salvarSinal(a)

        if (temAprovado && sinaísEmitidos < LIMITE_SINAIS_DIA && TELEGRAM_TOKEN && TELEGRAM_CHAT) {
          await notificar(a)
          sinaísEmitidos++
        }

        resultados.push(a)
      }

      if (i + 3 < fixtures.length) await new Promise(r => setTimeout(r, 6000))
    }

    const aprovados = resultados.filter(a =>
      ['SINAL_FORTE', 'SINAL_BOM'].includes(a.statusVitoria) ||
      ['SINAL_FORTE', 'SINAL_BOM'].includes(a.statusOver15) ||
      ['SINAL_FORTE', 'SINAL_BOM'].includes(a.statusOver25)
    )

    return new Response(JSON.stringify({
      success: true,
      analisados: resultados.length,
      aprovados: aprovados.length,
      notificados: sinaísEmitidos,
      duracao_s: ((Date.now() - start) / 1000).toFixed(1),
      top: aprovados.slice(0, 10).map(a => ({
        jogo: `${a.homeTeam} x ${a.awayTeam}`,
        favorito: a.isFavoriteHome ? a.homeTeam : a.awayTeam,
        fav_odd: a.favOdd,
        vit: `${a.scoreVitoria} (${a.statusVitoria})`,
        o15: `${a.scoreOver15} (${a.statusOver15})`,
        o25: `${a.scoreOver25} (${a.statusOver25})`,
      })),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('[PLANO FAVORITO] Erro:', err)
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
