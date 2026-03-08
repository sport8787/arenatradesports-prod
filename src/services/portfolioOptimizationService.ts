import { supabase } from "@/integrations/supabase/client";

export interface PortfolioAdjustment {
  bet_id: string;
  match_id: string;
  market: string;
  original_stake: number;
  adjusted_stake: number;
  reduction_pct: number;
  reason: string;
  correlation: number;
}

export interface PortfolioAnalysis {
  total_bets: number;
  total_stake: number;
  exposure_pct: number;
  risk_level: "none" | "low" | "medium" | "high";
  risk_score: number;
  diversification_score: number;
  unique_matches: number;
  unique_leagues: number;
  unique_markets?: number;
  avg_clv?: number;
  max_stake_pct?: number;
  global_reduction_pct: number;
  adjustments: PortfolioAdjustment[];
  recommendations: string[];
}

export const portfolioOptimizationService = {
  async analyze(userId: string, bankroll?: number, activeBets?: any[]): Promise<PortfolioAnalysis> {
    const { data, error } = await supabase.functions.invoke("portfolio-optimization", {
      body: { user_id: userId, bankroll, active_bets: activeBets },
    });
    if (error) throw error;
    return data.portfolio;
  },

  getRiskColor(level: string): string {
    switch (level) {
      case "high": return "text-red-400";
      case "medium": return "text-yellow-400";
      case "low": return "text-green-400";
      default: return "text-muted-foreground";
    }
  },

  getRiskBadge(level: string): string {
    switch (level) {
      case "high": return "🔴 Alto Risco";
      case "medium": return "🟡 Risco Moderado";
      case "low": return "🟢 Risco Baixo";
      default: return "⚪ Sem Exposição";
    }
  },
};
