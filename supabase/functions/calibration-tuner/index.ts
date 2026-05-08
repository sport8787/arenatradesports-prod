// calibration-tuner — endpoint utilitário/admin para forçar refresh imediato
// das duas arenas (trader_sports + punter). O cron de 30min já roda
// public.refresh_arena_calibration via pg_cron. Esta edge serve para acionar
// manualmente (botão admin / debug) ou logo após uma liquidação relevante.

import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(url, key);
  const out: any = {};
  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* ok */ }
    const limit = Number(body?.limit ?? 50);
    for (const arena of ['trader_sports', 'punter'] as const) {
      const { data, error } = await sb.rpc('refresh_arena_calibration', { p_arena: arena, p_limit: limit });
      if (error) out[arena] = { error: error.message };
      else out[arena] = Array.isArray(data) ? data[0] : data;
    }
    return new Response(JSON.stringify({ ok: true, refreshed: out }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error)?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
