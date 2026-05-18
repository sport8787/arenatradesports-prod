// Edge: punter-prelive-geral
// Análise pré-live do Punter — varredura geral de mercados.
// Cobre: 1X2/DC, Over-Under, BTTS, Handicap Asiático,
// Escanteios, Cartões e Players.
// É uma orquestradora fina: chama em sequência os motores Sportmonks já
// existentes e devolve um resumo consolidado.
// Disparo:
//   - Cron: diário 11:30 UTC (08:30 BRT)
//   - Manual: POST /functions/v1/punter-prelive-geral
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Time guard global generoso — Supabase Edge tem timeout próprio (~150s).
const TIME_GUARD_MS = 140_000;

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
  console.log("[prelive-geral] iniciando varredura geral de mercados");

  // Ordem importa: o motor principal Sportmonks roda primeiro (insere a base
  // de jogos em punter_analyses), depois os módulos complementares vão
  // adicionar/atualizar mercados específicos (corners, cards, players, AH).
  const runs: any[] = [];

  // Nota: mycroft-corners-punter é per-jogo (chamada do card no /punter pelo
  // usuário), não tem modo batch. Fica fora do cron — escanteios continuam
  // gerados sob demanda como antes.
  const pipeline = [
    "mycroft-punter-sportmonks",   // 1X2 / DC / O-U / BTTS (Sportmonks + Gemini)
    "handicap-asiatico-prelive",    // AH dedicado
    "mycroft-cards-punter",         // Cartões (batch)
    "mycroft-players-punter",       // Marcadores (batch)
  ];

  for (const fn of pipeline) {
    if (Date.now() - startedAt > TIME_GUARD_MS) {
      console.warn(`[prelive-geral] time guard atingido, pulando ${fn}`);
      runs.push({ name: fn, ok: false, skipped: true, reason: "time_guard" });
      continue;
    }
    const res = await invoke(fn);
    runs.push(res);
    console.log(`[prelive-geral] ${fn}: ok=${res.ok} status=${res.status} ms=${res.elapsed_ms}`);
  }

  const allOk = runs.every((r) => r.ok || r.skipped);
  const summary = {
    success: allOk,
    elapsed_ms: Date.now() - startedAt,
    sub_runs: runs,
  };

  return new Response(JSON.stringify(summary), {
    status: allOk ? 200 : 207,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
