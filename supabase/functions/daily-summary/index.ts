import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Support both cron (all users) and manual trigger (single user)
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const targetUserId = body.user_id;

    let userIds: string[] = [];

    if (targetUserId) {
      userIds = [targetUserId];
    } else {
      // Get all users with bankroll activity
      const { data: bankrolls } = await supabase
        .from("user_bankroll")
        .select("user_id");
      userIds = (bankrolls || []).map((b: any) => b.user_id);
    }

    const today = new Date().toISOString().split("T")[0];
    const todayStart = `${today}T00:00:00.000Z`;
    const todayEnd = `${today}T23:59:59.999Z`;
    const results: any[] = [];

    for (const userId of userIds) {
      // Fetch today's bets from both tables
      const [horusRes, manualRes] = await Promise.all([
        supabase
          .from("virtual_bets_punter")
          .select("*")
          .eq("user_id", userId)
          .gte("created_at", todayStart)
          .lte("created_at", todayEnd),
        supabase
          .from("virtual_bets_manual")
          .select("*")
          .eq("user_id", userId)
          .gte("created_at", todayStart)
          .lte("created_at", todayEnd),
      ]);

      const horusBets = horusRes.data || [];
      const manualBets = manualRes.data || [];
      const allBets = [...horusBets, ...manualBets];

      if (allBets.length === 0) continue;

      const calcStats = (bets: any[]) => {
        const settled = bets.filter((b) => b.status === "green" || b.status === "red" || b.result === "green" || b.result === "red");
        const wins = settled.filter((b) => b.status === "green" || b.result === "green").length;
        const losses = settled.filter((b) => b.status === "red" || b.result === "red").length;
        const profit = bets.reduce((sum, b) => sum + (Number(b.profit_loss) || 0), 0);
        return { total: bets.length, wins, losses, profit: Math.round(profit * 100) / 100 };
      };

      const horusStats = calcStats(horusBets);
      const manualStats = calcStats(manualBets);

      // Best bet (highest profit)
      const settledAll = allBets.filter((b) => (b.status === "green" || b.result === "green") && Number(b.profit_loss) > 0);
      const bestBet = settledAll.sort((a, b) => (Number(b.profit_loss) || 0) - (Number(a.profit_loss) || 0))[0];

      // Best market
      const marketStats: Record<string, { wins: number; total: number; profit: number }> = {};
      for (const bet of allBets) {
        const m = bet.market || "unknown";
        if (!marketStats[m]) marketStats[m] = { wins: 0, total: 0, profit: 0 };
        marketStats[m].total++;
        if (bet.status === "green" || bet.result === "green") marketStats[m].wins++;
        marketStats[m].profit += Number(bet.profit_loss) || 0;
      }
      const bestMarketEntry = Object.entries(marketStats).sort((a, b) => b[1].profit - a[1].profit)[0];

      const summary = {
        user_id: userId,
        date: today,
        horus: horusStats,
        manual: manualStats,
        total_bets: allBets.length,
        total_profit: Math.round((horusStats.profit + manualStats.profit) * 100) / 100,
        best_bet: bestBet ? { match: bestBet.match_name, profit: Number(bestBet.profit_loss) } : null,
        best_market: bestMarketEntry ? { name: bestMarketEntry[0], profit: Math.round(bestMarketEntry[1].profit * 100) / 100 } : null,
      };

      // Upsert (unique on user_id + date)
      const { error } = await supabase
        .from("daily_summaries")
        .upsert(summary, { onConflict: "user_id,date" });

      if (!error) results.push({ userId, status: "ok" });
      else results.push({ userId, status: "error", error: error instanceof Error ? error.message : String(error) });
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
