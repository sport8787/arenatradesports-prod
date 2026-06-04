import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const key = Deno.env.get('THE_ODDS_API_KEY')
  const r = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${key}&all=false`)
  const j = await r.json()
  const soccer = Array.isArray(j) ? j.filter((s:any)=>s.group==='Soccer').map((s:any)=>({key:s.key,title:s.title,active:s.active,has_outrights:s.has_outrights})) : j
  return new Response(JSON.stringify(soccer, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
