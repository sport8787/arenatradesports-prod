import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Poisson / Dixon-Coles Model Engine
 * 
 * Calculates match outcome probabilities using:
 * 1. Independent Poisson model for each team's goals
 * 2. Dixon-Coles correction for low-scoring outcomes (0-0, 1-0, 0-1, 1-1)
 * 3. Optional xG-based adjustment when available
 */

// Factorial with memoization
const factCache: Record<number, number> = { 0: 1, 1: 1 };
function factorial(n: number): number {
  if (n < 0) return 1;
  if (factCache[n]) return factCache[n];
  factCache[n] = n * factorial(n - 1);
  return factCache[n];
}

// Poisson PMF: P(X = k) = (λ^k * e^-λ) / k!
function poissonPmf(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// Dixon-Coles correction factor τ
function dixonColesCorrection(
  x: number, y: number,
  lambdaHome: number, lambdaAway: number,
  rho: number
): number {
  if (x === 0 && y === 0) return 1 - lambdaHome * lambdaAway * rho;
  if (x === 0 && y === 1) return 1 + lambdaHome * rho;
  if (x === 1 && y === 0) return 1 + lambdaAway * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

interface PoissonInput {
  home_team: string;
  away_team: string;
  league?: string;
  // Expected goals (can come from xG, historical avg, or API)
  home_xg?: number;
  away_xg?: number;
  // Futodds CS projected goals (best source for pre-live)
  futodds_lambda_home?: number;
  futodds_lambda_away?: number;
  // Historical averages if no xG
  home_goals_avg?: number;
  away_goals_avg?: number;
  home_goals_conceded_avg?: number;
  away_goals_conceded_avg?: number;
  league_avg_goals?: number;
  // Dixon-Coles rho parameter (-0.2 to 0.1 typical)
  rho?: number;
  // Max goals to compute matrix
  max_goals?: number;
}

interface ScoreProb {
  home: number;
  away: number;
  probability: number;
}

interface MarketProb {
  market: string;
  probability: number;
  fair_odd: number;
}

interface PoissonResult {
  home_lambda: number;
  away_lambda: number;
  rho: number;
  home_win: number;
  draw: number;
  away_win: number;
  over_1_5: number;
  over_2_5: number;
  over_3_5: number;
  under_1_5: number;
  under_2_5: number;
  under_3_5: number;
  btts_yes: number;
  btts_no: number;
  most_likely_scores: ScoreProb[];
  markets: MarketProb[];
  score_matrix: number[][];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const input: PoissonInput = await req.json();
    const maxGoals = input.max_goals || 6;
    const rho = input.rho ?? -0.03; // Typical DC correction

    // Calculate expected goals (lambda)
    let lambdaHome: number;
    let lambdaAway: number;

    if (input.futodds_lambda_home && input.futodds_lambda_away) {
      // Futodds CS projections — preferred for pre-live (Computer Simulation model)
      lambdaHome = input.futodds_lambda_home;
      lambdaAway = input.futodds_lambda_away;
    } else if (input.home_xg && input.away_xg) {
      // Use xG directly (second best)
      lambdaHome = input.home_xg;
      lambdaAway = input.away_xg;
    } else if (input.home_goals_avg && input.away_goals_avg) {
      // Attack/defense strength model
      const leagueAvg = input.league_avg_goals || 2.7; // ~1.35 per team
      const avgPerTeam = leagueAvg / 2;

      const homeAttack = (input.home_goals_avg || avgPerTeam) / avgPerTeam;
      const homeDef = (input.home_goals_conceded_avg || avgPerTeam) / avgPerTeam;
      const awayAttack = (input.away_goals_avg || avgPerTeam) / avgPerTeam;
      const awayDef = (input.away_goals_conceded_avg || avgPerTeam) / avgPerTeam;

      // Home advantage factor
      const homeAdv = 1.15;
      lambdaHome = homeAttack * awayDef * avgPerTeam * homeAdv;
      lambdaAway = awayAttack * homeDef * avgPerTeam;
    } else {
      // Fallback: league average
      lambdaHome = 1.5;
      lambdaAway = 1.2;
    }

    // Ensure reasonable bounds
    lambdaHome = Math.max(0.3, Math.min(4.5, lambdaHome));
    lambdaAway = Math.max(0.2, Math.min(4.0, lambdaAway));

    // Build score probability matrix with Dixon-Coles correction
    const scoreMatrix: number[][] = [];
    for (let i = 0; i <= maxGoals; i++) {
      scoreMatrix[i] = [];
      for (let j = 0; j <= maxGoals; j++) {
        const poisson = poissonPmf(lambdaHome, i) * poissonPmf(lambdaAway, j);
        const tau = dixonColesCorrection(i, j, lambdaHome, lambdaAway, rho);
        scoreMatrix[i][j] = poisson * tau;
      }
    }

    // Normalize matrix
    let totalProb = 0;
    for (let i = 0; i <= maxGoals; i++)
      for (let j = 0; j <= maxGoals; j++)
        totalProb += scoreMatrix[i][j];

    for (let i = 0; i <= maxGoals; i++)
      for (let j = 0; j <= maxGoals; j++)
        scoreMatrix[i][j] /= totalProb;

    // Calculate market probabilities
    let homeWin = 0, draw = 0, awayWin = 0;
    let over15 = 0, over25 = 0, over35 = 0;
    let bttsYes = 0;

    const allScores: ScoreProb[] = [];

    for (let i = 0; i <= maxGoals; i++) {
      for (let j = 0; j <= maxGoals; j++) {
        const p = scoreMatrix[i][j];
        allScores.push({ home: i, away: j, probability: p });

        if (i > j) homeWin += p;
        else if (i === j) draw += p;
        else awayWin += p;

        const totalGoals = i + j;
        if (totalGoals > 1.5) over15 += p;
        if (totalGoals > 2.5) over25 += p;
        if (totalGoals > 3.5) over35 += p;

        if (i > 0 && j > 0) bttsYes += p;
      }
    }

    // Sort most likely scores
    allScores.sort((a, b) => b.probability - a.probability);
    const mostLikely = allScores.slice(0, 10).map(s => ({
      ...s,
      probability: Math.round(s.probability * 10000) / 100,
    }));

    // Build markets array
    const toFairOdd = (p: number) => p > 0.01 ? Math.round((1 / p) * 100) / 100 : 99.99;
    const toPct = (p: number) => Math.round(p * 10000) / 100;

    const markets: MarketProb[] = [
      { market: "1X2 Home", probability: toPct(homeWin), fair_odd: toFairOdd(homeWin) },
      { market: "1X2 Draw", probability: toPct(draw), fair_odd: toFairOdd(draw) },
      { market: "1X2 Away", probability: toPct(awayWin), fair_odd: toFairOdd(awayWin) },
      { market: "Over 1.5", probability: toPct(over15), fair_odd: toFairOdd(over15) },
      { market: "Over 2.5", probability: toPct(over25), fair_odd: toFairOdd(over25) },
      { market: "Over 3.5", probability: toPct(over35), fair_odd: toFairOdd(over35) },
      { market: "Under 1.5", probability: toPct(1 - over15), fair_odd: toFairOdd(1 - over15) },
      { market: "Under 2.5", probability: toPct(1 - over25), fair_odd: toFairOdd(1 - over25) },
      { market: "Under 3.5", probability: toPct(1 - over35), fair_odd: toFairOdd(1 - over35) },
      { market: "BTTS Yes", probability: toPct(bttsYes), fair_odd: toFairOdd(bttsYes) },
      { market: "BTTS No", probability: toPct(1 - bttsYes), fair_odd: toFairOdd(1 - bttsYes) },
    ];

    const result: PoissonResult = {
      home_lambda: Math.round(lambdaHome * 100) / 100,
      away_lambda: Math.round(lambdaAway * 100) / 100,
      rho,
      home_win: toPct(homeWin),
      draw: toPct(draw),
      away_win: toPct(awayWin),
      over_1_5: toPct(over15),
      over_2_5: toPct(over25),
      over_3_5: toPct(over35),
      under_1_5: toPct(1 - over15),
      under_2_5: toPct(1 - over25),
      under_3_5: toPct(1 - over35),
      btts_yes: toPct(bttsYes),
      btts_no: toPct(1 - bttsYes),
      most_likely_scores: mostLikely,
      markets,
      score_matrix: scoreMatrix.map(row => row.map(v => Math.round(v * 10000) / 100)),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Poisson engine error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
