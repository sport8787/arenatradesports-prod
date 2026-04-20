import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!TOKEN || !CHAT_ID) throw new Error("Telegram não configurado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Busca tudo que foi liquidado nas últimas 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("punter_analyses")
      .select("home_team, away_team, market, odd, result, profit_loss, final_score_home, final_score_away, stake_percentage")
      .in("result", ["GREEN", "RED", "VOID"])
      .gte("settled_at", since)
      .order("profit_loss", { ascending: false });

    if (error) throw error;
    const bets = data || [];

    if (bets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum resultado liquidado nas últimas 24h" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const greens = bets.filter((b) => b.result === "GREEN");
    const reds = bets.filter((b) => b.result === "RED");
    const voids = bets.filter((b) => b.result === "VOID");

    const totalPnl = bets.reduce((s, b) => s + (Number(b.profit_loss) || 0), 0);
    const totalStake = bets
      .filter((b) => b.result !== "VOID")
      .reduce((s, b) => s + (Number(b.stake_percentage) || 1), 0);
    const roi = totalStake > 0 ? (totalPnl / totalStake) * 100 : 0;
    const winRate = bets.length > 0 ? (greens.length / (greens.length + reds.length || 1)) * 100 : 0;

    const today = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    const best = greens[0];
    const bestLine = best
      ? `\n🏆 *Melhor sinal:* ${best.home_team} ${best.final_score_home}-${best.final_score_away} ${best.away_team} (${best.market} @ ${Number(best.odd).toFixed(2)}) → +${Number(best.profit_loss).toFixed(2)}u`
      : "";

    const pnlIcon = totalPnl > 0 ? "💰" : totalPnl < 0 ? "📉" : "➖";
    const pnlSign = totalPnl > 0 ? "+" : "";

    const msg = `📊 *RESUMO DO DIA — ${today}*
━━━━━━━━━━━━━━━━━

✅ Sinais liquidados: *${bets.length}*
🟢 GREENs: *${greens.length}*
🔴 REDs: *${reds.length}*${voids.length > 0 ? `\n⚪ Anulados: ${voids.length}` : ""}
🎯 Taxa de acerto: *${winRate.toFixed(1)}%*
📈 ROI: *${pnlSign}${roi.toFixed(1)}%*
${pnlIcon} Resultado: *${pnlSign}${totalPnl.toFixed(2)}u*${bestLine}

━━━━━━━━━━━━━━━━━
⚡ Mycroft IA — Arena Punter

📲 Grupo VIP gratuito: t.me/oraculo_mycroft
🔗 oraculo-mycroft.com`;

    const tg = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: msg,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    if (!tg.ok) {
      const err = await tg.text();
      throw new Error(`Telegram erro: ${tg.status} ${err}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        bets: bets.length,
        greens: greens.length,
        reds: reds.length,
        roi,
        pnl: totalPnl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("punter-daily-summary-telegram error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
