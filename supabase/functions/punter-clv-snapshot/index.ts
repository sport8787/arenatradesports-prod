// punter-clv-snapshot — Cron a cada 2min. Para cada linha em punter_clv_log SEM close
// cujo commence_time esteja a 0–8min do agora (janela de captura), busca a odd
// Exchange Betfair via Futodds e grava close_back/lay/mid + clv_pp.
// CLV = (open_mid/close_mid - 1) * 100  (positivo = pegou valor antes do mercado).

import { createClient } from "npm:@supabase/supabase-js@2";
import { getExchangeQuote } from "../_shared/futoddsExchange.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = Date.now();
  // Janela: jogos que começam em 0–8 min E ainda sem close capturado.
  const fromIso = new Date(now - 1 * 60_000).toISOString();      // 1min de tolerância para trás
  const toIso = new Date(now + 8 * 60_000).toISOString();

  const { data: rows, error } = await sb
    .from("punter_clv_log")
    .select("id, match_id, market, futodds_event_id, commence_time, open_mid_odd")
    .is("close_mid_odd", null)
    .not("futodds_event_id", "is", null)
    .gte("commence_time", fromIso)
    .lte("commence_time", toIso)
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  let captured = 0, failed = 0;
  for (const r of rows ?? []) {
    try {
      const quote = await getExchangeQuote(String(r.futodds_event_id), String(r.market));
      if (!quote || !quote.mid_odd) { failed++; results.push({ id: r.id, skipped: "no_quote" }); continue; }
      const closeMid = quote.mid_odd;
      const openMid = Number(r.open_mid_odd) || null;
      const clv_pp = (openMid && closeMid) ? ((openMid / closeMid) - 1) * 100 : null;
      const { error: upErr } = await sb.from("punter_clv_log")
        .update({
          close_back_odd: quote.back_odd,
          close_lay_odd: quote.lay_odd,
          close_mid_odd: closeMid,
          clv_pp,
          close_captured_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      if (upErr) { failed++; results.push({ id: r.id, error: upErr.message }); continue; }
      captured++;
      results.push({ id: r.id, match_id: r.match_id, market: r.market, clv_pp: clv_pp != null ? Number(clv_pp.toFixed(2)) : null });
    } catch (e) {
      failed++;
      results.push({ id: r.id, error: (e as Error).message });
    }
  }

  console.log(`[punter-clv-snapshot] candidates=${rows?.length ?? 0} captured=${captured} failed=${failed}`);
  return new Response(JSON.stringify({ ok: true, candidates: rows?.length ?? 0, captured, failed, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
