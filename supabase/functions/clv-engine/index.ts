import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, match_id, bet_id } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Mode 1: Calculate CLV for a specific bet
    if (bet_id) {
      const { data: bet } = await supabase
        .from("bets_history")
        .select("*")
        .eq("id", bet_id)
        .single();

      if (!bet) throw new Error("Bet not found");

      const clvResult = calculateCLV(bet.odd, bet.odd_close);
      
      // Update the bet with CLV
      await supabase
        .from("bets_history")
        .update({ clv: clvResult.clv_percentage })
        .eq("id", bet_id);

      return new Response(JSON.stringify({ success: true, clv: clvResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode 2: Batch CLV calculation for user
    if (user_id) {
      const { data: bets } = await supabase
        .from("bets_history")
        .select("id, odd, odd_close, market, league, result")
        .eq("user_id", user_id)
        .not("odd_close", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);

      if (!bets || bets.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          summary: { total_bets: 0, avg_clv: 0, positive_clv_rate: 0 } 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results = bets.map(bet => ({
        id: bet.id,
        ...calculateCLV(bet.odd, bet.odd_close),
        market: bet.market,
        league: bet.league,
        result: bet.result,
      }));

      // Batch update CLV values
      for (const r of results) {
        await supabase
          .from("bets_history")
          .update({ clv: r.clv_percentage })
          .eq("id", r.id);
      }

      // Summary statistics
      const positiveCLV = results.filter(r => r.clv_percentage > 0);
      const avgCLV = results.reduce((sum, r) => sum + r.clv_percentage, 0) / results.length;

      // CLV by market
      const byMarket: Record<string, { total: number; sum: number; positive: number }> = {};
      for (const r of results) {
        const key = r.market || "unknown";
        if (!byMarket[key]) byMarket[key] = { total: 0, sum: 0, positive: 0 };
        byMarket[key].total++;
        byMarket[key].sum += r.clv_percentage;
        if (r.clv_percentage > 0) byMarket[key].positive++;
      }

      const marketBreakdown = Object.entries(byMarket).map(([market, stats]) => ({
        market,
        avg_clv: stats.sum / stats.total,
        positive_rate: (stats.positive / stats.total) * 100,
        sample_size: stats.total,
      }));

      // CLV vs actual results correlation
      const resultedBets = results.filter(r => r.result === "green" || r.result === "red");
      const clvAccuracy = resultedBets.length > 0 ? {
        positive_clv_win_rate: resultedBets.filter(r => r.clv_percentage > 0 && r.result === "green").length /
          Math.max(1, resultedBets.filter(r => r.clv_percentage > 0).length) * 100,
        negative_clv_win_rate: resultedBets.filter(r => r.clv_percentage <= 0 && r.result === "green").length /
          Math.max(1, resultedBets.filter(r => r.clv_percentage <= 0).length) * 100,
      } : null;

      return new Response(JSON.stringify({
        success: true,
        summary: {
          total_bets: results.length,
          avg_clv: Math.round(avgCLV * 100) / 100,
          positive_clv_rate: Math.round((positiveCLV.length / results.length) * 10000) / 100,
          market_beat_rate: Math.round((positiveCLV.length / results.length) * 10000) / 100,
        },
        by_market: marketBreakdown,
        clv_accuracy: clvAccuracy,
        details: results.slice(0, 50),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode 3: Calculate CLV for a specific match (all bookmakers)
    if (match_id) {
      const { data: odds } = await supabase
        .from("arena_odds")
        .select("*")
        .eq("match_id", match_id)
        .not("odd_close", "is", null);

      if (!odds || odds.length === 0) {
        return new Response(JSON.stringify({ success: true, match_clv: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const matchCLV = odds.map(o => ({
        bookmaker: o.bookmaker,
        market: o.market,
        odd_open: o.odd_open,
        odd_close: o.odd_close,
        ...calculateCLV(o.odd_open!, o.odd_close!),
      }));

      return new Response(JSON.stringify({ success: true, match_clv: matchCLV }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Provide user_id, bet_id, or match_id");

  } catch (error) {
    console.error("CLV Engine error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function calculateCLV(oddEntry: number | null, oddClose: number | null) {
  if (!oddEntry || !oddClose || oddClose <= 1) {
    return { clv_percentage: 0, clv_signal: "neutral" as const, implied_prob_entry: 0, implied_prob_close: 0 };
  }

  const probEntry = 1 / oddEntry;
  const probClose = 1 / oddClose;
  
  // CLV = (prob_close - prob_entry) / prob_entry * 100
  // Positive CLV = got better odds than closing line (beating the market)
  const clvPct = ((probClose - probEntry) / probEntry) * 100;

  let signal: "strong_positive" | "positive" | "neutral" | "negative" | "strong_negative";
  if (clvPct > 5) signal = "strong_positive";
  else if (clvPct > 2) signal = "positive";
  else if (clvPct > -2) signal = "neutral";
  else if (clvPct > -5) signal = "negative";
  else signal = "strong_negative";

  return {
    clv_percentage: Math.round(clvPct * 100) / 100,
    clv_signal: signal,
    implied_prob_entry: Math.round(probEntry * 10000) / 100,
    implied_prob_close: Math.round(probClose * 10000) / 100,
    edge_at_entry: Math.round((probClose - probEntry) * 10000) / 100,
  };
}
