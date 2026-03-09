import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApprovedBet {
  id: string;
  home_team: string;
  away_team: string;
  league: string;
  market: string;
  odd: number;
  confidence: number | null;
  value_percentage: number | null;
  stake_percentage: number | null;
  commence_time: string;
  bookmaker: string;
  thesis: string | null;
}

// ============================================================================
// TELEGRAM FORMATTER
// ============================================================================

function formatTelegramMessage(bets: ApprovedBet[], batchLabel?: string): string {
  const today = new Date().toLocaleDateString("pt-BR");
  let message = `🎯 *APOSTAS APROVADAS* — ${today}\n`;
  if (batchLabel) message += `📦 ${batchLabel}\n`;
  message += `\n📊 Total: *${bets.length} apostas*\n\n`;

  bets.forEach((bet, index) => {
    const score = bet.confidence ?? 70;
    const tierEmoji = score >= 90 ? "⭐⭐⭐" : score >= 70 ? "⭐⭐" : "⭐";
    const tierLabel = score >= 90 ? "ELITE" : score >= 70 ? "PREMIUM" : "STRONG";
    const edge = bet.value_percentage ?? 0;
    const stake = bet.stake_percentage ?? 1;

    const gameTime = new Date(bet.commence_time).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    message += `━━━━━━━━━━━━━━━━━\n`;
    message += `*${index + 1}. ${bet.home_team} vs ${bet.away_team}*\n`;
    message += `🏆 ${bet.league}\n`;
    message += `📊 ${bet.market}\n`;
    message += `💰 Odd: *${bet.odd.toFixed(2)}* (${bet.bookmaker})\n`;
    message += `${tierEmoji} Asset Score: *${score} ${tierLabel}*\n`;
    message += `📈 Edge: *+${edge.toFixed(1)}%*\n`;
    message += `💵 Stake: *${stake.toFixed(1)}%*\n`;
    message += `🕐 ${gameTime}\n\n`;
  });

  message += `━━━━━━━━━━━━━━━━━\n\n`;
  message += `✅ *Todas disponíveis no app*\n`;
  message += `⚡ *Mycroft IA — Arena Punter*`;

  return message;
}

// ============================================================================
// EMAIL HTML FORMATTER
// ============================================================================

function formatEmailHtml(bets: ApprovedBet[]): string {
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const betsHtml = bets
    .map((bet, index) => {
      const score = bet.confidence ?? 70;
      const badgeColor = score >= 90 ? "#fbbf24" : score >= 70 ? "#3b82f6" : "#10b981";
      const badgeTextColor = score >= 90 ? "#000" : "#fff";
      const badgeLabel = score >= 90 ? "ELITE" : score >= 70 ? "PREMIUM" : "STRONG";
      const edge = bet.value_percentage ?? 0;
      const stake = bet.stake_percentage ?? 1;

      const gameTime = new Date(bet.commence_time).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      });

      return `
      <div style="background:#0f1729;border-radius:8px;padding:20px;margin-bottom:16px;border-left:4px solid #3b82f6;">
        <div style="font-size:18px;font-weight:bold;color:#fff;margin-bottom:12px;">
          ${index + 1}. ${bet.home_team} vs ${bet.away_team}
        </div>
        <table style="width:100%;font-size:14px;color:#94a3b8;">
          <tr><td>🏆 <strong style="color:#fff">Liga:</strong></td><td style="color:#fff">${bet.league}</td></tr>
          <tr><td>📊 <strong style="color:#fff">Mercado:</strong></td><td style="color:#fff">${bet.market}</td></tr>
          <tr><td>💰 <strong style="color:#fff">Odd:</strong></td><td style="color:#fff">${bet.odd.toFixed(2)} (${bet.bookmaker})</td></tr>
          <tr><td>📈 <strong style="color:#fff">Edge:</strong></td><td style="color:#10b981">+${edge.toFixed(1)}%</td></tr>
          <tr><td>💵 <strong style="color:#fff">Stake:</strong></td><td style="color:#fff">${stake.toFixed(1)}%</td></tr>
          <tr><td>🕐 <strong style="color:#fff">Horário:</strong></td><td style="color:#fff">${gameTime}</td></tr>
        </table>
        <div style="margin-top:12px;">
          <span style="display:inline-block;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:bold;background:${badgeColor};color:${badgeTextColor};">
            ${score} ${badgeLabel}
          </span>
        </div>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0f1e;color:#fff;">
  <div style="max-width:600px;margin:0 auto;background:#1a1f36;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);padding:40px 20px;text-align:center;">
      <h1 style="font-size:28px;margin:0 0 8px;">🎯 Apostas Aprovadas</h1>
      <p style="margin:0;font-size:16px;opacity:0.9;">${today}</p>
    </div>
    <div style="padding:30px 20px;">
      <p style="font-size:16px;margin-bottom:24px;color:#cbd5e1;">
        Aqui estão as <strong style="color:#fff;">${bets.length} apostas aprovadas</strong> pelo Mycroft hoje:
      </p>
      ${betsHtml}
      <div style="text-align:center;margin-top:24px;">
        <a href="https://arenatradesports.lovable.app/punter" 
           style="display:inline-block;background:#3b82f6;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">
          VER NO APP →
        </a>
      </div>
    </div>
    <div style="background:#0f1729;padding:30px 20px;text-align:center;font-size:14px;color:#64748b;">
      <p style="margin:0;"><strong>⚡ Oráculo Mycroft</strong></p>
      <p style="font-size:12px;margin-top:8px;">Arena Punter — Análise Esportiva Inteligente</p>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    // Parse optional params
    let bodyParams: any = {};
    try {
      bodyParams = await req.json();
    } catch { /* empty body is fine */ }

    const telegramBatchSize = bodyParams.telegram_batch_size ?? 4;
    const skipEmail = bodyParams.skip_email ?? false;

    // 1. Fetch approved bets not yet sent
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Telegram: only unsent
    const { data: betsForTelegram, error: tgError } = await supabase
      .from("punter_analyses")
      .select("*")
      .eq("verdict", "APROVADO")
      .gt("commence_time", now)
      .gte("created_at", yesterday)
      .eq("sent_to_telegram", false)
      .order("commence_time", { ascending: true })
      .limit(telegramBatchSize);

    if (tgError) {
      console.error("❌ Erro ao buscar apostas para Telegram:", tgError);
    }

    // Email: only unsent (fetch all for email)
    const { data: betsForEmail, error: emailError } = await supabase
      .from("punter_analyses")
      .select("*")
      .eq("verdict", "APROVADO")
      .gt("commence_time", now)
      .gte("created_at", yesterday)
      .eq("sent_to_email", false)
      .order("commence_time", { ascending: true })
      .limit(50);

    if (emailError) {
      console.error("❌ Erro ao buscar apostas para Email:", emailError);
    }

    const telegramBets = betsForTelegram || [];
    const emailBets = betsForEmail || [];

    if (telegramBets.length === 0 && emailBets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma aposta nova para enviar", bets_sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📊 Telegram: ${telegramBets.length} apostas (batch ${telegramBatchSize}), Email: ${emailBets.length} apostas`);

    let telegramSent = false;
    let emailsSent = 0;

    // =========================================================================
    // 2. Send Telegram — batched (only `telegramBatchSize` per call)
    // =========================================================================
    if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID && telegramBets.length > 0) {
      // Count total unsent to show batch label
      const { count: totalUnsent } = await supabase
        .from("punter_analyses")
        .select("*", { count: "exact", head: true })
        .eq("verdict", "APROVADO")
        .gt("commence_time", now)
        .gte("created_at", yesterday)
        .eq("sent_to_telegram", false);

      const batchLabel = totalUnsent && totalUnsent > telegramBets.length
        ? `Lote ${telegramBets.length}/${totalUnsent} sinais restantes`
        : undefined;

      const telegramMessage = formatTelegramMessage(telegramBets, batchLabel);

      const tgResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: telegramMessage,
            parse_mode: "Markdown",
          }),
        }
      );

      if (tgResponse.ok) {
        telegramSent = true;
        console.log(`✅ Telegram enviado (${telegramBets.length} apostas)`);

        // Mark only this batch as sent
        const tgIds = telegramBets.map((b: any) => b.id);
        await supabase
          .from("punter_analyses")
          .update({ sent_to_telegram: true, telegram_sent_at: new Date().toISOString() })
          .in("id", tgIds);
      } else {
        const err = await tgResponse.json();
        console.error("❌ Telegram error:", err);
      }
    }

    // =========================================================================
    // 3. Send Emails via Resend (all unsent at once, skip if flag set)
    // =========================================================================
    if (!skipEmail && RESEND_API_KEY && emailBets.length > 0) {
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 500 });

      if (authError) {
        console.error("❌ Erro ao buscar usuários:", authError);
      } else {
        const confirmedEmails = (authData?.users || [])
          .filter(u => u.email && u.email_confirmed_at)
          .map(u => u.email!);

        console.log(`📧 ${confirmedEmails.length} usuários confirmados`);

        if (confirmedEmails.length > 0) {
          const emailHtml = formatEmailHtml(emailBets);
          const today = new Date().toLocaleDateString("pt-BR");

          for (const email of confirmedEmails) {
            try {
              const resendResponse = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${RESEND_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: "Oráculo Mycroft <onboarding@resend.dev>",
                  to: email,
                  subject: `🎯 ${emailBets.length} Apostas Aprovadas — ${today}`,
                  html: emailHtml,
                }),
              });

              if (resendResponse.ok) {
                emailsSent++;
              } else {
                const err = await resendResponse.json();
                console.error(`❌ Email error for ${email}:`, err);
              }
            } catch (emailErr) {
              console.error(`❌ Email send error for ${email}:`, emailErr);
            }
          }

          console.log(`✅ ${emailsSent}/${confirmedEmails.length} emails enviados`);

          if (emailsSent > 0) {
            const emailIds = emailBets.map((b: any) => b.id);
            await supabase
              .from("punter_analyses")
              .update({ sent_to_email: true, email_sent_at: new Date().toISOString() })
              .in("id", emailIds);
          }
        }
      }
    }

    console.log("✅ Notificações processadas");

    return new Response(
      JSON.stringify({
        success: true,
        telegram: { sent: telegramSent, count: telegramBets.length },
        email: { sent: emailsSent > 0, count: emailsSent },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Erro send-notifications:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
