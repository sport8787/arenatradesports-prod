// backtest-prewarm-cache
// Aquece os caches `sportmonks_fixtures_cache` + `sportmonks_odds_cache`
// para um conjunto de (league_key, season). Após executado uma vez,
// qualquer usuário pode rodar backtests instantâneos (cache hit puro).
//
// Input: { league_keys: string[], seasons: number[], include_odds?: boolean }
//        (default include_odds = true)
//
// Saída: contadores por liga/temporada com hits/misses.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LEAGUE_MAP: Record<string, { id: number; name: string }> = {
  'soccer_brazil_campeonato': { id: 71, name: 'Brasileirão Série A' },
  'soccer_brazil_serie_b': { id: 72, name: 'Brasileirão Série B' },
  'soccer_brazil_campeonato_paulista': { id: 475, name: 'Paulistão' },
  'soccer_brazil_campeonato_carioca': { id: 476, name: 'Carioca' },
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

const SM_TARGET_MARKETS = '1,12,14,28'
const ALLOWED_AH_LINES = new Set([-1.5, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1])

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

function round2(n: number): number { return Math.round(n * 100) / 100 }

function fmtAHLabel(side: 'Casa' | 'Fora', line: number): string {
  const lineStr = line === 0 ? '0' : (line > 0 ? `+${line}` : `${line}`)
  return `AH ${side} ${lineStr}`
}

function smNorm(n: string): string {
  return (n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, ' ')
}

function leagueMatches(leagueName: string, allowed: string): boolean {
  const target = smNorm(leagueName)
  const an = smNorm(allowed)
  return target === an || target.includes(an) || an.includes(target)
}

function* dateRangeOfSeason(season: number): Generator<string> {
  const start = new Date(`${season}-01-01T00:00:00Z`)
  const end = new Date(Math.min(new Date(`${season + 1}-12-31T00:00:00Z`).getTime(), Date.now()))
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10)
  }
}

function parseSportmonksOdds(rawOdds: any[]): Record<string, number> {
  const buckets: Record<string, number[]> = {}
  const push = (label: string, val: any) => {
    const v = parseFloat(String(val))
    if (!isFinite(v) || v < 1.01 || v > 50) return
    if (!buckets[label]) buckets[label] = []
    buckets[label].push(v)
  }
  for (const o of rawOdds || []) {
    const mid = Number(o.market_id)
    const lbl = String(o.label || '').toLowerCase().trim()
    const val = o.value ?? o.dp3
    if (mid === 1) {
      if (lbl === 'home' || lbl === '1') push('Casa', val)
      else if (lbl === 'draw' || lbl === 'x') push('Empate', val)
      else if (lbl === 'away' || lbl === '2') push('Fora', val)
    } else if (mid === 12) {
      const total = String(o.total ?? '').trim()
      if (total === '2.5' || total === '2.50') {
        if (lbl === 'over') push('Over 2.5', val)
        else if (lbl === 'under') push('Under 2.5', val)
      } else if (total === '1.5' || total === '1.50') {
        if (lbl === 'over') push('Over 1.5', val)
      }
    } else if (mid === 14) {
      if (lbl === 'yes') push('BTTS Sim', val)
    } else if (mid === 28) {
      const hcRaw = String(o.handicap ?? '').trim().replace(/^\+/, '')
      const hc = parseFloat(hcRaw)
      if (!isFinite(hc) || !ALLOWED_AH_LINES.has(hc)) continue
      if (lbl === 'home' || lbl === '1') push(fmtAHLabel('Casa', hc), val)
      else if (lbl === 'away' || lbl === '2') push(fmtAHLabel('Fora', hc), val)
    }
  }
  const agg: Record<string, number> = {}
  for (const [label, arr] of Object.entries(buckets)) agg[label] = round2(median(arr))
  return agg
}

async function warmFixtures(
  TOKEN: string, leagueKey: string, season: number, leagueName: string, dbClient: any
): Promise<{ count: number; fromCache: boolean }> {
  // Cache hit?
  const { data: cached } = await dbClient
    .from('sportmonks_fixtures_cache')
    .select('fixture_count, is_complete')
    .eq('league_key', leagueKey).eq('season', season).maybeSingle()
  if (cached?.is_complete) return { count: cached.fixture_count, fromCache: true }

  const fixtures: any[] = []
  let dayCount = 0
  const MAX_DAYS = 400
  for (const ymd of dateRangeOfSeason(season)) {
    if (dayCount++ >= MAX_DAYS) break
    const url = `https://api.sportmonks.com/v3/football/fixtures/date/${ymd}?api_token=${TOKEN}&include=scores;participants;state;league&per_page=100`
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const json = await res.json()
      const data: any[] = json.data || []
      for (const f of data) {
        const stateName = f.state?.short_name || f.state?.name || ''
        if (!/FT|AET|PEN_LIVE|FT_PEN/i.test(stateName)) continue
        const lname = f.league?.name || ''
        if (!leagueMatches(lname, leagueName)) continue
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
        if (gh === null || ga === null) continue
        fixtures.push({
          fixture: { id: f.id, date: f.starting_at || `${ymd}T00:00:00Z` },
          teams: { home: { name: home.name }, away: { name: away.name } },
          goals: { home: gh, away: ga },
          league: { round: '' },
          _leagueName: leagueName,
        })
      }
    } catch { /* skip */ }
    if (dayCount % 5 === 0) await new Promise(r => setTimeout(r, 100))
  }

  await dbClient.from('sportmonks_fixtures_cache').upsert({
    league_key: leagueKey, season, league_name: leagueName,
    fixtures, fixture_count: fixtures.length, is_complete: true,
    fetched_at: new Date().toISOString(),
  }, { onConflict: 'league_key,season' })

  return { count: fixtures.length, fromCache: false }
}

async function warmOdds(
  TOKEN: string, fixtureIds: number[], dbClient: any
): Promise<{ fetched: number; cached: number }> {
  if (fixtureIds.length === 0) return { fetched: 0, cached: 0 }
  const uniq = Array.from(new Set(fixtureIds))

  const { data: cached } = await dbClient
    .from('sportmonks_odds_cache')
    .select('fixture_id')
    .in('fixture_id', uniq)
  const hit = new Set((cached || []).map((r: any) => Number(r.fixture_id)))
  const missing = uniq.filter(id => !hit.has(id))

  let fetched = 0
  const CONCURRENCY = 8
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY)
    const rows = await Promise.all(batch.map(async (fid) => {
      const url = `https://api.sportmonks.com/v3/football/odds/pre-match/fixtures/${fid}?api_token=${TOKEN}&filters=markets:${SM_TARGET_MARKETS}`
      try {
        const res = await fetch(url)
        if (!res.ok) return { fixture_id: fid, odds: {}, has_real_odds: false, fetched_at: new Date().toISOString() }
        const json = await res.json()
        const parsed = parseSportmonksOdds(json.data || [])
        return {
          fixture_id: fid,
          odds: parsed,
          has_real_odds: Object.keys(parsed).length > 0,
          fetched_at: new Date().toISOString(),
        }
      } catch {
        return { fixture_id: fid, odds: {}, has_real_odds: false, fetched_at: new Date().toISOString() }
      }
    }))
    try {
      await dbClient.from('sportmonks_odds_cache').upsert(rows, { onConflict: 'fixture_id' })
      fetched += rows.length
    } catch (e) {
      console.warn('[Prewarm] odds upsert failed:', (e as Error).message)
    }
    await new Promise(r => setTimeout(r, 120))
  }
  return { fetched, cached: hit.size }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const TOKEN = Deno.env.get('SPORTMONKS_API_KEY')
    if (!TOKEN) throw new Error('SPORTMONKS_API_KEY não configurada')

    const body = await req.json().catch(() => ({}))
    const leagueKeys: string[] = body.league_keys || ['soccer_brazil_campeonato']
    const seasons: number[] = body.seasons || [new Date().getFullYear() - 1]
    const includeOdds: boolean = body.include_odds !== false

    const dbClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const summary: any[] = []
    let totalFixturesWarmed = 0
    let totalOddsFetched = 0

    for (const leagueKey of leagueKeys) {
      const info = LEAGUE_MAP[leagueKey]
      if (!info) { summary.push({ leagueKey, error: 'liga não mapeada' }); continue }
      for (const season of seasons) {
        try {
          console.log(`[Prewarm] ${leagueKey} / ${season}...`)
          const fxRes = await warmFixtures(TOKEN, leagueKey, season, info.name, dbClient)
          totalFixturesWarmed += fxRes.fromCache ? 0 : fxRes.count

          let oddsRes = { fetched: 0, cached: 0 }
          if (includeOdds && fxRes.count > 0) {
            const { data: cf } = await dbClient
              .from('sportmonks_fixtures_cache')
              .select('fixtures')
              .eq('league_key', leagueKey).eq('season', season).maybeSingle()
            const ids = (cf?.fixtures || []).map((f: any) => Number(f.fixture?.id)).filter((n: number) => Number.isFinite(n))
            oddsRes = await warmOdds(TOKEN, ids, dbClient)
            totalOddsFetched += oddsRes.fetched
          }

          summary.push({
            leagueKey,
            league: info.name,
            season,
            fixtures: fxRes.count,
            fixtures_from_cache: fxRes.fromCache,
            odds_fetched: oddsRes.fetched,
            odds_already_cached: oddsRes.cached,
          })
        } catch (e) {
          summary.push({ leagueKey, season, error: (e as Error).message })
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_fixtures_warmed: totalFixturesWarmed,
      total_odds_fetched: totalOddsFetched,
      summary,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
