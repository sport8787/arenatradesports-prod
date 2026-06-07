// live-telegram-results — Arena Live
// Varre mycroft_analyses + live_sinais com result GREEN/RED ainda não enviados ao Telegram.
// Cron: a cada 10 minutos via pg_cron (cron-live-telegram-results).
//
// Fontes:
//   mycroft_analyses — sinais ao vivo aprovados pelo Mycroft (análise IA em tempo real)
//   live_sinais      — sinais pré-live/ao vivo liquidados via plano-favorito-prelive

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BetToSend {
  id: string;
  source: "mycroft_analyses" | "live_sinais";
  home_team: string;
  away_team: string;
  league: string;
  market: string;
  odd: number | null;
  stake_pct: number | null;
  confidence: number | null;
  verdict: string | null;
  result: "GREEN" | "RED";
  score_home: number | null;
  score_away: number | null;
  profit_loss: number | null;
}

function esc(s: string): string {
  return String(s ?? "").replace(/([_*`\[])/g, "\\$1");
}

function buildMessage(b: BetToSend): string {
  const isGreen = b.result === "GREEN";
  const icon = isGreen ? "🟢" : "🔴";
  const label = isGreen ? "GREEN! ✅" : "RED ❌";
  const score = b.score_home != null && b.score_away != null
    ? `${b.score_home}-${b.score_away}` : "—";
  const odd = b.odd != null && b.odd > 1 ? Number(b.odd).toFixed(2) : "—";

  // P&L: se não tiver calculado, deriva da stake e odd
  let pnlLine: string;
  if (b.profit_loss != null) {
    const sign = b.profit_loss > 0 ? "+" : "";
    pnlLine = `${sign}${b.profit_loss.toFixed(2)}u`;
  } else if (b.stake_pct && b.odd && b.odd > 1) {
    const pl = isGreen ? b.stake_pct * (b.odd - 1) : -b.stake_pct;
    const sign = pl > 0 ? "+" : "";
    pnlLine = `${sign}${pl.toFixed(2)}u (stake ${b.stake_pct}%)`;
  } else {
    pnlLine = `stake ${b.stake_pct ?? "?"}%`;
  }

  // Linha de contexto do sinal
  const verdictLabel = b.verdict === "APROVADO_SITUACIONAL"
    ? "Conf. Reduzida" : b.verdict === "LABAREDA" ? "⚡ LABAREDA" : "Aprovado";

  return `${icon} *${label}* — Arena Live

⚽ ${esc(b.home_team)} *${score}* ${esc(b.away_team)}
🏆 ${esc(b.league)}
🎲 Mercado: *${esc(b.market)}*
💰 Odd: ${odd}  📊 Conf.: ${b.confidence ?? "—"}%  🎯 ${esc(verdictLabel)}
💵 Resultado: *${pnlLine}*

${isGreen ? "✅ Sinal confirmado ao vivo — banca cresce!" : "📉 Acontece. O processo continua vencedor."}

📲 Grupo VIP gratuito: t.me/oraculo_mycroft
🔗 oraculo-mycroft.com`;
}

async function sendTelegram(
  token: string, chatId: string, text: string, attempt = 1,
): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true }),
  });
  if (res.ok) return true;
  if (res.status === 429 && attempt <= 2) {
    const d = await res.json().catch(() => ({}));
    const wait = ((d?.parameters?.retry_after ?? 5) + 1) * 1000;
    await new Promise((r) => setTimeout(r, wait));
    return sendTelegram(token, chatId, text, attempt + 1);
  }
  console.error("[live-telegram-results] Telegram erro:", res.status, await res.text().catch(() => ""));
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!TOKEN || !CHAT_ID) {
    console.warn("[live-telegram-results] TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurado");
    return new Response(
      JSON.stringify({ ok: false, sent: 0, message: "Telegram não configurado" }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const queue: BetToSend[] = [];

  // ── 1) mycroft_analyses (sinais ao vivo: APROVADO / APROVADO_SITUACIONAL / LABAREDA)
  {
    const { data, error } = await supabase
      .from("mycroft_analyses")
      .select("id, match_id, market, verdict, odd, stake_pct, confidence, result, final_score_home, final_score_away, profit_loss, settled_at")
      .in("result", ["GREEN", "RED"])
      .eq("sent_result_telegram", false)
      .gte("settled_at", since)
      .order("settled_at", { ascending: true })
      .limit(6);

    if (error) {
      console.error("[live-telegram-results] mycroft_analyses select error:", error.message);
    }

    for (const r of data ?? []) {
      // Busca nomes dos times via live_matches pelo match_id
      let home = "—", away = "—", league = "—";
      const { data: lm } = await supabase
        .from("live_matches")
        .select("home_team, away_team, league, sport_title")
        .eq("match_id", r.match_id)
        .maybeSingle();
      if (lm) {
        home = lm.home_team || "—";
        away = lm.away_team || "—";
        league = lm.league || lm.sport_title || "—";
      }

      // Stake fallback por verdict quando não foi salvo pela IA
      const stake: number = Number(r.stake_pct) > 0
        ? Number(r.stake_pct)
        : r.verdict === "APROVADO_SITUACIONAL" ? 2 : 5;

      const odd = Number(r.odd);
      const profitLoss = r.result === "GREEN"
        ? parseFloat((stake * (odd - 1)).toFixed(2))
        : -stake;

      queue.push({
        id: r.id,
        source: "mycroft_analyses",
        home_team: home,
        away_team: away,
        league,
        market: r.market,
        odd: r.odd,
        stake_pct: stake,
        confidence: r.confidence,
        verdict: r.verdict,
        result: r.result,
        score_home: r.final_score_home,
        score_away: r.final_score_away,
        profit_loss: profitLoss,
      });
    }
  }

  // ── 2) live_sinais (sinais pré-live / ao vivo liquidados)
  {
    const { data, error } = await supabase
      .from("live_sinais")
      .select("id, home_team, away_team, championship, market, odd, stake, confidence, verdict, result, goals_home, goals_away, profit_loss, settled_at")
      .in("result", ["GREEN", "RED"])
      .eq("sent_result_telegram", false)
      .gte("settled_at", since)
      .order("settled_at", { ascending: true })
      .limit(6);

    if (error) {
      console.error("[live-telegram-results] live_sinais select error:", error.message);
    }

    for (const r of data ?? []) {
      queue.push({
        id: r.id,
        source: "live_sinais",
        home_team: r.home_team || "—",
        away_team: r.away_team || "—",
        league: r.championship || "—",
        market: r.market,
        odd: r.odd,
        stake_pct: r.stake,
        confidence: r.confidence,
        verdict: r.verdict ?? "APROVADO",
        result: r.result,
        score_home: r.goals_home,
        score_away: r.goals_away,
        profit_loss: r.profit_loss,
      });
    }
  }

  if (queue.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, sent: 0, message: "Nenhum resultado novo para enviar" }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  let sent = 0;
  const sentMycroft: string[] = [];
  const sentLive: string[] = [];

  for (const b of queue) {
    const ok = await sendTelegram(TOKEN, CHAT_ID, buildMessage(b));
    if (ok) {
      sent++;
      if (b.source === "mycroft_analyses") sentMycroft.push(b.id);
      else sentLive.push(b.id);
    }
    // 3s entre mensagens para não extrapolar o rate limit do Telegram em grupos
    await new Promise((r) => setTimeout(r, 3000));
  }

  // Marca como enviado
  if (sentMycroft.length > 0) {
    await supabase.from("mycroft_analyses")
      .update({ sent_result_telegram: true, result_telegram_sent_at: now })
      .in("id", sentMycroft);
  }
  if (sentLive.length > 0) {
    await supabase.from("live_sinais")
      .update({ sent_result_telegram: true, result_telegram_sent_at: now })
      .in("id", sentLive);
  }

  console.log(
    `[live-telegram-results] total=${queue.length} sent=${sent} mycroft=${sentMycroft.length} live_sinais=${sentLive.length}`,
  );

  return new Response(
    JSON.stringify({
      ok: true,
      total: queue.length,
      sent,
      mycroft_analyses: sentMycroft.length,
      live_sinais: sentLive.length,
    }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
