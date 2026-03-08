import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Ensemble Models Engine
 * 
 * Combines multiple probabilistic models into a weighted consensus:
 * 1. Poisson/Dixon-Coles (mathematical model)
 * 2. xG-based model (performance data)
 * 3. ELO rating model (historical strength)
 * 4. Market-implied model (bookmaker odds)
 * 
 * Weights are dynamically adjusted by the Self Learning Engine.
 */

interface EnsembleInput {
  match_id: string;
  home_team: string;
  away_team: string;
  market: string; // "home_win", "draw", "away_win", "over_2.5", etc.
  // Individual model probabilities
  poisson_prob?: number;
  xg_prob?: number;
  elo_prob?: number;
  market_prob?: number; // Implied from odds
  // Current bookmaker odd
  current_odd?: number;
  // Optional custom weights (from Self Learning)
  weights?: {
    poisson: number;
    xg: number;
    elo: number;
    market: number;
  };
}

interface ModelContribution {
  model: string;
  probability: number;
  weight: number;
  weighted_contribution: number;
  available: boolean;
}

interface EnsembleResult {
  match_id: string;
  market: string;
  ensemble_probability: number;
  fair_odd: number;
  edge?: number;
  confidence: number;
  model_agreement: number; // 0-100, how much models agree
  contributions: ModelContribution[];
  recommendation: "STRONG_VALUE" | "VALUE" | "MARGINAL" | "NO_VALUE" | "AGAINST";
}

// Default weights (can be overridden by Self Learning)
const DEFAULT_WEIGHTS = {
  poisson: 0.30,
  xg: 0.25,
  elo: 0.20,
  market: 0.25,
};

// Simple ELO-based probability estimation
function eloProbability(eloHome: number, eloAway: number, homeAdvantage: number = 65): number {
  const diff = eloHome - eloAway + homeAdvantage;
  return 1 / (1 + Math.pow(10, -diff / 400));
}

function calculateAgreement(probs: number[]): number {
  if (probs.length < 2) return 100;
  const mean = probs.reduce((a, b) => a + b, 0) / probs.length;
  const variance = probs.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / probs.length;
  const stdDev = Math.sqrt(variance);
  // High agreement = low std dev relative to mean
  const cv = mean > 0 ? stdDev / mean : 1;
  return Math.round(Math.max(0, Math.min(100, (1 - cv) * 100)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    // Support batch
    const inputs: EnsembleInput[] = body.batch || [body];
    const results: EnsembleResult[] = [];

    for (const input of inputs) {
      const weights = input.weights || DEFAULT_WEIGHTS;
      const contributions: ModelContribution[] = [];
      const availableProbs: number[] = [];

      // Collect available models
      const models = [
        { name: "Poisson/DC", prob: input.poisson_prob, weight: weights.poisson },
        { name: "xG Model", prob: input.xg_prob, weight: weights.xg },
        { name: "ELO Rating", prob: input.elo_prob, weight: weights.elo },
        { name: "Market Implied", prob: input.market_prob, weight: weights.market },
      ];

      let totalWeight = 0;
      let weightedSum = 0;

      for (const model of models) {
        const available = model.prob !== undefined && model.prob !== null && model.prob > 0;
        const prob = available ? model.prob! : 0;

        if (available) {
          totalWeight += model.weight;
          weightedSum += prob * model.weight;
          availableProbs.push(prob);
        }

        contributions.push({
          model: model.name,
          probability: Math.round(prob * 10000) / 100,
          weight: model.weight,
          weighted_contribution: available ? Math.round((prob * model.weight) * 10000) / 100 : 0,
          available,
        });
      }

      // Normalize ensemble probability
      const ensembleProb = totalWeight > 0 ? weightedSum / totalWeight : 0;
      const fairOdd = ensembleProb > 0.01 ? Math.round((1 / ensembleProb) * 100) / 100 : 99.99;

      // Calculate edge vs current odd
      let edge: number | undefined;
      if (input.current_odd && input.current_odd > 1) {
        const impliedProb = 1 / input.current_odd;
        edge = Math.round((ensembleProb - impliedProb) * 10000) / 100;
      }

      // Model agreement
      const agreement = calculateAgreement(availableProbs);

      // Confidence based on: number of models + agreement
      const modelCount = availableProbs.length;
      const modelBonus = modelCount >= 4 ? 20 : modelCount >= 3 ? 10 : modelCount >= 2 ? 5 : 0;
      const confidence = Math.min(100, Math.round(agreement * 0.7 + modelBonus + ensembleProb * 20));

      // Recommendation
      let recommendation: EnsembleResult["recommendation"];
      if (edge !== undefined) {
        if (edge > 8 && agreement > 70) recommendation = "STRONG_VALUE";
        else if (edge > 4) recommendation = "VALUE";
        else if (edge > 0) recommendation = "MARGINAL";
        else if (edge > -5) recommendation = "NO_VALUE";
        else recommendation = "AGAINST";
      } else {
        recommendation = "NO_VALUE";
      }

      results.push({
        match_id: input.match_id,
        market: input.market,
        ensemble_probability: Math.round(ensembleProb * 10000) / 100,
        fair_odd: fairOdd,
        edge,
        confidence,
        model_agreement: agreement,
        contributions,
        recommendation,
      });
    }

    const response = inputs.length === 1
      ? results[0]
      : { results, total: results.length };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Ensemble engine error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
