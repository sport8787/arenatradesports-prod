// edge-health-monitor
// Cron: a cada hora (*/60 * * * *)
// Verifica edge_error_logs nas últimas 2h e dispara alerta Telegram
// se alguma edge crítica falhou repetidamente.
// Kill-switch: cron_settings.edge_health_monitor

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Edges críticas que merecem alerta imediato se falharem
const CRITICAL_EDGES = new Set([
  "punter-prelive-favorito",
  "punter-prelive-geral",
  "mycroft-punter-anthropic",
  "mycroft-punter-sportmonks",
  "analyze-live-matches",
  "cron-live-matches",
  "asaas-webhook",
  "kiwify-webhook",
  "liquidar-sinais-ao-vivo",
  "punter-clv-capture",
]);

// Threshold: 3+ erros em 2h → alerta
const ERROR_THRESHOLD = 3;
const WINDOW_HOURS = 2;

async function sendTelegram(token: string, chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Kill switch
  const { data: setting } = await sb
    .from("cron_settings")
    .select("is_enabled")
    .eq("setting_key", "edge_health_monitor")
    .maybeSingle();

  // Se a chave não existir, considera ativo por padrão (fail-open)
  if (setting && !setting.is_enabled) {
    return new Response(JSON.stringify({ skipped: true, reason: "kill_switch" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString();

  // Busca erros das últimas 2h
  const { data: errors, error: qErr } = await sb
    .from("edge_error_logs")
    .select("function_name, error_message, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  if (qErr) {
    console.error("[health] erro ao buscar logs:", qErr.message);
    return new Response(JSON.stringify({ error: qErr.message }), { status: 500, headers: corsHeaders });
  }

  // Agrupa por edge
  const counts: Record<string, { count: number; lastError: string; lastAt: string }> = {};
  for (const e of errors ?? []) {
    const fn = e.function_name || "unknown";
    if (!counts[fn]) counts[fn] = { count: 0, lastError: "", lastAt: "" };
    counts[fn].count++;
    if (!counts[fn].lastAt || e.created_at > counts[fn].lastAt) {
      counts[fn].lastAt = e.created_at;
      counts[fn].lastError = (e.error_message || "").slice(0, 120);
    }
  }

  // Filtra apenas críticas com erros acima do threshold
  const alerts = Object.entries(counts)
    .filter(([fn, d]) => CRITICAL_EDGES.has(fn) && d.count >= ERROR_THRESHOLD)
    .sort((a, b) => b[1].count - a[1].count);

  console.log(`[health] janela=${WINDOW_HOURS}h erros_total=${errors?.length ?? 0} alertas=${alerts.length}`);

  if (alerts.length === 0) {
    return new Response(JSON.stringify({ ok: true, alerts: 0, checked: Object.keys(counts).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Monta mensagem Telegram
  const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

  if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
    const lines = alerts.map(([fn, d]) =>
      `• \`${fn}\` — *${d.count} erros*\n  └ ${d.lastError || "sem detalhe"}`
    ).join("\n");

    const msg =
      `🚨 *ORÁCULO MYCROFT — ALERTA DE SAÚDE*\n\n` +
      `${alerts.length} edge(s) crítica(s) com falhas nas últimas ${WINDOW_HOURS}h:\n\n` +
      `${lines}\n\n` +
      `_Verifique Supabase → Logs → Functions_`;

    try {
      await sendTelegram(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, msg);
      console.log("[health] alerta Telegram enviado");
    } catch (e) {
      console.warn("[health] falha ao enviar Telegram:", (e as Error).message);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, alerts: alerts.length, details: alerts.map(([fn, d]) => ({ fn, ...d })) }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
