import { supabase } from "@/integrations/supabase/client";

export interface AntiLimitInput {
  original_stake: number;
  market: string;
  odd: number;
  bookmaker: string;
  asset_score?: number;
  recent_bets_count_24h?: number;
  recent_bets_same_bookmaker?: number;
  recent_avg_stake?: number;
  bookmakers_available?: string[];
  max_delay_minutes?: number;
}

export interface AntiLimitResult {
  delay: {
    min_delay_seconds: number;
    max_delay_seconds: number;
    recommended_delay_seconds: number;
    reason: string;
  };
  stake: {
    original_stake: number;
    adjusted_stake: number;
    noise_range: [number, number];
    round_to: number;
    reason: string;
  };
  diversification: {
    primary_bookmaker: string;
    alternative_bookmakers: string[];
    mug_bet_suggestion?: { market: string; type: string; reason: string };
    bet_frequency_advice: string;
  };
  risk_profile: {
    limiting_risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    risk_score: number;
    risk_factors: string[];
    recommendations: string[];
  };
  stealth_score: number;
}

export const antiLimitingService = {
  async analyze(input: AntiLimitInput): Promise<AntiLimitResult> {
    const { data, error } = await supabase.functions.invoke("anti-limiting-engine", {
      body: input,
    });
    if (error) throw error;
    return data as AntiLimitResult;
  },

  getRiskColor(level: string): string {
    switch (level) {
      case "CRITICAL": return "text-red-500";
      case "HIGH": return "text-red-400";
      case "MEDIUM": return "text-yellow-400";
      case "LOW": return "text-green-400";
      default: return "text-muted-foreground";
    }
  },

  getStealthColor(score: number): string {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  },
};
