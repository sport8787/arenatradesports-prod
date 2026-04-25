// Background worker for Mycroft live analyses.
//
// Pulls jobs from public.mycroft_analysis_queue (claimed atomically with
// SKIP LOCKED via claim_mycroft_analysis_jobs), runs each analysis with
// resilientFetch (exponential backoff + circuit breaker), and persists the
// outcome into mycroft_analyses + live_matches.
//
// Designed to run on a short cron tick. Strict wall-clock budget so it never
// holds the cron lane open.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logEdgeError } from "../_shared/logEdgeError.ts";
import { resilientFetch } from "../_shared/resilientFetch.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RUN_BUDGET_MS = 50_000;        // wall-clock per invocation
const BATCH_SIZE = 12;               // jobs claimed per invocation
const ANALYSIS_CONCURRENCY = 4;      // parallel analyses
const WORKER_ID = `worker-${crypto.randomUUID().slice(0, 8)}`;

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try { results[i] = await fn(items[i], i); }
      catch (e) { console.warn('[Worker] item failed:', e); }
    }
  });
  await Promise.all(workers);
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const tStart = performance.now();
  const isOverBudget = () => performance.now() - tStart > RUN_BUDGET_MS;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Re-queue any jobs stuck in 'processing' for >5min (dead worker).
    await supabase.rpc('requeue_stuck_mycroft_jobs').catch((e) =>
      console.warn('[Worker] requeue_stuck_mycroft_jobs failed:', e?.message),
    );

    let totalDone = 0;
    let totalFailed = 0;
    let totalClaimed = 0;

    while (!isOverBudget()) {
      const { data: jobs, error } = await supabase
        .rpc('claim_mycroft_analysis_jobs', { p_limit: BATCH_SIZE, p_worker: WORKER_ID });

      if (error) {
        console.error('[Worker] claim error:', error.message);
        break;
      }
      if (!jobs || jobs.length === 0) break;
      totalClaimed += jobs.length;
      console.log(`[Worker] 🟢 claimed ${jobs.length} jobs (worker=${WORKER_ID})`);

      await runWithConcurrency(jobs, ANALYSIS_CONCURRENCY, async (job: any) => {
        const matchId = job.match_id as string;
        const payload = job.payload as { match: any };
        try {
          const res = await resilientFetch(`${supabaseUrl}/functions/v1/mycroft-sports-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
            body: JSON.stringify(payload),
            retries: 3,
            baseDelayMs: 600,
            maxDelayMs: 6_000,
            timeoutMs: 30_000,
            breakerKey: 'mycroft-sports-analysis',
          });
          if (!res.ok) throw new Error(`upstream_${res.status}`);
          const analysis = await res.json();

          const stats = payload?.match?.stats ?? null;
          const { data: row } = await supabase.from('mycroft_analyses').insert({
            match_id: matchId,
            verdict: analysis.verdict || 'AGUARDAR',
            market: analysis.market || 'N/A',
            thesis: analysis.thesis || '',
            odd: analysis.odd ?? null,
            confidence: analysis.confidence ?? 0,
            risk_management: analysis.risk_management ?? null,
            alerts: analysis.alerts ?? [],
            fundamentation: analysis.fundamentation ?? { stats },
          }).select('id').single();

          if (row) {
            const statusToSet =
              analysis.verdict === 'AGUARDAR' ? 'aguardar' :
              analysis.verdict === 'JOGO_MORTO' ? 'jogo_morto' :
              analysis.verdict === 'CUIDADO' ? 'cuidado' : 'done';
            await supabase.from('live_matches').update({
              mycroft_analysis_id: row.id,
              mycroft_status: statusToSet,
              updated_at: new Date().toISOString(),
            }).eq('match_id', matchId);
            if (analysis.verdict === 'APROVADO' || analysis.verdict === 'APROVADO_SITUACIONAL') {
              await supabase.from('signals_sent').insert({
                match_id: matchId,
                analysis_id: row.id,
              });
            }
          }

          await supabase.from('mycroft_analysis_queue').update({
            status: 'done',
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_error: null,
          }).eq('id', job.id);
          totalDone++;
        } catch (e) {
          const msg = (e as Error)?.message || String(e);
          const isTerminal = job.attempts >= job.max_attempts;
          await supabase.from('mycroft_analysis_queue').update({
            status: isTerminal ? 'failed' : 'pending',
            last_error: msg.slice(0, 500),
            locked_at: null,
            locked_by: null,
            updated_at: new Date().toISOString(),
            processed_at: isTerminal ? new Date().toISOString() : null,
          }).eq('id', job.id);
          totalFailed++;
          console.warn(`[Worker] job ${job.id} (${matchId}) failed (attempt ${job.attempts}/${job.max_attempts}): ${msg}`);
        }
      });
    }

    const result = {
      ok: true,
      worker: WORKER_ID,
      claimed: totalClaimed,
      done: totalDone,
      failed: totalFailed,
      run_ms: Math.round(performance.now() - tStart),
      over_budget: isOverBudget(),
    };
    console.log('[Worker] ✅ tick complete', result);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Worker] fatal:', error);
    await logEdgeError("process-mycroft-queue", error).catch(() => {});
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
