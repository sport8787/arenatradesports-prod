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

    const currentMinute = new Date().getMinutes();
    const isAnalysisMinute = currentMinute % 2 === 1; // ímpares = análise

    console.log(`[CronLive] ▶️ Minuto ${currentMinute} — ${isAnalysisMinute ? 'STATS + ANÁLISE' : 'STATS ONLY'}`);

    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    };

    // SEMPRE rodar stats (fetch + scores)
    const statsJobs: Promise<any>[] = [
      fetch(`${baseUrl}/functions/v1/fetch-live-matches`, {
        method: 'POST', headers,
      }).then(r => r.json()),

      fetch(`${baseUrl}/functions/v1/update-live-scores`, {
        method: 'POST', headers,
      }).then(r => r.json()),
    ];

    const [fetchRes, scoresRes] = await Promise.allSettled(statsJobs);

    const result: Record<string, any> = {
      success: true,
      minute: currentMinute,
      phase: isAnalysisMinute ? 'stats+analysis' : 'stats_only',
      fetch: fetchRes.status === 'fulfilled' ? fetchRes.value : { error: fetchRes.reason?.message },
      scores: scoresRes.status === 'fulfilled' ? scoresRes.value : { error: scoresRes.reason?.message },
    };

    // SÓ nos minutos ímpares → análise Mycroft com dados já atualizados
    if (isAnalysisMinute) {
      const analyzeRes = await fetch(`${baseUrl}/functions/v1/analyze-live-matches`, {
        method: 'POST', headers,
        body: JSON.stringify({ bankroll: 500 }),
      }).then(r => r.json()).catch(e => ({ error: e.message }));

      result.analysis = analyzeRes;
      console.log(`[CronLive] 🧠 Análise: ${analyzeRes?.analyzed ?? 0} jogos analisados`);
    }

    console.log('[CronLive] ✅ Resultados:', JSON.stringify({
      minute: currentMinute,
      phase: result.phase,
      fetch_ok: fetchRes.status === 'fulfilled',
      scores_ok: scoresRes.status === 'fulfilled',
      analysis_ok: isAnalysisMinute ? !!result.analysis : 'skipped',
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
