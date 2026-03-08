import { supabase } from "@/integrations/supabase/client";

export interface EnsembleInput {
  match_id: string;
  home_team: string;
  away_team: string;
  market: string;
  poisson_prob?: number;
  xg_prob?: number;
  elo_prob?: number;
  market_prob?: number;
  current_odd?: number;
  weights?: { poisson: number; xg: number; elo: number; market: number };
}

export interface ModelContribution {
  model: string;
  probability: number;
  weight: number;
  weighted_contribution: number;
  available: boolean;
}

export interface EnsembleResult {
  match_id: string;
  market: string;
  ensemble_probability: number;
  fair_odd: number;
  edge?: number;
  confidence: number;
  model_agreement: number;
  contributions: ModelContribution[];
  recommendation: "STRONG_VALUE" | "VALUE" | "MARGINAL" | "NO_VALUE" | "AGAINST";
}

export const ensembleService = {
  async calculate(input: EnsembleInput): Promise<EnsembleResult> {
    const { data, error } = await supabase.functions.invoke("ensemble-models", {
      body: input,
    });
    if (error) throw error;
    return data as EnsembleResult;
  },

  async calculateBatch(inputs: EnsembleInput[]): Promise<EnsembleResult[]> {
    const { data, error } = await supabase.functions.invoke("ensemble-models", {
      body: { batch: inputs },
    });
    if (error) throw error;
    return data.results || [data];
  },

  getRecommendationColor(rec: string): string {
    switch (rec) {
      case "STRONG_VALUE": return "text-green-400";
      case "VALUE": return "text-emerald-400";
      case "MARGINAL": return "text-yellow-400";
      case "NO_VALUE": return "text-muted-foreground";
      case "AGAINST": return "text-red-400";
      default: return "text-muted-foreground";
    }
  },

  getRecommendationBadge(rec: string): string {
    switch (rec) {
      case "STRONG_VALUE": return "🔥 Valor Forte";
      case "VALUE": return "✅ Valor";
      case "MARGINAL": return "⚠️ Marginal";
      case "NO_VALUE": return "➖ Sem Valor";
      case "AGAINST": return "❌ Contra";
      default: return "—";
    }
  },
};
