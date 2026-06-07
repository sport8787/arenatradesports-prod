// punter-telegram-results — Arena Punter
// Varre punter_analyses com result GREEN/RED/VOID ainda não enviados ao Telegram.
// Cron: a cada 10 minutos via pg_cron.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SettledBet {
  id: string;
  home_team: string;
  away_team: string;
  league: string;
  market: string;
  odd: number;
  confidence: number | null;
  stake_percentage: number | null;
  bookmaker: string;
  result: "GREEN" | "RED" | "VOID";
  final_score_home: number;
  final_score_away: number;
  profit_loss: number | null;
}

function escapeMd(s: string): string {
  return String(s ?? "").replace(/([_*`\[])/g, "\\$1");
}

function formatBetMessage(b: SettledBet): string {
  const isGreen = b.result === "GREEN";
  const isVoid = b.result === "VOID";
  const icon = isGreen ? "🟢" : isVoid ? "⚪" : "🔴";
  const label = isGreen ? "GREEN! ✅" : isVoid ? "ANULADO" : "RED ❌";
  const pnl = b.profit_loss ?? 0;
  const pnlSign = pnl > 0 ? "+" : "";
  const pnlLine = isVoid ? "Stake devolvida" : `${pnlSign}${pnl.toFixed(2)}u`;

  return `${icon} *${label}* — Arena Punter

⚽ ${escapeMd(b.home_team)} *${b.final_score_home}-${b.final_score_away}* ${escapeMd(b.away_team)}
🏆 ${escapeMd(b.league || "—")}
🎲 Mercado: *${escapeMd(b.market)}*
💰 Odd: ${Number(b.odd).toFixed(2)}  📊 Conf.: ${b.confidence ?? "—"}%
💵 Resultado: *${pnlLine}*

${isGreen ? "🎯 Sinal confirmado — banca cresce!" : isVoid ? "↩️ Stake devolvida" : "📉 Faz parte. Próximo sinal vindo."}

📲 Grupo VIP gratuito: t.me/oraculo_mycroft
🔗 oraculo-mycroft.com`;
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
      const retryAfter = (data?.parameters?.retry_after ?? 5) + 1;
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return sendTelegram(token, chatId, text, attempt + 1);
    } catch { return false; }
  }
  console.error("[punter-telegram-results] Telegram erro:", res.status, await res.text().catch(() => ""));
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!TOKEN || !CHAT_ID) {
      return new Response(JSON.stringify({ ok: false, sent: 0, message: "Telegram não configurado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("punter_analyses")
      .select("id, home_team, away_team, league, market, odd, confidence, stake_percentage, bookmaker, result, final_score_home, final_score_away, profit_loss")
      .in("result", ["GREEN", "RED", "VOID"])
      .eq("sent_green_to_telegram", false)
      .gte("settled_at", since)
      .order("settled_at", { ascending: true })
      .limit(8);

    if (error) throw error;
    const bets = (data || []) as SettledBet[];

    if (bets.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "Nenhum resultado novo" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sent = 0;
    const sentIds: string[] = [];
    for (const b of bets) {
      const ok = await sendTelegram(TOKEN, CHAT_ID, formatBetMessage(b));
      if (ok) { sent++; sentIds.push(b.id); }
      await new Promise((r) => setTimeout(r, 3000));
    }

    if (sentIds.length > 0) {
      await supabase.from("punter_analyses")
        .update({ sent_green_to_telegram: true, green_telegram_sent_at: new Date().toISOString() })
        .in("id", sentIds);
    }

    return new Response(JSON.stringify({ ok: true, total: bets.length, sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[punter-telegram-results] exception:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
