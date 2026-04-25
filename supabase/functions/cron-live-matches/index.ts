import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { logEdgeError } from "../_shared/logEdgeError.ts";

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

    // Check granular cron settings
    const { data: settings } = await supabaseAdmin
      .from('cron_settings')
      .select('setting_key, is_enabled')
      .in('setting_key', ['live_matches_cron', 'analyze_live_matches_cron', 'evaluate_cashout_cron']);

    const settingsMap = new Map((settings || []).map((s: any) => [s.setting_key, s.is_enabled]));
    const masterEnabled = settingsMap.get('live_matches_cron') ?? false;
    const analyzeEnabled = settingsMap.get('analyze_live_matches_cron') ?? true;
    const cashoutEnabled = settingsMap.get('evaluate_cashout_cron') ?? false;

    if (!masterEnabled) {
      console.log('[CronLive] ⏸️ Cron desativado, pulando execução');
      return new Response(JSON.stringify({ skipped: true, reason: 'cron_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentMinute = new Date().getMinutes();

    console.log(`[CronLive] ▶️ Minuto ${currentMinute} — STATS x2 + ANÁLISE`);

    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    };

    const runStats = async (label: string) => {
      const jobs = [
        fetch(`${baseUrl}/functions/v1/fetch-live-matches`, { method: 'POST', headers }).then(r => r.json()),
        fetch(`${baseUrl}/functions/v1/update-live-scores`, { method: 'POST', headers }).then(r => r.json()),
      ];
      const [fetchR, scoresR] = await Promise.allSettled(jobs);
      console.log(`[CronLive] ${label} fetch_ok=${fetchR.status === 'fulfilled'} scores_ok=${scoresR.status === 'fulfilled'}`);
      return { fetch: fetchR, scores: scoresR };
    };

    // 1ª rodada de stats (segundo 0)
    const round1 = await runStats('🔄 Round1 (0s)');

    // Aguarda 30 segundos e roda stats novamente
    await new Promise(resolve => setTimeout(resolve, 30_000));
    const round2 = await runStats('🔄 Round2 (30s)');

    const result: Record<string, any> = {
      success: true,
      minute: currentMinute,
      phase: 'stats_x2+analysis',
      round1_fetch: round1.fetch.status === 'fulfilled' ? round1.fetch.value : { error: (round1.fetch as any).reason?.message },
      round1_scores: round1.scores.status === 'fulfilled' ? round1.scores.value : { error: (round1.scores as any).reason?.message },
      round2_fetch: round2.fetch.status === 'fulfilled' ? round2.fetch.value : { error: (round2.fetch as any).reason?.message },
      round2_scores: round2.scores.status === 'fulfilled' ? round2.scores.value : { error: (round2.scores as any).reason?.message },
    };

    // Análise a cada minuto, após as duas rodadas de atualização (controlada por toggle)
    if (analyzeEnabled) {
      const analyzeRes = await fetch(`${baseUrl}/functions/v1/analyze-live-matches`, {
        method: 'POST', headers,
        body: JSON.stringify({ bankroll: 500 }),
      }).then(r => r.json()).catch(e => ({ error: e instanceof Error ? e.message : String(e) }));
      result.analysis = analyzeRes;
      console.log(`[CronLive] 🧠 Análise: ${analyzeRes?.analyzed ?? 0} jogos analisados`);
    } else {
      console.log('[CronLive] ⏸️ Análise IA desativada via cron_settings');
      result.analysis = { skipped: true, reason: 'analyze_disabled' };
    }

    // Worker da fila: drena análises enfileiradas pelo fetch-live-matches quando ele estourou o budget.
    // Roda em background — não bloqueia a próxima execução do cron.
    const queueRes = await fetch(`${baseUrl}/functions/v1/process-mycroft-queue`, {
      method: 'POST', headers,
    }).then(r => r.json()).catch(e => ({ error: e instanceof Error ? e.message : String(e) }));
    result.queue_worker = queueRes;
    console.log(`[CronLive] 📥 Worker fila: claimed=${queueRes?.claimed ?? 0} done=${queueRes?.done ?? 0} failed=${queueRes?.failed ?? 0}`);

    // Cashout (controlado por toggle, desativado por padrão)
    if (cashoutEnabled) {
      const cashoutRes = await fetch(`${baseUrl}/functions/v1/evaluate-cashout`, {
        method: 'POST', headers,
      }).then(r => r.json()).catch(e => ({ error: e instanceof Error ? e.message : String(e) }));
      result.cashout = cashoutRes;
      console.log(`[CronLive] 💰 Cashout avaliado`);
    } else {
      result.cashout = { skipped: true, reason: 'cashout_disabled' };
    }

    console.log('[CronLive] ✅ Resultados:', JSON.stringify({
      minute: currentMinute,
      phase: result.phase,
      r1_fetch_ok: round1.fetch.status === 'fulfilled',
      r2_fetch_ok: round2.fetch.status === 'fulfilled',
      analysis_ok: !!result.analysis,
    }));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[CronLive] ❌ Erro:', error);
    await logEdgeError("cron-live-matches", error).catch(() => {});
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
