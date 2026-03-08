import { supabase } from "@/integrations/supabase/client";

export interface KellyResult {
  full_kelly: number;
  fractional_kelly: number;
  stake_percent: number;
  stake_amount: number;
  edge: number;
  ev: number;
  drawdown_adjusted: boolean;
  drawdown_reduction: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
}

/**
 * Calculates optimal stake using Bankroll AI Kelly Engine
 */
export async function calculateKellyStake(params: {
  userId: string;
  probability: number;    // 0-1
  odd: number;
  bankrollSource?: "horus" | "manual";
  assetScore?: number;
}): Promise<KellyResult> {
  const { data, error } = await supabase.functions.invoke("bankroll-ai-kelly", {
    body: {
      user_id: params.userId,
      probability: params.probability,
      odd: params.odd,
      bankroll_source: params.bankrollSource || "horus",
      asset_score: params.assetScore,
    },
  });

  if (error) throw error;
  return data as KellyResult;
}

/**
 * Quick local Kelly calculation (no bankroll lookup)
 */
export function quickKelly(probability: number, odd: number, bankroll: number): {
  stakePercent: number;
  stakeAmount: number;
  edge: number;
} {
  const p = probability;
  const b = odd - 1;
  const q = 1 - p;
  const fullKelly = b > 0 ? ((b * p - q) / b) * 100 : 0;

  if (fullKelly <= 0) {
    return { stakePercent: 0, stakeAmount: 0, edge: (p * odd - 1) * 100 };
  }

  const fractional = fullKelly * 0.25;
  const capped = Math.min(5, Math.max(1, fractional));
  
  return {
    stakePercent: Math.round(capped * 100) / 100,
    stakeAmount: Math.round(bankroll * (capped / 100) * 100) / 100,
    edge: Math.round((p * odd - 1) * 100 * 100) / 100,
  };
}

export function getRiskColor(level: KellyResult["risk_level"]): string {
  switch (level) {
    case "LOW": return "text-green-400";
    case "MEDIUM": return "text-yellow-400";
    case "HIGH": return "text-orange-400";
    case "EXTREME": return "text-red-400";
  }
}

export function getRiskBadgeColor(level: KellyResult["risk_level"]): string {
  switch (level) {
    case "LOW": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "MEDIUM": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "HIGH": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "EXTREME": return "bg-red-500/20 text-red-400 border-red-500/30";
  }
}
