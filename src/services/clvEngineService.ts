import { supabase } from "@/integrations/supabase/client";

export interface CLVResult {
  clv_percentage: number;
  clv_signal: "strong_positive" | "positive" | "neutral" | "negative" | "strong_negative";
  implied_prob_entry: number;
  implied_prob_close: number;
  edge_at_entry?: number;
}

export interface CLVSummary {
  total_bets: number;
  avg_clv: number;
  positive_clv_rate: number;
  market_beat_rate: number;
}

export interface CLVReport {
  success: boolean;
  summary: CLVSummary;
  by_market?: Array<{
    market: string;
    avg_clv: number;
    positive_rate: number;
    sample_size: number;
  }>;
  clv_accuracy?: {
    positive_clv_win_rate: number;
    negative_clv_win_rate: number;
  } | null;
  details?: CLVResult[];
}

export const clvEngineService = {
  async calculateForUser(userId: string): Promise<CLVReport> {
    const { data, error } = await supabase.functions.invoke("clv-engine", {
      body: { user_id: userId },
    });
    if (error) throw error;
    return data;
  },

  async calculateForBet(betId: string): Promise<CLVResult> {
    const { data, error } = await supabase.functions.invoke("clv-engine", {
      body: { bet_id: betId },
    });
    if (error) throw error;
    return data.clv;
  },

  async calculateForMatch(matchId: string): Promise<any[]> {
    const { data, error } = await supabase.functions.invoke("clv-engine", {
      body: { match_id: matchId },
    });
    if (error) throw error;
    return data.match_clv;
  },

  getSignalColor(signal: string): string {
    switch (signal) {
      case "strong_positive": return "text-green-400";
      case "positive": return "text-green-300";
      case "neutral": return "text-muted-foreground";
      case "negative": return "text-red-300";
      case "strong_negative": return "text-red-400";
      default: return "text-muted-foreground";
    }
  },

  getSignalLabel(signal: string): string {
    switch (signal) {
      case "strong_positive": return "Bateu o Mercado 🔥";
      case "positive": return "CLV Positivo ✅";
      case "neutral": return "Neutro ➖";
      case "negative": return "CLV Negativo ⚠️";
      case "strong_negative": return "Abaixo do Mercado ❌";
      default: return "N/A";
    }
  },
};
