// punter-telegram-results — Sweep de resultados GREEN/RED e envia ao grupo Telegram.
// Varre 3 fontes: punter_analyses, mycroft_analyses, live_sinais
// Cron recomendado: a cada 10 minutos.

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
  odd: number | null;
  confidence: number | null;
  stake_pct: number | null;
  result: "GREEN" | "RED" | "VOID";
  score_home: number | null;
  score_away: number | null;
  profit_loss: number | null;
  source: "punter_analyses" | "mycroft_analyses" | "live_sinais";
}

function escapeMd(s: string): string {
  return String(s ?? "").replace(/([_*`\[])/g, "\\$1");
}

function formatBetMessage(b: SettledBet): string {
  const isGreen = b.result === "GREEN";
  const isVoid = b.result === "VOID";
  const icon = isGreen ? "🟢" : isVoid ? "⚪" : "🔴";
  const label = isGreen ? "GREEN! ✅" : isVoid ? "ANULADO" : "RED ❌";
  const pnl = b.profit_loss;
  const stake = b.stake_pct ?? "?";
  const odd = b.odd != null ? Number(b.odd).toFixed(2) : "—";
  const score = b.score_home != null && b.score_away != null
    ? `${b.score_home}-${b.score_away}`
    : "—";
  const pnlLine = isVoid
    ? "Stake devolvida"
    : pnl != null
    ? `${pnl > 0 ? "+" : ""}${pnl.toFixed(2)}u`
    : `stake ${stake}%`;

  return `${icon} *${label}* — Oráculo Mycroft

⚽ ${escapeMd(b.home_team)} *${score}* ${escapeMd(b.away_team)}
🏆 ${escapeMd(b.league || "—")}
🎲 Mercado: *${escapeMd(b.market)}*
💰 Odd: ${odd}  📊 Conf.: ${b.confidence ?? "—"}%  💵 Stake: ${stake}%
💵 Resultado: *${pnlLine}*

${isGreen ? "🎯 Sinal confirmado — banca cresce!" : isVoid ? "↩️ Stake devolvida" : "📉 Faz parte do processo. O próximo vem!"}

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
      console.warn("[punter-telegram-results] Telegram não configurado — TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID faltando");
      return new Response(JSON.stringify({ ok: false, sent: 0, message: "Telegram não configurado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    const allBets: SettledBet[] = [];

    // ── 1) punter_analyses (tabela original)
    {
      const { data } = await supabase
        .from("punter_analyses")
        .select("id, home_team, away_team, league, market, odd, confidence, stake_percentage, result, final_score_home, final_score_away, profit_loss")
        .in("result", ["GREEN", "RED", "VOID"])
        .eq("sent_green_to_telegram", false)
        .gte("settled_at", since)
        .order("settled_at", { ascending: true })
        .limit(6);
      for (const r of data ?? []) {
        allBets.push({
          id: r.id, source: "punter_analyses",
          home_team: r.home_team, away_team: r.away_team,
          league: r.league, market: r.market,
          odd: r.odd, confidence: r.confidence,
          stake_pct: r.stake_percentage,
          result: r.result,
          score_home: r.final_score_home, score_away: r.final_score_away,
          profit_loss: r.profit_loss,
        });
      }
    }

    // ── 2) mycroft_analyses (sinais ao vivo aprovados pelo Mycroft)
    {
      const { data } = await supabase
        .from("mycroft_analyses")
        .select("id, match_id, market, odd, stake_pct, confidence, verdict, result, final_score_home, final_score_away, settled_at")
        .in("result", ["GREEN", "RED"])
        .eq("sent_result_telegram", false)
        .gte("settled_at", since)
        .order("settled_at", { ascending: true })
        .limit(6);
      for (const r of data ?? []) {
        // Busca nomes dos times via live_matches
        let home = "—", away = "—", league = "—";
        const { data: lm } = await supabase
          .from("live_matches")
          .select("home_team, away_team, league, sport_title")
          .eq("match_id", r.match_id)
          .maybeSingle();
        if (lm) { home = lm.home_team || "—"; away = lm.away_team || "—"; league = lm.league || lm.sport_title || "—"; }
        // Stake fallback: APROVADO_SITUACIONAL=2%, outros=5%
        const stake = r.stake_pct ?? (r.verdict === "APROVADO_SITUACIONAL" ? 2 : 5);
        const odd = Number(r.odd);
        const profitLoss = r.result === "GREEN"
          ? parseFloat(((stake * (odd - 1))).toFixed(2))
          : -stake;
        allBets.push({
          id: r.id, source: "mycroft_analyses",
          home_team: home, away_team: away,
          league, market: r.market,
          odd: r.odd, confidence: r.confidence,
          stake_pct: stake,
          result: r.result,
          score_home: r.final_score_home, score_away: r.final_score_away,
          profit_loss: profitLoss,
        });
      }
    }

    // ── 3) live_sinais (sinais pré-live liquidados)
    {
      const { data } = await supabase
        .from("live_sinais")
        .select("id, home_team, away_team, championship, market, odd, stake, confidence, result, goals_home, goals_away, profit_loss")
        .in("result", ["GREEN", "RED"])
        .eq("sent_result_telegram", false)
        .gte("settled_at", since)
        .order("settled_at", { ascending: true })
        .limit(6);
      for (const r of data ?? []) {
        allBets.push({
          id: r.id, source: "live_sinais",
          home_team: r.home_team || "—", away_team: r.away_team || "—",
          league: r.championship || "—", market: r.market,
          odd: r.odd, confidence: r.confidence,
          stake_pct: r.stake,
          result: r.result,
          score_home: r.goals_home, score_away: r.goals_away,
          profit_loss: r.profit_loss,
        });
      }
    }

    if (allBets.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, message: "Nenhum resultado novo para enviar" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date().toISOString();
    let sent = 0;
    const sentBySource: Record<string, string[]> = {
      punter_analyses: [], mycroft_analyses: [], live_sinais: [],
    };

    for (const b of allBets) {
      const msg = formatBetMessage(b);
      const ok = await sendTelegram(TOKEN, CHAT_ID, msg);
      if (ok) {
        sent++;
        sentBySource[b.source].push(b.id);
      }
      await new Promise((r) => setTimeout(r, 3000));
    }

    // Marca como enviado em cada tabela
    if (sentBySource.punter_analyses.length > 0) {
      await supabase.from("punter_analyses")
        .update({ sent_green_to_telegram: true, green_telegram_sent_at: now })
        .in("id", sentBySource.punter_analyses);
    }
    if (sentBySource.mycroft_analyses.length > 0) {
      await supabase.from("mycroft_analyses")
        .update({ sent_result_telegram: true, result_telegram_sent_at: now })
        .in("id", sentBySource.mycroft_analyses);
    }
    if (sentBySource.live_sinais.length > 0) {
      await supabase.from("live_sinais")
        .update({ sent_result_telegram: true, result_telegram_sent_at: now })
        .in("id", sentBySource.live_sinais);
    }

    console.log(`[punter-telegram-results] sent=${sent}/${allBets.length} punter=${sentBySource.punter_analyses.length} mycroft=${sentBySource.mycroft_analyses.length} live=${sentBySource.live_sinais.length}`);

    return new Response(
      JSON.stringify({ ok: true, total: allBets.length, sent, by_source: Object.fromEntries(Object.entries(sentBySource).map(([k, v]) => [k, v.length])) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[punter-telegram-results] exception:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
