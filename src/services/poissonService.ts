import { supabase } from "@/integrations/supabase/client";

export interface PoissonInput {
  home_team: string;
  away_team: string;
  league?: string;
  home_xg?: number;
  away_xg?: number;
  home_goals_avg?: number;
  away_goals_avg?: number;
  home_goals_conceded_avg?: number;
  away_goals_conceded_avg?: number;
  league_avg_goals?: number;
  rho?: number;
}

export interface ScoreProb {
  home: number;
  away: number;
  probability: number;
}

export interface MarketProb {
  market: string;
  probability: number;
  fair_odd: number;
}

export interface PoissonResult {
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

export const poissonService = {
  async calculate(input: PoissonInput): Promise<PoissonResult> {
    const { data, error } = await supabase.functions.invoke("poisson-dixon-coles", {
      body: input,
    });
    if (error) throw error;
    return data as PoissonResult;
  },
};
