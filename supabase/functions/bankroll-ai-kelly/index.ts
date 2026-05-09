import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface KellyInput {
  user_id: string;
  probability: number;   // 0-1 (estimated real probability)
  odd: number;            // decimal odd
  bankroll_source?: "horus" | "manual"; // which bankroll to use
  asset_score?: number;   // BAS score for dynamic adjustment
}

interface KellyOutput {
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
 * Bankroll AI — Kelly Criterion Engine
 * 
 * Features:
 * 1. Kelly 25% (fractional) for safety
 * 2. Dynamic drawdown protection (reduces stake on losing streaks)
 * 3. Asset Score modulation (higher BAS = allow closer to full Kelly fraction)
 * 4. Min/Max stake caps (1%-5% of bankroll)
 */

function calculateDrawdownReduction(currentBalance: number, initialBalance: number): number {
  if (initialBalance <= 0 || currentBalance >= initialBalance) return 0;
  
  const drawdownPct = ((initialBalance - currentBalance) / initialBalance) * 100;
  
  // Progressive reduction:
  // 0-10% drawdown = no reduction
  // 10-20% drawdown = 25% stake reduction
  // 20-30% drawdown = 50% stake reduction  
  // 30%+ drawdown = 75% stake reduction (survival mode)
  if (drawdownPct >= 30) return 0.75;
  if (drawdownPct >= 20) return 0.50;
  if (drawdownPct >= 10) return 0.25;
  return 0;
}

function getRiskLevel(stakePercent: number, drawdownReduction: number): KellyOutput["risk_level"] {
  if (drawdownReduction >= 0.50) return "EXTREME";
  if (stakePercent >= 4) return "HIGH";
  if (stakePercent >= 2.5) return "MEDIUM";
  return "LOW";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const input: KellyInput = await req.json();
    const { user_id, probability, odd, bankroll_source = "horus", asset_score } = input;

    // 1. Fetch bankroll
    const bankrollTable = bankroll_source === "manual" ? "manual_bankroll" : "sports_bankroll";
    const { data: bankrollData } = await supabase
      .from(bankrollTable)
      .select("balance, initial_balance")
      .eq("user_id", user_id)
      .maybeSingle();

    const balance = bankrollData?.balance || 0;
    const initialBalance = bankrollData?.initial_balance || balance;

    if (balance <= 0) {
      return new Response(
        JSON.stringify({ error: "No bankroll available", stake_amount: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Kelly Criterion: f* = (p*b - q) / b
    const p = probability;
    const q = 1 - p;
    const b = odd - 1;
    const fullKelly = b > 0 ? ((b * p - q) / b) * 100 : 0;
    const edge = (p * odd - 1) * 100;
    const ev = edge;

    // No edge = don't bet
    if (fullKelly <= 0) {
      return new Response(
        JSON.stringify({
          full_kelly: 0,
          fractional_kelly: 0,
          stake_percent: 0,
          stake_amount: 0,
          edge: Math.round(edge * 100) / 100,
          ev: Math.round(ev * 100) / 100,
          drawdown_adjusted: false,
          drawdown_reduction: 0,
          risk_level: "LOW",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fractional Kelly (25%)
    let fraction = 0.25;

    // 4. Asset Score modulation: ELITE bets get up to 35% Kelly
    if (asset_score) {
      if (asset_score >= 80) fraction = 0.35;      // ELITE
      else if (asset_score >= 70) fraction = 0.30;  // PREMIUM
      else if (asset_score >= 60) fraction = 0.25;  // STRONG
      else fraction = 0.20;                          // SPECULATIVE
    }

    let fractionalKelly = fullKelly * fraction;

    // 5. Drawdown protection
    const drawdownReduction = calculateDrawdownReduction(balance, initialBalance);
    const drawdownAdjusted = drawdownReduction > 0;
    
    if (drawdownAdjusted) {
      fractionalKelly = fractionalKelly * (1 - drawdownReduction);
    }

    // 6. Cap between 1% and 5%
    const minStake = 1;
    const maxStake = 5;
    const stakePercent = Math.min(maxStake, Math.max(minStake, fractionalKelly));
    const stakeAmount = Math.round(balance * (stakePercent / 100) * 100) / 100;

    const result: KellyOutput = {
      full_kelly: Math.round(fullKelly * 100) / 100,
      fractional_kelly: Math.round(fractionalKelly * 100) / 100,
      stake_percent: Math.round(stakePercent * 100) / 100,
      stake_amount: stakeAmount,
      edge: Math.round(edge * 100) / 100,
      ev: Math.round(ev * 100) / 100,
      drawdown_adjusted: drawdownAdjusted,
      drawdown_reduction: Math.round(drawdownReduction * 100),
      risk_level: getRiskLevel(stakePercent, drawdownReduction),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in bankroll-ai-kelly:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
