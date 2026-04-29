// Reconcilia analises_comparativas pendentes com resultados reais (mycroft_analyses + punter_signals)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let updated = 0;

  // Pega comparativas sem resultado nos últimos 7 dias
  const { data: pending } = await sb
    .from("analises_comparativas")
    .select("id, modo, match_id, mercado, source_function")
    .is("resultado_real", null)
    .gte("created_at", cutoff)
    .limit(2000);

  if (!pending) return new Response(JSON.stringify({ updated: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  for (const row of pending) {
    if (!row.match_id || !row.mercado) continue;
    let resultado: string | null = null;

    if (row.modo === "trader") {
      const { data: m } = await sb
        .from("mycroft_analyses")
        .select("result")
        .eq("match_id", row.match_id)
        .ilike("market", row.mercado)
        .not("result", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const r = (m as any)?.result;
      if (r) resultado = ["green", "won", "win"].includes(r) ? "GREEN" : ["red", "lost", "loss"].includes(r) ? "RED" : r === "push" ? "PUSH" : null;
    } else {
      const { data: ps } = await sb
        .from("punter_signals")
        .select("result")
        .eq("match_id", row.match_id)
        .ilike("market", row.mercado)
        .not("result", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const r = (ps as any)?.result;
      if (r) resultado = ["green", "won", "win"].includes(r) ? "GREEN" : ["red", "lost", "loss"].includes(r) ? "RED" : r === "push" ? "PUSH" : null;
    }

    if (resultado) {
      await sb.from("analises_comparativas").update({ resultado_real: resultado, settled_at: new Date().toISOString() }).eq("id", row.id);
      updated++;
    }
  }

  return new Response(JSON.stringify({ scanned: pending.length, updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
