import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
      throw new Error("Telegram credentials not configured");
    }

    const body = await req.json();

    // Health check mode — does not send anything
    if (body?.test === true) {
      return new Response(
        JSON.stringify({ success: true, mode: "health_check", message: "Function reachable" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { ativo, preco, sinal, analise_mycroft, script_horus, confluencia, estresse, institucional, positionSizing } = body;

    const sizingInfo = positionSizing
      ? `\n💼 *POSITION SIZING:*\nRisco Máx: ${positionSizing.risco_maximo_tc} TC | Size: ${positionSizing.size_sugerido_tc} TC\nSL: ${positionSizing.sl_preco} | TP: ${positionSizing.tp_preco} | RR: ${positionSizing.rr_ratio}x`
      : "";

    const mensagem = `
🏛️ *ARENA TRADER — ALERTA MYCROFT*

📈 *ATIVO:* ${ativo}
💰 *PREÇO:* ${preco}
🎯 *SINAL:* ${sinal}
📊 *Confluência:* ${confluencia ?? "N/A"}/4
⚠️ *Estresse:* ${estresse ?? "N/A"}
🐋 *Institucional:* ${institucional ?? "N/A"}
${sizingInfo}

🔬 *ANÁLISE FORENSE:*
${analise_mycroft}

🎙️ *VEREDITO DE HÓRUS:*
"${script_horus}"
    `.trim();

    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

    const tgResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: mensagem,
        parse_mode: "Markdown",
      }),
    });

    const tgData = await tgResponse.json();

    if (!tgResponse.ok) {
      console.error("Telegram API error:", tgData);
      throw new Error(`Telegram API error: ${tgResponse.status}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Mycroft Telegram error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
