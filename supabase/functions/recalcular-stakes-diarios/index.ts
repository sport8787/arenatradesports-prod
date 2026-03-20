import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Recalcular Stakes Diários
 * 
 * Cron: Todo dia às 10:00 BRT (13:00 UTC)
 * 
 * Busca sinais com status 'awaiting_stake' cujo match_date é hoje,
 * recalcula o stake Kelly com a banca real atual de cada usuário,
 * e atualiza o status para 'stake_calculated'.
 */

// Tier-based stake rules (% of bankroll)
const TIER_STAKE: Record<number, number> = {
  1: 4.5,  // Elite
  2: 3.25, // Forte
  3: 2.25, // Valor
};

const MAX_DAILY_EXPOSURE = 15; // % máximo de exposição diária

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const hoje = new Date().toISOString().split("T")[0];

    // Buscar sinais aprovados para hoje sem stake
    const { data: signals, error } = await supabase
      .from("punter_signals")
      .select("*, punter_analyses!punter_signals_analysis_id_fkey(confidence, stake_percentage, home_team, away_team, league, market, thesis, odd)")
      .eq("match_date", hoje)
      .eq("stake_confirmed", false)
      .eq("dismissed", false)
      .eq("status", "awaiting_stake");

    if (error) {
      console.error("[Recálculo] Erro ao buscar sinais:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!signals || signals.length === 0) {
      console.log("[Recálculo] Nenhum sinal pendente para hoje");
      return new Response(
        JSON.stringify({ recalculadas: 0, data: hoje, mensagem: "Nenhum sinal pendente para hoje" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Recálculo] ${signals.length} sinais encontrados para ${hoje}`);

    // Agrupar por match_id para identificar usuários únicos
    // Sinais são globais (não per-user), banca é per-user
    // Precisamos buscar todos os usuários que têm banca configurada
    const { data: bankrolls } = await supabase
      .from("user_bankroll")
      .select("user_id, balance, initial_balance");

    if (!bankrolls || bankrolls.length === 0) {
      console.log("[Recálculo] Nenhuma banca encontrada");
      return new Response(
        JSON.stringify({ recalculadas: 0, mensagem: "Nenhuma banca configurada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalRecalculadas = 0;

    for (const signal of signals) {
      const analysis = signal.punter_analyses;
      if (!analysis) continue;

      // Determinar tier baseado no stake_percentage_original
      const originalStake = signal.stake_percentage_original || analysis.stake_percentage || 3;
      let tier = 3;
      if (originalStake >= 4) tier = 1;
      else if (originalStake >= 3) tier = 2;

      const stakeBase = TIER_STAKE[tier] || 2.25;

      // Buscar apostas já confirmadas hoje para verificar exposição
      // (sinais são globais, mas a exposição é verificada na hora do bet placement no frontend)
      
      // Calcular stake amount usando a primeira banca disponível como referência
      // (o stake real será calculado per-user no frontend quando confirmar)
      const refBankroll = bankrolls[0]?.balance || 1000;
      const stakeAmount = Math.round(refBankroll * (stakeBase / 100) * 100) / 100;

      await supabase
        .from("punter_signals")
        .update({
          stake_percentage: stakeBase,
          stake_amount: stakeAmount,
          bankroll_at_recalc: refBankroll,
          stake_recalculated_at: new Date().toISOString(),
          status: "stake_calculated",
        })
        .eq("id", signal.id);

      totalRecalculadas++;

      const tierLabel = tier === 1 ? '⚡ SINAL FORTE' : tier === 2 ? '✅ SINAL BOM' : '🎯 SINAL MODERADO';
      console.log(
        `[Recálculo] ✅ ${analysis.home_team} vs ${analysis.away_team} | ${tierLabel} | Stake ${stakeBase}% | R$ ${stakeAmount}`
      );
    }

    // Notificar via Telegram
    if (totalRecalculadas > 0) {
      try {
        const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
        const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

        if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
          const linhas = signals.slice(0, 10).map((s: any, i: number) => {
            const a = s.punter_analyses;
            if (!a) return "";
            const emoji = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"][i] || "▪️";
            const originalStake = s.stake_percentage_original || a.stake_percentage || 3;
            let tier = 3;
            if (originalStake >= 4) tier = 1;
            else if (originalStake >= 3) tier = 2;
            const stakeBase = TIER_STAKE[tier] || 2.25;
            const tierLabel = tier === 1 ? '⚡ SINAL FORTE' : tier === 2 ? '✅ SINAL BOM' : '🎯 SINAL MODERADO';
            return `${emoji} ${a.home_team} vs ${a.away_team}\n📊 ${a.market} @ ${s.odd}\n💰 Stake: ${stakeBase}% (${tierLabel})\n📈 Edge: ${s.value_percentage?.toFixed(1) || "?"}%`;
          }).filter(Boolean).join("\n━━━━━━━━━━━━━━━━━\n");

          const mensagem = `🎯 MYCROFT — STAKES DO DIA\n\n📅 ${hoje}\n⚡ ${totalRecalculadas} apostas com stake recalculado\n\n${linhas}\n\n⚠️ Abra o app para CONFIRMAR ou DISPENSAR`;

          await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text: mensagem,
              parse_mode: "HTML",
            }),
          });
          console.log("[Recálculo] 📱 Telegram notificado");
        }
      } catch (tgErr) {
        console.error("[Recálculo] Erro no Telegram:", tgErr);
      }
    }

    return new Response(
      JSON.stringify({
        recalculadas: totalRecalculadas,
        data: hoje,
        mensagem: `${totalRecalculadas} sinais com stake recalculado para hoje`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Recálculo] ERRO:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
