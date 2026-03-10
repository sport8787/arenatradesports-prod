import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================================
// TYPES
// ============================================================================

interface OptimizationParams {
  num_selections: number;
  min_asset_score: number;
  max_correlation: number;
  top_k: number;
  min_odd: number;
  max_odd: number;
}

interface Bet {
  id: string;
  match_id: string;
  home_team: string;
  away_team: string;
  league: string;
  market: string;
  bookmaker: string;
  odd: number;
  value_percentage: number;
  expected_value: number;
  confidence: number;
  stake_percentage: number;
  asset_score: number;
  estimated_probability: number;
  commence_time: string;
  teams: string[];
}

interface ScoredParlay {
  id: string;
  bets: Bet[];
  score: number;
  totalOdd: number;
  avgEdge: number;
  avgCorrelation: number;
  combinedProbability: number;
  expectedROI: number;
  kellyStake: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  breakdown: {
    edgeScore: number;
    independenceScore: number;
    probabilityScore: number;
    sharpeScore: number;
  };
  warnings: string[];
}

// ============================================================================
// 1. PARAMETER VALIDATION
// ============================================================================

function validateParams(body: any): OptimizationParams {
  const params: OptimizationParams = {
    num_selections: body.num_selections ?? 4,
    min_asset_score: body.min_asset_score ?? 70,
    max_correlation: body.max_correlation ?? 0.3,
    top_k: body.top_k ?? 5,
    min_odd: body.min_odd ?? 1.3,
    max_odd: body.max_odd ?? 100,
  };

  if (params.num_selections < 3 || params.num_selections > 8)
    throw new Error("num_selections deve estar entre 3 e 8");
  if (params.min_asset_score < 50 || params.min_asset_score > 100)
    throw new Error("min_asset_score deve estar entre 50 e 100");
  if (params.max_correlation < 0 || params.max_correlation > 1)
    throw new Error("max_correlation deve estar entre 0 e 1");
  if (params.top_k < 1 || params.top_k > 20)
    throw new Error("top_k deve estar entre 1 e 20");
  if (params.min_odd < 1.01)
    throw new Error("min_odd deve ser >= 1.01");
  if (params.max_odd < params.min_odd)
    throw new Error("max_odd deve ser >= min_odd");

  return params;
}

// ============================================================================
// 2. FETCH ELIGIBLE BETS (real query)
// ============================================================================

async function fetchEligibleBets(
  supabase: any,
  params: OptimizationParams,
): Promise<Bet[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("punter_analyses")
    .select("*")
    .eq("verdict", "APROVADO")
    .gte("confidence", params.min_asset_score)
    .gte("odd", params.min_odd)
    .lte("odd", params.max_odd)
    .gt("commence_time", now)
    .order("value_percentage", { ascending: false })
    .limit(200);

  if (error) throw new Error(`Erro ao buscar análises: ${error.message}`);
  if (!data || data.length === 0) return [];

  return data
    .filter((a: any) => {
      const edge = a.value_percentage || 0;
      return edge >= 3;
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
        bookmaker: a.bookmaker,
        odd: a.odd,
        value_percentage: a.value_percentage || 0,
        expected_value: (a.value_percentage || 0) / 100,
        confidence: a.confidence || 70,
        stake_percentage: a.stake_percentage || 2,
        asset_score: a.confidence || 70,
        estimated_probability: Math.min(99, Math.max(1, estimatedProb)),
        commence_time: a.commence_time,
        teams: [a.home_team, a.away_team],
      };
    });
}

// ============================================================================
// 3. REFINED PAIRWISE CORRELATION
// ============================================================================

function calculatePairwiseCorrelation(a: Bet, b: Bet): number {
  // Same match
  if (a.match_id === b.match_id) {
    const aM = a.market.toLowerCase();
    const bM = b.market.toLowerCase();
    // Mutually exclusive markets → impossible
    if (
      (aM.includes("casa") && bM.includes("fora")) ||
      (aM.includes("fora") && bM.includes("casa")) ||
      (aM.includes("empate") && (bM.includes("casa") || bM.includes("fora")))
    ) {
      return -1;
    }
    return 0.85;
  }

  let corr = 0;

  // Shared teams across different matches
  const commonTeams = a.teams.filter((t) => b.teams.includes(t));
  if (commonTeams.length > 0) {
    corr += 0.7;
    const team = commonTeams[0];
    const sideA = a.home_team === team ? "home" : a.away_team === team ? "away" : null;
    const sideB = b.home_team === team ? "home" : b.away_team === team ? "away" : null;
    if (sideA && sideB && sideA !== sideB) corr += 0.1;
  }

  // Same league
  if (a.league === b.league) corr += 0.12;

  // Same market type
  if (a.market === b.market) corr += 0.08;

  // Same bookmaker (minor)
  if (a.bookmaker === b.bookmaker) corr += 0.03;

  return Math.min(corr, 1.0);
}

// ============================================================================
// 4. CORRELATION MATRIX (memoized)
// ============================================================================

function buildCorrelationMatrix(bets: Bet[]): number[][] {
  const n = bets.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const corr = calculatePairwiseCorrelation(bets[i], bets[j]);
      matrix[i][j] = corr;
      matrix[j][i] = corr;
    }
    matrix[i][i] = 1;
  }
  return matrix;
}

// ============================================================================
// 5. KELLY CRITERION (adjusted)
// ============================================================================

function calculateKellyStake(
  totalOdd: number,
  combinedProb: number,
  avgCorrelation: number,
  numSelections: number,
): number {
  const p = combinedProb / 100;
  const b = totalOdd - 1;
  const q = 1 - p;

  let kellyFull = (p * b - q) / b;
  if (kellyFull <= 0) return 0;

  let stake = kellyFull * 0.25;
  stake *= Math.pow(1 - avgCorrelation, 1.5);

  if (numSelections > 4) {
    stake *= Math.pow(0.9, numSelections - 4);
  }
  if (totalOdd > 10) {
    stake *= Math.sqrt(10 / totalOdd);
  }

  return Math.max(0.5, Math.min(5, stake * 100));
}

// ============================================================================
// 6. PARLAY SCORING
// ============================================================================

function scoreParlay(
  bets: Bet[],
  corrMatrix: number[][],
  betIndices: number[],
  maxCorrelation: number,
): ScoredParlay {
  const n = betIndices.length;
  const selectedBets = betIndices.map((i) => bets[i]);

  const totalOdd = selectedBets.reduce((acc, b) => acc * b.odd, 1);
  const avgEdge = selectedBets.reduce((acc, b) => acc + b.value_percentage, 0) / n;
  const combinedProb =
    selectedBets.reduce((acc, b) => acc * (b.estimated_probability / 100), 1) * 100;

  let sumCorr = 0;
  let pairCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      sumCorr += corrMatrix[betIndices[i]][betIndices[j]];
      pairCount++;
    }
  }
  const avgCorrelation = pairCount > 0 ? sumCorr / pairCount : 0;

  const expectedROI = totalOdd * (combinedProb / 100) - 1;

  // Edge score (0–0.4)
  const edgeScore = Math.min(avgEdge / 10, 1.0) * 0.4;

  // Independence score (0–0.3)
  const independenceScore = (1 - avgCorrelation) * 0.3;

  // Probability score (0–0.2)
  let probabilityScore = 0;
  if (combinedProb < 5) {
    probabilityScore = (combinedProb / 100) * 2 * 0.2;
  } else if (combinedProb > 50) {
    probabilityScore = Math.max(0, 1 - (combinedProb - 50) / 50) * 0.2;
  } else {
    probabilityScore = Math.min(combinedProb / 30, 1.0) * 0.2;
  }

  // Sharpe ratio (0–0.1)
  let sharpeScore = 0;
  if (combinedProb > 0) {
    const variance = selectedBets.reduce((acc, b) => {
      const p = b.estimated_probability / 100;
      return acc + b.odd * b.odd * p * (1 - p);
    }, 0);
    const stdDev = Math.sqrt(variance);
    const sharpe = expectedROI / (stdDev + 1e-6);
    sharpeScore = Math.min(Math.max(sharpe, 0) / 2, 1.0) * 0.1;
  }

  const totalScore = edgeScore + independenceScore + probabilityScore + sharpeScore;
  const kellyStake = calculateKellyStake(totalOdd, combinedProb, avgCorrelation, n);

  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  if (avgCorrelation < 0.25 && combinedProb >= 20) riskLevel = "LOW";
  else if (avgCorrelation < 0.4 && combinedProb >= 10) riskLevel = "MEDIUM";
  else if (avgCorrelation < 0.6 && combinedProb >= 5) riskLevel = "HIGH";
  else riskLevel = "EXTREME";

  const warnings: string[] = [];
  if (expectedROI < 0) warnings.push("⚠️ ROI esperado negativo");
  if (avgCorrelation > maxCorrelation) warnings.push("⚠️ Correlação média acima do limite");
  if (kellyStake < 0.5) warnings.push("ℹ️ Kelly stake muito baixo (menos de 0.5%)");
  if (combinedProb < 5) warnings.push("🔴 Probabilidade combinada muito baixa (<5%)");
  if (combinedProb > 50) warnings.push("🟡 Probabilidade combinada alta (odds baixas)");

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (corrMatrix[betIndices[i]][betIndices[j]] > 0.7) {
        warnings.push(
          `⚠️ Par ${i + 1}-${j + 1} com alta correlação (${corrMatrix[betIndices[i]][betIndices[j]].toFixed(2)})`,
        );
      }
    }
  }

  return {
    id: betIndices.join("-"),
    bets: selectedBets,
    score: Math.round(totalScore * 100) / 100,
    totalOdd: Math.round(totalOdd * 100) / 100,
    avgEdge: Math.round(avgEdge * 100) / 100,
    avgCorrelation: Math.round(avgCorrelation * 100) / 100,
    combinedProbability: Math.round(combinedProb * 100) / 100,
    expectedROI: Math.round(expectedROI * 10000) / 100,
    kellyStake: Math.round(kellyStake * 100) / 100,
    riskLevel,
    breakdown: {
      edgeScore: Math.round(edgeScore * 100) / 100,
      independenceScore: Math.round(independenceScore * 100) / 100,
      probabilityScore: Math.round(probabilityScore * 100) / 100,
      sharpeScore: Math.round(sharpeScore * 100) / 100,
    },
    warnings,
  };
}

// ============================================================================
// 7. BEAM SEARCH COMBINATION GENERATOR
// ============================================================================

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i;
  }
  return result;
}

function generateCombinationsBeam(
  bets: Bet[],
  corrMatrix: number[][],
  params: OptimizationParams,
): ScoredParlay[] {
  const n = bets.length;
  const k = params.num_selections;
  if (n < k) return [];

  // Sort by edge for beam search
  const sortedIndices = bets
    .map((_, idx) => idx)
    .sort((a, b) => bets[b].value_percentage - bets[a].value_percentage);

  const beamWidth = Math.min(50, n);
  const candidateIndices = sortedIndices.slice(0, beamWidth);

  const combinations: number[][] = [];
  const totalCombos = comb(beamWidth, k);
  const maxCombos = 100000;

  if (totalCombos > maxCombos) {
    console.log(`[MultiBet] Muitas combinações (${totalCombos}), amostrando ${maxCombos}`);
    const used = new Set<string>();
    while (combinations.length < maxCombos) {
      const shuffled = [...candidateIndices].sort(() => Math.random() - 0.5);
      const combo = shuffled.slice(0, k).sort((a, b) => a - b);
      const key = combo.join(",");
      if (!used.has(key)) {
        used.add(key);
        combinations.push(combo);
      }
    }
  } else {
    const generate = (start: number, chosen: number[]) => {
      if (chosen.length === k) {
        combinations.push([...chosen]);
        return;
      }
      for (let i = start; i < candidateIndices.length; i++) {
        chosen.push(candidateIndices[i]);
        generate(i + 1, chosen);
        chosen.pop();
      }
    };
    generate(0, []);
  }

  // Score and filter
  const scored: ScoredParlay[] = [];
  for (const combo of combinations) {
    // Reject impossible pairs (correlation = -1)
    let hasImpossible = false;
    for (let i = 0; i < k && !hasImpossible; i++) {
      for (let j = i + 1; j < k && !hasImpossible; j++) {
        if (corrMatrix[combo[i]][combo[j]] < 0) hasImpossible = true;
      }
    }
    if (hasImpossible) continue;

    const parlay = scoreParlay(bets, corrMatrix, combo, params.max_correlation);
    if (parlay.avgCorrelation <= params.max_correlation) {
      scored.push(parlay);
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// ============================================================================
// 8. DIVERSIFICATION
// ============================================================================

function diversifyResults(parlays: ScoredParlay[], topK: number): ScoredParlay[] {
  if (parlays.length === 0) return [];

  const selected: ScoredParlay[] = [];

  for (const p of parlays) {
    let tooSimilar = false;
    for (const sel of selected) {
      const common = sel.bets.filter((sb) => p.bets.some((pb) => pb.id === sb.id)).length;
      const maxLen = Math.max(sel.bets.length, p.bets.length);
      if (common / maxLen > 0.6) {
        tooSimilar = true;
        break;
      }
    }
    if (!tooSimilar) selected.push(p);
    if (selected.length >= topK) break;
  }

  // Fill remaining
  if (selected.length < topK) {
    for (const p of parlays) {
      if (!selected.includes(p)) selected.push(p);
      if (selected.length >= topK) break;
    }
  }

  return selected.slice(0, topK);
}

// ============================================================================
// 9. MAIN HANDLER
// ============================================================================

serve(async (req) => {
  const startTime = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const params = validateParams(body);

    console.log(`[MultiBet] Params: ${JSON.stringify(params)}`);

    const bets = await fetchEligibleBets(supabase, params);
    console.log(`[MultiBet] ${bets.length} apostas elegíveis encontradas`);

    if (bets.length < params.num_selections) {
      return new Response(
        JSON.stringify({
          success: true,
          eligible_count: bets.length,
          total_available: bets.length,
          total_combinations_scored: 0,
          parlays: [],
          execution_time_ms: Date.now() - startTime,
          message: bets.length === 0
            ? "Nenhuma aposta aprovada disponível. Execute o Scanner primeiro."
            : `Apenas ${bets.length} apostas elegíveis. Mínimo ${params.num_selections} necessário.`,
          metadata: {
            params_used: params,
            avg_correlation_threshold: params.max_correlation,
            timestamp: new Date().toISOString(),
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[MultiBet] Construindo matriz de correlação...");
    const corrMatrix = buildCorrelationMatrix(bets);

    console.log("[MultiBet] Gerando combinações (beam search)...");
    const scoredParlays = generateCombinationsBeam(bets, corrMatrix, params);
    console.log(`[MultiBet] ${scoredParlays.length} parlays gerados`);

    const topParlays = diversifyResults(scoredParlays, params.top_k);

    return new Response(
      JSON.stringify({
        success: true,
        eligible_count: bets.length,
        total_available: bets.length,
        total_combinations_scored: scoredParlays.length,
        parlays: topParlays,
        execution_time_ms: Date.now() - startTime,
        metadata: {
          params_used: params,
          avg_correlation_threshold: params.max_correlation,
          timestamp: new Date().toISOString(),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[MultiBet] Erro:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        execution_time_ms: Date.now() - startTime,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
