// Edge: punter-prelive-favorito
// Análise pré-live do Punter — Plano Favorito + Handicap Asiático.
// É uma orquestradora fina: chama as edges Sportmonks dedicadas em sequência
// e devolve um resumo consolidado.
// Disparo:
//   - Cron: diário 09:00 UTC (06:00 BRT)
//   - Manual: POST /functions/v1/punter-prelive-favorito
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function invoke(name: string, body: Record<string, unknown> = {}) {
  const started = Date.now();
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({ ...body, data_source: "sportmonks" }),
    });
    const text = await r.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep text */ }
    return {
      name,
      ok: r.ok,
      status: r.status,
      elapsed_ms: Date.now() - started,
      result: parsed,
    };
  } catch (err) {
    return {
      name,
      ok: false,
      status: 0,
      elapsed_ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const startedAt = Date.now();

  // Kill switch: ignora apenas quando chamado manualmente via botão
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* sem body */ }
  const isManual = body?.source === "manual";

  if (!isManual) {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: setting } = await sb.from("cron_settings").select("is_enabled").eq("setting_key", "punter_cron").maybeSingle();
    if (!setting?.is_enabled) {
      console.log("[prelive-favorito] ⏸️ crons Punter desativados via kill switch");
      return new Response(JSON.stringify({ skipped: true, reason: "punter_cron disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  console.log("[prelive-favorito] iniciando rodada Favorito + AH");

  // Em sequência (não paralelo) para evitar duplo-rate-limit em Sportmonks/Odds
  const favorito = await invoke("plano-favorito-prelive");
  const ah = await invoke("handicap-asiatico-prelive");

  const summary = {
    success: favorito.ok && ah.ok,
    elapsed_ms: Date.now() - startedAt,
    sub_runs: [favorito, ah],
  };
  console.log("[prelive-favorito] concluído", {
    favorito_ok: favorito.ok,
    ah_ok: ah.ok,
    elapsed_ms: summary.elapsed_ms,
  });

  return new Response(JSON.stringify(summary), {
    status: summary.success ? 200 : 207,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
