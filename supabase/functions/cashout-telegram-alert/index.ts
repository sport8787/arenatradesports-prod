// cashout-telegram-alert — envia alerta CRITICAL de Cash-Out para grupo Telegram.
// Chamado por evaluate-cashout quando dispara sinal CRITICAL inédito.
// Dedupe externo: bet_id + signal_type + placar (evita repetir).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeMd(s: string): string {
  return String(s ?? "").replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

async function sendTelegram(token: string, chatId: string, text: string, attempt = 1): Promise<boolean> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true }),
  });
  if (res.ok) return true;
  if (res.status === 429 && attempt <= 2) {
    try {
      const data = await res.json();
      const retry = (data?.parameters?.retry_after ?? 5) + 1;
      await new Promise((r) => setTimeout(r, retry * 1000));
      return sendTelegram(token, chatId, text, attempt + 1);
    } catch { return false; }
  }
  console.error("[cashout-telegram-alert] erro", res.status, await res.text().catch(() => ""));
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!TOKEN || !CHAT_ID) {
      return new Response(JSON.stringify({ ok: false, error: "telegram not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const {
      bet_id, signal_type, match_name, market, placar, minuto,
      entry_odd, current_odd, cashout_value, motivo,
    } = body || {};

    if (!bet_id || !signal_type || !match_name) {
      return new Response(JSON.stringify({ ok: false, error: "missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Dedupe: já mandamos esse signal_type+placar para essa bet?
    const dedupeKey = `${bet_id}::${signal_type}::${placar ?? ""}`;
    const { data: existing } = await supabase
      .from("cashout_telegram_alerts")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ ok: true, deduped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lossPct = current_odd && entry_odd
      ? Math.round(((Number(current_odd) / Number(entry_odd)) - 1) * 100)
      : null;
    const lucroPerda = cashout_value && entry_odd
      ? Number(cashout_value) - (Number(cashout_value) / Number(current_odd || 1)) * Number(entry_odd)
      : null;

    const text = `🚨 *CASH OUT RECOMENDADO* 🚨

⚽ ${escapeMd(match_name)}${placar ? ` *${escapeMd(placar)}*` : ""}${minuto ? ` ⏱️ ${escapeMd(String(minuto))}'` : ""}
🎲 Mercado: *${escapeMd(market || "—")}*
💰 Odd: ${entry_odd ? Number(entry_odd).toFixed(2) : "—"} → *${current_odd ? Number(current_odd).toFixed(2) : "—"}*${lossPct != null ? ` (${lossPct >= 0 ? "+" : ""}${lossPct}%)` : ""}
${cashout_value ? `💵 Valor de Cash Out: *R$ ${Number(cashout_value).toFixed(2)}*` : ""}

📉 *${escapeMd(motivo || "Posição comprometida — fechar agora")}*

⚠️ *Ação recomendada: feche a posição IMEDIATAMENTE*

📲 Mais sinais: t.me/oraculo_mycroft
🔗 oraculo-mycroft.com`;

    const sent = await sendTelegram(TOKEN, CHAT_ID, text);

    await supabase.from("cashout_telegram_alerts").insert({
      bet_id, signal_type, match_name, market, placar, minuto,
      entry_odd, current_odd, cashout_value, motivo,
      dedupe_key: dedupeKey, sent,
    });

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[cashout-telegram-alert] error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
