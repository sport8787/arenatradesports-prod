import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// TYPES
// ============================================================================

interface EligibleBet {
  id: string;
  match_id: string;
  home_team: string;
  away_team: string;
  league: string;
  market: string;
  odd: number;
  asset_score: number;
  edge: number;
  probability: number;
  commence_time: string;
  bookmaker: string;
}

interface ScoredParlay {
  id: string;
  bets: EligibleBet[];
  score: number;
  totalOdd: number;
  avgEdge: number;
  avgCorrelation: number;
  combinedProbability: number;
  expectedROI: number;
  kellyStake: number;
  breakdown: {
    edgeScore: number;
    independenceScore: number;
    probabilityScore: number;
    sharpeScore: number;
  };
}

// ============================================================================
// CORRELATION ENGINE
// ============================================================================

function calculatePairwiseCorrelation(a: EligibleBet, b: EligibleBet): number {
  let corr = 0;

  // Same league: +0.3
  if (a.league && b.league && a.league === b.league) corr += 0.3;

  // Same market type: +0.2
  if (a.market && b.market && a.market === b.market) corr += 0.2;

  // Same match: +0.7
  if (a.match_id === b.match_id) corr += 0.7;

  // Same day: +0.1
  if (a.commence_time && b.commence_time) {
    const dayA = a.commence_time.slice(0, 10);
    const dayB = b.commence_time.slice(0, 10);
    if (dayA === dayB) corr += 0.1;
  }

  return Math.min(corr, 1.0);
}

// ============================================================================
// COMBINATION GENERATOR (with early pruning)
// ============================================================================

function* generateCombinations(
  bets: EligibleBet[],
  size: number,
  maxCorrelation: number,
): Generator<EligibleBet[]> {
  const n = bets.length;
  if (size > n) return;

  const indices = Array.from({ length: size }, (_, i) => i);
  let count = 0;
  const MAX_COMBOS = 50000;

  while (true) {
    if (count++ > MAX_COMBOS) return;

    const combo = indices.map(i => bets[i]);

    // Early prune: check max pairwise correlation
    let maxPairCorr = 0;
    let valid = true;
    for (let i = 0; i < combo.length && valid; i++) {
      for (let j = i + 1; j < combo.length && valid; j++) {
        const c = calculatePairwiseCorrelation(combo[i], combo[j]);
        if (c > maxPairCorr) maxPairCorr = c;
        if (c > maxCorrelation + 0.2) valid = false; // Hard cutoff
      }
    }

    if (valid) yield combo;

    // Next combination
    let i = size - 1;
    while (i >= 0 && indices[i] === n - size + i) i--;
    if (i < 0) return;
    indices[i]++;
    for (let j = i + 1; j < size; j++) indices[j] = indices[j - 1] + 1;
  }
}

// ============================================================================
// SCORING SYSTEM
// ============================================================================

function scoreParlay(combo: EligibleBet[], maxCorrelation: number): ScoredParlay | null {
  const n = combo.length;

  // Calculate average correlation
  let totalCorr = 0;
  let pairCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      totalCorr += calculatePairwiseCorrelation(combo[i], combo[j]);
      pairCount++;
    }
  }
  const avgCorrelation = pairCount > 0 ? totalCorr / pairCount : 0;

  if (avgCorrelation > maxCorrelation) return null;

  // 1. EDGE SCORE (40%)
  const avgEdge = combo.reduce((s, b) => s + b.edge, 0) / n;
  const edgeScore = Math.min(avgEdge / 10, 1.0) * 0.4;

  // 2. INDEPENDENCE SCORE (30%)
  const independenceScore = (1 - avgCorrelation) * 0.3;

  // 3. COMBINED PROBABILITY (20%)
  const combinedProb = combo.reduce((p, b) => p * (b.probability / 100), 1) * 100;
  let probabilityScore: number;
  if (combinedProb < 5) {
    probabilityScore = (combinedProb / 100) * 2;
  } else {
    probabilityScore = Math.min(combinedProb / 30, 1.0);
  }
  probabilityScore *= 0.2;

  // 4. SHARPE RATIO (10%)
  const totalOdd = combo.reduce((p, b) => p * b.odd, 1);
  const expectedReturn = totalOdd - 1;
  const variance = combo.reduce((v, b) => v + (1 / (b.probability / 100) - 1), 0);
  const sharpe = variance > 0 ? expectedReturn / Math.sqrt(variance) : 0;
  const sharpeScore = Math.min(sharpe / 2, 1.0) * 0.1;

  const score = edgeScore + independenceScore + probabilityScore + sharpeScore;

  // Kelly for parlay
  const kellyFull = combinedProb > 0
    ? ((totalOdd * (combinedProb / 100) - 1) / (totalOdd - 1)) * 100
    : 0;
  const kellyStake = Math.max(0, Math.min(5, kellyFull * 0.25));

  const expectedROI = (totalOdd * (combinedProb / 100) - 1) * 100;

  return {
    id: combo.map(b => b.id).join('-'),
    bets: combo,
    score: Math.round(score * 100) / 100,
    totalOdd: Math.round(totalOdd * 100) / 100,
    avgEdge: Math.round(avgEdge * 100) / 100,
    avgCorrelation: Math.round(avgCorrelation * 100) / 100,
    combinedProbability: Math.round(combinedProb * 100) / 100,
    expectedROI: Math.round(expectedROI * 100) / 100,
    kellyStake: Math.round(kellyStake * 100) / 100,
    breakdown: {
      edgeScore: Math.round(edgeScore * 100) / 100,
      independenceScore: Math.round(independenceScore * 100) / 100,
      probabilityScore: Math.round(probabilityScore * 100) / 100,
      sharpeScore: Math.round(sharpeScore * 100) / 100,
    },
  };
}

// ============================================================================
// DIVERSIFICATION
// ============================================================================

function diversifyResults(candidates: ScoredParlay[], k: number): ScoredParlay[] {
  const selected: ScoredParlay[] = [];
  const usedSizes = new Set<number>();

  // First pass: pick best from each size
  for (const c of candidates) {
    if (!usedSizes.has(c.bets.length)) {
      selected.push(c);
      usedSizes.add(c.bets.length);
      if (selected.length >= k) break;
    }
  }

  // Fill remaining with best scores
  if (selected.length < k) {
    for (const c of candidates) {
      if (!selected.includes(c)) {
        selected.push(c);
        if (selected.length >= k) break;
      }
    }
  }

  return selected;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      num_selections = 4,
      min_asset_score = 70,
      max_correlation = 0.3,
      top_k = 5,
    } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Load today's approved analyses
    const now = new Date().toISOString();
    const { data: analyses } = await supabase
      .from("punter_analyses")
      .select("*")
      .eq("verdict", "APROVADO")
      .gt("commence_time", now)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!analyses || analyses.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        eligible_count: 0,
        total_available: 0,
        parlays: [],
        message: "Nenhuma aposta aprovada disponível. Execute o Scanner primeiro.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Map to eligible bets
    const eligible: EligibleBet[] = analyses
      .filter((a: any) => {
        const impliedProb = a.implied_probability || (1 / a.odd) * 100;
        const estimatedProb = a.estimated_probability || impliedProb + (a.value_percentage || 0);
        const edge = a.value_percentage || 0;
        const assetScore = a.confidence || 70;
        return assetScore >= min_asset_score && edge >= 3 && a.odd >= 1.3;
      })
      .map((a: any) => {
        const impliedProb = a.implied_probability || (1 / a.odd) * 100;
        const estimatedProb = a.estimated_probability || impliedProb + (a.value_percentage || 0);
        return {
          id: a.id,
          match_id: a.match_id,
          home_team: a.home_team,
          away_team: a.away_team,
          league: a.league,
          market: a.market,
          odd: a.odd,
          asset_score: a.confidence || 70,
          edge: a.value_percentage || 0,
          probability: Math.min(99, Math.max(1, estimatedProb)),
          commence_time: a.commence_time,
          bookmaker: a.bookmaker,
        };
      });

    if (eligible.length < 3) {
      return new Response(JSON.stringify({
        success: true,
        eligible_count: eligible.length,
        total_available: analyses.length,
        parlays: [],
        message: `Apenas ${eligible.length} apostas elegíveis. Mínimo 3 necessário.`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Generate and score combinations
    const allScored: ScoredParlay[] = [];
    const minSize = Math.max(3, num_selections);
    const maxSize = Math.min(8, Math.min(num_selections, eligible.length));

    for (let size = minSize; size <= maxSize; size++) {
      for (const combo of generateCombinations(eligible, size, max_correlation)) {
        const scored = scoreParlay(combo, max_correlation);
        if (scored) allScored.push(scored);
      }
    }

    // 4. Sort by score and diversify
    allScored.sort((a, b) => b.score - a.score);
    const topParlays = diversifyResults(allScored, top_k);

    return new Response(JSON.stringify({
      success: true,
      eligible_count: eligible.length,
      total_available: analyses.length,
      total_combinations_scored: allScored.length,
      parlays: topParlays,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Multi-Bet Optimizer error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
