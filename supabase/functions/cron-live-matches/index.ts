import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if the cron is enabled
    const { data: setting } = await supabaseAdmin
      .from('cron_settings')
      .select('is_enabled')
      .eq('setting_key', 'live_matches_cron')
      .maybeSingle();

    if (!setting?.is_enabled) {
      console.log('[CronLive] ⏸️ Cron desativado, pulando execução');
      return new Response(JSON.stringify({ skipped: true, reason: 'cron_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[CronLive] ▶️ Cron ativado, disparando jobs em paralelo...');

    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    };

    // Fire all 3 jobs in parallel — analyze uses data already in DB
    const [fetchRes, scoresRes, analyzeRes] = await Promise.allSettled([
      fetch(`${baseUrl}/functions/v1/fetch-live-matches`, {
        method: 'POST', headers,
      }).then(r => r.json()),

      fetch(`${baseUrl}/functions/v1/update-live-scores`, {
        method: 'POST', headers,
      }).then(r => r.json()),

      fetch(`${baseUrl}/functions/v1/analyze-live-matches`, {
        method: 'POST', headers,
        body: JSON.stringify({ bankroll: 500 }),
      }).then(r => r.json()),
    ]);

    const result = {
      success: true,
      fetch: fetchRes.status === 'fulfilled' ? fetchRes.value : { error: fetchRes.reason?.message },
      scores: scoresRes.status === 'fulfilled' ? scoresRes.value : { error: scoresRes.reason?.message },
      analysis: analyzeRes.status === 'fulfilled' ? analyzeRes.value : { error: analyzeRes.reason?.message },
    };

    console.log('[CronLive] ✅ Resultados:', JSON.stringify({
      fetch_ok: fetchRes.status === 'fulfilled',
      scores_ok: scoresRes.status === 'fulfilled',
      analysis_ok: analyzeRes.status === 'fulfilled',
      analyzed: analyzeRes.status === 'fulfilled' ? analyzeRes.value?.analyzed : 0,
    }));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[CronLive] ❌ Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
