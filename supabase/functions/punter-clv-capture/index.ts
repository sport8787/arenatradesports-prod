// punter-clv-capture
// Cron periódico: captura "closing odds" (Betfair Exchange via Futodds) para sinais
// que estão a ≤ 15min do kickoff e ainda não têm close_* preenchido em punter_clv_log.
// Calcula clv_pp = (1/close_mid - 1/open_mid) * 100  (positivo = entramos antes do mercado se ajustar a favor).

import { createClient } from 'npm:@supabase/supabase-js@2.45.0'
import { resolveFutoddsEventId, getExchangeQuote } from '../_shared/futoddsExchange.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Kill switch — respeita o mesmo toggle do Punter
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* sem body */ }
  const isManual = body?.source === 'manual'

  if (!isManual) {
    const { data: setting } = await supabase
      .from('cron_settings')
      .select('is_enabled')
      .eq('setting_key', 'punter_cron')
      .maybeSingle()
    if (!setting?.is_enabled) {
      console.log('[CLV] ⏸️ punter_cron desativado — abortando captura de CLV')
      return new Response(JSON.stringify({ skipped: true, reason: 'punter_cron disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  const nowIso = new Date().toISOString()
  const horizonIso = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const lookbackIso = new Date(Date.now() - 30 * 60 * 1000).toISOString() // pega quem já começou nos últimos 30min sem close

  const { data: rows, error } = await supabase
    .from('punter_clv_log')
    .select('id, match_id, market, futodds_event_id, home_team, away_team, commence_time, open_mid_odd')
    .is('close_mid_odd', null)
    .gte('commence_time', lookbackIso)
    .lte('commence_time', horizonIso)
    .limit(200)

  if (error) {
    console.error('[CLV] query falhou:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  let captured = 0, skipped = 0, failed = 0
  for (const r of rows ?? []) {
    try {
      let eventId = r.futodds_event_id
      if (!eventId) eventId = await resolveFutoddsEventId(supabase, r.home_team, r.away_team, r.commence_time)
      if (!eventId) { skipped++; continue }
      const quote = await getExchangeQuote(String(eventId), String(r.market))
      if (!quote || !quote.mid_odd) { skipped++; continue }
      const openMid = Number(r.open_mid_odd ?? 0)
      const clv_pp = openMid > 0 && quote.mid_odd > 0
        ? ((1 / quote.mid_odd) - (1 / openMid)) * 100
        : null
      const { error: upErr } = await supabase
        .from('punter_clv_log')
        .update({
          close_back_odd: quote.back_odd,
          close_lay_odd: quote.lay_odd,
          close_mid_odd: quote.mid_odd,
          clv_pp,
          close_captured_at: nowIso,
        })
        .eq('id', r.id)
      if (upErr) { failed++; console.warn('[CLV] upd falhou:', upErr.message); continue }
      captured++
    } catch (e) {
      failed++
      console.warn('[CLV] erro item:', (e as Error).message)
    }
  }

  // Atualiza quarentena após capturar novos closings (cheap)
  try { await supabase.rpc('refresh_punter_quarantine') } catch (e) { console.warn('[CLV] refresh_quarantine falhou:', (e as Error).message) }

  console.log(`[CLV] capturados=${captured} skipped=${skipped} failed=${failed} candidates=${rows?.length ?? 0}`)
  return new Response(JSON.stringify({ captured, skipped, failed, candidates: rows?.length ?? 0 }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
