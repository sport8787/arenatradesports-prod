import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MonteCarloInput {
  user_id?: string;
  win_rate: number;         // 0-100
  avg_odd: number;          // decimal odd
  avg_stake_pct: number;    // % of bankroll per bet (e.g. 2.5)
  initial_bankroll: number; // starting capital
  num_bets: number;         // bets to simulate (e.g. 500)
  num_simulations?: number; // default 10000
  ruin_threshold_pct?: number; // % of bankroll = ruin (default 10 = 10% of initial)
  max_stake_amount?: number; // absolute max stake cap (e.g. 50000) - realistic bookmaker limits
}

interface MonteCarloOutput {
  ruin_probability: number;       // % chance of hitting ruin
  expected_roi: number;           // median ROI
  avg_final_bankroll: number;
  median_final_bankroll: number;
  percentiles: {
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  avg_max_drawdown: number;       // average max drawdown across sims
  worst_drawdown: number;         // worst seen across all sims
  profit_probability: number;     // % of sims ending in profit
  growth_curves: number[][];      // 5 sample curves for visualization (downsampled)
}

function runSimulation(
  winRate: number,
  avgOdd: number,
  avgStakePct: number,
  initialBankroll: number,
  numBets: number,
  ruinThreshold: number,
  maxStakeAmount: number
): { finalBankroll: number; maxDrawdown: number; hitRuin: boolean; curve: number[] } {
  let bankroll = initialBankroll;
  let peak = bankroll;
  let maxDrawdown = 0;
  let hitRuin = false;
  const curve: number[] = [bankroll];

  const p = winRate / 100;

  for (let i = 0; i < numBets; i++) {
    if (bankroll <= ruinThreshold) {
      hitRuin = true;
      // Fill remaining with ruin value
      for (let j = i; j < numBets; j++) curve.push(bankroll);
      break;
    }

    const rawStake = bankroll * (avgStakePct / 100);
    const stake = Math.min(rawStake, maxStakeAmount); // Cap at bookmaker limit
    const isWin = Math.random() < p;

    if (isWin) {
      bankroll += stake * (avgOdd - 1);
    } else {
      bankroll -= stake;
    }

    bankroll = Math.max(0, bankroll);
    curve.push(bankroll);

    if (bankroll > peak) peak = bankroll;
    const dd = peak > 0 ? ((peak - bankroll) / peak) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return { finalBankroll: bankroll, maxDrawdown, hitRuin, curve };
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function downsampleCurve(curve: number[], targetPoints: number): number[] {
  if (curve.length <= targetPoints) return curve;
  const step = (curve.length - 1) / (targetPoints - 1);
  const result: number[] = [];
  for (let i = 0; i < targetPoints; i++) {
    result.push(Math.round(curve[Math.round(i * step)] * 100) / 100);
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: MonteCarloInput = await req.json();
    const {
      win_rate,
      avg_odd,
      avg_stake_pct,
      initial_bankroll,
      num_bets,
      num_simulations = 10000,
      ruin_threshold_pct = 10,
      max_stake_amount = 50000, // Default 50k cap - realistic bookmaker limit
    } = input;

    const ruinThreshold = initial_bankroll * (ruin_threshold_pct / 100);
    const finalBankrolls: number[] = [];
    const maxDrawdowns: number[] = [];
    let ruinCount = 0;
    let profitCount = 0;
    const sampleCurves: number[][] = [];

    // Pick 5 evenly spaced sims for visualization
    const sampleIndices = new Set([0, Math.floor(num_simulations * 0.25), Math.floor(num_simulations * 0.5), Math.floor(num_simulations * 0.75), num_simulations - 1]);

    for (let i = 0; i < num_simulations; i++) {
      const result = runSimulation(win_rate, avg_odd, avg_stake_pct, initial_bankroll, num_bets, ruinThreshold, max_stake_amount);
      
      finalBankrolls.push(result.finalBankroll);
      maxDrawdowns.push(result.maxDrawdown);
      if (result.hitRuin) ruinCount++;
      if (result.finalBankroll > initial_bankroll) profitCount++;

      if (sampleIndices.has(i)) {
        sampleCurves.push(downsampleCurve(result.curve, 50));
      }
    }

    const avgFinal = finalBankrolls.reduce((a, b) => a + b, 0) / finalBankrolls.length;
    const medianFinal = percentile(finalBankrolls, 50);
    const avgDD = maxDrawdowns.reduce((a, b) => a + b, 0) / maxDrawdowns.length;
    const worstDD = Math.max(...maxDrawdowns);
    const medianROI = ((medianFinal - initial_bankroll) / initial_bankroll) * 100;

    const output: MonteCarloOutput = {
      ruin_probability: Math.round((ruinCount / num_simulations) * 100 * 100) / 100,
      expected_roi: Math.round(medianROI * 100) / 100,
      avg_final_bankroll: Math.round(avgFinal * 100) / 100,
      median_final_bankroll: Math.round(medianFinal * 100) / 100,
      percentiles: {
        p5: Math.round(percentile(finalBankrolls, 5) * 100) / 100,
        p10: Math.round(percentile(finalBankrolls, 10) * 100) / 100,
        p25: Math.round(percentile(finalBankrolls, 25) * 100) / 100,
        p50: Math.round(medianFinal * 100) / 100,
        p75: Math.round(percentile(finalBankrolls, 75) * 100) / 100,
        p90: Math.round(percentile(finalBankrolls, 90) * 100) / 100,
        p95: Math.round(percentile(finalBankrolls, 95) * 100) / 100,
      },
      avg_max_drawdown: Math.round(avgDD * 100) / 100,
      worst_drawdown: Math.round(worstDD * 100) / 100,
      profit_probability: Math.round((profitCount / num_simulations) * 100 * 100) / 100,
      growth_curves: sampleCurves,
    };

    return new Response(JSON.stringify(output), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in monte-carlo-simulation:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
