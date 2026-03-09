import { supabase } from "@/integrations/supabase/client";

export interface MonteCarloInput {
  winRate: number;          // 0-100
  avgOdd: number;
  avgStakePct: number;      // e.g. 2.5
  initialBankroll: number;
  numBets: number;          // e.g. 500
  numSimulations?: number;  // default 10000
  ruinThresholdPct?: number; // default 10
  maxStakeAmount?: number;  // default 50000 - bookmaker limit cap
}

export interface MonteCarloResult {
  ruin_probability: number;
  expected_roi: number;
  avg_final_bankroll: number;
  median_final_bankroll: number;
  percentiles: {
    p5: number; p10: number; p25: number;
    p50: number; p75: number; p90: number; p95: number;
  };
  avg_max_drawdown: number;
  worst_drawdown: number;
  profit_probability: number;
  growth_curves: number[][];
}

export async function runMonteCarloSimulation(input: MonteCarloInput): Promise<MonteCarloResult> {
  const { data, error } = await supabase.functions.invoke("monte-carlo-simulation", {
    body: {
      win_rate: input.winRate,
      avg_odd: input.avgOdd,
      avg_stake_pct: input.avgStakePct,
      initial_bankroll: input.initialBankroll,
      num_bets: input.numBets,
      num_simulations: input.numSimulations || 10000,
      ruin_threshold_pct: input.ruinThresholdPct || 10,
      max_stake_amount: input.maxStakeAmount || 50000,
    },
  });

  if (error) throw error;
  return data as MonteCarloResult;
}

export function getRuinColor(ruinPct: number): string {
  if (ruinPct < 5) return "text-green-400";
  if (ruinPct < 15) return "text-yellow-400";
  if (ruinPct < 30) return "text-orange-400";
  return "text-red-400";
}

export function getProfitColor(profitPct: number): string {
  if (profitPct >= 80) return "text-green-400";
  if (profitPct >= 60) return "text-yellow-400";
  return "text-red-400";
}
