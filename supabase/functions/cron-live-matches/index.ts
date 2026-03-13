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

    console.log('[CronLive] ▶️ Cron ativado, buscando jogos ao vivo...');

    // Call fetch-live-matches
    const fetchRes = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/fetch-live-matches`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
      }
    );

    const fetchData = await fetchRes.json();
    console.log('[CronLive] ✅ fetch-live-matches resultado:', JSON.stringify(fetchData));

    // Call update-live-scores
    const scoresRes = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/update-live-scores`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
      }
    );

    const scoresData = await scoresRes.json();
    console.log('[CronLive] ✅ update-live-scores resultado:', JSON.stringify(scoresData));

    // Call analyze-live-matches to trigger Mycroft analysis
    const analyzeRes = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-live-matches`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ bankroll: 500 }),
      }
    );

    const analyzeData = await analyzeRes.json();
    console.log('[CronLive] ✅ analyze-live-matches resultado:', JSON.stringify(analyzeData));

    return new Response(JSON.stringify({
      success: true,
      fetch: fetchData,
      scores: scoresData,
      analysis: analyzeData,
    }), {
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
