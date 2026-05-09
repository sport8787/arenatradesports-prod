import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Initial weights from learningEngineConfig
const INITIAL_WEIGHTS = {
  prob_model: 0.25,
  value_odds: 0.20,
  statistics: 0.15,
  pattern_engine: 0.15,
  market_inefficiency: 0.10,
  sharp_money: 0.10,
  odds_drift: 0.05,
};

const MAX_WEIGHT_CHANGE = 0.05;
const MIN_BETS_FOR_RECALIBRATION = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, mode = "analyze" } = await req.json();
    if (!user_id) throw new Error("Missing user_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load resulted bets
    const { data: bets } = await supabase
      .from("bets_history")
      .select("*")
      .eq("user_id", user_id)
      .not("result", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (!bets || bets.length < MIN_BETS_FOR_RECALIBRATION) {
      return new Response(JSON.stringify({
        success: true,
        status: "insufficient_data",
        message: `Precisa de ${MIN_BETS_FOR_RECALIBRATION} apostas resultadas (atual: ${bets?.length || 0})`,
        current_weights: INITIAL_WEIGHTS,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ANALYSIS: Performance by different dimensions ===

    // 1. Performance by Asset Score tier
    const tierPerformance = analyzeByTier(bets);

    // 2. Performance by market
    const marketPerformance = analyzeByDimension(bets, "market");

    // 3. Performance by league
    const leaguePerformance = analyzeByDimension(bets, "league");

    // 4. Performance by odd range
    const oddRangePerformance = analyzeByOddRange(bets);

    // 5. CLV correlation with results
    const clvAnalysis = analyzeCLVCorrelation(bets);

    // 6. Edge analysis
    const edgeAnalysis = analyzeEdgeAccuracy(bets);

    if (mode === "analyze") {
      return new Response(JSON.stringify({
        success: true,
        status: "analysis_complete",
        total_bets: bets.length,
        current_weights: INITIAL_WEIGHTS,
        analysis: {
          by_tier: tierPerformance,
          by_market: marketPerformance,
          by_league: leaguePerformance,
          by_odd_range: oddRangePerformance,
          clv_correlation: clvAnalysis,
          edge_accuracy: edgeAnalysis,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === RECALIBRATE: Adjust weights based on performance ===
    const newWeights = recalibrateWeights(bets, INITIAL_WEIGHTS);

    // Store recalibration results in model_performance
    await supabase.from("model_performance").insert({
      date: new Date().toISOString().split("T")[0],
      period: "recalibration",
      total_bets: bets.length,
      wins: bets.filter(b => b.result === "green").length,
      losses: bets.filter(b => b.result === "red").length,
      roi: calculateROI(bets),
      win_rate: (bets.filter(b => b.result === "green").length / bets.length) * 100,
      profit: bets.reduce((s, b) => s + (b.profit_loss || 0), 0),
      avg_edge: bets.reduce((s, b) => s + (b.edge || 0), 0) / bets.length,
      avg_odd: bets.reduce((s, b) => s + b.odd, 0) / bets.length,
      avg_asset_score: bets.reduce((s, b) => s + (b.asset_score || 0), 0) / bets.length,
    });

    return new Response(JSON.stringify({
      success: true,
      status: "recalibrated",
      total_bets: bets.length,
      previous_weights: INITIAL_WEIGHTS,
      new_weights: newWeights.weights,
      changes: newWeights.changes,
      analysis: {
        by_tier: tierPerformance,
        by_market: marketPerformance,
        clv_correlation: clvAnalysis,
        edge_accuracy: edgeAnalysis,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Self Learning Engine error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function calculateROI(bets: any[]): number {
  const totalStaked = bets.reduce((s, b) => s + b.stake, 0);
  const totalProfit = bets.reduce((s, b) => s + (b.profit_loss || 0), 0);
  return totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
}

function analyzeByTier(bets: any[]) {
  const tiers: Record<string, any[]> = { ELITE: [], PREMIUM: [], STRONG: [], SPECULATIVE: [], IGNORAR: [] };
  for (const b of bets) {
    const tier = b.asset_classification || "SPECULATIVE";
    if (tiers[tier]) tiers[tier].push(b);
  }

  return Object.entries(tiers)
    .filter(([_, arr]) => arr.length > 0)
    .map(([tier, arr]) => ({
      tier,
      total: arr.length,
      wins: arr.filter(b => b.result === "green").length,
      win_rate: (arr.filter(b => b.result === "green").length / arr.length) * 100,
      roi: calculateROI(arr),
      avg_odd: arr.reduce((s, b) => s + b.odd, 0) / arr.length,
      avg_score: arr.reduce((s, b) => s + (b.asset_score || 0), 0) / arr.length,
    }));
}

function analyzeByDimension(bets: any[], key: string) {
  const groups: Record<string, any[]> = {};
  for (const b of bets) {
    const val = (b as any)[key] || "unknown";
    if (!groups[val]) groups[val] = [];
    groups[val].push(b);
  }

  return Object.entries(groups)
    .filter(([_, arr]) => arr.length >= 10)
    .map(([name, arr]) => ({
      name,
      total: arr.length,
      win_rate: (arr.filter(b => b.result === "green").length / arr.length) * 100,
      roi: calculateROI(arr),
    }))
    .sort((a, b) => b.roi - a.roi);
}

function analyzeByOddRange(bets: any[]) {
  const ranges = [
    { label: "1.01-1.50", min: 1.01, max: 1.50 },
    { label: "1.51-2.00", min: 1.51, max: 2.00 },
    { label: "2.01-3.00", min: 2.01, max: 3.00 },
    { label: "3.01-5.00", min: 3.01, max: 5.00 },
    { label: "5.01+", min: 5.01, max: 100 },
  ];

  return ranges.map(r => {
    const subset = bets.filter(b => b.odd >= r.min && b.odd <= r.max);
    return {
      range: r.label,
      total: subset.length,
      win_rate: subset.length > 0 ? (subset.filter(b => b.result === "green").length / subset.length) * 100 : 0,
      roi: subset.length > 0 ? calculateROI(subset) : 0,
    };
  }).filter(r => r.total > 0);
}

function analyzeCLVCorrelation(bets: any[]) {
  const withCLV = bets.filter(b => b.clv != null);
  if (withCLV.length < 20) return { status: "insufficient_clv_data", sample: withCLV.length };

  const positiveCLV = withCLV.filter(b => b.clv > 0);
  const negativeCLV = withCLV.filter(b => b.clv <= 0);

  return {
    total_with_clv: withCLV.length,
    positive_clv: {
      count: positiveCLV.length,
      win_rate: positiveCLV.length > 0 ? (positiveCLV.filter(b => b.result === "green").length / positiveCLV.length) * 100 : 0,
      roi: positiveCLV.length > 0 ? calculateROI(positiveCLV) : 0,
    },
    negative_clv: {
      count: negativeCLV.length,
      win_rate: negativeCLV.length > 0 ? (negativeCLV.filter(b => b.result === "green").length / negativeCLV.length) * 100 : 0,
      roi: negativeCLV.length > 0 ? calculateROI(negativeCLV) : 0,
    },
    clv_predictive: positiveCLV.length > 0 && negativeCLV.length > 0
      ? calculateROI(positiveCLV) > calculateROI(negativeCLV)
      : null,
  };
}

function analyzeEdgeAccuracy(bets: any[]) {
  const withEdge = bets.filter(b => b.edge != null && b.edge > 0);
  if (withEdge.length < 20) return { status: "insufficient_edge_data", sample: withEdge.length };

  const highEdge = withEdge.filter(b => b.edge > 10);
  const lowEdge = withEdge.filter(b => b.edge <= 10 && b.edge > 0);

  return {
    total_with_edge: withEdge.length,
    high_edge: {
      count: highEdge.length,
      win_rate: highEdge.length > 0 ? (highEdge.filter(b => b.result === "green").length / highEdge.length) * 100 : 0,
      roi: highEdge.length > 0 ? calculateROI(highEdge) : 0,
    },
    low_edge: {
      count: lowEdge.length,
      win_rate: lowEdge.length > 0 ? (lowEdge.filter(b => b.result === "green").length / lowEdge.length) * 100 : 0,
      roi: lowEdge.length > 0 ? calculateROI(lowEdge) : 0,
    },
  };
}

function recalibrateWeights(bets: any[], currentWeights: Record<string, number>) {
  const newWeights = { ...currentWeights };
  const changes: Record<string, { old: number; new: number; reason: string }> = {};

  // Analyze which components correlate most with winning bets
  const winners = bets.filter(b => b.result === "green");
  const losers = bets.filter(b => b.result === "red");

  const avgScoreWin = winners.reduce((s, b) => s + (b.asset_score || 0), 0) / Math.max(1, winners.length);
  const avgScoreLose = losers.reduce((s, b) => s + (b.asset_score || 0), 0) / Math.max(1, losers.length);

  // If high-score bets are winning more, boost prob_model and value_odds
  if (avgScoreWin > avgScoreLose * 1.15) {
    adjustWeight(newWeights, changes, "prob_model", 0.02, "High-score bets winning 15%+ more");
    adjustWeight(newWeights, changes, "value_odds", 0.01, "Edge correlation with wins");
  }

  // CLV analysis: if positive CLV bets perform well, boost market_inefficiency
  const posCLV = bets.filter(b => b.clv != null && b.clv > 2);
  if (posCLV.length >= 20) {
    const clvROI = calculateROI(posCLV);
    if (clvROI > 5) {
      adjustWeight(newWeights, changes, "market_inefficiency", 0.02, `CLV+ bets ROI: ${clvROI.toFixed(1)}%`);
    }
  }

  // Pattern analysis: if patterned bets do well
  const withPattern = bets.filter(b => b.asset_classification === "ELITE" || b.asset_classification === "PREMIUM");
  if (withPattern.length >= 30) {
    const patternROI = calculateROI(withPattern);
    if (patternROI > 8) {
      adjustWeight(newWeights, changes, "pattern_engine", 0.02, `ELITE/PREMIUM ROI: ${patternROI.toFixed(1)}%`);
    } else if (patternROI < -3) {
      adjustWeight(newWeights, changes, "pattern_engine", -0.02, `ELITE/PREMIUM ROI negative: ${patternROI.toFixed(1)}%`);
    }
  }

  // Normalize weights to sum to 1
  const totalWeight = Object.values(newWeights).reduce((s, w) => s + w, 0);
  for (const key of Object.keys(newWeights)) {
    newWeights[key] = Math.round((newWeights[key] / totalWeight) * 1000) / 1000;
  }

  return { weights: newWeights, changes };
}

function adjustWeight(
  weights: Record<string, number>,
  changes: Record<string, any>,
  key: string,
  delta: number,
  reason: string
) {
  const clampedDelta = Math.max(-MAX_WEIGHT_CHANGE, Math.min(MAX_WEIGHT_CHANGE, delta));
  const oldVal = weights[key];
  weights[key] = Math.max(0.02, Math.min(0.40, oldVal + clampedDelta));
  if (weights[key] !== oldVal) {
    changes[key] = { old: oldVal, new: weights[key], reason };
  }
}
