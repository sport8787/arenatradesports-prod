import { supabase } from "@/integrations/supabase/client";

export interface LearningAnalysis {
  status: "analysis_complete" | "recalibrated" | "insufficient_data";
  total_bets: number;
  current_weights: Record<string, number>;
  new_weights?: Record<string, number>;
  changes?: Record<string, { old: number; new: number; reason: string }>;
  message?: string;
  analysis?: {
    by_tier: Array<{
      tier: string;
      total: number;
      wins: number;
      win_rate: number;
      roi: number;
      avg_odd: number;
      avg_score: number;
    }>;
    by_market: Array<{ name: string; total: number; win_rate: number; roi: number }>;
    by_league?: Array<{ name: string; total: number; win_rate: number; roi: number }>;
    by_odd_range?: Array<{ range: string; total: number; win_rate: number; roi: number }>;
    clv_correlation: any;
    edge_accuracy: any;
  };
}

export const selfLearningService = {
  async analyze(userId: string): Promise<LearningAnalysis> {
    const { data, error } = await supabase.functions.invoke("self-learning-engine", {
      body: { user_id: userId, mode: "analyze" },
    });
    if (error) throw error;
    return data;
  },

  async recalibrate(userId: string): Promise<LearningAnalysis> {
    const { data, error } = await supabase.functions.invoke("self-learning-engine", {
      body: { user_id: userId, mode: "recalibrate" },
    });
    if (error) throw error;
    return data;
  },
};
