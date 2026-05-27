// punter-steam-monitor — Cron a cada 1 min. Captura snapshots Exchange e detecta
// movimentação significativa (steam/sharp money) para sinais Punter abertos cuja
// kickoff está em [-15min, +6h]. Persiste:
//   • punter_steam_snapshots (sempre que conseguir quote)
//   • punter_steam_signals (quando |drift| >= STEAM_THRESHOLD_PCT)

import { createClient } from "npm:@supabase/supabase-js@2";
import { captureSteamSnapshot, detectSteam, persistSteamSignal, STEAM_THRESHOLD_PCT } from "../_shared/steamDetection.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Kill switch global: LIVE OFF pausa o monitor de steam (depende de odds em tempo real).
  {
    const { data: setting } = await sb
      .from('cron_settings').select('is_enabled')
      .eq('setting_key', 'live_matches_cron').maybeSingle();
    if (setting && setting.is_enabled === false) {
      return new Response(JSON.stringify({ skipped: true, reason: 'live_globally_off' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const now = Date.now();
  const fromIso = new Date(now - 15 * 60_000).toISOString();
  const toIso = new Date(now + 6 * 60 * 60_000).toISOString();

  // Pega sinais Punter abertos com event_id Futodds resolvido (via punter_clv_log).
  const { data: rows, error } = await sb
    .from("punter_clv_log")
    .select("match_id, market, futodds_event_id, commence_time")
    .not("futodds_event_id", "is", null)
    .gte("commence_time", fromIso)
    .lte("commence_time", toIso)
    .limit(80);
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let snapped = 0, detected = 0, failed = 0;
  const results: any[] = [];
  for (const r of rows ?? []) {
    try {
      const snap = await captureSteamSnapshot(sb, String(r.futodds_event_id), String(r.market));
      if (!snap) { failed++; continue; }
      snapped++;
      const det = await detectSteam(sb, String(r.futodds_event_id), String(r.market));
      if (det && det.direction !== "neutral") {
        await persistSteamSignal(sb, String(r.match_id), String(r.market), String(r.futodds_event_id), det);
        detected++;
        results.push({ match_id: r.match_id, market: r.market, ...det });
      }
    } catch (e) {
      failed++;
      results.push({ match_id: r.match_id, error: (e as Error).message });
    }
  }
  console.log(`[punter-steam-monitor] candidates=${rows?.length ?? 0} snapped=${snapped} detected=${detected} failed=${failed} threshold=${STEAM_THRESHOLD_PCT}`);
  return new Response(JSON.stringify({ ok: true, candidates: rows?.length ?? 0, snapped, detected, failed, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
