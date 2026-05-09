import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PatternResult {
  league: string;
  market: string;
  wins: number;
  losses: number;
  sample_size: number;
  win_rate: number;
  roi: number;
  avg_odd: number;
  confidence: number;
  is_profitable: boolean;
  pattern_type: string;
}

/**
 * Pattern Mining Engine
 * 
 * Analyzes bets_history to find profitable patterns by league + market.
 * Calculates ROI, win rate, confidence and updates arena_patterns table.
 * 
 * Confidence formula:
 *   base = win_rate
 *   + sample bonus (up to +15 for 500+ bets)
 *   + ROI bonus (up to +10 for 15%+ ROI)
 *   capped at 100
 */
function calculateConfidence(winRate: number, sampleSize: number, roi: number): number {
  let confidence = winRate;

  // Sample size bonus
  if (sampleSize >= 500) confidence += 15;
  else if (sampleSize >= 300) confidence += 10;
  else if (sampleSize >= 100) confidence += 5;

  // ROI bonus
  if (roi >= 15) confidence += 10;
  else if (roi >= 8) confidence += 7;
  else if (roi >= 3) confidence += 3;

  // Penalty for negative ROI
  if (roi < 0) confidence -= 10;

  return Math.min(100, Math.max(0, Math.round(confidence)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const minSample = body.min_sample || 30;
    const userId = body.user_id; // optional: filter by user

    // Fetch resulted bets from bets_history
    let query = supabase
      .from("bets_history")
      .select("league, market, odd, result, stake, profit_loss")
      .not("result", "is", null)
      .not("league", "is", null);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: bets, error } = await query.limit(10000);

    if (error) throw error;
    if (!bets || bets.length === 0) {
      return new Response(
        JSON.stringify({ patterns: [], message: "No resulted bets found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group by league + market
    const groups: Record<string, {
      wins: number; losses: number; totalStake: number;
      totalProfit: number; odds: number[];
    }> = {};

    for (const bet of bets) {
      const key = `${bet.league}|||${bet.market}`;
      if (!groups[key]) {
        groups[key] = { wins: 0, losses: 0, totalStake: 0, totalProfit: 0, odds: [] };
      }
      const g = groups[key];
      if (bet.result === "green" || bet.result === "win") g.wins++;
      else g.losses++;
      g.totalStake += bet.stake || 0;
      g.totalProfit += bet.profit_loss || 0;
      g.odds.push(bet.odd || 0);
    }

    // Calculate patterns
    const patterns: PatternResult[] = [];

    for (const [key, g] of Object.entries(groups)) {
      const [league, market] = key.split("|||");
      const sampleSize = g.wins + g.losses;
      if (sampleSize < minSample) continue;

      const winRate = (g.wins / sampleSize) * 100;
      const roi = g.totalStake > 0 ? (g.totalProfit / g.totalStake) * 100 : 0;
      const avgOdd = g.odds.length > 0 ? g.odds.reduce((a, b) => a + b, 0) / g.odds.length : 0;
      const confidence = calculateConfidence(winRate, sampleSize, roi);
      const isProfitable = roi > 0;

      patterns.push({
        league,
        market,
        wins: g.wins,
        losses: g.losses,
        sample_size: sampleSize,
        win_rate: Math.round(winRate * 100) / 100,
        roi: Math.round(roi * 100) / 100,
        avg_odd: Math.round(avgOdd * 100) / 100,
        confidence,
        is_profitable: isProfitable,
        pattern_type: "league_market",
      });
    }

    // Upsert patterns into arena_patterns
    for (const p of patterns) {
      const { error: upsertError } = await supabase
        .from("arena_patterns")
        .upsert(
          {
            league: p.league,
            market: p.market,
            wins: p.wins,
            losses: p.losses,
            sample_size: p.sample_size,
            win_rate: p.win_rate,
            roi: p.roi,
            avg_odd: p.avg_odd,
            confidence: p.confidence,
            is_profitable: p.is_profitable,
            pattern_type: p.pattern_type,
            last_calculated_at: new Date().toISOString(),
          },
          { onConflict: "league,market" }
        );

      if (upsertError) {
        console.error("Upsert error for", p.league, p.market, upsertError);
      }
    }

    // Sort by ROI desc
    patterns.sort((a, b) => b.roi - a.roi);

    return new Response(
      JSON.stringify({
        patterns,
        total_patterns: patterns.length,
        total_bets_analyzed: bets.length,
        profitable_patterns: patterns.filter(p => p.is_profitable).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in pattern-mining-engine:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
